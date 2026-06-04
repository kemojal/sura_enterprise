import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { customers, productVariants, products, saleItems, sales, shifts, shops, staffMembers, user } from '#/db/schema'
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
        taxAmount: sales.taxAmount,
        discountAmount: sales.discountAmount,
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
        variantName: saleItems.variantName,
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, sale.id))

    const [shop] = await db
      .select({
        name: shops.name,
        address: shops.address,
        phone: shops.phone,
        currency: shops.currency,
        logoUrl: shops.logoUrl,
        receiptFooter: shops.receiptFooter,
        taxRate: shops.taxRate,
        taxInclusive: shops.taxInclusive,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    return { sale, items, shop }
  })

// Tax config for the POS sale form
export const getSaleConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtx(request.headers)
  const [shop] = await db
    .select({
      currency: shops.currency,
      taxRate: shops.taxRate,
      taxInclusive: shops.taxInclusive,
      loyaltyEnabled: shops.loyaltyEnabled,
      loyaltyEarnRate: shops.loyaltyEarnRate,
      loyaltyPointValue: shops.loyaltyPointValue,
    })
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1)
  return {
    currency: shop?.currency ?? 'GHS',
    taxRate: Number(shop?.taxRate ?? 0),
    taxInclusive: shop?.taxInclusive ?? true,
    loyaltyEnabled: shop?.loyaltyEnabled ?? false,
    loyaltyEarnRate: Number(shop?.loyaltyEarnRate ?? 0),
    loyaltyPointValue: Number(shop?.loyaltyPointValue ?? 0),
  }
})

const saleItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  variantName: z.string().optional(),
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
      discountType: z.enum(['amount', 'percent']).optional(),
      discountValue: z.string().optional(),
      pointsToRedeem: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtx(request.headers)
    const { shopId, userId } = ctx

    // Tax + loyalty config from the shop
    const [shopCfg] = await db
      .select({
        taxRate: shops.taxRate,
        taxInclusive: shops.taxInclusive,
        loyaltyEnabled: shops.loyaltyEnabled,
        loyaltyEarnRate: shops.loyaltyEarnRate,
        loyaltyPointValue: shops.loyaltyPointValue,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)
    const rate = Number(shopCfg?.taxRate ?? 0)
    const loyaltyOn = !!shopCfg?.loyaltyEnabled

    const lineTotal = data.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    )

    // Manual discount applies to the line total before tax. Clamp to [0, lineTotal].
    let discountAmountNum = 0
    if (data.discountType && data.discountValue) {
      const v = Number(data.discountValue)
      if (v > 0) {
        discountAmountNum =
          data.discountType === 'percent' ? lineTotal * (v / 100) : v
      }
    }
    discountAmountNum = Math.min(Math.max(discountAmountNum, 0), lineTotal)

    // Points redemption: each point is worth loyaltyPointValue, applied as an
    // extra discount before tax. Capped at the customer's balance and the
    // remaining line value.
    let pointsRedeemed = 0
    let pointsRedeemValue = 0
    if (loyaltyOn && data.customerId && data.pointsToRedeem && data.pointsToRedeem > 0) {
      const [cust] = await db
        .select({ balance: customers.loyaltyPoints })
        .from(customers)
        .where(and(eq(customers.id, data.customerId), eq(customers.shopId, shopId)))
        .limit(1)
      const balance = cust?.balance ?? 0
      const pointValue = Number(shopCfg?.loyaltyPointValue ?? 0)
      const remaining = lineTotal - discountAmountNum
      const maxByValue = pointValue > 0 ? Math.floor(remaining / pointValue) : 0
      pointsRedeemed = Math.max(0, Math.min(data.pointsToRedeem, balance, maxByValue))
      pointsRedeemValue = pointsRedeemed * pointValue
    }

    const totalDiscount = discountAmountNum + pointsRedeemValue
    const discountedLine = lineTotal - totalDiscount

    // Inclusive: line prices already contain tax; tax is the embedded portion.
    // Exclusive: tax is added on top of the (discounted) line total.
    let totalAmountNum = discountedLine
    let taxAmountNum = 0
    if (rate > 0) {
      if (shopCfg?.taxInclusive) {
        taxAmountNum = discountedLine * (rate / (100 + rate))
        totalAmountNum = discountedLine
      } else {
        taxAmountNum = discountedLine * (rate / 100)
        totalAmountNum = discountedLine + taxAmountNum
      }
    }
    const totalAmount = totalAmountNum.toFixed(2)
    const taxAmount = taxAmountNum.toFixed(2)
    // Record total discount (manual + points value) on the sale
    const discountAmount = totalDiscount.toFixed(2)

    // Points earned on the final payable total
    const pointsEarned =
      loyaltyOn && data.customerId
        ? Math.floor(totalAmountNum * Number(shopCfg?.loyaltyEarnRate ?? 0))
        : 0

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

    const cashierId = (await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(and(eq(staffMembers.shopId, shopId), eq(staffMembers.userId, userId)))
      .limit(1)
      .then((r) => r[0]))?.id

    // Attach to the cashier's currently open shift, if any.
    const openShift = cashierId
      ? (await db
          .select({ id: shifts.id })
          .from(shifts)
          .where(
            and(
              eq(shifts.shopId, shopId),
              eq(shifts.cashierId, cashierId),
              eq(shifts.status, 'open'),
            ),
          )
          .limit(1)
          .then((r) => r[0]))?.id
      : undefined

    const sale = await db.transaction(async (tx) => {
      const saleId = nanoid()
      const [newSale] = await tx
        .insert(sales)
        .values({
          id: saleId,
          shopId,
          cashierId,
          shiftId: openShift,
          customerId: data.customerId,
          totalAmount,
          taxAmount,
          discountAmount,
          pointsEarned,
          pointsRedeemed,
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
          variantId: item.variantId,
          variantName: item.variantName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
        })
        // Decrement variant stock when a variant is sold, else product stock
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({ stockQty: sql`${productVariants.stockQty} - ${item.quantity}` })
            .where(eq(productVariants.id, item.variantId))
        } else {
          await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} - ${item.quantity}` })
            .where(eq(products.id, item.productId))
        }
      }

      // Update customer loyalty balance: subtract redeemed, add earned
      if (data.customerId && (pointsEarned > 0 || pointsRedeemed > 0)) {
        await tx
          .update(customers)
          .set({
            loyaltyPoints: sql`${customers.loyaltyPoints} - ${pointsRedeemed} + ${pointsEarned}`,
          })
          .where(eq(customers.id, data.customerId))
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
