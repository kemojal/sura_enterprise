import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, ilike } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { categories, products } from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtx, getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listProducts = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      search: z.string().optional(),
      categoryId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)
    const conditions = [eq(products.shopId, shopId)]
    if (data.search) conditions.push(ilike(products.name, `%${data.search}%`))
    if (data.categoryId)
      conditions.push(eq(products.categoryId, data.categoryId))
    return db
      .select({
        id: products.id,
        name: products.name,
        sellingPrice: products.sellingPrice,
        buyingPrice: products.buyingPrice,
        stockQty: products.stockQty,
        lowStockThreshold: products.lowStockThreshold,
        isActive: products.isActive,
        categoryId: products.categoryId,
        imageUrl: products.imageUrl,
        barcode: products.barcode,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(products.name)
  })

export const listCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const { shopId } = await getShopCtx(request.headers)
  return db
    .select()
    .from(categories)
    .where(eq(categories.shopId, shopId))
    .orderBy(categories.name)
})

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional(),
  buyingPrice: z.string(),
  sellingPrice: z.string(),
  stockQty: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  supplierId: z.string().optional(),
  expiryDate: z.string().optional(),
  imageUrl: z.string().optional(),
  barcode: z.string().optional(),
})

export const findProductByBarcode = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ barcode: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)
    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
        sellingPrice: products.sellingPrice,
        stockQty: products.stockQty,
        imageUrl: products.imageUrl,
        barcode: products.barcode,
      })
      .from(products)
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.barcode, data.barcode),
          eq(products.isActive, true),
        ),
      )
      .limit(1)
    return product ?? null
  })

export const createProduct = createServerFn({ method: 'POST' })
  .inputValidator(productSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')
    const [product] = await db
      .insert(products)
      .values({
        id: nanoid(),
        shopId,
        ...data,
        categoryId: data.categoryId || undefined,
        supplierId: data.supplierId || undefined,
        imageUrl: data.imageUrl || undefined,
        barcode: data.barcode || undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      })
      .returning()
    return product
  })

export const updateProduct = createServerFn({ method: 'POST' })
  .inputValidator(productSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')
    const { id, ...rest } = data
    const [product] = await db
      .update(products)
      .set({
        ...rest,
        categoryId: rest.categoryId || undefined,
        supplierId: rest.supplierId || undefined,
        imageUrl: rest.imageUrl || undefined,
        barcode: rest.barcode || undefined,
        expiryDate: rest.expiryDate ? new Date(rest.expiryDate) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.shopId, shopId)))
      .returning()
    return product
  })

export const deleteProduct = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'products:write')
    const { shopId } = ctx
    const [removed] = await db
      .update(products)
      .set({ isActive: false })
      .where(and(eq(products.id, data.id), eq(products.shopId, shopId)))
      .returning({ name: products.name })

    await logActivity(db, {
      shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'product.deleted',
      entityType: 'product',
      entityId: data.id,
      description: `Deleted product ${removed?.name ?? ''}`.trim(),
    })
  })

const importRowSchema = z.object({
  name: z.string().min(1),
  categoryName: z.string().optional(),
  buyingPrice: z.string(),
  sellingPrice: z.string(),
  stockQty: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0),
  barcode: z.string().optional(),
})

export const bulkImportProducts = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ rows: z.array(importRowSchema).min(1).max(1000) }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'products:write')
    const { shopId } = ctx

    // Existing products (by lowercased name) for upsert
    const existing = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.shopId, shopId))
    const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]))

    // Existing categories (by lowercased name); create missing ones
    const existingCats = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.shopId, shopId))
    const catByName = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]))

    let created = 0
    let updated = 0

    for (const row of data.rows) {
      let categoryId: string | undefined
      if (row.categoryName) {
        const key = row.categoryName.toLowerCase()
        categoryId = catByName.get(key)
        if (!categoryId) {
          categoryId = nanoid()
          await db
            .insert(categories)
            .values({ id: categoryId, shopId, name: row.categoryName })
          catByName.set(key, categoryId)
        }
      }

      const existingId = byName.get(row.name.toLowerCase())
      if (existingId) {
        await db
          .update(products)
          .set({
            categoryId,
            buyingPrice: row.buyingPrice,
            sellingPrice: row.sellingPrice,
            stockQty: row.stockQty,
            lowStockThreshold: row.lowStockThreshold,
            barcode: row.barcode || undefined,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(and(eq(products.id, existingId), eq(products.shopId, shopId)))
        updated++
      } else {
        const id = nanoid()
        await db.insert(products).values({
          id,
          shopId,
          name: row.name,
          categoryId,
          buyingPrice: row.buyingPrice,
          sellingPrice: row.sellingPrice,
          stockQty: row.stockQty,
          lowStockThreshold: row.lowStockThreshold,
          barcode: row.barcode || undefined,
        })
        byName.set(row.name.toLowerCase(), id)
        created++
      }
    }

    await logActivity(db, {
      shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'products.imported',
      entityType: 'product',
      description: `Imported products via CSV — ${created} created, ${updated} updated`,
    })

    return { created, updated }
  })
