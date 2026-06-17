# Editable Grids — Expenses Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the editable grid (per-field permissions, lock-after-entry, field-level audit) to the Expenses page, adding three new grid capabilities the Suppliers slice didn't need: enum/dropdown cells, currency cells, and display-only columns.

**Architecture:** Reuse the shipped foundation unchanged where possible — the generic server-side `updateRecordField` already enforces and audits any registry resource. This plan extends the registry/cell layer with `enum`, `currency`, and `displayOnly` field kinds, renders enum cells via Glide's dropdown custom-cell, and wires the Expenses page exactly like Suppliers (grid + owner lock panel + history, with the existing add-expense modal and date filter preserved).

**Tech Stack:** TanStack Start + React 19, Drizzle + Neon Postgres, `@glideapps/glide-data-grid` + `@glideapps/glide-data-grid-cells` (dropdown only), zod, vitest.

**Prereqs:** Branch `feat/grid-edit-permissions-audit` (the foundation + Suppliers slice). Spec: `docs/superpowers/specs/2026-06-17-editable-grids-field-permissions-audit-design.md`. Foundation plan: `docs/superpowers/plans/2026-06-17-editable-grids-foundation-suppliers.md`.

**Scope decision (v1):** The grid edits *existing* expenses (the spec's "edit entered fields" + audit core). Creating new expenses keeps the existing `/app/expenses/new` modal — no in-grid row append in v1 (consistent with the Suppliers slice). Editable columns: **category** (enum), **description** (text), **amount** (currency, financial). **Date** is shown as a **display-only** column (timestamps aren't safely inline-editable and are rarely corrected). `recordedBy` stays in the CSV export but is not a grid column.

---

## File Structure

**Modified (foundation extensions)**
- `src/lib/grid/registry.ts` — add `options?` + `displayOnly?` to `FieldDef`; add the `expenses` resource; add `currency`/`category` validators.
- `src/lib/grid/authorize.ts` — reject `displayOnly` fields server-side.
- `src/lib/expenses.ts` — export `expenseCats`; add `listExpensesGrid`.
- `src/components/grid/cells.ts` — `CellModel` gains `enum` kind + `options`; handle `currency`/`date`/`displayOnly`.
- `src/components/grid/glide-impl.tsx` — render enum cells via the dropdown custom-cell; extract dropdown edits.
- `src/components/settings/field-permissions-panel.tsx` — hide `displayOnly` fields from the matrix.
- `src/lib/queries.ts` — add `expensesGridQuery`.
- `src/routes/app/expenses/index.tsx` — grid-backed `ExpensesContent`.
- `src/routes/app/expenses/new.tsx` — pass grid data to `ExpensesContent`.

**Test files**
- `src/lib/grid/registry.test.ts`, `authorize.test.ts`, `src/components/grid/cells.test.ts` — extend.

---

## Task 1: Foundation — enum, currency, displayOnly + Expenses registry entry

**Files:** Modify `src/lib/grid/registry.ts`, `src/lib/grid/authorize.ts`, `src/lib/expenses.ts`, `src/components/settings/field-permissions-panel.tsx`; Test `src/lib/grid/registry.test.ts`, `src/lib/grid/authorize.test.ts`

- [ ] **Step 1: Export the category enum from expenses.ts**

In `src/lib/expenses.ts`, the array `expenseCats` is currently a local `const` (around line 40). Add `export`:
```ts
export const expenseCats = [
  'rent',
  'electricity',
  'internet',
  'salary',
  'supplier_payment',
  'transport',
  'maintenance',
  'packaging',
  'misc',
] as const
```
(Only add the word `export` — keep the values identical; `createExpense` still uses it.)

- [ ] **Step 2: Write the failing registry + authorize tests**

