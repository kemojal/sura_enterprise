import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { desc, sql } from 'drizzle-orm'

import { db } from '#/db/index'
import { products, purchaseOrders, shops, suppliers } from '#/db/schema'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listSuppliers = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
  return db.select().from(suppliers).where(eq(suppliers.shopId, shopId)).orderBy(suppliers.name)
})

export const getSupplier = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, data.id), eq(suppliers.shopId, shopId)))
      .limit(1)
    if (!supplier) throw new Error('Supplier not found')
    const supplierProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.supplierId, supplier.id), eq(products.shopId, shopId)))

    const [shop] = await db
      .select({ currency: shops.currency })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    // Purchase orders for this supplier
    const pos = await db
      .select({
        id: purchaseOrders.id,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        amountPaid: purchaseOrders.amountPaid,
        createdAt: purchaseOrders.createdAt,
        receivedAt: purchaseOrders.receivedAt,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.supplierId, supplier.id),
          eq(purchaseOrders.shopId, shopId),
        ),
      )
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(100)

    // Statement totals exclude cancelled orders
    const [agg] = await db
      .select({
        totalOrdered: sql<string>`coalesce(sum(case when ${purchaseOrders.status} != 'cancelled' then ${purchaseOrders.totalAmount} else 0 end), 0)`,
        totalPaid: sql<string>`coalesce(sum(case when ${purchaseOrders.status} != 'cancelled' then ${purchaseOrders.amountPaid} else 0 end), 0)`,
        orderCount: sql<number>`cast(count(*) as int)`,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.supplierId, supplier.id),
          eq(purchaseOrders.shopId, shopId),
        ),
      )

    const totalOrdered = Number(agg?.totalOrdered ?? 0)
    const totalPaid = Number(agg?.totalPaid ?? 0)

    return {
      supplier,
      products: supplierProducts,
      pos,
      currency: shop?.currency ?? 'GHS',
      stats: {
        totalOrdered,
        totalPaid,
        outstanding: totalOrdered - totalPaid,
        orderCount: agg?.orderCount ?? 0,
      },
    }
  })

const supplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export const createSupplier = createServerFn({ method: 'POST' })
  .inputValidator(supplierSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
    const [supplier] = await db
      .insert(suppliers)
      .values({ id: nanoid(), shopId, ...data })
      .returning()
    return supplier
  })

export const updateSupplier = createServerFn({ method: 'POST' })
  .inputValidator(supplierSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
    const { id, ...rest } = data
    const [supplier] = await db
      .update(suppliers)
      .set(rest)
      .where(and(eq(suppliers.id, id), eq(suppliers.shopId, shopId)))
      .returning()
    return supplier
  })
