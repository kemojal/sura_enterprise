# Editable Grids + Field Permissions + Edit Audit — Design

**Date:** 2026-06-17
**Status:** Approved (shape), pending implementation plan
**Author:** Kemo + Claude

## 1. Goal

Give five data-entry pages an Excel-like editable grid, with owner-configurable
per-field edit permissions and a complete audit trail of who edited what after
data was entered.

Target pages:

- `/app/suppliers`
- `/app/expenses`
- `/app/products`
- `/app/sales`
- `/app/purchase-orders/new`

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Grid library | **Glide Data Grid** (`@glideapps/glide-data-grid`) | React-native canvas grid, true Excel keyboard feel, MIT, SSR-safe with client-only boundary. Binds to typed columns; clean hooks for per-cell editability + edit capture. |
| Permission granularity | **Per-role × per-field** | Owner sets, per resource + column, which roles (manager/cashier) may edit. Owner always allowed. Stored in DB, managed in Settings. |
| Edit-after-entry | **Lock-after-entry, owner unlock required** | Records lock on creation; owner unlocks a row/field for correction; staff edits permitted only while unlocked. Owner bypasses lock. Protects financial reports from silent rewrites. |
| Audit | **Field-level before→after**, dedicated table + reuse of `activityLog` feed | Owner can see exactly what staff changed. |

Rejected: free-form spreadsheet (Luckysheet/Univer) over financial ledgers — data-integrity risk (arbitrary cells/formulas in the books) and no clean binding for typed data + field permissions + audit. Luckysheet is also effectively abandoned (Univer is its successor).

## 3. Current-state map (as built)

- **Roles:** `owner | manager | cashier` on `staffMembers.role`. Access via
  `can(role, resource)` in `src/lib/permissions.ts`. Enforced in route
  `beforeLoad` and server-side `getShopCtxWithPermission(headers, resource)`.
  Role-based only — **no field-level control today**.
- **Activity log:** `activityLog` table (`id, shopId, staffId, actorName, action,
  entityType, entityId, description, createdAt`) + `logActivity(exec, input)`
  helper called inside mutations, best-effort. **No before/after values stored.**
- **Pages:** mostly read-only tables + create-via-modal/route forms. Sales and
  expenses have **no update path** today. Suppliers/products have edit routes.
- **Mutations:** `createServerFn({ method: 'POST' })` + zod `.inputValidator` +
  `getShopCtxWithPermission`. DB = Drizzle + Neon Postgres, schema in
  `src/db/schema.ts`, migrations via `drizzle-kit generate`.

## 4. Data model (new tables, `src/db/schema.ts`)

```
fieldPermissions
  id            text pk
  shopId        text fk shops
  resource      text            -- 'suppliers' | 'expenses' | 'products' | 'sales' | 'purchase_orders'
  field         text            -- column key from registry
  role          text            -- 'manager' | 'cashier'  (owner implicit-allow)
  canEdit       boolean
  updatedAt     timestamp
  unique(shopId, resource, field, role)

recordLocks
  id            text pk
  shopId        text fk shops
  entityType    text            -- 'supplier' | 'expense' | 'product' | 'sale'
  entityId      text
  unlocked      boolean         -- default false (locked)
  unlockedById  text fk staffMembers (nullable)
  unlockedAt    timestamp (nullable)
  unique(shopId, entityType, entityId)

fieldEdits
  id            text pk
  shopId        text fk shops
  staffId       text fk staffMembers (nullable)
  actorName     text            -- denormalized, survives staff deletion
  entityType    text
  entityId      text
  field         text
  oldValue      text (nullable)
  newValue      text (nullable)
  createdAt     timestamp default now
```

`activityLog` is reused for the human-readable summary feed (e.g. action
`sale.field_edited`, description "Cashier John changed Sale #123 amount 100→120").

Defaults: when no `fieldPermissions` row exists for a (resource, field, role),
fall back to a coded default in the resolver (see §6) — no seed data required.
Records are **locked by default** (absence of a `recordLocks.unlocked=true` row
means locked).

## 5. Column registry — `src/lib/grid/registry.ts`

Single source of truth describing every editable resource. Per resource:

```ts
type FieldDef = {
  key: string            // db column / logical field
  label: string
  kind: 'text' | 'number' | 'currency' | 'enum' | 'relation' | 'boolean' | 'date'
  validator: ZodType     // server-side validation of the new value
  financial?: boolean    // financial field (extra-sensitive; lock matters most)
  editableByDefault?: { manager: boolean; cashier: boolean } // coded default
  options?: () => Promise<{ id: string; label: string }[]>   // for enum/relation cells
}

type ResourceDef = {
  resource: string
  entityType: string     // for recordLocks / fieldEdits
  table: PgTable         // drizzle table to update
  pk: 'id'
  fields: FieldDef[]
}
```

The registry drives: grid columns, the permission matrix UI, and server-side
validation/enforcement in `updateRecordField`. One definition, three consumers.

## 6. Central enforced mutation — `updateRecordField`

A single server fn replaces N per-page update functions. Same gauntlet every
call, always server-side:

```
updateRecordField({ resource, id, field, value }):
  1. ctx = getShopCtx(headers)            -> role, shopId, staffId, userName
  2. def = registry[resource]; fieldDef = def.fields.find(field)
     -> reject if unknown resource/field
  3. parsed = fieldDef.validator.parse(value)   -> reject invalid
  4. if role !== 'owner':
        canEdit = resolveFieldPermission(shopId, resource, field, role)
        -> reject if !canEdit
        locked = isLocked(shopId, def.entityType, id)
        -> reject if locked
  5. transaction:
        old = select current value
        update def.table set [field] = parsed where id = id and shopId = shopId
        insert fieldEdits { ...old, new }
        logActivity { action: `${entityType}.field_edited`, description }
  6. return updated row
```