Append to `src/lib/grid/registry.test.ts`:
```ts
import { getResource } from './registry'

describe('registry: expenses', () => {
  it('exposes an expenses resource with the right fields', () => {
    expect(REGISTRY.expenses.entityType).toBe('expense')
    expect(REGISTRY.expenses.permission).toBe('expenses')
    expect(getField('expenses', 'amount')?.financial).toBe(true)
    expect(getField('expenses', 'date')?.displayOnly).toBe(true)
  })

  it('category is an enum field with options', () => {
    const cat = getField('expenses', 'category')!
    expect(cat.kind).toBe('enum')
    expect(cat.options?.map((o) => o.value)).toContain('rent')
    expect(cat.validator.safeParse('rent').success).toBe(true)
    expect(cat.validator.safeParse('not_a_cat').success).toBe(false)
  })

  it('amount currency validator coerces to a 2dp string, rejects junk/negatives', () => {
    const amt = getField('expenses', 'amount')!.validator
    expect(amt.safeParse(150).data).toBe('150.00')
    expect(amt.safeParse('12.5').data).toBe('12.50')
    expect(amt.safeParse(-3).success).toBe(false)
    expect(amt.safeParse('abc').success).toBe(false)
  })

  it('getResource returns the expenses def', () => {
    expect(getResource('expenses')?.table).toBeDefined()
  })
})
```

Append to `src/lib/grid/authorize.test.ts`:
```ts
describe('authorizeFieldEdit: displayOnly', () => {
  it('rejects a display-only field even for owner', () => {
    const r = authorizeFieldEdit({
      resource: 'expenses',
      field: 'date',
      role: 'owner',
      rawValue: '2026-01-01',
      entityId: 'e1',
      perms: [],
      locks: [],
    })
    expect(r).toMatchObject({ ok: false })
  })
})
```

- [ ] **Step 3: Run them — expect FAIL**

Run: `npx vitest run src/lib/grid/registry.test.ts src/lib/grid/authorize.test.ts`
Expected: FAIL (no `expenses` in REGISTRY; `displayOnly` not enforced).

- [ ] **Step 4: Extend `FieldDef` + add the expenses resource in `registry.ts`**

In `src/lib/grid/registry.ts`:

(a) Add the import of `expenseCats` and the `expenses` table to the existing schema import. Change:
```ts
import { suppliers } from '#/db/schema'
```
to:
```ts
import { expenses, suppliers } from '#/db/schema'
import { expenseCats } from '#/lib/expenses'
```

(b) Extend the `FieldDef` interface — add `options` and `displayOnly`:
```ts
export interface FieldDef {
  key: string
  label: string
  kind: CellKind
  validator: z.ZodType
  financial?: boolean
  displayOnly?: boolean // shown in the grid but never editable (e.g. timestamps)
  options?: ReadonlyArray<{ value: string; label: string }> // for enum fields
  editableByDefault?: Partial<Record<NonOwnerRole, boolean>>
}
```

(c) Above the `REGISTRY` const, add the expenses field validators + category options:
```ts
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: 'Rent',
  electricity: 'Electricity',
  internet: 'Internet',
  salary: 'Salary',
  supplier_payment: 'Supplier Payment',
  transport: 'Transport',
  maintenance: 'Maintenance',
  packaging: 'Packaging',
  misc: 'Miscellaneous',
}

const EXPENSE_CATEGORY_OPTIONS = expenseCats.map((v) => ({
  value: v,
  label: EXPENSE_CATEGORY_LABELS[v] ?? v,
}))

// Coerce a number or numeric string to a non-negative 2-decimal string
// (the amount column is a Postgres numeric stored as a string).
const currency = z
  .coerce.number()
  .finite()
  .nonnegative()
  .transform((n) => n.toFixed(2))
```

(d) Add the `expenses` entry to `REGISTRY` (alongside `suppliers`):
```ts
  expenses: {
    resource: 'expenses',
    entityType: 'expense',
    permission: 'expenses',
    table: expenses,
    fields: [
      {
        key: 'date',
        label: 'Date',
        kind: 'date',
        validator: z.any(),
        displayOnly: true,
      },
      {
        key: 'category',
        label: 'Category',
        kind: 'enum',
        validator: z.enum(expenseCats),
        options: EXPENSE_CATEGORY_OPTIONS,
        editableByDefault: { manager: true },
      },
      {
        key: 'description',
        label: 'Description',
        kind: 'text',
        validator: optionalText,
        editableByDefault: { manager: true },
      },
      {
        key: 'amount',
        label: 'Amount',
        kind: 'currency',
        validator: currency,
        financial: true,
        editableByDefault: { manager: false },
      },
    ],
  },
```
(`optionalText` already exists in this file from the Suppliers slice — reuse it.)

