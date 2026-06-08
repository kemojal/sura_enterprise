import { and, asc, eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { branches, shops, staffMembers } from '#/db/schema'
import { auth } from './auth'
import { requireRole } from './permissions'
import type { Resource, StaffRole } from './permissions'

export interface ShopContext {
  shopId: string
  role: StaffRole
  staffId: string | undefined
  userId: string
  userName?: string
  branchId?: string
  branchName?: string
}

const BRANCH_COOKIE = 'sf_branch'

function readCookie(headers: Headers, name: string): string | undefined {
  const raw = headers.get('cookie')
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

// Resolve the active branch for a request: the cookie-selected branch if it
// belongs to this shop and is active, otherwise the main branch (or the first).
async function resolveBranch(shopId: string, headers: Headers) {
  const list = await db
    .select({ id: branches.id, name: branches.name, isMain: branches.isMain })
    .from(branches)
    .where(and(eq(branches.shopId, shopId), eq(branches.isActive, true)))
    .orderBy(asc(branches.createdAt))
  if (list.length === 0) return { branchId: undefined, branchName: undefined }

  const wanted = readCookie(headers, BRANCH_COOKIE)
  const picked =
    list.find((b) => b.id === wanted) ??
    list.find((b) => b.isMain) ??
    list[0]
  return { branchId: picked.id, branchName: picked.name }
}

export async function getShopCtxForUser(
  userId: string,
  userName?: string,
): Promise<ShopContext> {
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
      userName,
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
    userName,
  }
}

export async function getShopCtx(headers: Headers): Promise<ShopContext> {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error('Not authenticated')
  const ctx = await getShopCtxForUser(session.user.id, session.user.name)
  const branch = await resolveBranch(ctx.shopId, headers)
  return { ...ctx, ...branch }
}

export async function getShopCtxWithPermission(
  headers: Headers,
  resource: Resource,
): Promise<ShopContext> {
  const ctx = await getShopCtx(headers)
  requireRole(ctx.role, resource)
  return ctx
}
