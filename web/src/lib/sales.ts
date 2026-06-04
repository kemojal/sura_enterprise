import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { customers, products, saleItems, sales, shops, staffMembers, user } from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtx } from './context'
import { sendLowStockAlert } from './email'
import { nanoid } from './nanoid'

export const listSales = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)
    const conditions = [eq(sales.shopId, shopId)]
    if (data.from) conditions.push(gte(sales.createdAt, new Date(data.from)))
    if (data.to) conditions.push(lte(sales.createdAt, new Date(data.to)))
    return db
      .select({
        id: sales.id,
        totalAmount: sales.totalAmount,
        amountPaid: sales.amountPaid,
        paymentMethod: sales.paymentMethod,
        status: sales.status,
        createdAt: sales.createdAt,
        customerName: customers.name,
        cashierName: staffMembers.name,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(staffMembers, eq(sales.cashierId, staffMembers.id))
      .where(and(...conditions))
      .orderBy(desc(sales.createdAt))
      .limit(100)
  })

export const getSaleDetail = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)

    const [sale] = await db
      .select({
        id: sales.id,
        totalAmount: sales.totalAmount,
        amountPaid: sales.amountPaid,
        paymentMethod: sales.paymentMethod,
        status: sales.status,
        createdAt: sales.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        cashierName: staffMembers.name,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(staffMembers, eq(sales.cashierId, staffMembers.id))
      .where(and(eq(sales.id, data.id), eq(sales.shopId, shopId)))
      .limit(1)

    if (!sale) throw new Error('Sale not found')

    const items = await db
      .select({
        id: saleItems.id,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        subtotal: saleItems.subtotal,
        productName: products.name,
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, sale.id))

    const [shop] = await db
      .select({ name: shops.name, address: shops.address, phone: shops.phone, currency: shops.currency })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    return { sale, items, shop }
  })

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.string(),
})

export const createSale = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      items: z.array(saleItemSchema).min(1),
      customerId: z.string().optional(),
      amountPaid: z.string(),
      paymentMethod: z.enum(['cash', 'credit', 'mobile_money']),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtx(request.headers)
    const { shopId, userId } = ctx

    const totalAmount = data.items
      .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
      .toFixed(2)

    const amountPaid = Number(data.amountPaid).toFixed(2)
    const status = Number(amountPaid) < Number(totalAmount) ? 'credit' : 'completed'

    if (status === 'credit' && !data.customerId) {
      throw new Error('Customer required for credit sales')
    }

    // Snapshot stock BEFORE the sale for threshold-crossing detection
    const productIds = data.items.map((i) => i.productId)
    const beforeStock = await db
      .select({
        id: products.id,
        name: products.name,
        stockQty: products.stockQty,
        lowStockThreshold: products.lowStockThreshold,
      })
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.shopId, shopId)))

    const sale = await db.transaction(async (tx) => {
      const saleId = nanoid()
      const [newSale] = await tx
        .insert(sales)
        .values({
          id: saleId,
          shopId,
          cashierId: (await db
            .select({ id: staffMembers.id })
            .from(staffMembers)
            .where(and(eq(staffMembers.shopId, shopId), eq(staffMembers.userId, userId)))
            .limit(1)
            .then((r) => r[0]))?.id,
          customerId: data.customerId,
          totalAmount,
          amountPaid,
          paymentMethod: data.paymentMethod,
          status,
        })
        .returning()

      for (const item of data.items) {
        const subtotal = (Number(item.unitPrice) * item.quantity).toFixed(2)
        await tx.insert(saleItems).values({
          id: nanoid(),
          saleId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
        })
        await tx
          .update(products)
          .set({ stockQty: sql`${products.stockQty} - ${item.quantity}` })
          .where(eq(products.id, item.productId))
      }

      await logActivity(tx, {
        shopId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        action: 'sale.created',
        entityType: 'sale',
        entityId: saleId,
        description: `Recorded ${status} sale of ${totalAmount} (${data.items.length} item${data.items.length === 1 ? '' : 's'})`,
      })

      return newSale
    })

    // Fire low-stock alert if any product just crossed its threshold (non-blocking)
    checkAndAlertLowStock({ shopId, userId, data: data.items, beforeStock }).catch(() => {})

    return sale
  })

async function checkAndAlertLowStock(opts: {
  shopId: string
  userId: string
  data: { productId: string; quantity: number }[]
  beforeStock: { id: string; name: string; stockQty: number; lowStockThreshold: number }[]
}) {
  const quantityMap = new Map(opts.data.map((i) => [i.productId, i.quantity]))

  // Find products that just crossed their threshold in this sale
  const crossed = opts.beforeStock.filter((p) => {
    const sold = quantityMap.get(p.id) ?? 0
    const after = p.stockQty - sold
    const wasAbove = p.stockQty > p.lowStockThreshold
    const nowAtOrBelow = after <= p.lowStockThreshold
    return wasAbove && nowAtOrBelow
  })

  if (crossed.length === 0) return

  // Get re-fetched current quantities and owner email
  const [shop, ownerUser, currentStock] = await Promise.all([
    db.select({ name: shops.name, ownerId: shops.ownerId })
      .from(shops).where(eq(shops.id, opts.shopId)).limit(1).then((r) => r[0]),
    db.select({ email: user.email })
      .from(user).where(eq(user.id, opts.userId)).limit(1).then((r) => r[0]),
    db.select({ id: products.id, stockQty: products.stockQty })
      .from(products)
      .where(inArray(products.id, crossed.map((p) => p.id))),
  ])

  if (!shop || !ownerUser) return

  const stockMap = new Map(currentStock.map((p) => [p.id, p.stockQty]))
  const alertItems = crossed.map((p) => ({
    name: p.name,
    stockQty: stockMap.get(p.id) ?? p.stockQty - (quantityMap.get(p.id) ?? 0),
    lowStockThreshold: p.lowStockThreshold,
  }))

  await sendLowStockAlert({
    ownerEmail: ownerUser.email,
    shopName: shop.name,
    items: alertItems,
  })
}
