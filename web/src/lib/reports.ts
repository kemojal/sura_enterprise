import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { expenses, products, saleItems, saleReturns, sales, shops } from '#/db/schema'
import { getShopCtxWithPermission } from './context'

export const getReport = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ from: z.string(), to: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'reports')

    const [shop] = await db
      .select({ currency: shops.currency })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    const from = new Date(data.from)
    const to = new Date(data.to)
    to.setHours(23, 59, 59, 999)

    const salesConditions = [
      eq(sales.shopId, shopId),
      gte(sales.createdAt, from),
      lte(sales.createdAt, to),
    ]
    const expConditions = [
      eq(expenses.shopId, shopId),
      gte(expenses.date, from),
      lte(expenses.date, to),
    ]

    const [salesSummary] = await db
      .select({
        totalRevenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
        totalTax: sql<string>`coalesce(sum(${sales.taxAmount}), 0)`,
        totalDiscount: sql<string>`coalesce(sum(${sales.discountAmount}), 0)`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(sales)
      .where(and(...salesConditions))

    const [expSummary] = await db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(...expConditions))

    const topProducts = await db
      .select({
        productId: saleItems.productId,
        name: products.name,
        totalQty: sql<number>`cast(sum(${saleItems.quantity}) as int)`,
        totalRevenue: sql<string>`sum(${saleItems.subtotal})`,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...salesConditions))
      .groupBy(saleItems.productId, products.name)
      .orderBy(desc(sql`sum(${saleItems.quantity})`))
      .limit(10)

    const expByCategory = await db
      .select({
        category: expenses.category,
        total: sql<string>`sum(${expenses.amount})`,
      })
      .from(expenses)
      .where(and(...expConditions))
      .groupBy(expenses.category)
      .orderBy(desc(sql`sum(${expenses.amount})`))

    // Profitability per product: units sold × (sale price − current buying price).
    // Uses current buyingPrice as cost basis (historical cost not captured per line).
    const productProfit = await db
      .select({
        productId: saleItems.productId,
        name: products.name,
        unitsSold: sql<number>`cast(sum(${saleItems.quantity}) as int)`,
        revenue: sql<string>`sum(${saleItems.subtotal})`,
        cost: sql<string>`sum(${saleItems.quantity} * ${products.buyingPrice})`,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...salesConditions))
      .groupBy(saleItems.productId, products.name)
      .orderBy(desc(sql`sum(${saleItems.subtotal}) - sum(${saleItems.quantity} * ${products.buyingPrice})`))
      .limit(10)

    const [refundsSummary] = await db
      .select({ total: sql<string>`coalesce(sum(${saleReturns.refundAmount}), 0)` })
      .from(saleReturns)
      .where(
        and(
          eq(saleReturns.shopId, shopId),
          gte(saleReturns.createdAt, from),
          lte(saleReturns.createdAt, to),
        ),
      )

    const grossRevenue = Number(salesSummary?.totalRevenue ?? 0)
    const refunds = Number(refundsSummary?.total ?? 0)
    const revenue = grossRevenue - refunds
    const totalExpenses = Number(expSummary?.total ?? 0)

    const grossProfit = productProfit.reduce(
      (sum, p) => sum + (Number(p.revenue) - Number(p.cost)),
      0,
    )

    return {
      revenue,
      refunds,
      taxCollected: Number(salesSummary?.totalTax ?? 0),
      discountsGiven: Number(salesSummary?.totalDiscount ?? 0),
      totalExpenses,
      profit: revenue - totalExpenses,
      grossProfit,
      salesCount: salesSummary?.count ?? 0,
      topProducts,
      productProfit,
      expByCategory,
      currency: shop?.currency ?? 'GHS',
    }
  })
