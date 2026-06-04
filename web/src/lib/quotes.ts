import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import {
  customers,
  productVariants,
  products,
  quoteItems,
  quotes,
  saleItems,
  sales,
  shops,
  staffMembers,
} from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtx, getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listQuotes = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtxWithPermission(request.headers, 'sales')
  return db
    .select({
      id: quotes.id,
      status: quotes.status,
      totalAmount: quotes.totalAmount,
      validUntil: quotes.validUntil,
      createdAt: quotes.createdAt,
      customerName: customers.name,
    })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .where(eq(quotes.shopId, shopId))
    .orderBy(desc(quotes.createdAt))
    .limit(100)
})

export const getQuote = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'sales')

    const [quote] = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        totalAmount: quotes.totalAmount,
        notes: quotes.notes,
        validUntil: quotes.validUntil,
        convertedSaleId: quotes.convertedSaleId,
        createdAt: quotes.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        staffName: staffMembers.name,
      })
      .from(quotes)
      .leftJoin(customers, eq(quotes.customerId, customers.id))
      .leftJoin(staffMembers, eq(quotes.staffId, staffMembers.id))
      .where(and(eq(quotes.id, data.id), eq(quotes.shopId, shopId)))
      .limit(1)
    if (!quote) throw new Error('Quote not found')

    const items = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quote.id))

    const [shop] = await db
      .select({
        name: shops.name,
        address: shops.address,
        phone: shops.phone,
        currency: shops.currency,
        logoUrl: shops.logoUrl,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    return { quote, items, shop }
  })

const quoteItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  name: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.string(),
})

export const createQuote = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      items: z.array(quoteItemSchema).min(1),
      customerId: z.string().optional(),
      notes: z.string().optional(),
      validUntil: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'sales')
    const { shopId } = ctx

    const total = data.items
      .reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
      .toFixed(2)

    const quoteId = nanoid()
    await db.insert(quotes).values({
      id: quoteId,
      shopId,
      customerId: data.customerId || undefined,
      staffId: ctx.staffId,
      status: 'draft',
      totalAmount: total,
      notes: data.notes,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
    })

    for (const item of data.items) {
      await db.insert(quoteItems).values({
        id: nanoid(),
        quoteId,
        productId: item.productId,
        variantId: item.variantId || undefined,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: (Number(item.unitPrice) * item.quantity).toFixed(2),
      })
    }

    return { id: quoteId }
  })

export const updateQuoteStatus = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      status: z.enum(['draft', 'sent', 'accepted', 'declined']),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'sales')
    await db
      .update(quotes)
      .set({ status: data.status })
      .where(and(eq(quotes.id, data.id), eq(quotes.shopId, shopId)))
  })

// Convert a quote into a completed cash sale (applies the shop's tax),
// decrements stock, marks the quote converted.
export const convertQuoteToSale = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtx(request.headers)
    const { shopId } = ctx

    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, data.id), eq(quotes.shopId, shopId)))
      .limit(1)
    if (!quote) throw new Error('Quote not found')
    if (quote.status === 'converted') throw new Error('Already converted')

    const items = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quote.id))
    if (items.length === 0) throw new Error('Quote has no items')

    const [shopTax] = await db
      .select({ taxRate: shops.taxRate, taxInclusive: shops.taxInclusive })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)
    const rate = Number(shopTax?.taxRate ?? 0)

    const lineTotal = items.reduce((s, i) => s + Number(i.subtotal), 0)
    let totalAmount = lineTotal
    let taxAmount = 0
    if (rate > 0) {
      if (shopTax?.taxInclusive) {
        taxAmount = lineTotal * (rate / (100 + rate))
      } else {
        taxAmount = lineTotal * (rate / 100)
        totalAmount = lineTotal + taxAmount
      }
    }

    return db.transaction(async (tx) => {
      const saleId = nanoid()
      await tx.insert(sales).values({
        id: saleId,
        shopId,
        cashierId: ctx.staffId,
        customerId: quote.customerId,
        totalAmount: totalAmount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        amountPaid: totalAmount.toFixed(2),
        paymentMethod: 'cash',
        status: 'completed',
      })

      for (const item of items) {
        await tx.insert(saleItems).values({
          id: nanoid(),
          saleId,
          productId: item.productId,
          variantId: item.variantId,
          variantName: item.variantId
            ? item.name.split(' — ').slice(1).join(' — ') || null
            : null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({ stockQty: sql`${productVariants.stockQty} - ${item.quantity}` })
            .where(eq(productVariants.id, item.variantId))
        } else if (item.productId) {
          await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} - ${item.quantity}` })
            .where(eq(products.id, item.productId))
        }
      }

      await tx
        .update(quotes)
        .set({ status: 'converted', convertedSaleId: saleId })
        .where(eq(quotes.id, quote.id))

      await logActivity(tx, {
        shopId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        action: 'quote.converted',
        entityType: 'quote',
        entityId: quote.id,
        description: `Converted quote to sale of ${totalAmount.toFixed(2)}`,
      })

      return { saleId }
    })
  })

export const deleteQuote = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'sales')
    await db
      .delete(quotes)
      .where(and(eq(quotes.id, data.id), eq(quotes.shopId, shopId)))
  })
