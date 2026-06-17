import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { fieldEdits, fieldPermissions, recordLocks } from '#/db/schema'
import { getShopCtxWithPermission } from '#/lib/context'
import { logActivity } from '#/lib/activity'
import { nanoid } from '#/lib/nanoid'
import { authorizeFieldEdit } from './authorize'
import { getResource } from './registry'

// Serialize a field value for the audit trail without losing fidelity on
// numbers, booleans, or dates (the registry will gain such fields in rollout).
function auditValue(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ── The one enforced inline-edit mutation ────────────────────────────────────
export const updateRecordField = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      resource: z.string(),
      id: z.string(),
      field: z.string(),
      value: z.unknown(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const def = getResource(data.resource)
    if (!def) throw new Error('Unknown resource')

    const ctx = await getShopCtxWithPermission(
      request.headers,
      def.permission,
    )

    const perms = await db
      .select()
      .from(fieldPermissions)
      .where(eq(fieldPermissions.shopId, ctx.shopId))
    const locks = await db
      .select()
      .from(recordLocks)
      .where(
        and(
          eq(recordLocks.shopId, ctx.shopId),
          eq(recordLocks.entityType, def.entityType),
          eq(recordLocks.entityId, data.id),
        ),
      )

    const decision = authorizeFieldEdit({
      resource: data.resource,
      field: data.field,
      role: ctx.role,
      rawValue: data.value,
      entityId: data.id,
      perms,
      locks,
    })
    if (!decision.ok) throw new Error(decision.reason)

    const table = def.table as any

    return db.transaction(async (tx) => {
      const found = await tx
        .select()
        .from(table)
        .where(and(eq(table.id, data.id), eq(table.shopId, ctx.shopId)))
        .limit(1)
      const current = found[0] as Record<string, unknown> | undefined
      if (!current) throw new Error('Record not found')

      const oldValue = current[data.field] ?? null
      const [updated] = await tx
        .update(table)
        .set({ [data.field]: decision.parsed })
        .where(and(eq(table.id, data.id), eq(table.shopId, ctx.shopId)))
        .returning()

      await tx.insert(fieldEdits).values({
        id: nanoid(),
        shopId: ctx.shopId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        entityType: def.entityType,
        entityId: data.id,
        field: data.field,
        oldValue: auditValue(oldValue),
        newValue: auditValue(decision.parsed),
      })

      await logActivity(tx, {
        shopId: ctx.shopId,
        staffId: ctx.staffId,
        actorName: ctx.userName,
        action: `${def.entityType}.field_edited`,
        entityType: def.entityType,
        entityId: data.id,
        description: `${ctx.userName ?? 'Someone'} changed ${data.field}: ${
          oldValue ?? '—'
        } → ${decision.parsed ?? '—'}`,
      })

      return updated
    })
  })

// ── Owner: lock / unlock a record ─────────────────────────────────────────────
export const setRecordLock = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      entityType: z.string(),
      entityId: z.string(),
      unlocked: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'settings') // owner-only
    await db
      .insert(recordLocks)
      .values({
        id: nanoid(),
        shopId: ctx.shopId,
        entityType: data.entityType,
        entityId: data.entityId,
        unlocked: data.unlocked,
        unlockedById: data.unlocked ? ctx.staffId : null,
        unlockedAt: data.unlocked ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [recordLocks.shopId, recordLocks.entityType, recordLocks.entityId],
        set: {
          unlocked: data.unlocked,
          unlockedById: data.unlocked ? ctx.staffId : null,
          unlockedAt: data.unlocked ? new Date() : null,
        },
      })
    await logActivity(db, {
      shopId: ctx.shopId,
      staffId: ctx.staffId,
      actorName: ctx.userName,
      action: data.unlocked ? `${data.entityType}.unlocked` : `${data.entityType}.locked`,
      entityType: data.entityType,
      entityId: data.entityId,
      description: `${ctx.userName ?? 'Owner'} ${
        data.unlocked ? 'unlocked' : 'locked'
      } a ${data.entityType} for editing`,
    })
    return { ok: true }
  })

// ── Owner: read / set field permissions ───────────────────────────────────────
export const getFieldPermissions = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'settings')
    return db
      .select()
      .from(fieldPermissions)
      .where(eq(fieldPermissions.shopId, ctx.shopId))
  },
)

export const setFieldPermission = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      resource: z.string(),
      field: z.string(),
      role: z.enum(['manager', 'cashier']),
      canEdit: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'settings')
    await db
      .insert(fieldPermissions)
      .values({ id: nanoid(), shopId: ctx.shopId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          fieldPermissions.shopId,
          fieldPermissions.resource,
          fieldPermissions.field,
          fieldPermissions.role,
        ],
        set: { canEdit: data.canEdit, updatedAt: new Date() },
      })
    return { ok: true }
  })

// ── Per-record edit history ───────────────────────────────────────────────────
export const listFieldEdits = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ entityType: z.string(), entityId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'activity')
    return db
      .select()
      .from(fieldEdits)
      .where(
        and(
          eq(fieldEdits.shopId, ctx.shopId),
          eq(fieldEdits.entityType, data.entityType),
          eq(fieldEdits.entityId, data.entityId),
        ),
      )
      .orderBy(desc(fieldEdits.createdAt))
      .limit(100)
  })
