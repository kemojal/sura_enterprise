import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, gte, lte, sql, sum } from 'drizzle-orm'

import { db } from '#/db/index'
import { expenses, products, saleItems, sales, shops } from '#/db/schema'
import { getShopCtx } from './context'

export const getDashboardStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)

    const [shop] = await db
      .select({ currency: shops.currency })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [todaySalesRow] = await db
      .select({ total: sum(sales.totalAmount) })
      .from(sales)
      .where(
        and(
          eq(sales.shopId, shopId),
          gte(sales.createdAt, todayStart),
          lte(sales.createdAt, todayEnd),
        ),
      )

    const [todayExpensesRow] = await db
      .select({ total: sum(expenses.amount) })
      .from(expenses)
      .where(
        and(
          eq(expenses.shopId, shopId),
          gte(expenses.date, todayStart),
          lte(expenses.date, todayEnd),
        ),
      )

    const todaySales = Number(todaySalesRow?.total ?? 0)
    const todayExpenses = Number(todayExpensesRow?.total ?? 0)

    // Yesterday's sales for delta comparison
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const yesterdayEnd = new Date(todayEnd)
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)

    const [yesterdaySalesRow] = await db
      .select({ total: sum(sales.totalAmount) })
      .from(sales)
      .where(
        and(
          eq(sales.shopId, shopId),
          gte(sales.createdAt, yesterdayStart),
          lte(sales.createdAt, yesterdayEnd),
        ),
      )
    const yesterdaySales = Number(yesterdaySalesRow?.total ?? 0)

    // Last 7 days sales — bucket in JS using the same local-day basis as the
    // today/yesterday cards, so the chart and stat cards never disagree.
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

    function dayKey(d: Date) {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      return x.getTime()
    }

    const bucketTotals = new Map<number, number>()
    for (const row of weekRows) {
      if (!row.createdAt) continue
      const key = dayKey(new Date(row.createdAt))
      bucketTotals.set(key, (bucketTotals.get(key) ?? 0) + Number(row.total))
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

    const topProducts = await db
      .select({
        productId: saleItems.productId,
        name: products.name,
        totalQty: sql<number>`cast(sum(${saleItems.quantity}) as int)`,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(eq(sales.shopId, shopId))
      .groupBy(saleItems.productId, products.name)
      .orderBy(desc(sql`sum(${saleItems.quantity})`))
      .limit(5)

    return {
      todaySales,
      yesterdaySales,
      todayExpenses,
      estimatedProfit: todaySales - todayExpenses,
      totalDebt: Number(debtRow?.total ?? 0),
      weeklySales,
      lowStock,
      outOfStock,
      topProducts,
      currency: shop?.currency ?? 'GHS',
    }
  },
)