- [ ] **Step 5: Enforce `displayOnly` in `authorize.ts`**

In `src/lib/grid/authorize.ts`, inside `authorizeFieldEdit`, immediately after the `if (!def || !fieldDef) return { ok: false, reason: 'Unknown field' }` line, add:
```ts
  if (fieldDef.displayOnly) {
    return { ok: false, reason: 'This column is read-only' }
  }
```
(This is before validation and before the owner-bypass, so display-only columns are never writable by anyone via the grid.)

- [ ] **Step 6: Hide `displayOnly` fields from the Settings matrix**

In `src/components/settings/field-permissions-panel.tsx`, the per-resource table maps `res.fields`. Change that map to skip display-only fields. Find:
```tsx
              {res.fields.map((f) => (
```
and change to:
```tsx
              {res.fields
                .filter((f) => !f.displayOnly)
                .map((f) => (
```
(Leave the rest of the `<tr>...</tr>` body unchanged — only the iterable changes. Verify the JSX still closes correctly.)

- [ ] **Step 7: Run the tests — expect PASS**

Run: `npx vitest run src/lib/grid/registry.test.ts src/lib/grid/authorize.test.ts`
Expected: PASS (all prior + the 5 new assertions).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`. No errors in `registry.ts`, `authorize.ts`, `expenses.ts`, `field-permissions-panel.tsx`.

> Possible circular-import note: `registry.ts` now imports from `expenses.ts`, and `expenses.ts` imports `getShopCtxWithPermission` from `context.ts` (not from registry), so there is no cycle. If a runtime cycle warning appears, move `expenseCats` to a tiny `src/lib/expenses-categories.ts` constants module and import it from both `expenses.ts` and `registry.ts`. Only do this if a real cycle manifests.

- [ ] **Step 9: Commit**
```bash
git add web/src/lib/grid/registry.ts web/src/lib/grid/registry.test.ts web/src/lib/grid/authorize.ts web/src/lib/grid/authorize.test.ts web/src/lib/expenses.ts web/src/components/settings/field-permissions-panel.tsx
git commit -m "feat(grid): enum/currency/displayOnly field kinds + expenses registry"
```

---

## Task 2: Cell builders — enum, currency, date, displayOnly

**Files:** Modify `src/components/grid/cells.ts`, Test `src/components/grid/cells.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/grid/cells.test.ts`:
```ts
const catField: FieldDef = {
  key: 'category',
  label: 'Category',
  kind: 'enum',
  validator: {} as never,
  options: [
    { value: 'rent', label: 'Rent' },
    { value: 'misc', label: 'Miscellaneous' },
  ],
}
const dateField: FieldDef = {
  key: 'date',
  label: 'Date',
  kind: 'date',
  validator: {} as never,
  displayOnly: true,
}

describe('cellModel: enum', () => {
  it('shows the option label, keeps the raw value, carries options', () => {
    const c = cellModel(catField, 'rent', true)
    expect(c.kind).toBe('enum')
    expect(c.value).toBe('rent')
    expect(c.display).toBe('Rent')
    expect(c.readonly).toBe(false)
    expect(c.options).toBe(catField.options)
  })
  it('falls back to the raw value when no matching option', () => {
    expect(cellModel(catField, 'unknown', true).display).toBe('unknown')
  })
})

describe('cellModel: date / displayOnly', () => {
  it('date renders the ISO date portion and is always read-only', () => {
    const c = cellModel(dateField, '2026-06-17T10:00:00.000Z', true)
    expect(c.kind).toBe('text')
    expect(c.display).toBe('2026-06-17')
    expect(c.readonly).toBe(true) // displayOnly overrides editable
  })
})
```

- [ ] **Step 2: Run them — expect FAIL**

Run: `npx vitest run src/components/grid/cells.test.ts`
Expected: FAIL (enum kind / options / displayOnly not handled).

- [ ] **Step 3: Rewrite `cells.ts`**

Replace `src/components/grid/cells.ts` with:
```ts
import type { FieldDef } from '#/lib/grid/registry'

