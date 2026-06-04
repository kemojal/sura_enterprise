import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { productVariants, products } from '#/db/schema'
import { getShopCtx, getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listVariants = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtx(request.headers)

    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
        hasVariants: products.hasVariants,
      })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.shopId, shopId)))
      .limit(1)
    if (!product) throw new Error('Product not found')

    const variants = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, data.productId),
          eq(productVariants.shopId, shopId),
          eq(productVariants.isActive, true),
        ),
      )
      .orderBy(productVariants.name)

    return { product, variants }
  })

const variantSchema = z.object({
  productId: z.string(),
  name: z.string().min(1),
  barcode: z.string().optional(),
  buyingPrice: z.string(),
  sellingPrice: z.string(),
  stockQty: z.coerce.number().int().min(0).default(0),
})

export const createVariant = createServerFn({ method: 'POST' })
  .inputValidator(variantSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')

    const [variant] = await db
      .insert(productVariants)
      .values({
        id: nanoid(),
        shopId,
        productId: data.productId,
        name: data.name,
        barcode: data.barcode || undefined,
        buyingPrice: data.buyingPrice,
        sellingPrice: data.sellingPrice,
        stockQty: data.stockQty,
      })
      .returning()

    // Flag the parent as having variants
    await db
      .update(products)
      .set({ hasVariants: true })
      .where(and(eq(products.id, data.productId), eq(products.shopId, shopId)))

    return variant
  })

export const updateVariant = createServerFn({ method: 'POST' })
  .inputValidator(variantSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')
    const { id, productId, ...rest } = data
    const [variant] = await db
      .update(productVariants)
      .set({
        name: rest.name,
        barcode: rest.barcode || null,
        buyingPrice: rest.buyingPrice,
        sellingPrice: rest.sellingPrice,
        stockQty: rest.stockQty,
      })
      .where(and(eq(productVariants.id, id), eq(productVariants.shopId, shopId)))
      .returning()
    return variant
  })

export const deleteVariant = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), productId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')
    await db
      .update(productVariants)
      .set({ isActive: false })
      .where(and(eq(productVariants.id, data.id), eq(productVariants.shopId, shopId)))

    // If no active variants remain, unflag the parent
    const remaining = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, data.productId),
          eq(productVariants.shopId, shopId),
          eq(productVariants.isActive, true),
        ),
      )
    if (remaining.length === 0) {
      await db
        .update(products)
        .set({ hasVariants: false })
        .where(and(eq(products.id, data.productId), eq(products.shopId, shopId)))
    }
  })
