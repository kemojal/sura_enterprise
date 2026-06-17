# Editable Grids — Foundation + Suppliers Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the editable-grid foundation (Glide Data Grid, per-role × per-field permissions, lock-after-entry, field-level audit) end-to-end on the Suppliers page, proving the pattern before rolling out to the other four pages.

**Architecture:** All edit authority lives server-side in one enforced `updateRecordField` server function, which composes a pure, unit-tested authorizer (`authorizeFieldEdit`) over a column registry + permission/lock resolvers. The grid is a thin client-only Glide wrapper; the existing read-only table is the SSR/hydration fallback. Owner manages field permissions in Settings and unlocks records per row; every edit writes a `fieldEdits` audit row plus an `activityLog` summary.

**Tech Stack:** TanStack Start + React 19, Drizzle ORM + Neon Postgres, `@glideapps/glide-data-grid`, zod, vitest.

**Scope note:** This plan covers the foundation + the Suppliers vertical slice (all-text fields, non-financial). The rollout to Expenses, Products, Sales (financial/lock-critical), and PO-new (entry grid, dropdown/number cells) are separate follow-on plans that reuse this foundation. Spec: `docs/superpowers/specs/2026-06-17-editable-grids-field-permissions-audit-design.md`.

---

## File Structure

**New files**
- `src/lib/grid/registry.ts` — resource/field registry (single source of truth). Suppliers def here; later plans append resources.
- `src/lib/grid/permissions.ts` — pure resolvers `resolveFieldPermission`, `isLocked` + row types.
- `src/lib/grid/authorize.ts` — pure `authorizeFieldEdit` decision function.
- `src/lib/grid/server.ts` — server fns: `updateRecordField`, `setRecordLock`, `getFieldPermissions`, `setFieldPermission`, `listFieldEdits`.
- `src/lib/grid/registry.test.ts`, `permissions.test.ts`, `authorize.test.ts` — vitest (node env, pure, no DB).
- `src/components/grid/cells.ts` — pure cell/column model builders (`buildColumns`, `cellModel`).
- `src/components/grid/cells.test.ts` — vitest.
- `src/components/grid/glide-impl.tsx` — heavy client chunk: imports Glide, maps CellModel→GridCell, renders `DataEditor`. Lazy-loaded.
- `src/components/grid/data-grid.tsx` — SSR-safe boundary: mounted gate + `Suspense` + fallback table.
- `src/components/grid/record-history.tsx` — per-row audit popover (uses `listFieldEdits`).
- `src/components/settings/field-permissions-panel.tsx` — owner permission matrix.

**Modified files**
- `src/db/schema.ts` — add `fieldPermissions`, `recordLocks`, `fieldEdits` tables; add `unique` to the pg-core import.
- `src/routes/__root.tsx` — add `<div id="portal" />` for Glide overlay editors.
- `src/lib/queries.ts` — add `suppliersGridQuery` bundling suppliers + perms + locks.
- `src/routes/app/suppliers/index.tsx` — render `DataGrid` (client) with the existing table as fallback; owner lock toggles + history.
- `src/routes/app/settings.tsx` — mount the field-permissions panel.
- `web/package.json` — new deps.

---

## Task 1: Install Glide Data Grid

**Files:** `web/package.json`, `web/package-lock.json`

- [ ] **Step 1: Install**

Run (from `web/`):
```bash
npm install @glideapps/glide-data-grid @glideapps/glide-data-grid-cells
```
Expected: both added to `dependencies`. (`glide-data-grid-cells` is for dropdown/number custom cells used by later rollout plans; install now so the foundation is complete.)

- [ ] **Step 2: Verify dev server still boots**

Run: `npm run dev` then Ctrl-C after it prints the local URL.
Expected: no module-resolution errors.

- [ ] **Step 3: Commit**
```bash
git add web/package.json web/package-lock.json
git commit -m "build: add glide-data-grid for editable grids"
```

---

## Task 2: Database schema — permission, lock, audit tables

**Files:** Modify `src/db/schema.ts`

- [ ] **Step 1: Extend the pg-core import**

Change the top import (currently lines 1-9) to add `unique`:
```ts
import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
```

- [ ] **Step 2: Append the three tables**

