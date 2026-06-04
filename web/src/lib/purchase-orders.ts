import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import {
  products,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from '#/db/schema'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listPurchaseOrders = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'purchase_orders')
    return db
      .select({
        id: purchaseOrders.id,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        amountPaid: purchaseOrders.amountPaid,
        createdAt: purchaseOrders.createdAt,
        receivedAt: purchaseOrders.receivedAt,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.shopId, shopId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(100)
  },
)

export const getPurchaseOrder = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'purchase_orders')

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        amountPaid: purchaseOrders.amountPaid,
        notes: purchaseOrders.notes,
        createdAt: purchaseOrders.createdAt,
        receivedAt: purchaseOrders.receivedAt,
        supplierName: suppliers.name,
        supplierId: purchaseOrders.supplierId,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(eq(purchaseOrders.id, data.id), eq(purchaseOrders.shopId, shopId)))
      .limit(1)
    if (!po) throw new Error('Purchase order not found')

    const items = await db
      .select({
        id: purchaseOrderItems.id,
        productId: purchaseOrderItems.productId,
        productName: products.name,
        quantity: purchaseOrderItems.quantity,
        unitCost: purchaseOrderItems.unitCost,
        subtotal: purchaseOrderItems.subtotal,
      })
      .from(purchaseOrderItems)
      .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(eq(purchaseOrderItems.poId, po.id))

    return { po, items }
  })

export const createPurchaseOrder = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      supplierId: z.string().optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().min(1),
            unitCost: z.string(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId, staffId } = await getShopCtxWithPermission(
      request.headers,
      'purchase_orders',
    )

    const totalAmount = data.items
      .reduce((sum, i) => sum + Number(i.unitCost) * i.quantity, 0)
      .toFixed(2)

    const poId = nanoid()
    await db.insert(purchaseOrders).values({
      id: poId,
      shopId,
      supplierId: data.supplierId || undefined,
      staffId,
      status: 'ordered',
      totalAmount,
      notes: data.notes,
    })

    for (const item of data.items) {
      await db.insert(purchaseOrderItems).values({
        id: nanoid(),
        poId,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        subtotal: (Number(item.unitCost) * item.quantity).toFixed(2),
      })
    }

    return { id: poId }
  })

// Receive a PO: add ordered quantities to product stock, mark received
export const receivePurchaseOrder = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'purchase_orders')

    return db.transaction(async (tx) => {
      const [po] = await tx
        .select()
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, data.id), eq(purchaseOrders.shopId, shopId)))
        .limit(1)
      if (!po) throw new Error('Purchase order not found')
      if (po.status === 'received') throw new Error('Already received')
      if (po.status === 'cancelled') throw new Error('Order was cancelled')

      const items = await tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.poId, po.id))

      for (const item of items) {
        if (item.productId) {
          await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} + ${item.quantity}` })
            .where(eq(products.id, item.productId))
        }
      }

      await tx
        .update(purchaseOrders)
        .set({ status: 'received', receivedAt: new Date() })
        .where(eq(purchaseOrders.id, po.id))

      return { received: items.length }
    })
  })

export const recordPoPayment = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), amount: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'purchase_orders')

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, data.id), eq(purchaseOrders.shopId, shopId)))
      .limit(1)
    if (!po) throw new Error('Purchase order not found')

    const newPaid = Math.min(
      Number(po.totalAmount),
      Number(po.amountPaid) + Number(data.amount),
    ).toFixed(2)

    await db
      .update(purchaseOrders)
      .set({ amountPaid: newPaid })
      .where(eq(purchaseOrders.id, po.id))

    return { amountPaid: newPaid }
  })

export const cancelPurchaseOrder = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'purchase_orders')
    const [po] = await db
      .select({ status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, data.id), eq(purchaseOrders.shopId, shopId)))
      .limit(1)
    if (!po) throw new Error('Purchase order not found')
    if (po.status === 'received') throw new Error('Cannot cancel a received order')
    await db
      .update(purchaseOrders)
      .set({ status: 'cancelled' })
      .where(eq(purchaseOrders.id, data.id))
  })
