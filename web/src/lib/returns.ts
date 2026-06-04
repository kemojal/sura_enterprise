import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import {
  products,
  saleItems,
  saleReturnItems,
  saleReturns,
  sales,
} from '#/db/schema'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

// Items still returnable for a sale = sold qty minus already-returned qty
export const getReturnableItems = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ saleId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')

    const [sale] = await db
      .select()
      .from(sales)
      .where(and(eq(sales.id, data.saleId), eq(sales.shopId, shopId)))
      .limit(1)
    if (!sale) throw new Error('Sale not found')

    const items = await db
      .select({
        saleItemId: saleItems.id,
        productId: saleItems.productId,
        productName: products.name,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        returnedQty: sql<number>`coalesce((
          select cast(sum(${saleReturnItems.quantity}) as int)
          from ${saleReturnItems}
          where ${saleReturnItems.saleItemId} = ${saleItems.id}
        ), 0)`,
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, sale.id))

    return {
      sale: {
        id: sale.id,
        status: sale.status,
        totalAmount: sale.totalAmount,
        amountPaid: sale.amountPaid,
      },
      items: items.map((i) => ({
        ...i,
        returnableQty: i.quantity - i.returnedQty,
      })),
    }
  })

export const createReturn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      saleId: z.string(),
      reason: z.string().optional(),
      items: z
        .array(z.object({ saleItemId: z.string(), quantity: z.number().int().min(1) }))
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId, staffId } = await getShopCtxWithPermission(
      request.headers,
      'products:write',
    )

    return db.transaction(async (tx) => {
      const [sale] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, data.saleId), eq(sales.shopId, shopId)))
        .limit(1)
      if (!sale) throw new Error('Sale not found')

      // Load sale items + already-returned counts
      const lineItems = await tx
        .select({
          id: saleItems.id,
          productId: saleItems.productId,
          quantity: saleItems.quantity,
          unitPrice: saleItems.unitPrice,
        })
        .from(saleItems)
        .where(eq(saleItems.saleId, sale.id))

      const returnedSoFar = await tx
        .select({
          saleItemId: saleReturnItems.saleItemId,
          qty: sql<number>`cast(sum(${saleReturnItems.quantity}) as int)`,
        })
        .from(saleReturnItems)
        .innerJoin(saleReturns, eq(saleReturnItems.returnId, saleReturns.id))
        .where(eq(saleReturns.saleId, sale.id))
        .groupBy(saleReturnItems.saleItemId)

      const returnedMap = new Map(returnedSoFar.map((r) => [r.saleItemId, r.qty]))
      const itemMap = new Map(lineItems.map((i) => [i.id, i]))

      const returnId = nanoid()

      // 1. Validate all items first (no writes yet) and compute refund
      let refundAmount = 0
      const itemRows = data.items.map((reqItem) => {
        const line = itemMap.get(reqItem.saleItemId)
        if (!line) throw new Error('Invalid sale item')
        const alreadyReturned = returnedMap.get(reqItem.saleItemId) ?? 0
        const remaining = line.quantity - alreadyReturned
        if (reqItem.quantity > remaining) {
          throw new Error(`Cannot return more than ${remaining} of an item`)
        }
        const subtotal = Number(line.unitPrice) * reqItem.quantity
        refundAmount += subtotal
        return { reqItem, line, subtotal }
      })

      // 2. Insert the return header FIRST (FK target for return items)
      await tx.insert(saleReturns).values({
        id: returnId,
        shopId,
        saleId: sale.id,
        staffId,
        refundAmount: refundAmount.toFixed(2),
        reason: data.reason,
      })

      // 3. Restock products + insert return items
      for (const { reqItem, line, subtotal } of itemRows) {
        if (line.productId) {
          await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} + ${reqItem.quantity}` })
            .where(eq(products.id, line.productId))
        }
        await tx.insert(saleReturnItems).values({
          id: nanoid(),
          returnId,
          saleItemId: reqItem.saleItemId,
          productId: line.productId,
          quantity: reqItem.quantity,
          unitPrice: line.unitPrice,
          subtotal: subtotal.toFixed(2),
        })
      }

      // Determine if sale is now fully or partially returned
      const totalReturnedValue = await tx
        .select({
          total: sql<string>`coalesce(sum(${saleReturnItems.subtotal}), 0)`,
        })
        .from(saleReturnItems)
        .innerJoin(saleReturns, eq(saleReturnItems.returnId, saleReturns.id))
        .where(eq(saleReturns.saleId, sale.id))
        .then((r) => Number(r[0]?.total ?? 0))

      const fullyReturned = totalReturnedValue >= Number(sale.totalAmount)

      // For credit sales: returning items reduces what's owed. Treat the
      // returned value as a credit toward amountPaid so the debt query
      // (totalAmount - amountPaid) stays correct without mutating totalAmount.
      const updates: Partial<typeof sales.$inferInsert> = {
        status: fullyReturned ? 'refunded' : 'partially_refunded',
      }
      if (sale.status === 'credit' || sale.status === 'partially_refunded') {
        const newPaid = Math.min(
          Number(sale.totalAmount),
          Number(sale.amountPaid) + refundAmount,
        )
        updates.amountPaid = newPaid.toFixed(2)
      }

      await tx.update(sales).set(updates).where(eq(sales.id, sale.id))

      return { returnId, refundAmount: refundAmount.toFixed(2), fullyReturned }
    })
  })