Add at the end of `src/db/schema.ts`:
```ts
// ─── Editable-grid: field permissions, record locks, field-level audit ───────

// Owner-configured per-role × per-field edit rights. Missing row → coded
// default in the registry resolver. Owner is always allowed (never stored).
export const fieldPermissions = pgTable(
  'field_permissions',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    resource: text('resource').notNull(), // 'suppliers' | 'expenses' | …
    field: text('field').notNull(), // registry field key
    role: text('role').notNull(), // 'manager' | 'cashier'
    canEdit: boolean('can_edit').notNull().default(false),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [unique('field_perm_uq').on(t.shopId, t.resource, t.field, t.role)],
)

// A record is LOCKED for staff editing unless an unlocked=true row exists.
// Owner edits always bypass the lock.
export const recordLocks = pgTable(
  'record_locks',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'supplier' | 'expense' | …
    entityId: text('entity_id').notNull(),
    unlocked: boolean('unlocked').notNull().default(false),
    unlockedById: text('unlocked_by_id').references(() => staffMembers.id, {
      onDelete: 'set null',
    }),
    unlockedAt: timestamp('unlocked_at'),
  },
  (t) => [unique('record_lock_uq').on(t.shopId, t.entityType, t.entityId)],
)

// Field-level before→after audit. Actor name denormalized so the trail
// survives staff deletion.
export const fieldEdits = pgTable('field_edits', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  actorName: text('actor_name'),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

- [ ] **Step 3: Generate the migration**

Run (from `web/`): `npm run db:generate`
Expected: a new SQL file under `web/drizzle/` creating `field_permissions`, `record_locks`, `field_edits` with the two unique constraints.

- [ ] **Step 4: Apply to the dev DB**

Run (from `web/`): `npm run db:push`
Expected: "Changes applied". (Requires `DATABASE_URL` in `.env.local` — already present.)

- [ ] **Step 5: Commit**
```bash
git add web/src/db/schema.ts web/drizzle
git commit -m "feat(db): add field_permissions, record_locks, field_edits"
```

---

## Task 3: Column registry

**Files:** Create `src/lib/grid/registry.ts`, Test `src/lib/grid/registry.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/grid/registry.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { REGISTRY, getField } from './registry'

