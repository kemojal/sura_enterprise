import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { products, staffMembers, stockAdjustments } from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const getProductAdjustments = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')

    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
        stockQty: products.stockQty,
        sellingPrice: products.sellingPrice,
        buyingPrice: products.buyingPrice,
      })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.shopId, shopId)))
      .limit(1)

    if (!product) throw new Error('Product not found')

    const adjustments = await db
      .select({
        id: stockAdjustments.id,
        type: stockAdjustments.type,
        quantity: stockAdjustments.quantity,
        note: stockAdjustments.note,
        createdAt: stockAdjustments.createdAt,
        staffName: staffMembers.name,
      })
      .from(stockAdjustments)
      .leftJoin(staffMembers, eq(stockAdjustments.staffId, staffMembers.id))
      .where(
        and(
          eq(stockAdjustments.productId, data.productId),
          eq(stockAdjustments.shopId, shopId),
        ),
      )
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(20)

    return { product, adjustments }
  })

const adjTypes = ['restock', 'write_off', 'correction', 'initial_count'] as const

export const createStockAdjustment = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      productId: z.string(),
      type: z.enum(adjTypes),
      quantity: z.number().int().min(1),
      note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'products:write')
    const { shopId, staffId } = ctx

    // write_off reduces stock (negative), others increase
    const delta = data.type === 'write_off' ? -data.quantity : data.quantity

    return db.transaction(async (tx) => {
      const [product] = await tx
        .select({ stockQty: products.stockQty, name: products.name })
        .from(products)
        .where(and(eq(products.id, data.productId), eq(products.shopId, shopId)))
        .limit(1)

      if (!product) throw new Error('Product not found')

      const newQty = product.stockQty + delta
      if (newQty < 0) throw new Error('Stock cannot go below zero')

      await tx
        .update(products)
        .set({ stockQty: sql`${products.stockQty} + ${delta}` })
        .where(and(eq(products.id, data.productId), eq(products.shopId, shopId)))

      const [adjustment] = await tx
        .insert(stockAdjustments)
        .values({
          id: nanoid(),
          shopId,
          productId: data.productId,
          staffId,
          type: data.type,
          quantity: delta,
          note: data.note,
        })
        .returning()

      await logActivity(tx, {
        shopId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        action: 'stock.adjusted',
        entityType: 'product',
        entityId: data.productId,
        description: `Stock ${data.type.replace('_', ' ')} on ${product.name}: ${delta > 0 ? '+' : ''}${delta} (now ${newQty})`,
      })

      return { adjustment, newQty }
    })
  })

// Bulk physical count. Sets each product's stock to the counted value and logs
// a `correction` adjustment for every mismatch. Products that match are skipped.
export const bulkStocktake = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      counts: z
        .array(
          z.object({ productId: z.string(), countedQty: z.number().int().min(0) }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'products:write')
    const { shopId } = ctx

    return db.transaction(async (tx) => {
      const ids = data.counts.map((c) => c.productId)
      const current = await tx
        .select({ id: products.id, stockQty: products.stockQty })
        .from(products)
        .where(and(eq(products.shopId, shopId), inArray(products.id, ids)))
      const stockMap = new Map(current.map((p) => [p.id, p.stockQty]))

      let adjusted = 0
      for (const c of data.counts) {
        const before = stockMap.get(c.productId)
        if (before === undefined) continue
        const delta = c.countedQty - before
        if (delta === 0) continue

        await tx
          .update(products)
          .set({ stockQty: c.countedQty, updatedAt: new Date() })
          .where(and(eq(products.id, c.productId), eq(products.shopId, shopId)))

        await tx.insert(stockAdjustments).values({
          id: nanoid(),
          shopId,
          productId: c.productId,
          staffId: ctx.staffId,
          type: 'correction',
          quantity: delta,
          note: 'Stocktake',
        })
        adjusted++
      }

      if (adjusted > 0) {
        await logActivity(tx, {
          shopId,
          staffId: ctx.staffId,
          actorName: ctx.userName,
          action: 'stock.stocktake',
          entityType: 'product',
          description: `Stocktake — corrected ${adjusted} product${adjusted === 1 ? '' : 's'}`,
        })
      }

      return { adjusted }
    })
  })
