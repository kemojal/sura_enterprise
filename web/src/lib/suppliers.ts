import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { products, suppliers } from '#/db/schema'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listSuppliers = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
  return db.select().from(suppliers).where(eq(suppliers.shopId, shopId)).orderBy(suppliers.name)
})

export const getSupplier = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, data.id), eq(suppliers.shopId, shopId)))
      .limit(1)
    if (!supplier) throw new Error('Supplier not found')
    const supplierProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.supplierId, supplier.id), eq(products.shopId, shopId)))
    return { supplier, products: supplierProducts }
  })

const supplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export const createSupplier = createServerFn({ method: 'POST' })
  .inputValidator(supplierSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
    const [supplier] = await db
      .insert(suppliers)
      .values({ id: nanoid(), shopId, ...data })
      .returning()
    return supplier
  })

export const updateSupplier = createServerFn({ method: 'POST' })
  .inputValidator(supplierSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'suppliers')
    const { id, ...rest } = data
    const [supplier] = await db
      .update(suppliers)
      .set(rest)
      .where(and(eq(suppliers.id, id), eq(suppliers.shopId, shopId)))
      .returning()
    return supplier
  })