describe('registry: suppliers', () => {
  it('exposes a suppliers resource with a name field', () => {
    expect(REGISTRY.suppliers.entityType).toBe('supplier')
    expect(getField('suppliers', 'name')?.label).toBe('Name')
  })

  it('name validator rejects empty, accepts non-empty (trimmed)', () => {
    const name = getField('suppliers', 'name')!.validator
    expect(name.safeParse('').success).toBe(false)
    expect(name.safeParse('  Acme  ').success).toBe(true)
    expect(name.safeParse('  Acme  ').data).toBe('Acme')
  })

  it('email validator accepts blank→null and valid email, rejects junk', () => {
    const email = getField('suppliers', 'email')!.validator
    expect(email.safeParse('').data).toBe(null)
    expect(email.safeParse('a@b.com').data).toBe('a@b.com')
    expect(email.safeParse('nope').success).toBe(false)
  })

  it('getField returns undefined for unknown field', () => {
    expect(getField('suppliers', 'bogus')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run (from `web/`): `npx vitest run src/lib/grid/registry.test.ts`
Expected: FAIL — cannot find module `./registry`.

- [ ] **Step 3: Implement the registry**

`src/lib/grid/registry.ts`:
```ts
import { z } from 'zod'
import type { PgTable } from 'drizzle-orm/pg-core'

import { suppliers } from '#/db/schema'
import type { Resource, StaffRole } from '#/lib/permissions'

export type CellKind = 'text' | 'number' | 'currency' | 'enum' | 'boolean'
export type NonOwnerRole = Exclude<StaffRole, 'owner'>

export interface FieldDef {
  key: string // drizzle column property + logical field key
  label: string
  kind: CellKind
  validator: z.ZodType // validates + normalizes the incoming value
  financial?: boolean
  editableByDefault?: Partial<Record<NonOwnerRole, boolean>>
}

export interface ResourceDef {
  resource: string
  entityType: string // for record_locks / field_edits
  permission: Resource // permission gate for the underlying mutation
  table: PgTable
  fields: FieldDef[]
}

// Optional free text: blank string normalizes to null.
const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))

const optionalEmail = z
  .string()
  .trim()
  .email()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))

export const REGISTRY: Record<string, ResourceDef> = {
  suppliers: {
    resource: 'suppliers',
    entityType: 'supplier',
    permission: 'suppliers',
    table: suppliers,
    fields: [
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        validator: z.string().trim().min(1).max(200),
        editableByDefault: { manager: true },
      },
      {
        key: 'phone',
        label: 'Phone',
        kind: 'text',
        validator: optionalText,
        editableByDefault: { manager: true },
      },
      {
        key: 'email',
        label: 'Email',
        kind: 'text',
        validator: optionalEmail,
        editableByDefault: { manager: true },
      },
      {
        key: 'address',
        label: 'Address',
        kind: 'text',
        validator: optionalText,
        editableByDefault: { manager: true },
      },
      {
        key: 'notes',
        label: 'Notes',
        kind: 'text',
        validator: optionalText,
        editableByDefault: { manager: true },
      },
    ],
  },
}

export function getResource(resource: string): ResourceDef | undefined {
  return REGISTRY[resource]
}

export function getField(resource: string, field: string): FieldDef | undefined {
  return REGISTRY[resource]?.fields.find((f) => f.key === field)
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run src/lib/grid/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add web/src/lib/grid/registry.ts web/src/lib/grid/registry.test.ts
git commit -m "feat(grid): column registry with suppliers resource"
```

---

## Task 4: Permission + lock resolvers

**Files:** Create `src/lib/grid/permissions.ts`, Test `src/lib/grid/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/grid/permissions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isLocked, resolveFieldPermission } from './permissions'

const perms = [
  { resource: 'suppliers', field: 'notes', role: 'cashier', canEdit: true },
  { resource: 'suppliers', field: 'name', role: 'manager', canEdit: false },
]

describe('resolveFieldPermission', () => {
  it('owner always true', () => {
    expect(resolveFieldPermission(perms, 'suppliers', 'name', 'owner')).toBe(true)
  })
  it('uses explicit DB row over default', () => {
    // manager default for name is true, but DB row says false
    expect(resolveFieldPermission(perms, 'suppliers', 'name', 'manager')).toBe(false)
    // cashier has no registry default (false) but DB grants notes
    expect(resolveFieldPermission(perms, 'suppliers', 'notes', 'cashier')).toBe(true)
  })
  it('falls back to registry default when no row', () => {
    expect(resolveFieldPermission([], 'suppliers', 'phone', 'manager')).toBe(true)
    expect(resolveFieldPermission([], 'suppliers', 'phone', 'cashier')).toBe(false)
  })
  it('unknown field/resource → false', () => {
    expect(resolveFieldPermission([], 'suppliers', 'bogus', 'manager')).toBe(false)
    expect(resolveFieldPermission([], 'bogus', 'x', 'manager')).toBe(false)
  })
})

describe('isLocked', () => {
  it('locked by default (no row)', () => {
    expect(isLocked([], 'supplier', 's1')).toBe(true)
  })
  it('unlocked row → not locked', () => {
    expect(
      isLocked([{ entityType: 'supplier', entityId: 's1', unlocked: true }], 'supplier', 's1'),
    ).toBe(false)
  })
  it('explicit unlocked=false → locked', () => {
    expect(
      isLocked([{ entityType: 'supplier', entityId: 's1', unlocked: false }], 'supplier', 's1'),
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/lib/grid/permissions.test.ts`
Expected: FAIL — cannot find module `./permissions`.

- [ ] **Step 3: Implement**

`src/lib/grid/permissions.ts`:
```ts
import type { StaffRole } from '#/lib/permissions'
import { getField } from './registry'

export interface PermRow {
  resource: string
  field: string
  role: string
  canEdit: boolean
}

export interface LockRow {
  entityType: string
  entityId: string
  unlocked: boolean
}

export function resolveFieldPermission(
  perms: PermRow[],
  resource: string,
  field: string,
  role: StaffRole,
): boolean {
  if (role === 'owner') return true
  const fieldDef = getField(resource, field)
  if (!fieldDef) return false
  const row = perms.find(
    (p) => p.resource === resource && p.field === field && p.role === role,
  )
  if (row) return row.canEdit
  return fieldDef.editableByDefault?.[role as 'manager' | 'cashier'] ?? false
}

// A record is locked unless an explicit unlocked=true row exists for it.
export function isLocked(
  locks: LockRow[],
  entityType: string,
  entityId: string,
): boolean {
  const row = locks.find(
    (l) => l.entityType === entityType && l.entityId === entityId,
  )
  return row?.unlocked !== true
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run src/lib/grid/permissions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**
```bash
git add web/src/lib/grid/permissions.ts web/src/lib/grid/permissions.test.ts
git commit -m "feat(grid): pure permission + lock resolvers"
```

---

## Task 5: Authorizer

**Files:** Create `src/lib/grid/authorize.ts`, Test `src/lib/grid/authorize.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/grid/authorize.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { authorizeFieldEdit } from './authorize'

const base = {
  resource: 'suppliers',
  field: 'name',
  entityId: 's1',
  perms: [],
  locks: [{ entityType: 'supplier', entityId: 's1', unlocked: true }],
}

describe('authorizeFieldEdit', () => {
  it('owner bypasses lock and permission, value validated', () => {
    const r = authorizeFieldEdit({ ...base, role: 'owner', locks: [], rawValue: 'Acme' })
    expect(r).toEqual({ ok: true, parsed: 'Acme', entityType: 'supplier', financial: false })
  })
  it('rejects unknown resource/field', () => {
    expect(authorizeFieldEdit({ ...base, resource: 'x', role: 'owner', rawValue: 'a' }).ok).toBe(false)
    expect(authorizeFieldEdit({ ...base, field: 'x', role: 'owner', rawValue: 'a' }).ok).toBe(false)
  })
  it('rejects invalid value', () => {
    const r = authorizeFieldEdit({ ...base, role: 'owner', rawValue: '' })
    expect(r.ok).toBe(false)
  })
  it('non-owner: rejected when locked', () => {
    const r = authorizeFieldEdit({
      ...base,
      role: 'manager',
      locks: [], // locked by default
      rawValue: 'Acme',
    })
    expect(r).toMatchObject({ ok: false })
  })
  it('non-owner: rejected when field not permitted', () => {
    const r = authorizeFieldEdit({
      ...base,
      role: 'cashier', // no default for suppliers.name
      rawValue: 'Acme',
    })
    expect(r).toMatchObject({ ok: false })
  })
  it('non-owner: allowed when unlocked + permitted', () => {
    const r = authorizeFieldEdit({ ...base, role: 'manager', rawValue: 'Acme' })
    expect(r).toMatchObject({ ok: true, parsed: 'Acme' })
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/lib/grid/authorize.test.ts`
Expected: FAIL — cannot find module `./authorize`.

- [ ] **Step 3: Implement**

`src/lib/grid/authorize.ts`:
```ts
import type { StaffRole } from '#/lib/permissions'
import { getField, getResource } from './registry'
import { isLocked, resolveFieldPermission } from './permissions'
import type { LockRow, PermRow } from './permissions'

export interface AuthzInput {
  resource: string
  field: string
  role: StaffRole
  rawValue: unknown
  entityId: string
  perms: PermRow[]
  locks: LockRow[]
}

export type AuthzResult =
  | { ok: true; parsed: unknown; entityType: string; financial: boolean }
  | { ok: false; reason: string }

export function authorizeFieldEdit(input: AuthzInput): AuthzResult {
  const def = getResource(input.resource)
  const fieldDef = getField(input.resource, input.field)
  if (!def || !fieldDef) return { ok: false, reason: 'Unknown field' }

  const parsed = fieldDef.validator.safeParse(input.rawValue)
  if (!parsed.success) return { ok: false, reason: 'Invalid value' }

  if (input.role !== 'owner') {
    if (!resolveFieldPermission(input.perms, input.resource, input.field, input.role)) {
      return { ok: false, reason: 'You are not allowed to edit this field' }
    }
    if (isLocked(input.locks, def.entityType, input.entityId)) {
      return { ok: false, reason: 'Record is locked — ask the owner to unlock it' }
    }
  }

  return {
    ok: true,
    parsed: parsed.data,
    entityType: def.entityType,
    financial: !!fieldDef.financial,
  }
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run src/lib/grid/authorize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**
```bash
git add web/src/lib/grid/authorize.ts web/src/lib/grid/authorize.test.ts
git commit -m "feat(grid): pure authorizeFieldEdit decision function"
```

---

## Task 6: Server functions

**Files:** Create `src/lib/grid/server.ts`

No unit test (DB-bound). The decision logic is already covered by Task 5; this task wires it to Drizzle. Verification is typecheck + the manual run in Task 12.

- [ ] **Step 1: Implement the server functions**

`src/lib/grid/server.ts`:
```ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { fieldEdits, fieldPermissions, recordLocks } from '#/db/schema'
import type { Resource } from '#/lib/permissions'
import { getShopCtxWithPermission } from '#/lib/context'
import { logActivity } from '#/lib/activity'
import { nanoid } from '#/lib/nanoid'
import { authorizeFieldEdit } from './authorize'
import { getResource } from './registry'

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
      def.permission as Resource,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = def.table as any

    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(table)
        .where(and(eq(table.id, data.id), eq(table.shopId, ctx.shopId)))
        .limit(1)
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
        oldValue: oldValue === null ? null : String(oldValue),
        newValue: decision.parsed == null ? null : String(decision.parsed),
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
```

- [ ] **Step 2: Typecheck**

Run (from `web/`): `npx tsc --noEmit`
Expected: no errors from `src/lib/grid/server.ts`. (Pre-existing errors elsewhere, if any, are out of scope — confirm none are in the new file.)

- [ ] **Step 3: Commit**
```bash
git add web/src/lib/grid/server.ts
git commit -m "feat(grid): enforced updateRecordField + lock/permission/audit server fns"
```

---

## Task 7: Pure cell + column builders

**Files:** Create `src/components/grid/cells.ts`, Test `src/components/grid/cells.test.ts`

These are framework-free so they unit-test without a canvas. Glide-specific mapping happens in Task 8.

- [ ] **Step 1: Write the failing test**

`src/components/grid/cells.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildColumns, cellModel } from './cells'
import type { FieldDef } from '#/lib/grid/registry'

const nameField: FieldDef = {
  key: 'name',
  label: 'Name',
  kind: 'text',
  validator: {} as never,
}
const priceField: FieldDef = {
  key: 'price',
  label: 'Price',
  kind: 'currency',
  validator: {} as never,
}

describe('buildColumns', () => {
  it('maps field defs to grid columns', () => {
    expect(buildColumns([nameField])).toEqual([{ id: 'name', title: 'Name', width: 180 }])
  })
})

describe('cellModel', () => {
  it('text cell, editable', () => {
    expect(cellModel(nameField, 'Acme', true)).toEqual({
      kind: 'text',
      value: 'Acme',
      display: 'Acme',
      readonly: false,
    })
  })
  it('null → empty string', () => {
    expect(cellModel(nameField, null, true).value).toBe('')
  })
  it('currency/number kind maps to number cell, readonly when locked', () => {
    const c = cellModel(priceField, '12.50', false)
    expect(c.kind).toBe('number')
    expect(c.readonly).toBe(true)
    expect(c.display).toBe('12.50')
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/components/grid/cells.test.ts`
Expected: FAIL — cannot find module `./cells`.

- [ ] **Step 3: Implement**

`src/components/grid/cells.ts`:
```ts
import type { FieldDef } from '#/lib/grid/registry'

export interface GridColumnModel {
  id: string
  title: string
  width: number
}

export interface CellModel {
  kind: 'text' | 'number'
  value: string
  display: string
  readonly: boolean
}

export function buildColumns(fields: FieldDef[]): GridColumnModel[] {
  return fields.map((f) => ({ id: f.key, title: f.label, width: 180 }))
}

export function cellModel(
  field: FieldDef,
  raw: unknown,
  editable: boolean,
): CellModel {
  const str = raw == null ? '' : String(raw)
  const kind: CellModel['kind'] =
    field.kind === 'number' || field.kind === 'currency' ? 'number' : 'text'
  return { kind, value: str, display: str, readonly: !editable }
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run src/components/grid/cells.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add web/src/components/grid/cells.ts web/src/components/grid/cells.test.ts
git commit -m "feat(grid): pure column + cell model builders"
```

---

## Task 8: Glide implementation chunk (client, lazy)

**Files:** Create `src/components/grid/glide-impl.tsx`

Renders Glide's `DataEditor`. Lazy-loaded so it never evaluates during SSR. Verified by the manual run in Task 12 (canvas grids are not unit-testable in jsdom).

- [ ] **Step 1: Implement**

`src/components/grid/glide-impl.tsx`:
```tsx
import {
  DataEditor,
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type Item,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { useCallback } from 'react'

import type { FieldDef } from '#/lib/grid/registry'
import { buildColumns, cellModel } from './cells'

export interface GlideGridProps {
  fields: FieldDef[]
  rows: Array<Record<string, unknown>>
  // (rowIndex, fieldKey) → can this cell be edited right now?
  isEditable: (rowIndex: number, fieldKey: string) => boolean
  // Commit one cell edit; resolve with true on success, false to revert.
  onEdit: (rowIndex: number, fieldKey: string, value: unknown) => Promise<boolean>
}

const lockedTheme = { bgCell: '#f3f4f6', textDark: '#9ca3af' }

export default function GlideGrid({
  fields,
  rows,
  isEditable,
  onEdit,
}: GlideGridProps) {
  const columns = buildColumns(fields).map((c) => ({ id: c.id, title: c.title, width: c.width }))

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const field = fields[col]
      const editable = isEditable(row, field.key)
      const m = cellModel(field, rows[row]?.[field.key], editable)
      const themeOverride = editable ? undefined : lockedTheme
      if (m.kind === 'number') {
        const n = rows[row]?.[field.key]
        return {
          kind: GridCellKind.Number,
          data: n == null || n === '' ? undefined : Number(n),
          displayData: m.display,
          allowOverlay: editable,
          readonly: !editable,
          themeOverride,
        }
      }
      return {
        kind: GridCellKind.Text,
        data: m.value,
        displayData: m.display,
        allowOverlay: editable,
        readonly: !editable,
        themeOverride,
      }
    },
    [fields, rows, isEditable],
  )

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell
      const field = fields[col]
      const value =
        newValue.kind === GridCellKind.Number ? newValue.data : (newValue.data as string)
      // Glide is synchronous here; the parent updates `rows` state on success
      // (which redraws) or leaves it unchanged on failure (which reverts).
      void onEdit(row, field.key, value)
    },
    [fields, onEdit],
  )

  return (
    <div className="app-card overflow-hidden" style={{ height: 560 }}>
      <DataEditor
        columns={columns}
        rows={rows.length}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        smoothScrollX
        smoothScrollY
        rowMarkers="number"
        width="100%"
        height={560}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `glide-impl.tsx`. (If Glide's `width` prop rejects `"100%"`, drop the `width` prop and let it fill the sized container — note for the implementer.)

- [ ] **Step 3: Commit**
```bash
git add web/src/components/grid/glide-impl.tsx
git commit -m "feat(grid): lazy Glide DataEditor implementation chunk"
```

---

## Task 9: SSR-safe DataGrid boundary + portal

**Files:** Create `src/components/grid/data-grid.tsx`, Modify `src/routes/__root.tsx`

- [ ] **Step 1: Add the Glide overlay portal to the document body**

In `src/routes/__root.tsx`, inside `RootDocument`'s `<body>`, add the portal div right before `{children}`:
```tsx
      <body>
        <div id="portal" style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000 }} />
        {children}
```
(Glide mounts overlay editors into `#portal`.)

- [ ] **Step 2: Implement the boundary component**

`src/components/grid/data-grid.tsx`:
```tsx
import { Suspense, lazy, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import type { FieldDef } from '#/lib/grid/registry'
import type { GlideGridProps } from './glide-impl'

const GlideGrid = lazy(() => import('./glide-impl'))

export interface DataGridProps extends GlideGridProps {
  // Rendered on the server and until the client grid hydrates.
  fallback: ReactNode
}

export function DataGrid({ fallback, ...grid }: DataGridProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <>{fallback}</>
  return (
    <Suspense fallback={fallback}>
      <GlideGrid {...grid} />
    </Suspense>
  )
}

export type { FieldDef }
```

- [ ] **Step 3: Typecheck + boot**

Run: `npx tsc --noEmit` then `npm run dev` (Ctrl-C after URL prints).
Expected: no type errors; dev server boots (SSR does not import Glide).

- [ ] **Step 4: Commit**
```bash
git add web/src/components/grid/data-grid.tsx web/src/routes/__root.tsx
git commit -m "feat(grid): SSR-safe DataGrid boundary + overlay portal"
```

---

## Task 10: Record-history popover

**Files:** Create `src/components/grid/record-history.tsx`

- [ ] **Step 1: Implement**

`src/components/grid/record-history.tsx`:
```tsx
import { useState } from 'react'
import { History } from 'lucide-react'

import { listFieldEdits } from '#/lib/grid/server'

export function RecordHistory({
  entityType,
  entityId,
  label,
}: {
  entityType: string
  entityId: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [edits, setEdits] = useState<
    Awaited<ReturnType<typeof listFieldEdits>>
  >([])
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!open) {
      setLoading(true)
      try {
        setEdits(await listFieldEdits({ data: { entityType, entityId } }))
      } finally {
        setLoading(false)
      }
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={toggle}
        title="Edit history"
        className="inline-flex items-center gap-1 text-xs text-lagoon-deep hover:underline"
      >
        <History size={13} /> History
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-80 app-card p-3 text-xs shadow-xl">
          <p className="font-semibold text-sea-ink mb-2">{label} — edits</p>
          {loading ? (
            <p className="text-sea-ink-soft">Loading…</p>
          ) : edits.length === 0 ? (
            <p className="text-sea-ink-soft">No edits recorded.</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {edits.map((e) => (
                <li key={e.id} className="border-b border-line pb-1.5">
                  <span className="font-medium text-sea-ink">{e.field}</span>{' '}
                  <span className="text-sea-ink-soft">
                    {e.oldValue ?? '—'} → {e.newValue ?? '—'}
                  </span>
                  <div className="text-[11px] text-sea-ink-soft">
                    {e.actorName ?? 'Someone'} ·{' '}
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `record-history.tsx`.

- [ ] **Step 3: Commit**
```bash
git add web/src/components/grid/record-history.tsx
git commit -m "feat(grid): per-record edit-history popover"
```

---

## Task 11: Owner field-permissions panel in Settings

**Files:** Create `src/components/settings/field-permissions-panel.tsx`, Modify `src/routes/app/settings.tsx`

- [ ] **Step 1: Implement the panel**

`src/components/settings/field-permissions-panel.tsx`:
```tsx
import { useEffect, useState } from 'react'

import { REGISTRY } from '#/lib/grid/registry'
import { resolveFieldPermission } from '#/lib/grid/permissions'
import type { PermRow } from '#/lib/grid/permissions'
import { getFieldPermissions, setFieldPermission } from '#/lib/grid/server'

const ROLES = ['manager', 'cashier'] as const

export function FieldPermissionsPanel() {
  const [perms, setPerms] = useState<PermRow[]>([])
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    getFieldPermissions().then((rows) => setPerms(rows as PermRow[]))
  }, [])

  async function toggle(
    resource: string,
    field: string,
    role: (typeof ROLES)[number],
    next: boolean,
  ) {
    const key = `${resource}.${field}.${role}`
    setSaving(key)
    try {
      await setFieldPermission({ data: { resource, field, role, canEdit: next } })
      setPerms((prev) => {
        const rest = prev.filter(
          (p) => !(p.resource === resource && p.field === field && p.role === role),
        )
        return [...rest, { resource, field, role, canEdit: next }]
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="app-card p-5 space-y-5">
      <div>
        <h3 className="display-title text-lg font-bold text-sea-ink">
          Edit permissions
        </h3>
        <p className="text-sm text-sea-ink-soft">
          Choose which fields each role may edit in the grids. You (owner) can
          always edit. Every edit is recorded in Activity.
        </p>
      </div>

      {Object.values(REGISTRY).map((res) => (
        <div key={res.resource}>
          <p className="text-sm font-semibold text-sea-ink capitalize mb-2">
            {res.resource.replace('_', ' ')}
          </p>
          <table className="w-full text-sm">
            <thead className="text-sea-ink-soft text-left">
              <tr>
                <th className="py-1.5 font-medium">Field</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-1.5 font-medium capitalize w-24">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {res.fields.map((f) => (
                <tr key={f.key}>
                  <td className="py-2 text-sea-ink">{f.label}</td>
                  {ROLES.map((role) => {
                    const checked = resolveFieldPermission(
                      perms,
                      res.resource,
                      f.key,
                      role,
                    )
                    const key = `${res.resource}.${f.key}.${role}`
                    return (
                      <td key={role} className="py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving === key}
                          onChange={(e) =>
                            toggle(res.resource, f.key, role, e.target.checked)
                          }
                          className="w-4 h-4 accent-lagoon-deep"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Mount it in Settings**

In `src/routes/app/settings.tsx`, add the import near the other imports:
```tsx
import { FieldPermissionsPanel } from '#/components/settings/field-permissions-panel'
```
Then render `<FieldPermissionsPanel />` inside the settings page layout (place it after the existing settings cards in `SettingsPage`'s returned JSX — match the surrounding container/spacing).

- [ ] **Step 3: Typecheck + manual check**

Run: `npx tsc --noEmit`, then `npm run dev`, sign in as owner, open `/app/settings`.
Expected: an "Edit permissions" card lists Suppliers fields with manager/cashier checkboxes; toggling persists across reload.

- [ ] **Step 4: Commit**
```bash
git add web/src/components/settings/field-permissions-panel.tsx web/src/routes/app/settings.tsx
git commit -m "feat(settings): owner field-permissions matrix"
```

---

## Task 12: Wire the Suppliers page to the grid

**Files:** Modify `src/lib/queries.ts`, Modify `src/routes/app/suppliers/index.tsx`

- [ ] **Step 1: Add a bundled grid query**

In `src/lib/suppliers.ts`, add a loader that returns suppliers + this shop's perms + supplier locks. Append:
```ts
import { fieldPermissions, recordLocks } from '#/db/schema'

export const listSuppliersGrid = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const { shopId, role } = await getShopCtxWithPermission(
      request.headers,
      'suppliers',
    )
    const [rows, perms, locks] = await Promise.all([
      db.select().from(suppliers).where(eq(suppliers.shopId, shopId)).orderBy(suppliers.name),
      db.select().from(fieldPermissions).where(eq(fieldPermissions.shopId, shopId)),
      db
        .select()
        .from(recordLocks)
        .where(and(eq(recordLocks.shopId, shopId), eq(recordLocks.entityType, 'supplier'))),
    ])
    return { rows, perms, locks, role }
  },
)
```

In `src/lib/queries.ts`, add (and import `listSuppliersGrid`):
```ts
import { listSuppliers, listSuppliersGrid } from './suppliers'

export const suppliersGridQuery = () =>
  queryOptions({
    queryKey: ['suppliers', 'grid'],
    queryFn: () => listSuppliersGrid(),
  })
```

- [ ] **Step 2: Rewrite the Suppliers route to use the grid**

Replace `src/routes/app/suppliers/index.tsx` with:
```tsx
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Button } from '#/components/ui/button'
import { DataGrid } from '#/components/grid/data-grid'
import { RecordHistory } from '#/components/grid/record-history'
import { REGISTRY } from '#/lib/grid/registry'
import { isLocked, resolveFieldPermission } from '#/lib/grid/permissions'
import type { LockRow, PermRow } from '#/lib/grid/permissions'
import { updateRecordField, setRecordLock } from '#/lib/grid/server'
import { can } from '#/lib/permissions'
import type { StaffRole } from '#/lib/permissions'
import { suppliersGridQuery } from '#/lib/queries'

export const Route = createFileRoute('/app/suppliers/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'suppliers'))
      throw redirect({ to: '/app/dashboard' })
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(suppliersGridQuery()),
  component: SuppliersPage,
})

const FIELDS = REGISTRY.suppliers.fields

type SupplierRow = Record<string, unknown> & { id: string; name: string }

function SuppliersPage() {
  const initial = Route.useLoaderData()
  const router = useRouter()
  const [rows, setRows] = useState<SupplierRow[]>(initial.rows as SupplierRow[])
  const perms = initial.perms as PermRow[]
  const [locks, setLocks] = useState<LockRow[]>(initial.locks as LockRow[])
  const role = initial.role as StaffRole
  const isOwner = role === 'owner'

  const isEditable = useMemo(
    () => (rowIndex: number, fieldKey: string) => {
      const rec = rows[rowIndex]
      if (!rec) return false
      if (!resolveFieldPermission(perms, 'suppliers', fieldKey, role)) return false
      if (role !== 'owner' && isLocked(locks, 'supplier', rec.id)) return false
      return true
    },
    [rows, perms, locks, role],
  )

  async function onEdit(rowIndex: number, fieldKey: string, value: unknown) {
    const rec = rows[rowIndex]
    try {
      const updated = (await updateRecordField({
        data: { resource: 'suppliers', id: rec.id, field: fieldKey, value },
      })) as SupplierRow
      setRows((prev) =>
        prev.map((r, i) => (i === rowIndex ? { ...r, ...updated } : r)),
      )
      return true
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Edit rejected')
      setRows((prev) => [...prev]) // force redraw → revert the cell
      return false
    }
  }

  async function toggleLock(id: string, currentlyLocked: boolean) {
    await setRecordLock({
      data: { entityType: 'supplier', entityId: id, unlocked: currentlyLocked },
    })
    setLocks((prev) => {
      const rest = prev.filter(
        (l) => !(l.entityType === 'supplier' && l.entityId === id),
      )
      return [...rest, { entityType: 'supplier', entityId: id, unlocked: currentlyLocked }]
    })
    router.invalidate()
  }

  const fallbackTable = (
    <div className="app-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
          <tr>
            {FIELDS.map((f) => (
              <th key={f.key} className="px-4 py-3 font-medium">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-sea-ink/[0.04]">
              {FIELDS.map((f) => (
                <td key={f.key} className="px-4 py-3 text-sea-ink-soft">
                  {(s[f.key] as string) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
          Suppliers
        </h2>
        <Link to="/app/suppliers/new">
          <Button size="sm">+ Add supplier</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No suppliers yet.
        </div>
      ) : (
        <>
          <DataGrid
            fields={FIELDS}
            rows={rows}
            isEditable={isEditable}
            onEdit={onEdit}
            fallback={fallbackTable}
          />

          {isOwner && (
            <div className="app-card p-4">
              <p className="text-sm font-semibold text-sea-ink mb-2">
                Lock / unlock for staff editing
              </p>
              <ul className="divide-y divide-line text-sm">
                {rows.map((s) => {
                  const locked = isLocked(locks, 'supplier', s.id)
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sea-ink">{s.name as string}</span>
                      <span className="flex items-center gap-3">
                        <RecordHistory
                          entityType="supplier"
                          entityId={s.id}
                          label={s.name as string}
                        />
                        <button
                          onClick={() => toggleLock(s.id, locked)}
                          className="text-xs text-lagoon-deep hover:underline"
                        >
                          {locked ? 'Unlock' : 'Lock'}
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in the suppliers route or queries.

- [ ] **Step 4: Manual end-to-end verification**

Run: `npm run dev`. Then:
1. As **owner**, open `/app/suppliers`. Confirm the grid renders with supplier rows (table appears first, then the canvas grid after hydration).
2. Edit a `name` cell → it persists on reload. Open the row's **History** → shows the old→new entry, your name, timestamp.
3. Open `/app/activity` → a "changed name" entry appears.
4. In **Settings → Edit permissions**, uncheck **manager → name**.
5. Sign in as a **manager** staff user. On `/app/suppliers`, the `name` cell is greyed/read-only; editing is rejected. Other permitted fields are editable only if the owner **unlocked** that row.
6. As owner, **Unlock** a row; confirm the manager can now edit that row's permitted fields; **Lock** it again and confirm edits are rejected.

Expected: all six behaviors hold. (If Glide's overlay editor doesn't appear, confirm the `#portal` div from Task 9 exists in the DOM.)

- [ ] **Step 5: Commit**
```bash
git add web/src/lib/suppliers.ts web/src/lib/queries.ts web/src/routes/app/suppliers/index.tsx
git commit -m "feat(suppliers): editable grid with field permissions, locks, audit"
```

---

## Task 13: Full regression + wrap-up

- [ ] **Step 1: Run the whole unit suite**

Run (from `web/`): `npm run test`
Expected: all grid tests pass (registry, permissions, authorize, cells), no regressions.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in `src/lib/grid/**` or `src/components/grid/**`. Fix any.

- [ ] **Step 3: Final commit (if lint produced fixes)**
```bash
git add -A
git commit -m "chore(grid): lint pass for editable-grid foundation"
```

---

## Self-Review (done by plan author)

**Spec coverage:**
- Grid library = Glide ✓ (Tasks 1, 8, 9). Per-role × per-field perms ✓ (Tasks 3–5, 11). Lock-after-entry + owner unlock ✓ (Tasks 2, 6, 12). Field-level before/after audit ✓ (Tasks 2, 6, 10). Central enforced `updateRecordField` ✓ (Task 6). Registry single-source ✓ (Task 3). SSR-safe client-only grid + fallback ✓ (Tasks 8–9, 12). Settings matrix ✓ (Task 11). History popover ✓ (Task 10). Activity feed reuse ✓ (Task 6 logs `*.field_edited`).
- Deferred to follow-on plans (per spec §11–12): Expenses, Products, Sales (financial/lock-critical), PO-new (entry grid + dropdown/number cells). Dropdown cells (`glide-data-grid-cells`) installed but unused until then.

**Type consistency:** `FieldDef`/`ResourceDef` (Task 3) consumed unchanged in Tasks 4–8, 11, 12. `PermRow`/`LockRow` (Task 4) reused in Tasks 6, 12. `authorizeFieldEdit` signature (Task 5) matches its caller in Task 6. `GlideGridProps` (Task 8) matches `DataGrid` (Task 9) and the suppliers caller (Task 12: `fields`, `rows`, `isEditable`, `onEdit`, `fallback`).

**Placeholder scan:** none — every step has runnable code/commands. DB-bound and canvas-render tasks use typecheck + explicit manual steps rather than fake unit tests (honest: those can't be unit-verified without a DB/browser).

**Known implementer watch-points:** (1) Glide `DataEditor` `width="100%"` may need to be dropped in favor of container sizing — noted in Task 8. (2) `db.transaction` on neon-serverless Pool driver is supported; if the driver rejects it, fall back to sequential writes (the audit insert + update stay best-effort-ordered). (3) `npx tsc --noEmit` may surface pre-existing repo errors unrelated to this work — only new-file errors block.
