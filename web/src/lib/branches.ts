import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import {
  branches,
  products,
  stockTransferItems,
  stockTransfers,
} from '#/db/schema'
import { logActivity } from './activity'
import { getShopCtx, getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

// All active + inactive branches with a live SKU / stock summary.
export const listBranches = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId, branchId: activeBranchId } = await getShopCtx(request.headers)

    const rows = await db
      .select({
        id: branches.id,
        name: branches.name,
        address: branches.address,
        phone: branches.phone,
        isMain: branches.isMain,
        isActive: branches.isActive,
        skuCount: sql<number>`cast(count(${products.id}) filter (where ${products.isActive} = true) as int)`,
        unitsInStock: sql<number>`cast(coalesce(sum(${products.stockQty}) filter (where ${products.isActive} = true), 0) as int)`,
      })
      .from(branches)
      .leftJoin(products, eq(products.branchId, branches.id))
      .where(eq(branches.shopId, shopId))
      .groupBy(branches.id)
      .orderBy(desc(branches.isMain), asc(branches.createdAt))

    return { branches: rows, activeBranchId }
  },
)

// Lightweight list for the branch switcher (active branches only).
export const listActiveBranches = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId, branchId } = await getShopCtx(request.headers)
    const rows = await db
      .select({ id: branches.id, name: branches.name, isMain: branches.isMain })
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.isActive, true)))
      .orderBy(desc(branches.isMain), asc(branches.createdAt))
    return { branches: rows, activeBranchId: branchId }
  },
)

export const createBranch = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      phone: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'settings')
    const id = nanoid()
    await db.insert(branches).values({
      id,
      shopId: ctx.shopId,
      name: data.name,
      address: data.address,
      phone: data.phone,
      isMain: false,
      isActive: true,
    })
    await logActivity(db, {
      shopId: ctx.shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: 'branch.created',
      entityType: 'branch',
      entityId: id,
      description: `Created branch "${data.name}"`,
    })
    return { id }
  })

export const updateBranch = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      address: z.string().optional(),
      phone: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'settings')

    // Don't allow deactivating the main branch.
    const [branch] = await db
      .select({ isMain: branches.isMain })
      .from(branches)
      .where(and(eq(branches.id, data.id), eq(branches.shopId, shopId)))
      .limit(1)
    if (!branch) throw new Error('Branch not found')
    if (branch.isMain && data.isActive === false)
      throw new Error('Cannot deactivate the main branch')

    await db
      .update(branches)
      .set({
        name: data.name,
        address: data.address,
        phone: data.phone,
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      })
      .where(and(eq(branches.id, data.id), eq(branches.shopId, shopId)))
  })

// Promote a branch to main (demotes the previous main).
export const setMainBranch = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'settings')
    await db.transaction(async (tx) => {
      await tx
        .update(branches)
        .set({ isMain: false })
        .where(eq(branches.shopId, shopId))
      await tx
        .update(branches)
        .set({ isMain: true, isActive: true })
        .where(and(eq(branches.id, data.id), eq(branches.shopId, shopId)))
    })
  })

// Plain (non-variant) products in one branch — the transferable stock.
export const listBranchStock = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ branchId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(
      request.headers,
      'products:write',
    )
    return db
      .select({
        id: products.id,
        name: products.name,
        stockQty: products.stockQty,
        barcode: products.barcode,
      })
      .from(products)
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.branchId, data.branchId),
          eq(products.isActive, true),
          eq(products.hasVariants, false),
        ),
      )
      .orderBy(products.name)
  })

const transferItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
})

// Move stock from one branch to another. For each line: decrement the source
// product, then find (by barcode, else name) or create the matching product in
// the destination branch and increment it.
export const createTransfer = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      fromBranchId: z.string(),
      toBranchId: z.string(),
      note: z.string().optional(),
      items: z.array(transferItemSchema).min(1),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'products:write')
    const { shopId } = ctx
    if (data.fromBranchId === data.toBranchId)
      throw new Error('Source and destination branches must differ')

    const validBranches = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.isActive, true)))
    const ids = new Set(validBranches.map((b) => b.id))
    if (!ids.has(data.fromBranchId) || !ids.has(data.toBranchId))
      throw new Error('Invalid branch')

    return db.transaction(async (tx) => {
      const transferId = nanoid()
      await tx.insert(stockTransfers).values({
        id: transferId,
        shopId,
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        note: data.note,
      })

      for (const item of data.items) {
        const [src] = await tx
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, item.productId),
              eq(products.shopId, shopId),
              eq(products.branchId, data.fromBranchId),
            ),
          )
          .limit(1)
        if (!src) throw new Error('Product not in source branch')
        if (src.stockQty < item.quantity)
          throw new Error(`Not enough stock of ${src.name}`)

        await tx
          .update(products)
          .set({ stockQty: sql`${products.stockQty} - ${item.quantity}` })
          .where(eq(products.id, src.id))

        // Find the matching product in the destination branch.
        const matchConds = [
          eq(products.shopId, shopId),
          eq(products.branchId, data.toBranchId),
          eq(products.hasVariants, false),
        ]
        const [dest] = await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              ...matchConds,
              src.barcode
                ? eq(products.barcode, src.barcode)
                : eq(products.name, src.name),
            ),
          )
          .limit(1)

        if (dest) {
          await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} + ${item.quantity}` })
            .where(eq(products.id, dest.id))
        } else {
          await tx.insert(products).values({
            id: nanoid(),
            shopId,
            branchId: data.toBranchId,
            name: src.name,
            categoryId: src.categoryId,
            buyingPrice: src.buyingPrice,
            sellingPrice: src.sellingPrice,
            stockQty: item.quantity,
            lowStockThreshold: src.lowStockThreshold,
            supplierId: src.supplierId,
            barcode: src.barcode,
            imageUrl: src.imageUrl,
          })
        }

        await tx.insert(stockTransferItems).values({
          id: nanoid(),
          transferId,
          name: src.name,
          quantity: item.quantity,
        })
      }

      await logActivity(tx, {
        shopId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        action: 'stock.transferred',
        entityType: 'transfer',
        entityId: transferId,
        description: `Transferred ${data.items.length} item(s) between branches`,
      })

      return { id: transferId }
    })
  })

export const listTransfers = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(
      request.headers,
      'products:write',
    )
    return db
      .select({
        id: stockTransfers.id,
        note: stockTransfers.note,
        actorName: stockTransfers.actorName,
        createdAt: stockTransfers.createdAt,
        fromName: sql<string>`(select name from ${branches} where id = ${stockTransfers.fromBranchId})`,
        toName: sql<string>`(select name from ${branches} where id = ${stockTransfers.toBranchId})`,
        itemCount: sql<number>`cast((select count(*) from ${stockTransferItems} where transfer_id = ${stockTransfers.id}) as int)`,
        units: sql<number>`cast(coalesce((select sum(quantity) from ${stockTransferItems} where transfer_id = ${stockTransfers.id}), 0) as int)`,
      })
      .from(stockTransfers)
      .where(eq(stockTransfers.shopId, shopId))
      .orderBy(desc(stockTransfers.createdAt))
      .limit(100)
  },
)
