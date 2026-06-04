import { and, eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { shops, staffMembers } from '#/db/schema'
import { auth } from './auth'
import { requireRole } from './permissions'
import type { Resource, StaffRole } from './permissions'

export interface ShopContext {
  shopId: string
  role: StaffRole
  staffId: string | undefined
  userId: string
}

export async function getShopCtxForUser(userId: string): Promise<ShopContext> {
  const [ownedShop] = await db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.ownerId, userId))
    .limit(1)

  if (ownedShop) {
    const [ownerStaff] = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.shopId, ownedShop.id),
          eq(staffMembers.userId, userId),
        ),
      )
      .limit(1)
    return {
      shopId: ownedShop.id,
      role: 'owner',
      staffId: ownerStaff?.id,
      userId,
    }
  }

  const [staff] = await db
    .select({
      shopId: staffMembers.shopId,
      role: staffMembers.role,
      id: staffMembers.id,
    })
    .from(staffMembers)
    .where(
      and(eq(staffMembers.userId, userId), eq(staffMembers.isActive, true)),
    )
    .limit(1)

  if (!staff) throw new Error('No shop found')

  return {
    shopId: staff.shopId,
    role: staff.role as StaffRole,
    staffId: staff.id,
    userId,
  }
}

export async function getShopCtx(headers: Headers): Promise<ShopContext> {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error('Not authenticated')
  return getShopCtxForUser(session.user.id)
}

export async function getShopCtxWithPermission(
  headers: Headers,
  resource: Resource,
): Promise<ShopContext> {
  const ctx = await getShopCtx(headers)
  requireRole(ctx.role, resource)
  return ctx
}
