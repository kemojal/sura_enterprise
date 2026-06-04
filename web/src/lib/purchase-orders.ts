import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import {
  categories,
  products,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

// Products at or below their low-stock threshold, with a suggested reorder
// quantity that tops stock up to 2× the threshold.
export const getReorderSuggestions = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'purchase_orders')
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        stockQty: products.stockQty,
        lowStockThreshold: products.lowStockThreshold,
        buyingPrice: products.buyingPrice,
        supplierId: products.supplierId,
        supplierName: suppliers.name,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.isActive, true),
          sql`${products.stockQty} <= ${products.lowStockThreshold}`,
        ),
      )
      .orderBy(products.stockQty)

    return rows.map((p) => ({
      ...p,
      suggestedQty: Math.max(p.lowStockThreshold * 2 - p.stockQty, 1),
    }))
  },
)

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
    const ctx = await getShopCtxWithPermission(request.headers, 'purchase_orders')
    const { shopId, staffId } = ctx

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

    await logActivity(db, {
      shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'po.created',
      entityType: 'purchase_order',
      entityId: poId,
      description: `Created purchase order — ${totalAmount} (${data.items.length} item${data.items.length === 1 ? '' : 's'})`,
    })

    return { id: poId }
  })

// Receive a PO: add ordered quantities to product stock, mark received
export const receivePurchaseOrder = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'purchase_orders')
    const { shopId } = ctx

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

      await logActivity(tx, {
        shopId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        action: 'po.received',
        entityType: 'purchase_order',
        entityId: po.id,
        description: `Received purchase order — restocked ${items.length} product${items.length === 1 ? '' : 's'}`,
      })

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
