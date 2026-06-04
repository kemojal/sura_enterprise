import { and, asc, eq, lte } from 'drizzle-orm'

import { db } from '#/db/index'
import { products, shops, user } from '#/db/schema'
import { sendLowStockAlert } from './email'

export interface DigestResult {
  shopsScanned: number
  shopsNotified: number
  emailsSent: number
  details: { shop: string; lowItems: number; sent: boolean; reason?: string }[]
}

/**
 * Daily low-stock digest. For every shop with alerts enabled, find active
 * products at or below their threshold and email the owner a single summary.
 * Idempotent to run repeatedly; intended to be triggered once a day by an
 * external scheduler via the protected /api/cron/low-stock route.
 */
export async function runLowStockDigest(): Promise<DigestResult> {
  const enabledShops = await db
    .select({ id: shops.id, name: shops.name, ownerId: shops.ownerId })
    .from(shops)
    .where(eq(shops.lowStockAlertsEnabled, true))

  const result: DigestResult = {
    shopsScanned: enabledShops.length,
    shopsNotified: 0,
    emailsSent: 0,
    details: [],
  }

  for (const shop of enabledShops) {
    const lowItems = await db
      .select({
        name: products.name,
        stockQty: products.stockQty,
        lowStockThreshold: products.lowStockThreshold,
      })
      .from(products)
      .where(
        and(
          eq(products.shopId, shop.id),
          eq(products.isActive, true),
          lte(products.stockQty, products.lowStockThreshold),
        ),
      )
      .orderBy(asc(products.stockQty))

    if (lowItems.length === 0) {
      result.details.push({ shop: shop.name, lowItems: 0, sent: false, reason: 'all stocked' })
      continue
    }

    const [owner] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, shop.ownerId))
      .limit(1)

    if (!owner?.email) {
      result.details.push({
        shop: shop.name,
        lowItems: lowItems.length,
        sent: false,
        reason: 'no owner email',
      })
      continue
    }

    try {
      await sendLowStockAlert({
        ownerEmail: owner.email,
        shopName: shop.name,
        items: lowItems,
      })
      result.shopsNotified += 1
      result.emailsSent += 1
      result.details.push({ shop: shop.name, lowItems: lowItems.length, sent: true })
    } catch (err) {
      result.details.push({
        shop: shop.name,
        lowItems: lowItems.length,
        sent: false,
        reason: err instanceof Error ? err.message : 'send failed',
      })
    }
  }

  return result
}
