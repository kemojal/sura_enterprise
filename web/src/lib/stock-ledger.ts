import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import {
  products,
  purchaseOrderItems,
  purchaseOrders,
  saleItems,
  saleReturnItems,
  saleReturns,
  sales,
  stockAdjustments,
} from '#/db/schema'
import { getShopCtxWithPermission } from './context'

interface Movement {
  kind: string
  label: string
  delta: number
  note: string | null
  createdAt: Date
}

const adjLabel: Record<string, string> = {
  restock: 'Restock',
  write_off: 'Write-off',
  correction: 'Correction',
  initial_count: 'Initial count',
}

export const getStockLedger = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')

    const [product] = await db
      .select({ id: products.id, name: products.name, stockQty: products.stockQty })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.shopId, shopId)))
      .limit(1)
    if (!product) throw new Error('Product not found')

    const [adjustments, soldItems, returnedItems, received] = await Promise.all([
      // Manual adjustments + stocktakes (delta already signed)
      db
        .select({
          type: stockAdjustments.type,
          quantity: stockAdjustments.quantity,
          note: stockAdjustments.note,
          createdAt: stockAdjustments.createdAt,
        })
        .from(stockAdjustments)
        .where(
          and(
            eq(stockAdjustments.productId, data.productId),
            eq(stockAdjustments.shopId, shopId),
          ),
        ),
      // Sales (decrease)
      db
        .select({ quantity: saleItems.quantity, createdAt: sales.createdAt })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(and(eq(saleItems.productId, data.productId), eq(sales.shopId, shopId))),
      // Returns (increase)
      db
        .select({
          quantity: saleReturnItems.quantity,
          createdAt: saleReturns.createdAt,
        })
        .from(saleReturnItems)
        .innerJoin(saleReturns, eq(saleReturnItems.returnId, saleReturns.id))
        .where(
          and(
            eq(saleReturnItems.productId, data.productId),
            eq(saleReturns.shopId, shopId),
          ),
        ),
      // PO receipts (increase) — only received orders, at receivedAt
      db
        .select({
          quantity: purchaseOrderItems.quantity,
          receivedAt: purchaseOrders.receivedAt,
        })
        .from(purchaseOrderItems)
        .innerJoin(purchaseOrders, eq(purchaseOrderItems.poId, purchaseOrders.id))
        .where(
          and(
            eq(purchaseOrderItems.productId, data.productId),
            eq(purchaseOrders.shopId, shopId),
            eq(purchaseOrders.status, 'received'),
          ),
        ),
    ])

    const movements: Movement[] = []
    for (const a of adjustments) {
      movements.push({
        kind: a.type,
        label: adjLabel[a.type] ?? a.type,
        delta: a.quantity,
        note: a.note,
        createdAt: a.createdAt,
      })
    }
    for (const s of soldItems) {
      movements.push({
        kind: 'sale',
        label: 'Sale',
        delta: -s.quantity,
        note: null,
        createdAt: s.createdAt,
      })
    }
    for (const r of returnedItems) {
      movements.push({
        kind: 'return',
        label: 'Return',
        delta: r.quantity,
        note: null,
        createdAt: r.createdAt,
      })
    }
    for (const p of received) {
      if (!p.receivedAt) continue
      movements.push({
        kind: 'po',
        label: 'PO received',
        delta: p.quantity,
        note: null,
        createdAt: p.receivedAt,
      })
    }

    // Newest first; running balance anchored to current stock
    movements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    let running = product.stockQty
    const rows = movements.map((m) => {
      const balanceAfter = running
      running -= m.delta
      return { ...m, balanceAfter }
    })

    return { product, rows }
  })
