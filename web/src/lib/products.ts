import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, ilike } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { categories, productVariants, products } from '#/db/schema'
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
    const { shopId, branchId } = await getShopCtx(request.headers)
    const conditions = [eq(products.shopId, shopId)]
    if (branchId) conditions.push(eq(products.branchId, branchId))
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
        hasVariants: products.hasVariants,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(products.name)
  })

// Sellable units for the POS: products without variants + every active variant
// of products with variants, each as its own pickable line.
export const listSellableItems = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId, branchId } = await getShopCtx(request.headers)

    const plainProducts = await db
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
          eq(products.isActive, true),
          eq(products.hasVariants, false),
          ...(branchId ? [eq(products.branchId, branchId)] : []),
        ),
      )
      .orderBy(products.name)

    const variants = await db
      .select({
        variantId: productVariants.id,
        productId: productVariants.productId,
        productName: products.name,
        variantName: productVariants.name,
        sellingPrice: productVariants.sellingPrice,
        stockQty: productVariants.stockQty,
        barcode: productVariants.barcode,
        imageUrl: products.imageUrl,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.shopId, shopId),
          eq(productVariants.isActive, true),
          eq(products.isActive, true),
          ...(branchId ? [eq(products.branchId, branchId)] : []),
        ),
      )
      .orderBy(products.name)

    return {
      products: plainProducts.map((p) => ({
        id: p.id,
        variantId: null as string | null,
        name: p.name,
        sellingPrice: p.sellingPrice,
        stockQty: p.stockQty,
        imageUrl: p.imageUrl,
        barcode: p.barcode,
      })),
      variants: variants.map((v) => ({
        id: v.productId,
        variantId: v.variantId,
        name: `${v.productName} — ${v.variantName}`,
        sellingPrice: v.sellingPrice,
        stockQty: v.stockQty,
        imageUrl: v.imageUrl,
        barcode: v.barcode,
      })),
    }
  },
)

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
    const { shopId, branchId } = await getShopCtx(request.headers)

    // Variant barcodes take priority (they're the sellable SKU)
    const [variant] = await db
      .select({
        productId: productVariants.productId,
        variantId: productVariants.id,
        productName: products.name,
        variantName: productVariants.name,
        sellingPrice: productVariants.sellingPrice,
        stockQty: productVariants.stockQty,
        imageUrl: products.imageUrl,
        barcode: productVariants.barcode,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.shopId, shopId),
          eq(productVariants.barcode, data.barcode),
          eq(productVariants.isActive, true),
          ...(branchId ? [eq(products.branchId, branchId)] : []),
        ),
      )
      .limit(1)
    if (variant) {
      return {
        id: variant.productId,
        variantId: variant.variantId,
        name: `${variant.productName} — ${variant.variantName}`,
        sellingPrice: variant.sellingPrice,
        stockQty: variant.stockQty,
        imageUrl: variant.imageUrl,
        barcode: variant.barcode,
      }
    }

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
          eq(products.hasVariants, false),
          eq(products.isActive, true),
          ...(branchId ? [eq(products.branchId, branchId)] : []),
        ),
      )
      .limit(1)
    return product ? { ...product, variantId: null as string | null } : null
  })

export const createProduct = createServerFn({ method: 'POST' })
  .inputValidator(productSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId, branchId } = await getShopCtxWithPermission(request.headers, 'products:write')
    const [product] = await db
      .insert(products)
      .values({
        id: nanoid(),
        shopId,
        branchId,
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
