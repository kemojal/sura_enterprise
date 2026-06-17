import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import {
  expenses,
  fieldPermissions,
  recordLocks,
  staffMembers,
} from '#/db/schema'
import { getShopCtxWithPermission } from './context'

export const listExpenses = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      category: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'expenses')
    const conditions = [eq(expenses.shopId, shopId)]
    if (data.from) conditions.push(gte(expenses.date, new Date(data.from)))
    if (data.to) conditions.push(lte(expenses.date, new Date(data.to)))
    return db
      .select({
        id: expenses.id,
        category: expenses.category,
        amount: expenses.amount,
        description: expenses.description,
        date: expenses.date,
        recordedBy: staffMembers.name,
      })
      .from(expenses)
      .leftJoin(staffMembers, eq(expenses.recordedById, staffMembers.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.date))
      .limit(100)
  })

export const expenseCats = [
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

export const listExpensesGrid = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId, role } = await getShopCtxWithPermission(
      request.headers,
      'expenses',
    )
    const conditions = [eq(expenses.shopId, shopId)]
    if (data.from) conditions.push(gte(expenses.date, new Date(data.from)))
    if (data.to) conditions.push(lte(expenses.date, new Date(data.to)))

    const [rows, perms, locks] = await Promise.all([
      db
        .select({
          id: expenses.id,
          category: expenses.category,
          amount: expenses.amount,
          description: expenses.description,
          date: expenses.date,
          recordedById: expenses.recordedById,
          recordedBy: staffMembers.name,
        })
        .from(expenses)
        .leftJoin(staffMembers, eq(expenses.recordedById, staffMembers.id))
        .where(and(...conditions))
        .orderBy(desc(expenses.date))
        .limit(100),
      db
        .select()
        .from(fieldPermissions)
        .where(eq(fieldPermissions.shopId, shopId)),
      db
        .select()
        .from(recordLocks)
        .where(
          and(
            eq(recordLocks.shopId, shopId),
            eq(recordLocks.entityType, 'expense'),
          ),
        ),
    ])
    return { rows, perms, locks, role }
  })

export const createExpense = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      category: z.enum(expenseCats).default('misc'),
      amount: z.string(),
      description: z.string().optional(),
      date: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId, staffId } = await getShopCtxWithPermission(request.headers, 'expenses')
    const [expense] = await db
      .insert(expenses)
      .values({
        id: crypto.randomUUID(),
        shopId,
        recordedById: staffId,
        category: data.category,
        amount: data.amount,
        description: data.description,
        date: data.date ? new Date(data.date) : new Date(),
      })
      .returning()
    return expense
  })