Resolvers (pure, unit-tested):

- `resolveFieldPermission(perms, resource, field, role)` — owner → true; else
  DB row if present, else `fieldDef.editableByDefault[role]`, else false.
- `isLocked(locks, entityType, id)` — true unless an `unlocked=true` row exists.

Rationale: one place enforces validation + permission + lock + audit. Per-page
update fns would duplicate enforcement five times and drift.

## 7. Grid component — `src/components/grid/data-grid.tsx`

- Wraps Glide `DataEditor`. **Client-only** (canvas + browser APIs): render
  inside a mounted/lazy boundary; the existing read-only table stays as the
  SSR/hydration fallback (progressive enhancement).
- Adds `<div id="portal" />` to the root document (`__root.tsx`) for Glide
  overlay editors; imports `@glideapps/glide-data-grid/dist/index.css`.
- Custom theme matching the island design system (sea/lagoon/palm).
- Columns built from the registry. Enum/relation fields (category, supplier,
  payment method) use dropdown cells (`@glideapps/glide-data-grid-cells`).
- `getCellContent`: cell is read-only + greyed when `resolveFieldPermission`
  is false **or** the record is locked (for non-owner).
- `onCellEdited`: optimistic local set → `updateRecordField` → on reject,
  revert the cell and toast the reason.
- Excel feel: arrow-key nav, copy/paste, fill-down, keyboard entry. Entry pages
  (PO-new) get an add-row affordance.
- Currency/number cells parse and format decimal strings (amounts are stored as
  numeric/strings) — no float rounding in the books.

## 8. Permission config UI (owner-only, Settings)

New "Edit permissions" panel in `/app/settings`:

- Per resource, a matrix: rows = fields (from registry), columns = manager /
  cashier, cells = checkboxes. Owner column implicit (always on).
- Server fns `getFieldPermissions()` / `setFieldPermission({ resource, field,
  role, canEdit })`. Owner-only (reuse `getShopCtxWithPermission(_, 'settings')`).

## 9. Lock / unlock flow

- Records lock on creation (no `recordLocks` row, or `unlocked=false`).
- Owner sees an unlock toggle per row (plus bulk-select) in the grid.
- Unlock → staff may edit that row's permitted fields until owner re-locks.
- Owner edits always bypass the lock.
- Every unlock/relock writes `logActivity` (`<entity>.unlocked` /
  `<entity>.locked`). Server fns `setRecordLock({ entityType, id, unlocked })`,
  owner-only.
- Optional later enhancement: auto-relock window (unlock expires after N
  minutes). Not in initial scope.

## 10. Audit surfacing

- `/app/activity` feed shows field-edit events (reuses existing page; the
  `activityLog` summary rows appear automatically).
- Per-row **history** popover in the grid: lists that record's `fieldEdits`
  (field, old→new, actor, timestamp). Server fn `listFieldEdits({ entityType,
  entityId })`. This is the owner's primary "what did staff change after entry"
  view.

## 11. Per-page plan

| Page | Grid use | Entity / notes |
|---|---|---|
| Suppliers | edit existing | `supplier`; slice #1, non-financial; proves pattern |
| Expenses | edit + add rows | `expense`; category enum cell |
| Products | edit existing | `product`; buyingPrice/sellingPrice/stockQty are `financial` |
| Sales | edit existing | `sale`; most fields `financial` + lock-critical; corrections need owner unlock |
| PO-new | **entry grid** (line items) | new records, no lock; qty × unitCost → subtotal auto |

## 12. Phasing (recommended implementation order)

1. **Foundation:** schema (3 tables + migration), registry, resolvers,
   `updateRecordField`, `setRecordLock`, `getFieldPermissions`/`setFieldPermission`,
   `listFieldEdits` — all server-side + unit-tested.
2. **Grid component** + portal + theme + dropdown cells.
3. **Slice #1 — Suppliers** end-to-end (grid swap, registry def, permission
   panel entry, lock toggle, history popover). Validate the full loop.
4. **Settings permission matrix UI** (all resources).
5. **Rollout:** Expenses → Products → Sales (lock-critical) → PO-new (entry grid).

## 13. Testing

vitest:

- Registry validators (each field accepts valid / rejects invalid values).
- `resolveFieldPermission` (owner always; DB override; coded default; deny).
- `isLocked` (locked by default; unlocked row permits; owner bypass at call site).
- `updateRecordField` enforcement: reject unknown field, unauthorized role,
  locked record (non-owner), invalid value; accept owner edit; writes `fieldEdits`
  + `activityLog` atomically.
- Grid component smoke render (client-only boundary).

## 14. Risks / notes

- **Concurrency:** two staff editing the same row = last-write-wins; audit
  captures both edits. Acceptable for MVP; revisit if it bites.
- **Glide SSR:** must be strictly client-only; keep the existing table as
  fallback so the page renders without JS / during hydration.
- **Bundle size:** Glide + cells extra is lazy-loaded on the grid pages only.
- **Currency precision:** keep amounts as decimal strings; validate; never
  round through float.
- **Security:** the grid is a convenience; all authority lives in
  `updateRecordField` server-side. The client never decides editability.

## 15. Out of scope

- Free-form formulas / multi-sheet workbooks.
- Per-individual-staff overrides (per-role only for now).
- Auto-relock time window (noted as later enhancement).
- Bulk CSV-style paste of many new rows into ledger pages (entry grid on PO-new
  only).
