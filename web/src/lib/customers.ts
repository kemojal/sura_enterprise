import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { customerPayments, customers, sales } from '#/db/schema'
import { getShopCtx, getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listCustomers = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ search: z.string().optional() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)
    const conditions = [eq(customers.shopId, shopId)]
    if (data.search) conditions.push(ilike(customers.name, `%${data.search}%`))
    return db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        totalDebt: sql<string>`coalesce(sum(${sales.totalAmount} - ${sales.amountPaid}), 0)`,
      })
      .from(customers)
      .leftJoin(
        sales,
        and(eq(sales.customerId, customers.id), eq(sales.status, 'credit')),
      )
      .where(and(...conditions))
      .groupBy(customers.id, customers.name, customers.phone, customers.email)
      .orderBy(customers.name)
  })

export const getCustomer = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, data.id), eq(customers.shopId, shopId)))
      .limit(1)
    if (!customer) throw new Error('Customer not found')

    const customerSales = await db
      .select()
      .from(sales)
      .where(eq(sales.customerId, customer.id))
      .orderBy(sql`${sales.createdAt} desc`)
      .limit(50)

    const payments = await db
      .select()
      .from(customerPayments)
      .where(eq(customerPayments.customerId, customer.id))
      .orderBy(sql`${customerPayments.createdAt} desc`)
      .limit(50)

    const totalDebt = customerSales
      .filter((s) => s.status === 'credit')
      .reduce((sum, s) => sum + Number(s.totalAmount) - Number(s.amountPaid), 0)

    return { customer, sales: customerSales, payments, totalDebt }
  })

export const createCustomer = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'customers:write')
    const [customer] = await db
      .insert(customers)
      .values({ id: nanoid(), shopId, ...data })
      .returning()
    return customer
  })

export const recordPayment = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      customerId: z.string(),
      saleId: z.string().optional(),
      amount: z.string(),
      note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    await getShopCtxWithPermission(request.headers, 'customers:write')

    await db.transaction(async (tx) => {
      await tx.insert(customerPayments).values({
        id: nanoid(),
        customerId: data.customerId,
        saleId: data.saleId,
        amount: data.amount,
        note: data.note,
      })

      if (data.saleId) {
        const [sale] = await tx
          .select()
          .from(sales)
          .where(eq(sales.id, data.saleId))
          .limit(1)
        if (sale) {
          const newPaid = (Number(sale.amountPaid) + Number(data.amount)).toFixed(2)
          const newStatus =
            Number(newPaid) >= Number(sale.totalAmount) ? 'completed' : 'credit'
          await tx
            .update(sales)
            .set({ amountPaid: newPaid, status: newStatus })
            .where(eq(sales.id, data.saleId))
        }
      }
    })
  })
