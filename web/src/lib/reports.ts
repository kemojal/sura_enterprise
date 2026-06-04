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

    const salesByMethod = await db
      .select({
        method: sales.paymentMethod,
        count: sql<number>`cast(count(*) as int)`,
        total: sql<string>`sum(${sales.totalAmount})`,
      })
      .from(sales)
      .where(and(...salesConditions))
      .groupBy(sales.paymentMethod)
      .orderBy(desc(sql`sum(${sales.totalAmount})`))

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

    // Daily revenue series across the range, bucketed in JS by local day so it
    // matches the from/to boundaries the cards use.
    const trendRows = await db
      .select({ createdAt: sales.createdAt, total: sales.totalAmount })
      .from(sales)
      .where(and(...salesConditions))
    const dayBuckets = new Map<number, number>()
    for (const row of trendRows) {
      if (!row.createdAt) continue
      const d = new Date(row.createdAt)
      d.setHours(0, 0, 0, 0)
      dayBuckets.set(d.getTime(), (dayBuckets.get(d.getTime()) ?? 0) + Number(row.total))
    }
    const dailySales: { date: string; total: number }[] = []
    const cursor = new Date(from)
    cursor.setHours(0, 0, 0, 0)
    const lastDay = new Date(to)
    lastDay.setHours(0, 0, 0, 0)
    // Cap at 92 days to keep the payload + chart sane
    let guard = 0
    while (cursor.getTime() <= lastDay.getTime() && guard < 92) {
      dailySales.push({
        date: cursor.toISOString().slice(0, 10),
        total: dayBuckets.get(cursor.getTime()) ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
      guard++
    }

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
      salesByMethod,
      dailySales,
      currency: shop?.currency ?? 'GHS',
    }
  })
