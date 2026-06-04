import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { staffMembers } from '#/db/schema'
import { auth } from './auth'
import { logActivity } from './activity'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listStaff = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtxWithPermission(request.headers, 'staff')
  return db
    .select({
      id: staffMembers.id,
      name: staffMembers.name,
      email: staffMembers.email,
      role: staffMembers.role,
      isActive: staffMembers.isActive,
      createdAt: staffMembers.createdAt,
    })
    .from(staffMembers)
    .where(eq(staffMembers.shopId, shopId))
    .orderBy(staffMembers.name)
})

export const addStaff = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.enum(['manager', 'cashier']),
      password: z.string().min(8),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'staff')
    const { shopId } = ctx

    const newUser = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
      headers: request.headers,
    })

    const [staff] = await db
      .insert(staffMembers)
      .values({
        id: nanoid(),
        shopId,
        userId: newUser.user.id,
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: true,
      })
      .returning()

    await logActivity(db, {
      shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'staff.added',
      entityType: 'staff',
      entityId: staff.id,
      description: `Added ${data.role} ${data.name}`,
    })

    return staff
  })

export const updateStaffStatus = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), isActive: z.boolean() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'staff')
    const { shopId } = ctx
    const [updated] = await db
      .update(staffMembers)
      .set({ isActive: data.isActive })
      .where(and(eq(staffMembers.id, data.id), eq(staffMembers.shopId, shopId)))
      .returning({ name: staffMembers.name })

    await logActivity(db, {
      shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: data.isActive ? 'staff.reactivated' : 'staff.suspended',
      entityType: 'staff',
      entityId: data.id,
      description: `${data.isActive ? 'Reactivated' : 'Suspended'} ${updated?.name ?? 'staff member'}`,
    })
  })
