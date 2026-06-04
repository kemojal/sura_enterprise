import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { shops, staffMembers } from '#/db/schema'
import { auth } from './auth'
import { getShopCtxForUser, getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const getAppContext = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return null

    try {
      const ctx = await getShopCtxForUser(session.user.id)
      const [shop] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, ctx.shopId))
        .limit(1)
      return {
        session,
        shop: shop ?? null,
        role: ctx.role,
        staffId: ctx.staffId,
      }
    } catch {
      return {
        session,
        shop: null,
        role: 'cashier' as const,
        staffId: undefined,
      }
    }
  },
)

export const getShopSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'settings')
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)
    if (!shop) throw new Error('Shop not found')
    return shop
  },
)

export const updateShop = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      phone: z.string().optional(),
      currency: z.string().min(1),
      logoUrl: z.string().optional(),
      receiptFooter: z.string().optional(),
      taxRate: z.string().optional(),
      taxInclusive: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'settings')
    const [shop] = await db
      .update(shops)
      .set({
        name: data.name,
        address: data.address,
        phone: data.phone,
        currency: data.currency,
        logoUrl: data.logoUrl ?? null,
        receiptFooter: data.receiptFooter ?? null,
        taxRate: data.taxRate ?? '0',
        taxInclusive: data.taxInclusive ?? true,
      })
      .where(eq(shops.id, shopId))
      .returning()
    return shop
  })

const createShopSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  currency: z.string().default('GHS'),
})

export const createShop = createServerFn({ method: 'POST' })
  .inputValidator(createShopSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) throw new Error('Not authenticated')

    const shopId = nanoid()
    const [shop] = await db
      .insert(shops)
      .values({ id: shopId, ownerId: session.user.id, ...data })
      .returning()

    await db.insert(staffMembers).values({
      id: nanoid(),
      shopId,
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: 'owner',
      isActive: true,
    })

    return shop
  })
