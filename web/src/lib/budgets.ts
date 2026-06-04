import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { expenseBudgets, expenses, shops } from '#/db/schema'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

const categories = [
  'rent',
  'electricity',
  'internet',
  'salary',
  'supplier_payment',
  'transport',
  'maintenance',
  'packaging',
  'misc',
] as const

// Budget vs actual for the current calendar month, per category.
export const getBudgetVsActual = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'expenses')

    const [shop] = await db
      .select({ currency: shops.currency })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const budgets = await db
      .select({
        category: expenseBudgets.category,
        monthlyAmount: expenseBudgets.monthlyAmount,
      })
      .from(expenseBudgets)
      .where(eq(expenseBudgets.shopId, shopId))
    const budgetMap = new Map(budgets.map((b) => [b.category, Number(b.monthlyAmount)]))

    const actuals = await db
      .select({
        category: expenses.category,
        total: sql<string>`sum(${expenses.amount})`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.shopId, shopId),
          gte(expenses.date, monthStart),
          lte(expenses.date, monthEnd),
        ),
      )
      .groupBy(expenses.category)
    const actualMap = new Map(actuals.map((a) => [a.category, Number(a.total)]))

    const rows = categories.map((category) => {
      const budget = budgetMap.get(category) ?? 0
      const actual = actualMap.get(category) ?? 0
      return { category, budget, actual, remaining: budget - actual }
    })

    return {
      rows,
      currency: shop?.currency ?? 'GHS',
      totalBudget: rows.reduce((s, r) => s + r.budget, 0),
      totalActual: rows.reduce((s, r) => s + r.actual, 0),
      month: monthStart.toLocaleDateString('en-GH', {
        month: 'long',
        year: 'numeric',
      }),
    }
  },
)

export const setBudget = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ category: z.enum(categories), monthlyAmount: z.string() }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'expenses')
    const amount = Number(data.monthlyAmount)

    const [existing] = await db
      .select({ id: expenseBudgets.id })
      .from(expenseBudgets)
      .where(
        and(
          eq(expenseBudgets.shopId, shopId),
          eq(expenseBudgets.category, data.category),
        ),
      )
      .limit(1)

    if (amount <= 0) {
      // Clearing the budget
      if (existing) {
        await db.delete(expenseBudgets).where(eq(expenseBudgets.id, existing.id))
      }
      return { cleared: true }
    }

    if (existing) {
      await db
        .update(expenseBudgets)
        .set({ monthlyAmount: amount.toFixed(2) })
        .where(eq(expenseBudgets.id, existing.id))
    } else {
      await db.insert(expenseBudgets).values({
        id: nanoid(),
        shopId,
        category: data.category,
        monthlyAmount: amount.toFixed(2),
      })
    }
    return { saved: true }
  })
