import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { sales, shifts, shops, staffMembers } from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtx, getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

// The current cashier's staffId, resolved within the active shop.
async function cashierStaffId(shopId: string, userId: string) {
  const [row] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(and(eq(staffMembers.shopId, shopId), eq(staffMembers.userId, userId)))
    .limit(1)
  return row?.id
}

// Aggregate the cash a shift is responsible for: float + completed cash sales.
async function shiftCashSummary(shiftId: string) {
  const [agg] = await db
    .select({
      txns: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      cash: sql<string>`coalesce(sum(${sales.totalAmount}) filter (where ${sales.paymentMethod} = 'cash'), 0)`,
    })
    .from(sales)
    .where(and(eq(sales.shiftId, shiftId), eq(sales.status, 'completed')))
  return {
    txns: Number(agg?.txns ?? 0),
    total: Number(agg?.total ?? 0),
    cash: Number(agg?.cash ?? 0),
  }
}

// The signed-in cashier's currently open shift (null if none).
export const getMyOpenShift = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId, userId } = await getShopCtxWithPermission(
      request.headers,
      'sales',
    )
    const staffId = await cashierStaffId(shopId, userId)
    if (!staffId) return null

    const [shift] = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.shopId, shopId),
          eq(shifts.cashierId, staffId),
          eq(shifts.status, 'open'),
        ),
      )
      .limit(1)
    if (!shift) return null

    const summary = await shiftCashSummary(shift.id)
    return { shift, summary }
  },
)

export const openShift = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ openingFloat: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'sales')
    const { shopId, userId, userName } = ctx
    const staffId = await cashierStaffId(shopId, userId)
    if (!staffId) throw new Error('No staff record for this user')

    const [existing] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.shopId, shopId),
          eq(shifts.cashierId, staffId),
          eq(shifts.status, 'open'),
        ),
      )
      .limit(1)
    if (existing) throw new Error('You already have an open shift')

    const id = nanoid()
    await db.insert(shifts).values({
      id,
      shopId,
      cashierId: staffId,
      cashierName: userName ?? null,
      status: 'open',
      openingFloat: Number(data.openingFloat || 0).toFixed(2),
    })

    await logActivity(db, {
      shopId,
      staffId,
      actorName: userName,
      action: 'shift.opened',
      entityType: 'shift',
      entityId: id,
      description: `Opened shift with float ${Number(data.openingFloat || 0).toFixed(2)}`,
    })

    return { id }
  })

export const closeShift = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      countedCash: z.string(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtx(request.headers)
    const { shopId, userName } = ctx

    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, data.id), eq(shifts.shopId, shopId)))
      .limit(1)
    if (!shift) throw new Error('Shift not found')
    if (shift.status === 'closed') throw new Error('Shift already closed')

    const summary = await shiftCashSummary(shift.id)
    const expected = Number(shift.openingFloat) + summary.cash
    const counted = Number(data.countedCash || 0)
    const variance = counted - expected

    await db
      .update(shifts)
      .set({
        status: 'closed',
        expectedCash: expected.toFixed(2),
        countedCash: counted.toFixed(2),
        variance: variance.toFixed(2),
        notes: data.notes,
        closedAt: new Date(),
      })
      .where(eq(shifts.id, shift.id))

    await logActivity(db, {
      shopId,
      staffId: shift.cashierId ?? undefined,
      actorName: userName,
      action: 'shift.closed',
      entityType: 'shift',
      entityId: shift.id,
      description: `Closed shift — expected ${expected.toFixed(2)}, counted ${counted.toFixed(2)}, variance ${variance.toFixed(2)}`,
    })

    return { id: shift.id, variance: variance.toFixed(2) }
  })

export const listShifts = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtxWithPermission(request.headers, 'sales')
  return db
    .select()
    .from(shifts)
    .where(eq(shifts.shopId, shopId))
    .orderBy(desc(shifts.openedAt))
    .limit(100)
})

// Full Z-report for one shift: header + live cash summary + shop info.
export const getShiftReport = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'sales')

    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, data.id), eq(shifts.shopId, shopId)))
      .limit(1)
    if (!shift) throw new Error('Shift not found')

    const summary = await shiftCashSummary(shift.id)
    const expected = Number(shift.openingFloat) + summary.cash

    const [shop] = await db
      .select({ name: shops.name, address: shops.address, currency: shops.currency })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    return { shift, summary, expectedCash: expected, shop }
  })