export interface GridColumnModel {
  id: string
  title: string
  width: number
}

export interface CellModel {
  kind: 'text' | 'number' | 'enum'
  value: string
  display: string
  readonly: boolean
  options?: ReadonlyArray<{ value: string; label: string }>
}

export function buildColumns(fields: FieldDef[]): GridColumnModel[] {
  return fields.map((f) => ({ id: f.key, title: f.label, width: 180 }))
}

export function cellModel(
  field: FieldDef,
  raw: unknown,
  editable: boolean,
): CellModel {
  const readonly = !editable || field.displayOnly === true
  const value = raw == null ? '' : String(raw)

  if (field.kind === 'enum') {
    const opt = field.options?.find((o) => o.value === value)
    return {
      kind: 'enum',
      value,
      display: opt?.label ?? value,
      readonly,
      options: field.options,
    }
  }

  if (field.kind === 'number' || field.kind === 'currency') {
    return { kind: 'number', value, display: value, readonly }
  }

  if (field.kind === 'date') {
    // raw arrives as an ISO string over the wire; show the yyyy-mm-dd portion.
    return { kind: 'text', value, display: value.slice(0, 10), readonly }
  }

  return { kind: 'text', value, display: value, readonly }
}
```

- [ ] **Step 4: Run the full cells suite — expect PASS**

Run: `npx vitest run src/components/grid/cells.test.ts`
Expected: PASS (the 4 original Suppliers-slice tests + the 4 new ones).

- [ ] **Step 5: Commit**
```bash
git add web/src/components/grid/cells.ts web/src/components/grid/cells.test.ts
git commit -m "feat(grid): cell models for enum, currency, date, display-only"
```

---

## Task 3: Render enum dropdown cells in Glide (+ build gate)

**Files:** Modify `src/components/grid/glide-impl.tsx`

No unit test (canvas). The critical verification is **`npm run build`** — it confirms the `glide-data-grid-cells` dropdown renderer bundles without dragging in its heavy optional deps (toast-ui, react-select).

- [ ] **Step 1: Wire the dropdown renderer + enum cell mapping**

Replace `src/components/grid/glide-impl.tsx` with:
```tsx
import { DataEditor, GridCellKind } from '@glideapps/glide-data-grid'
import type {
  EditableGridCell,
  GridCell,
  Item,
} from '@glideapps/glide-data-grid'
import { DropdownCell } from '@glideapps/glide-data-grid-cells'
import '@glideapps/glide-data-grid/dist/index.css'
import { useCallback } from 'react'

import type { FieldDef } from '#/lib/grid/registry'
import { buildColumns, cellModel } from './cells'

export interface GlideGridProps {
  fields: FieldDef[]
  rows: Array<Record<string, unknown>>
  isEditable: (rowIndex: number, fieldKey: string) => boolean
  onEdit: (rowIndex: number, fieldKey: string, value: unknown) => Promise<boolean>
}

const lockedTheme = { bgCell: '#f3f4f6', textDark: '#9ca3af' }

// Only the dropdown renderer — avoid `allCells`, which pulls in toast-ui and
// react-select and bloats/breaks the bundle.
const customRenderers = [DropdownCell]

