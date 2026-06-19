import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { customers, heldSales } from '#/db/schema'
import { getShopCtx } from './context'
import type { ShopContext } from './context'
import { nanoid } from './nanoid'

const heldItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  unitPrice: z.string(),
  quantity: z.number().int().min(1),
})

export async function _listHeldSalesCore(ctx: ShopContext) {
  return db
    .select({
      id: heldSales.id,
      label: heldSales.label,
      itemCount: heldSales.itemCount,
      total: heldSales.total,
      createdAt: heldSales.createdAt,
      customerName: customers.name,
    })
    .from(heldSales)
    .leftJoin(customers, eq(heldSales.customerId, customers.id))
    .where(eq(heldSales.shopId, ctx.shopId))
    .orderBy(desc(heldSales.createdAt))
    .limit(50)
}

export const listHeldSales = createServerFn({ method: 'GET' }).handler(
  async () => _listHeldSalesCore(await getShopCtx(getRequest().headers)),
)

export const holdSale = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      items: z.array(heldItemSchema).min(1),
      customerId: z.string().optional(),
      label: z.string().optional(),
      discountType: z.enum(['amount', 'percent']).optional(),
      discountValue: z.string().optional(),
      total: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId, staffId } = await getShopCtx(request.headers)
    const id = nanoid()
    await db.insert(heldSales).values({
      id,
      shopId,
      staffId,
      customerId: data.customerId || undefined,
      label: data.label || undefined,
      itemsJson: JSON.stringify(data.items),
      discountType: data.discountType,
      discountValue: data.discountValue,
      itemCount: data.items.reduce((n, i) => n + i.quantity, 0),
      total: data.total,
    })
    return { id }
  })

export const getHeldSale = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)
    const [held] = await db
      .select()
      .from(heldSales)
      .where(and(eq(heldSales.id, data.id), eq(heldSales.shopId, shopId)))
      .limit(1)
    if (!held) throw new Error('Held sale not found')
    return {
      id: held.id,
      customerId: held.customerId,
      discountType: held.discountType,
      discountValue: held.discountValue,
      items: JSON.parse(held.itemsJson) as z.infer<typeof heldItemSchema>[],
    }
  })

export const deleteHeldSale = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)
    await db
      .delete(heldSales)
      .where(and(eq(heldSales.id, data.id), eq(heldSales.shopId, shopId)))
  })
