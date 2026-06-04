import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { cashReconciliations, sales, shops, staffMembers } from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

// Cash expected in the drawer today = sum of completed cash-sale totals
// (the shop keeps the total; change is returned, so amountPaid isn't used).
async function expectedCashToday(shopId: string): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmount}), 0)` })
    .from(sales)
    .where(
      and(
        eq(sales.shopId, shopId),
        eq(sales.paymentMethod, 'cash'),
        eq(sales.status, 'completed'),
        gte(sales.createdAt, start),
        lte(sales.createdAt, end),
      ),
    )
  return Number(row?.total ?? 0)
}

export const getCashSummary = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtxWithPermission(request.headers, 'cash')

  const [shop] = await db
    .select({ currency: shops.currency })
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1)

  const expected = await expectedCashToday(shopId)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const [lastToday] = await db
    .select({ createdAt: cashReconciliations.createdAt })
    .from(cashReconciliations)
    .where(
      and(
        eq(cashReconciliations.shopId, shopId),
        gte(cashReconciliations.createdAt, todayStart),
      ),
    )
    .orderBy(desc(cashReconciliations.createdAt))
    .limit(1)

  return { expected, currency: shop?.currency ?? 'GHS', reconciledToday: !!lastToday }
})

export const listReconciliations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'cash')
    return db
      .select({
        id: cashReconciliations.id,
        expectedCash: cashReconciliations.expectedCash,
        countedCash: cashReconciliations.countedCash,
        variance: cashReconciliations.variance,
        note: cashReconciliations.note,
        createdAt: cashReconciliations.createdAt,
        actorName: cashReconciliations.actorName,
        staffName: staffMembers.name,
      })
      .from(cashReconciliations)
      .leftJoin(staffMembers, eq(cashReconciliations.staffId, staffMembers.id))
      .where(eq(cashReconciliations.shopId, shopId))
      .orderBy(desc(cashReconciliations.createdAt))
      .limit(50)
  },
)

export const createReconciliation = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ countedCash: z.string(), note: z.string().optional() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'cash')
    const { shopId } = ctx

    // Recompute expected server-side — never trust a client total
    const expected = await expectedCashToday(shopId)
    const counted = Number(data.countedCash)
    if (isNaN(counted) || counted < 0) throw new Error('Invalid counted amount')
    const variance = counted - expected

    const id = nanoid()
    await db.insert(cashReconciliations).values({
      id,
      shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      expectedCash: expected.toFixed(2),
      countedCash: counted.toFixed(2),
      variance: variance.toFixed(2),
      note: data.note,
    })

    await logActivity(db, {
      shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'cash.reconciled',
      entityType: 'cash',
      entityId: id,
      description: `Cash count: counted ${counted.toFixed(2)} vs expected ${expected.toFixed(2)} (variance ${variance >= 0 ? '+' : ''}${variance.toFixed(2)})`,
    })

    return { expected: expected.toFixed(2), counted: counted.toFixed(2), variance: variance.toFixed(2) }
  })