export default function GlideGrid({
  fields,
  rows,
  isEditable,
  onEdit,
}: GlideGridProps) {
  const columns = buildColumns(fields).map((c) => ({
    id: c.id,
    title: c.title,
    width: c.width,
  }))

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const field = fields[col]
      const editable = isEditable(row, field.key)
      const m = cellModel(field, rows[row]?.[field.key], editable)
      const themeOverride = editable ? undefined : lockedTheme

      if (m.kind === 'enum') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: editable,
          readonly: !editable,
          copyData: m.display,
          themeOverride,
          data: {
            kind: 'dropdown-cell',
            allowedValues: (m.options ?? []).map((o) => ({
              value: o.value,
              label: o.label,
            })),
            value: m.value,
          },
        } as GridCell
      }

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
      let value: unknown
      if (newValue.kind === GridCellKind.Number) {
        value = newValue.data
      } else if (newValue.kind === GridCellKind.Custom) {
        // dropdown-cell payload
        const data = newValue.data as { value?: string }
        value = data.value
      } else {
        value = (newValue.data as string)
      }
      void onEdit(row, field.key, value)
    },
    [fields, onEdit],
  )

  return (
    <div
      className="app-card overflow-hidden"
      style={{ height: 560, width: '100%' }}
    >
      <DataEditor
        columns={columns}
        rows={rows.length}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        customRenderers={customRenderers}
        rowMarkers="number"
        width="100%"
        height={560}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + adapt to the real cells API**

Run: `npx tsc --noEmit`. KNOWN RISK: the exact export name and the dropdown `data` shape may differ in `@glideapps/glide-data-grid-cells@6.0.3`. If `DropdownCell` is not the export name, inspect `node_modules/@glideapps/glide-data-grid-cells/dist/index.d.ts` and import the correct dropdown renderer (it may be exported as `DropdownCellRenderer` or similar; `allCells` is the array of all of them — do NOT use it). The cell `data.kind` string must match what the renderer registers (look for `'dropdown-cell'` in the `.d.ts`). Adapt the import and the `data` literal minimally to satisfy the real types; keep behavior (a dropdown of `{value,label}` options, current value `m.value`). Report every deviation.

- [ ] **Step 3: BUILD GATE — verify the bundle**

Run: `npm run build`
Expected: build succeeds. This proves the dropdown renderer bundles cleanly.

If the build fails pulling in `react-select`/`@toast-ui/*` or a missing peer dep:
1. First try installing the missing peer(s) it names (e.g. `npm install react-select`), then rebuild.
2. If it still fails or balloons the bundle unacceptably, FALL BACK: render `enum` cells as a `GridCellKind.Text` cell (drop the dropdown), remove the `DropdownCell` import + `customRenderers`, and in `onCellEdited` treat enum like text. The `z.enum` validator still rejects invalid categories server-side. Report that you took the fallback so the dropdown can be revisited.

- [ ] **Step 4: Commit**
```bash
git add web/src/components/grid/glide-impl.tsx
git commit -m "feat(grid): enum dropdown cells via glide-data-grid-cells"
```

---

## Task 4: Server — `listExpensesGrid` + query

**Files:** Modify `src/lib/expenses.ts`, `src/lib/queries.ts`

- [ ] **Step 1: Add `listExpensesGrid` to `expenses.ts`**

(a) Extend the schema import. Change:
```ts
import { expenses, staffMembers } from '#/db/schema'
```
to:
```ts
import {
  expenses,
  fieldPermissions,
  recordLocks,
  staffMembers,
} from '#/db/schema'
```

(b) Append at the END of `src/lib/expenses.ts`:
```ts
export const listExpensesGrid = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId, role } = await getShopCtxWithPermission(
      request.headers,
      'expenses',
    )
    const conditions = [eq(expenses.shopId, shopId)]
    if (data.from) conditions.push(gte(expenses.date, new Date(data.from)))
    if (data.to) conditions.push(lte(expenses.date, new Date(data.to)))

    const [rows, perms, locks] = await Promise.all([
      db
        .select({
          id: expenses.id,
          category: expenses.category,
          amount: expenses.amount,
          description: expenses.description,
          date: expenses.date,
          recordedById: expenses.recordedById,
          recordedBy: staffMembers.name,
        })
        .from(expenses)
        .leftJoin(staffMembers, eq(expenses.recordedById, staffMembers.id))
        .where(and(...conditions))
        .orderBy(desc(expenses.date))
        .limit(100),
      db
        .select()
        .from(fieldPermissions)
        .where(eq(fieldPermissions.shopId, shopId)),
      db
        .select()
        .from(recordLocks)
        .where(
          and(
            eq(recordLocks.shopId, shopId),
            eq(recordLocks.entityType, 'expense'),
          ),
        ),
    ])
    return { rows, perms, locks, role }
  })
```
(`and, desc, eq, gte, lte` are already imported in this file.)

- [ ] **Step 2: Add `expensesGridQuery` to `queries.ts`**

(a) Add `listExpensesGrid` to the expenses import. Change:
```ts
import { listExpenses } from './expenses'
```
to:
```ts
import { listExpenses, listExpensesGrid } from './expenses'
```
(Keep `listExpenses` — `expensesListQuery` still uses it elsewhere.)

(b) Add next to `expensesListQuery`:
```ts
export const expensesGridQuery = (deps: { from?: string; to?: string }) =>
  queryOptions({
    queryKey: ['expenses', 'grid', deps],
    queryFn: () => listExpensesGrid({ data: deps }),
  })
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`. No errors in `expenses.ts` or `queries.ts`.

- [ ] **Step 4: Commit**
```bash
git add web/src/lib/expenses.ts web/src/lib/queries.ts
git commit -m "feat(expenses): listExpensesGrid loader + query"
```

---

## Task 5: Wire the Expenses page to the grid

**Files:** Modify `src/routes/app/expenses/index.tsx`, `src/routes/app/expenses/new.tsx`

- [ ] **Step 1: Replace `src/routes/app/expenses/index.tsx` with:**
```tsx
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { ExportButton } from '#/components/export-button'
import { DataGrid } from '#/components/grid/data-grid'
import { RecordHistory } from '#/components/grid/record-history'
import { REGISTRY } from '#/lib/grid/registry'
import { isLocked, resolveFieldPermission } from '#/lib/grid/permissions'
import type { LockRow, PermRow } from '#/lib/grid/permissions'
import { setRecordLock, updateRecordField } from '#/lib/grid/server'
import { can } from '#/lib/permissions'
import type { listExpensesGrid } from '#/lib/expenses'
import { expensesGridQuery } from '#/lib/queries'

export const Route = createFileRoute('/app/expenses/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'expenses')) throw redirect({ to: '/app/dashboard' })
  },
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(expensesGridQuery(deps)),
  component: ExpensesPage,
})

const FIELDS = REGISTRY.expenses.fields
const catLabel: Record<string, string> = Object.fromEntries(
  (REGISTRY.expenses.fields.find((f) => f.key === 'category')?.options ?? []).map(
    (o) => [o.value, o.label],
  ),
)

type GridData = Awaited<ReturnType<typeof listExpensesGrid>>
type ExpenseRow = GridData['rows'][number]

function ExpensesPage() {
  const data = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const { from, to } = Route.useSearch()
  return (
    <ExpensesContent
      data={data}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    />
  )
}

export function ExpensesContent({
  data,
  from,
  to,
  onFilter,
  children,
}: {
  data: GridData
  from?: string
  to?: string
  onFilter: (values: { from?: string; to?: string }) => void
  children?: ReactNode
}) {
  const router = useRouter()
  const [rows, setRows] = useState<ExpenseRow[]>(data.rows)
  const perms = data.perms as PermRow[]
  const [locks, setLocks] = useState<LockRow[]>(data.locks as LockRow[])
  const role = data.role
  const isOwner = role === 'owner'
  const total = rows.reduce((sum, e) => sum + Number(e.amount), 0)

  const isEditable = useMemo(
    () => (rowIndex: number, fieldKey: string) => {
      const rec = rows[rowIndex] as ExpenseRow | undefined
      if (!rec) return false
      if (!resolveFieldPermission(perms, 'expenses', fieldKey, role)) return false
      if (role !== 'owner' && isLocked(locks, 'expense', rec.id)) return false
      return true
    },
    [rows, perms, locks, role],
  )

  async function onEdit(rowIndex: number, fieldKey: string, value: unknown) {
    const rec = rows[rowIndex]
    try {
      const updated = (await updateRecordField({
        data: { resource: 'expenses', id: rec.id, field: fieldKey, value },
      })) as Partial<ExpenseRow>
      setRows((prev) =>
        prev.map((r, i) => (i === rowIndex ? { ...r, ...updated } : r)),
      )
      return true
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Edit rejected')
      setRows((prev) => [...prev])
      return false
    }
  }

  async function toggleLock(id: string, currentlyLocked: boolean) {
    // A record is "locked" unless an unlocked=true row exists (see isLocked).
    // Unlocking a locked row writes unlocked=true — new value equals
    // currentlyLocked. Not a typo; do not invert.
    try {
      await setRecordLock({
        data: { entityType: 'expense', entityId: id, unlocked: currentlyLocked },
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not change lock')
      return
    }
    setLocks((prev) => {
      const rest = prev.filter(
        (l) => !(l.entityType === 'expense' && l.entityId === id),
      )
      return [
        ...rest,
        { entityType: 'expense', entityId: id, unlocked: currentlyLocked },
      ]
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
          {rows.map((e) => (
            <tr key={e.id} className="hover:bg-sea-ink/[0.04]">
              {FIELDS.map((f) => (
                <td key={f.key} className="px-4 py-3 text-sea-ink-soft">
                  {f.key === 'date'
                    ? new Date(e.date).toLocaleDateString()
                    : f.key === 'category'
                      ? (catLabel[e.category] ?? e.category)
                      : ((e[f.key as keyof ExpenseRow] as string | null) ?? '—')}
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
          Expenses
        </h2>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={rows}
            filename="expenses"
            columns={[
              {
                header: 'Date',
                value: (e) => new Date(e.date).toLocaleDateString(),
              },
              {
                header: 'Category',
                value: (e) => catLabel[e.category] ?? e.category,
              },
              { header: 'Description', value: (e) => e.description ?? '' },
              { header: 'Recorded By', value: (e) => e.recordedBy ?? '' },
              { header: 'Amount', value: (e) => Number(e.amount).toFixed(2) },
            ]}
          />
          <Link to="/app/expenses/new">
            <Button size="sm">+ Add expense</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <input
          type="date"
          className="border border-line rounded-md px-3 py-1.5 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
          value={from ?? ''}
          onChange={(e) => onFilter({ from: e.target.value || undefined })}
        />
        <span className="text-sea-ink-soft text-sm">to</span>
        <input
          type="date"
          className="border border-line rounded-md px-3 py-1.5 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
          value={to ?? ''}
          onChange={(e) => onFilter({ to: e.target.value || undefined })}
        />
        {rows.length > 0 && (
          <span className="ml-auto text-sm text-sea-ink-soft">
            Total: <strong>{total.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No expenses yet.
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
                {rows.map((e) => {
                  const locked = isLocked(locks, 'expense', e.id)
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sea-ink">
                        {new Date(e.date).toLocaleDateString()} ·{' '}
                        {catLabel[e.category] ?? e.category} ·{' '}
                        {Number(e.amount).toFixed(2)}
                      </span>
                      <span className="flex items-center gap-3">
                        <RecordHistory
                          entityType="expense"
                          entityId={e.id}
                          label={`${catLabel[e.category] ?? e.category} expense`}
                        />
                        <button
                          onClick={() => toggleLock(e.id, locked)}
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

      {children}
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/routes/app/expenses/new.tsx` with:**
```tsx
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { ExpenseForm } from '#/components/forms/expense-form'
import { RouteDialog } from '#/components/route-dialog'
import { expensesGridQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'

import { can } from '#/lib/permissions'
import { ExpensesContent } from './index'

export const Route = createFileRoute('/app/expenses/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'expenses')) throw redirect({ to: '/app/dashboard' })
  },
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(expensesGridQuery(deps)),
  component: NewExpensePage,
})

function NewExpensePage() {
  const data = Route.useLoaderData()
  const { from, to } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const refresh = useRefresh()

  function close() {
    router.navigate({ to: '/app/expenses' })
  }

  async function saved() {
    await refresh()
    close()
  }

  return (
    <ExpensesContent
      data={data}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    >
      <RouteDialog title="Add expense" onClose={close}>
        <ExpenseForm onCancel={close} onSaved={saved} />
      </RouteDialog>
    </ExpensesContent>
  )
}
```

- [ ] **Step 3: Typecheck + lint the touched files**

Run: `npx tsc --noEmit` (no errors in the two route files), then
`npx eslint src/routes/app/expenses/index.tsx src/routes/app/expenses/new.tsx`
Expected: exit 0 (no errors). Fix any introduced (drop unnecessary casts, type-only imports, etc.) following the patterns from the Suppliers slice.

- [ ] **Step 4: Commit**
```bash
git add web/src/routes/app/expenses/index.tsx web/src/routes/app/expenses/new.tsx
git commit -m "feat(expenses): editable grid with permissions, locks, audit"
```

---

## Task 6: Regression — tests, lint, build

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: all grid + cells + registry + authorize tests pass (Suppliers-slice tests unchanged + the new Expenses assertions). Report the totals.

- [ ] **Step 2: Lint the feature surface**

Run: `npx eslint src/lib/grid src/components/grid src/components/settings src/routes/app/expenses`
Expected: exit 0. Fix any new errors (the repo has a pre-existing dirty baseline elsewhere — do not touch unrelated files).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds (this re-confirms the dropdown-cell bundle from Task 3 in the full app context).

- [ ] **Step 4: Final commit (only if lint produced fixes)**
```bash
git add -- web/src/lib/grid web/src/components/grid web/src/routes/app/expenses
git commit -m "chore(grid): lint pass for expenses rollout"
```

---

## Manual verification (needs a logged-in browser — not automatable here)

1. As **owner**, open `/app/expenses`. The grid shows Date (read-only/greyed), Category (dropdown), Description, Amount.
2. Edit an Amount → persists on reload; the row's **History** shows old→new; `/app/activity` shows "changed amount".
3. Change a Category via the dropdown → persists; audited.
4. Confirm the **Date** column is never editable (greyed for everyone, including owner).
5. In **Settings → Edit permissions**, the Expenses block lists Category/Description/Amount (NOT Date). Uncheck **manager → amount**.
6. As a **manager**, Amount is read-only; Category/Description editable only when the owner has **unlocked** that row.
7. Owner **Unlock** a row → manager can edit permitted fields → **Lock** → edits rejected.
8. The date filter, Total, CSV export, and **+ Add expense** modal all still work.

---

## Self-Review (plan author)

**Spec coverage (spec §11 "Expenses: edit + add rows; category dropdown"):**
- Category dropdown ✓ (Tasks 1–3). Edit existing + permissions + lock + audit ✓ (Tasks 1, 4, 5 reuse the generic `updateRecordField`). Add-rows is explicitly deferred (scope decision, top of plan) — creation stays in the existing modal, consistent with the Suppliers slice.
- Financial field handling ✓ — `amount` is `financial` with `editableByDefault.manager = false`, demonstrating the financial-default-locked behaviour the spec calls out for money fields.
- Display-only columns ✓ — new primitive for `date` (spec didn't name it, but timestamps need it; reused by the future Sales slice for computed totals).

**Type consistency:** `FieldDef` gains optional `options`/`displayOnly` (Task 1) — consumed by `cellModel` (Task 2), `glide-impl` (Task 3), and the settings panel filter (Task 1). `CellModel` gains `enum` + `options` (Task 2) — consumed by `glide-impl` (Task 3). `GridData`/`ExpenseRow`/`isEditable`/`onEdit`/`toggleLock` mirror the proven Suppliers shapes (Task 5). `listExpensesGrid` returns `{rows, perms, locks, role}` (Task 4) matching `expensesGridQuery` and the page loader.

**Placeholder scan:** none — every step has runnable code/commands. The two genuine unknowns (real `glide-data-grid-cells` export name/shape; whether the dropdown bundles cleanly) are handled with explicit inspect-and-adapt instructions + a build gate + a concrete documented fallback, not vague hand-waving.

**Watch-points for the implementer:** (1) `glide-data-grid-cells` export name/data-shape may differ in 6.0.3 — inspect the `.d.ts` (Task 3 Step 2). (2) The build gate (Task 3 Step 3) is the real test of the dropdown approach; take the documented text-cell fallback if it bloats/breaks. (3) `registry.ts` importing `expenseCats` from `expenses.ts` — watch for an import cycle (Task 1 Step 8 note).
