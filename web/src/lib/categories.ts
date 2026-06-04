import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { categories, products } from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

export const listCategoriesWithCounts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'categories')
    return db
      .select({
        id: categories.id,
        name: categories.name,
        productCount: sql<number>`cast(count(${products.id}) as int)`,
      })
      .from(categories)
      .leftJoin(
        products,
        and(eq(products.categoryId, categories.id), eq(products.isActive, true)),
      )
      .where(eq(categories.shopId, shopId))
      .groupBy(categories.id, categories.name)
      .orderBy(categories.name)
  },
)

export const createCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'categories')
    const name = data.name.trim()

    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.shopId, ctx.shopId), eq(categories.name, name)))
      .limit(1)
    if (existing[0]) throw new Error('A category with that name already exists')

    const [cat] = await db
      .insert(categories)
      .values({ id: nanoid(), shopId: ctx.shopId, name })
      .returning()

    await logActivity(db, {
      shopId: ctx.shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'category.created',
      entityType: 'category',
      entityId: cat.id,
      description: `Created category "${name}"`,
    })

    return cat
  })

export const renameCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'categories')
    const name = data.name.trim()
    const [cat] = await db
      .update(categories)
      .set({ name })
      .where(and(eq(categories.id, data.id), eq(categories.shopId, shopId)))
      .returning()
    return cat
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'categories')

    const [cat] = await db
      .select({ name: categories.name })
      .from(categories)
      .where(and(eq(categories.id, data.id), eq(categories.shopId, ctx.shopId)))
      .limit(1)
    if (!cat) throw new Error('Category not found')

    // Products keep existing — their categoryId is set null via FK onDelete
    await db
      .delete(categories)
      .where(and(eq(categories.id, data.id), eq(categories.shopId, ctx.shopId)))

    await logActivity(db, {
      shopId: ctx.shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'category.deleted',
      entityType: 'category',
      entityId: data.id,
      description: `Deleted category "${cat.name}"`,
    })
  })
