import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { expenses, products, saleItems, saleReturns, sales, shops } from '#/db/schema'
import { getShopCtx } from './context'

export type DashboardPeriod = 'today' | '7d' | '30d' | 'month'

function periodRange(period: DashboardPeriod): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  if (period === '7d') start.setDate(start.getDate() - 6)
  else if (period === '30d') start.setDate(start.getDate() - 29)
  else if (period === 'month') start.setDate(1)
  // 'today' → start already at today 00:00

  return { start, end }
}

async function sumSales(shopId: string, start: Date, end: Date) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmount}), 0)` })
    .from(sales)
    .where(
      and(eq(sales.shopId, shopId), gte(sales.createdAt, start), lte(sales.createdAt, end)),
    )
  return Number(row?.total ?? 0)
}

export const getDashboardStats = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      period: z.enum(['today', '7d', '30d', 'month']).default('today'),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)

    const [shop] = await db
      .select({
        currency: shops.currency,
        dailyTarget: shops.dailyTarget,
        monthlyTarget: shops.monthlyTarget,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    // Target progress: today + this month revenue, independent of the period
    const tStart = new Date()
    tStart.setHours(0, 0, 0, 0)
    const tEnd = new Date()
    tEnd.setHours(23, 59, 59, 999)
    const mStart = new Date()
    mStart.setDate(1)
    mStart.setHours(0, 0, 0, 0)
    const [todayRevenue, monthRevenue] = await Promise.all([
      sumSales(shopId, tStart, tEnd),
      sumSales(shopId, mStart, tEnd),
    ])

    const { start: periodStart, end: periodEnd } = periodRange(data.period)

    // Previous equal-length window for delta comparison
    const spanMs = periodEnd.getTime() - periodStart.getTime()
    const prevEnd = new Date(periodStart.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - spanMs)

    const [grossSales, prevGrossSales, expensesRow, refundsRow] = await Promise.all([
      sumSales(shopId, periodStart, periodEnd),
      sumSales(shopId, prevStart, prevEnd),
      db
        .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
        .from(expenses)
        .where(
          and(
            eq(expenses.shopId, shopId),
            gte(expenses.date, periodStart),
            lte(expenses.date, periodEnd),
          ),
        )
        .then((r) => Number(r[0]?.total ?? 0)),
      db
        .select({ total: sql<string>`coalesce(sum(${saleReturns.refundAmount}), 0)` })
        .from(saleReturns)
        .where(
          and(
            eq(saleReturns.shopId, shopId),
            gte(saleReturns.createdAt, periodStart),
            lte(saleReturns.createdAt, periodEnd),
          ),
        )
        .then((r) => Number(r[0]?.total ?? 0)),
    ])

    const periodSales = grossSales - refundsRow
    const periodExpenses = expensesRow

    // Last 7 days chart — always last 7 days regardless of period, bucketed in
    // JS using the same local-day basis so chart and cards never disagree.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 6)

    const weekRows = await db
      .select({ createdAt: sales.createdAt, total: sales.totalAmount })
      .from(sales)
      .where(
        and(
          eq(sales.shopId, shopId),
          gte(sales.createdAt, weekStart),
          lte(sales.createdAt, todayEnd),
        ),
      )

    const bucketTotals = new Map<number, number>()
    for (const row of weekRows) {
      if (!row.createdAt) continue
      const d = new Date(row.createdAt)
      d.setHours(0, 0, 0, 0)
      bucketTotals.set(d.getTime(), (bucketTotals.get(d.getTime()) ?? 0) + Number(row.total))
    }

    const weeklySales: { date: string; label: string; total: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart)
      d.setDate(d.getDate() - i)
      weeklySales.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-GH', { weekday: 'short' }),
        total: bucketTotals.get(d.getTime()) ?? 0,
      })
    }

    const lowStock = await db
      .select({
        id: products.id,
        name: products.name,
        stockQty: products.stockQty,
        lowStockThreshold: products.lowStockThreshold,
      })
      .from(products)
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.isActive, true),
          sql`${products.stockQty} <= ${products.lowStockThreshold}`,
          sql`${products.stockQty} > 0`,
        ),
      )
      .limit(10)

    const outOfStock = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(
        and(eq(products.shopId, shopId), eq(products.isActive, true), eq(products.stockQty, 0)),
      )
      .limit(10)

    const [debtRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${sales.totalAmount} - ${sales.amountPaid}), 0)`,
      })
      .from(sales)
      .where(and(eq(sales.shopId, shopId), eq(sales.status, 'credit')))

    // Best sellers scoped to the selected period
    const topProducts = await db
      .select({
        productId: saleItems.productId,
        name: products.name,
        totalQty: sql<number>`cast(sum(${saleItems.quantity}) as int)`,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(
        and(
          eq(sales.shopId, shopId),
          gte(sales.createdAt, periodStart),
          lte(sales.createdAt, periodEnd),
        ),
      )
      .groupBy(saleItems.productId, products.name)
      .orderBy(desc(sql`sum(${saleItems.quantity})`))
      .limit(5)

    return {
      period: data.period,
      periodSales,
      prevSales: prevGrossSales,
      periodExpenses,
      estimatedProfit: periodSales - periodExpenses,
      totalDebt: Number(debtRow?.total ?? 0),
      weeklySales,
      lowStock,
      outOfStock,
      topProducts,
      todayRevenue,
      monthRevenue,
      dailyTarget: Number(shop?.dailyTarget ?? 0),
      monthlyTarget: Number(shop?.monthlyTarget ?? 0),
      currency: shop?.currency ?? 'GHS',
    }
  })
