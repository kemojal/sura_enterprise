# Editable Grids — Products Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the editable grid (per-field permissions, lock-after-entry, field-level audit) to the Products page, adding one new grid capability: **relation cells** — dropdowns whose options come from a DB table per-shop (category), not a static enum.

**Architecture:** Reuse the shipped foundation. Extend the registry with a `relation` field kind and thread runtime-loaded options (`optionsByField`) through `DataGrid` → `glide-impl` → `cellModel`, reusing the existing dropdown cell. The Products page becomes a grid for editing name/category/prices/low-stock/barcode, with stock display-only (it has its own ledger-backed adjust flow), and the existing per-row actions (Variants/Ledger/Adjust/Edit/Delete) move to a compact per-row tools list. Search, category filter, CSV export, and the add-product modal are preserved.

**Tech Stack:** TanStack Start + React 19, Drizzle + Neon Postgres, `@glideapps/glide-data-grid` + dropdown cell, zod, vitest.

**Prereqs:** Branch `feat/grid-edit-permissions-audit` (foundation + Suppliers + Expenses slices). Spec: `docs/superpowers/specs/2026-06-17-editable-grids-field-permissions-audit-design.md`.

**Domain decisions (v1):**
- **`stockQty` is display-only in the grid.** Stock has a ledger (`stock_ledger` / stock-adjustments) and a dedicated `/products/$productId/adjust` flow. Inline-editing it would bypass the ledger and desync inventory. Corrections stay in the adjust flow; the grid shows the current count read-only.
- **Editable fields:** name (text), category (relation), buyingPrice + sellingPrice (currency, financial), lowStockThreshold (whole number), barcode (text). Per-row **actions** (Variants/Ledger/Adjust/Edit/Delete) move into a compact tools list below the grid; the inline image thumbnail and computed margin column are dropped from the grid view (both remain on the edit page / CSV export). Creating products keeps the existing `/products/new` modal.
- **Relation integrity:** the category dropdown only offers this shop's categories; the FK + dropdown constrain choices. A hand-crafted request with a foreign category id is not validated against the shop server-side in v1 (low-risk; noted as a future hardening). Clearing the category sets it to null.

---

## File Structure

**Modified (foundation extensions)**
- `src/lib/grid/registry.ts` — add `relation` to `CellKind`; add a whole-number validator; add the `products` resource.
- `src/components/grid/cells.ts` — `cellModel` gains a 4th `runtimeOptions` param; treat `relation` like `enum`.
- `src/components/grid/glide-impl.tsx` — `GlideGridProps` gains `optionsByField`; pass per-field runtime options into `cellModel`.
- `src/lib/products.ts` — add `listProductsGrid`.
- `src/lib/queries.ts` — add `productsGridQuery`.
- `src/routes/app/products/index.tsx` — grid-backed `ProductsContent` + per-row tools list.
- `src/routes/app/products/new.tsx` — pass grid data to `ProductsContent`.

**Test files:** `src/lib/grid/registry.test.ts`, `src/components/grid/cells.test.ts` — extend.

Note: `DataGrid` (`src/components/grid/data-grid.tsx`) needs NO change — `DataGridProps extends GlideGridProps`, so adding `optionsByField` to `GlideGridProps` flows through automatically.

---

## Task P1: Foundation — relation kind, whole-number validator, products registry + cell support

**Files:** Modify `src/lib/grid/registry.ts`, `src/components/grid/cells.ts`; Test `src/lib/grid/registry.test.ts`, `src/components/grid/cells.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/grid/registry.test.ts`:
```ts
describe('registry: products', () => {
  it('exposes a products resource gated by products:write', () => {
    expect(REGISTRY.products.entityType).toBe('product')
    expect(REGISTRY.products.permission).toBe('products:write')
  })

  it('category is a relation field; stock is display-only; prices are financial', () => {
    expect(getField('products', 'categoryId')?.kind).toBe('relation')
    expect(getField('products', 'stockQty')?.displayOnly).toBe(true)
    expect(getField('products', 'buyingPrice')?.financial).toBe(true)
    expect(getField('products', 'sellingPrice')?.financial).toBe(true)
  })

  it('lowStockThreshold validator accepts whole numbers, rejects negatives/decimals/junk', () => {
    const v = getField('products', 'lowStockThreshold')!.validator
    expect(v.safeParse(5).data).toBe(5)
    expect(v.safeParse('5').data).toBe(5)
    expect(v.safeParse(-1).success).toBe(false)
    expect(v.safeParse(2.5).success).toBe(false)
    expect(v.safeParse('abc').success).toBe(false)
  })

  it('categoryId validator maps blank to null, passes an id through', () => {
    const v = getField('products', 'categoryId')!.validator
    expect(v.safeParse('').data).toBe(null)
    expect(v.safeParse('cat_123').data).toBe('cat_123')
  })
})
```

Append to `src/components/grid/cells.test.ts`:
```ts
const relField: FieldDef = {
  key: 'categoryId',
  label: 'Category',
  kind: 'relation',
  validator: {} as never,
}

describe('cellModel: relation with runtime options', () => {
  it('uses runtime options for the display label and carries them', () => {
    const opts = [{ value: 'c1', label: 'Drinks' }]
    const c = cellModel(relField, 'c1', true, opts)
    expect(c.kind).toBe('enum') // relation renders as a dropdown
    expect(c.value).toBe('c1')
    expect(c.display).toBe('Drinks')
    expect(c.options).toBe(opts)
  })
  it('blank relation value shows empty display', () => {
    expect(cellModel(relField, null, true, [{ value: 'c1', label: 'Drinks' }]).display).toBe('')
  })
})
```

- [ ] **Step 2: Run them — expect FAIL**

Run: `npx vitest run src/lib/grid/registry.test.ts src/components/grid/cells.test.ts`
Expected: FAIL (no `products` resource; `cellModel` ignores the 4th arg / no `relation`).

- [ ] **Step 3: Extend `registry.ts`**

(a) Add `products` to the schema import. Change:
```ts
import { expenses, suppliers } from '#/db/schema'
```
to:
```ts
import { expenses, products, suppliers } from '#/db/schema'
```

(b) Add `'relation'` to `CellKind`:
```ts
export type CellKind = 'text' | 'number' | 'currency' | 'enum' | 'boolean' | 'date' | 'relation'
```

(c) Near the existing `currency` validator, add a whole-number validator:
```ts
// Coerce a number or numeric string to a non-negative integer.
const wholeNumber = z.coerce.number().int().nonnegative()

// Optional relation id: blank string normalizes to null.
const optionalRelation = z
  .string()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))
```

(d) Add the `products` entry to `REGISTRY` (alongside the others). Reuse the existing `optionalText` and `currency`:
```ts
  products: {
    resource: 'products',
    entityType: 'product',
    permission: 'products:write',
    table: products,
    fields: [
      {
        key: 'name', label: 'Name', kind: 'text',
        validator: z.string().trim().min(1).max(200),
        editableByDefault: { manager: true },
      },
      {
        key: 'categoryId', label: 'Category', kind: 'relation',
        validator: optionalRelation, editableByDefault: { manager: true },
      },
      {
        key: 'buyingPrice', label: 'Buy price', kind: 'currency',
        validator: currency, financial: true, editableByDefault: { manager: false },
      },
      {
        key: 'sellingPrice', label: 'Sell price', kind: 'currency',
        validator: currency, financial: true, editableByDefault: { manager: false },
      },
      {
        key: 'stockQty', label: 'Stock', kind: 'number',
        validator: z.any(), displayOnly: true,
      },
      {
        key: 'lowStockThreshold', label: 'Low-stock alert', kind: 'number',
        validator: wholeNumber, editableByDefault: { manager: true },
      },
      {
        key: 'barcode', label: 'Barcode', kind: 'text',
        validator: optionalText, editableByDefault: { manager: true },
      },
    ],
  },
```
ZOD NOTE (zod 4.4.x in this project): `wholeNumber` must make `5`/`'5'` → `5`, and REJECT `-1`, `2.5`, `'abc'`. If `z.coerce.number().int().nonnegative()` doesn't reject `'abc'`/NaN in this version, add `.refine(Number.isFinite)` or equivalent so the test passes. Keep the output a number. Report any change.

- [ ] **Step 4: Extend `cells.ts` — `runtimeOptions` param + `relation`**

Replace the `cellModel` function in `src/components/grid/cells.ts` with (keep `GridColumnModel`, `CellModel`, `buildColumns` as-is):
```ts
export function cellModel(
  field: FieldDef,
  raw: unknown,
  editable: boolean,
  runtimeOptions?: ReadonlyArray<{ value: string; label: string }>,
): CellModel {
  const readonly = !editable || field.displayOnly === true
  const value = raw == null ? '' : String(raw)
  const options = runtimeOptions ?? field.options

  if (field.kind === 'enum' || field.kind === 'relation') {
    const opt = options?.find((o) => o.value === value)
    return {
      kind: 'enum',
      value,
      display: value === '' ? '' : (opt?.label ?? value),
      readonly,
      options,
    }
  }

  if (field.kind === 'number' || field.kind === 'currency') {
    return { kind: 'number', value, display: value, readonly }
  }

  if (field.kind === 'date') {
    return { kind: 'text', value, display: value.slice(0, 10), readonly }
  }

  return { kind: 'text', value, display: value, readonly }
}
```
(The only changes vs the current version: the new `runtimeOptions` param, `options = runtimeOptions ?? field.options`, the `relation` branch folded into the `enum` branch, and the `value === '' ? ''` guard so a blank relation shows empty.)

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx vitest run src/lib/grid/registry.test.ts src/components/grid/cells.test.ts`
Expected: PASS (all prior + new). The existing enum (expenses) and number/text/date tests must still pass since the new param is optional.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit` — no errors in `registry.ts` / `cells.ts`.

- [ ] **Step 7: Commit**
```bash
git add web/src/lib/grid/registry.ts web/src/lib/grid/registry.test.ts web/src/components/grid/cells.ts web/src/components/grid/cells.test.ts
git commit -m "feat(grid): relation field kind + runtime options + products registry"
```

---

## Task P2: Thread runtime options through the Glide grid

**Files:** Modify `src/components/grid/glide-impl.tsx`

No unit test (canvas). Verify with `npx tsc --noEmit` and `npm run build` (no new deps, but confirm the bundle).

- [ ] **Step 1: Add `optionsByField` to the grid**

In `src/components/grid/glide-impl.tsx`:

(a) Add `optionsByField` to the props interface:
```ts
export interface GlideGridProps {
  fields: FieldDef[]
  rows: Array<Record<string, unknown>>
  isEditable: (rowIndex: number, fieldKey: string) => boolean
  onEdit: (rowIndex: number, fieldKey: string, value: unknown) => Promise<boolean>
  // Runtime-loaded dropdown options for relation fields, keyed by field.key.
  optionsByField?: Record<string, ReadonlyArray<{ value: string; label: string }>>
}
```

(b) Destructure it in the component signature:
```ts
export default function GlideGrid({
  fields,
  rows,
  isEditable,
  onEdit,
  optionsByField,
}: GlideGridProps) {
```

(c) Pass per-field options into `cellModel` inside `getCellContent`. Change the line:
```ts
      const m = cellModel(field, rows[row]?.[field.key], isEditable(row, field.key))
```
to:
```ts
      const m = cellModel(
        field,
        rows[row]?.[field.key],
        isEditable(row, field.key),
        optionsByField?.[field.key],
      )
```

(d) Add `optionsByField` to the `getCellContent` `useCallback` dependency array (it currently lists `[fields, rows, isEditable]`):
```ts
    [fields, rows, isEditable, optionsByField],
  )
```

(The existing `m.kind === 'enum'` branch already renders the dropdown cell from `m.options`, so relation cells need no further change here.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` (no errors in `glide-impl.tsx`), then `npm run build` (succeeds). The build is long-running but finishes on its own (~1-2 min) — wait for the exit.

- [ ] **Step 3: Commit**
```bash
git add web/src/components/grid/glide-impl.tsx
git commit -m "feat(grid): thread runtime relation options into dropdown cells"
```

---

## Task P3: Server — `listProductsGrid` + query

**Files:** Modify `src/lib/products.ts`, `src/lib/queries.ts`

- [ ] **Step 1: Add `listProductsGrid` to `products.ts`**

(a) The file imports `{ categories, productVariants, products } from '#/db/schema'`, `{ and, eq, ilike } from 'drizzle-orm'`, `db`, `getShopCtx`/`getShopCtxWithPermission`, `createServerFn`, `getRequest`, `z`. Extend the schema import to add the grid tables:
```ts
import {
  categories,
  fieldPermissions,
  productVariants,
  products,
  recordLocks,
} from '#/db/schema'
```

(b) Append at the END of `src/lib/products.ts`:
```ts
export const listProductsGrid = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      search: z.string().optional(),
      categoryId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const ctx = await getShopCtxWithPermission(request.headers, 'products')
    const { shopId, branchId, role } = ctx

    const conditions = [eq(products.shopId, shopId)]
    if (branchId) conditions.push(eq(products.branchId, branchId))
    if (data.search) conditions.push(ilike(products.name, `%${data.search}%`))
    if (data.categoryId) conditions.push(eq(products.categoryId, data.categoryId))

    const [rows, cats, perms, locks] = await Promise.all([
      db
        .select({
          id: products.id,
          name: products.name,
          categoryId: products.categoryId,
          categoryName: categories.name,
          buyingPrice: products.buyingPrice,
          sellingPrice: products.sellingPrice,
          stockQty: products.stockQty,
          lowStockThreshold: products.lowStockThreshold,
          barcode: products.barcode,
          imageUrl: products.imageUrl,
          hasVariants: products.hasVariants,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(products.name),
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.shopId, shopId))
        .orderBy(categories.name),
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
            eq(recordLocks.entityType, 'product'),
          ),
        ),
    ])
    return { rows, categories: cats, perms, locks, role }
  })
```
NOTE: `categories` has a `shopId` column (it is a per-shop table). `getShopCtxWithPermission(headers, 'products')` gates read access (all roles can read products; the EDIT mutation is separately gated by `products:write` in the registry). `branchId` comes from the resolved ctx (multi-branch). All `createServerFn`/`getRequest`/`db`/`z`/`and`/`eq`/`ilike` are already imported.

- [ ] **Step 2: Add `productsGridQuery` to `queries.ts`**

(a) Add `listProductsGrid` to the products import. The line currently is:
```ts
import { listCategories, listProducts } from './products'
```
Change to:
```ts
import { listCategories, listProducts, listProductsGrid } from './products'
```

(b) Add after the existing `productsListQuery` export:
```ts
export const productsGridQuery = (
  params: { search?: string; categoryId?: string } = {},
) =>
  queryOptions({
    queryKey: [
      'products',
      'grid',
      { search: params.search ?? null, categoryId: params.categoryId ?? null },
    ],
    queryFn: () =>
      listProductsGrid({
        data: { search: params.search, categoryId: params.categoryId },
      }),
  })
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` — no errors in `products.ts` / `queries.ts`.

- [ ] **Step 4: Commit**
```bash
git add web/src/lib/products.ts web/src/lib/queries.ts
git commit -m "feat(products): listProductsGrid loader + query"
```

---

## Task P4: Wire the Products page to the grid

**Files:** Modify `src/routes/app/products/index.tsx`, `src/routes/app/products/new.tsx`

- [ ] **Step 1: Replace `src/routes/app/products/index.tsx` with:**
```tsx
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { ExportButton } from '#/components/export-button'
import { Input } from '#/components/ui/input'
import { DataGrid } from '#/components/grid/data-grid'
import { RecordHistory } from '#/components/grid/record-history'
import { REGISTRY } from '#/lib/grid/registry'
import { isLocked, resolveFieldPermission } from '#/lib/grid/permissions'
import type { LockRow, PermRow } from '#/lib/grid/permissions'
import { setRecordLock, updateRecordField } from '#/lib/grid/server'
import { deleteProduct } from '#/lib/products'
import type { listProductsGrid } from '#/lib/products'
import { productsGridQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'

export const Route = createFileRoute('/app/products/')({
  validateSearch: z.object({
    search: z.string().optional(),
    categoryId: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({
    search: search.search,
    categoryId: search.categoryId,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      productsGridQuery({ search: deps.search, categoryId: deps.categoryId }),
    ),
  component: ProductsPage,
})

const FIELDS = REGISTRY.products.fields

type GridData = Awaited<ReturnType<typeof listProductsGrid>>
type ProductRow = GridData['rows'][number]

function ProductsPage() {
  const data = Route.useLoaderData()
  const { search, categoryId } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ProductsContent
      data={data}
      search={search}
      categoryId={categoryId}
      onSearch={(value) =>
        navigate({ search: (s) => ({ ...s, search: value || undefined }) })
      }
      onCategoryChange={(value) =>
        navigate({ search: (s) => ({ ...s, categoryId: value || undefined }) })
      }
    />
  )
}

export function ProductsContent({
  data,
  search,
  categoryId,
  onSearch,
  onCategoryChange,
  children,
}: {
  data: GridData
  search?: string
  categoryId?: string
  onSearch: (value: string) => void
  onCategoryChange?: (value: string) => void
  children?: ReactNode
}) {
  const router = useRouter()
  const refresh = useRefresh()
  const [rows, setRows] = useState<ProductRow[]>(data.rows)
  const perms = data.perms as PermRow[]
  const [locks, setLocks] = useState<LockRow[]>(data.locks as LockRow[])
  const role = data.role
  const isOwner = role === 'owner'
  const [deleting, setDeleting] = useState<string | null>(null)

  const optionsByField = useMemo(
    () => ({
      categoryId: [
        { value: '', label: '— None —' },
        ...data.categories.map((c) => ({ value: c.id, label: c.name })),
      ],
    }),
    [data.categories],
  )

  const isEditable = useMemo(
    () => (rowIndex: number, fieldKey: string) => {
      const rec = rows[rowIndex] as ProductRow | undefined
      if (!rec) return false
      if (!resolveFieldPermission(perms, 'products', fieldKey, role)) return false
      if (role !== 'owner' && isLocked(locks, 'product', rec.id)) return false
      return true
    },
    [rows, perms, locks, role],
  )

  async function onEdit(rowIndex: number, fieldKey: string, value: unknown) {
    const rec = rows[rowIndex]
    try {
      const updated = (await updateRecordField({
        data: { resource: 'products', id: rec.id, field: fieldKey, value },
      })) as Partial<ProductRow>
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== rowIndex) return r
          const merged = { ...r, ...updated }
          // categoryName is a join alias absent from the base row — keep the
          // grid label in sync when the category id changes.
          if ('categoryId' in updated) {
            merged.categoryName =
              data.categories.find((c) => c.id === merged.categoryId)?.name ?? null
          }
          return merged
        }),
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
        data: { entityType: 'product', entityId: id, unlocked: currentlyLocked },
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not change lock')
      return
    }
    setLocks((prev) => {
      const rest = prev.filter(
        (l) => !(l.entityType === 'product' && l.entityId === id),
      )
      return [
        ...rest,
        { entityType: 'product', entityId: id, unlocked: currentlyLocked },
      ]
    })
    router.invalidate()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await deleteProduct({ data: { id } })
    setDeleting(null)
    setRows((prev) => prev.filter((r) => r.id !== id))
    refresh()
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
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-sea-ink/[0.04]">
              {FIELDS.map((f) => (
                <td key={f.key} className="px-4 py-3 text-sea-ink-soft">
                  {f.key === 'categoryId'
                    ? (p.categoryName ?? '—')
                    : ((p[f.key as keyof ProductRow] as string | number | null) ??
                      '—')}
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
          Products
        </h2>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={rows}
            filename="products"
            columns={[
              { header: 'Name', value: (p) => p.name },
              { header: 'Category', value: (p) => p.categoryName ?? '' },
              { header: 'Buying Price', value: (p) => p.buyingPrice },
              { header: 'Selling Price', value: (p) => p.sellingPrice },
              { header: 'Stock', value: (p) => p.stockQty },
              { header: 'Low Stock Alert', value: (p) => p.lowStockThreshold },
              { header: 'Barcode', value: (p) => p.barcode ?? '' },
            ]}
          />
          <Link to="/app/products/stocktake">
            <Button size="sm" variant="outline">
              Stocktake
            </Button>
          </Link>
          <Link to="/app/products/import">
            <Button size="sm" variant="outline">
              Import
            </Button>
          </Link>
          <Link to="/app/products/labels">
            <Button size="sm" variant="outline">
              Labels
            </Button>
          </Link>
          <Link to="/app/products/new">
            <Button size="sm">+ Add product</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search products…"
          defaultValue={search ?? ''}
          onChange={(e) => onSearch(e.target.value)}
          className="max-w-xs"
        />
        {data.categories.length > 0 && onCategoryChange && (
          <select
            value={categoryId ?? ''}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="border border-line rounded-md px-3 py-2 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
          >
            <option value="">All categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No products yet.{' '}
          <Link to="/app/products/new" className="text-lagoon-deep hover:underline">
            Add your first product.
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-sea-ink-soft">
            Stock is read-only here — adjust it from a product's Adjust action so
            the stock ledger stays accurate.
          </p>
          <DataGrid
            fields={FIELDS}
            rows={rows}
            isEditable={isEditable}
            onEdit={onEdit}
            optionsByField={optionsByField}
            fallback={fallbackTable}
          />

          <div className="app-card p-4">
            <p className="text-sm font-semibold text-sea-ink mb-2">
              Product tools
            </p>
            <ul className="divide-y divide-line text-sm">
              {rows.map((p) => {
                const locked = isLocked(locks, 'product', p.id)
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-2 gap-3"
                  >
                    <span className="text-sea-ink truncate">{p.name}</span>
                    <span className="flex items-center gap-3 shrink-0 text-xs">
                      <Link
                        to="/app/products/$productId/variants"
                        params={{ productId: p.id }}
                        className="text-sea-ink-soft hover:text-sea-ink"
                      >
                        Variants
                      </Link>
                      <Link
                        to="/app/products/$productId/ledger"
                        params={{ productId: p.id }}
                        className="text-sea-ink-soft hover:text-sea-ink"
                      >
                        Ledger
                      </Link>
                      <Link
                        to="/app/products/$productId/adjust"
                        params={{ productId: p.id }}
                        className="text-sea-ink-soft hover:text-sea-ink"
                      >
                        Adjust
                      </Link>
                      <Link
                        to="/app/products/$productId/edit"
                        params={{ productId: p.id }}
                        className="text-lagoon-deep hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="text-red-500 hover:underline disabled:opacity-50"
                      >
                        {deleting === p.id ? '…' : 'Delete'}
                      </button>
                      {isOwner && (
                        <>
                          <RecordHistory
                            entityType="product"
                            entityId={p.id}
                            label={p.name}
                          />
                          <button
                            onClick={() => toggleLock(p.id, locked)}
                            className="text-lagoon-deep hover:underline"
                          >
                            {locked ? 'Unlock' : 'Lock'}
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {children}
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/routes/app/products/new.tsx` with:**
```tsx
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { ProductForm } from '#/components/product-form'
import { RouteDialog } from '#/components/route-dialog'
import { createProduct } from '#/lib/products'
import { productsGridQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'

import { can } from '#/lib/permissions'
import { ProductsContent } from './index'

export const Route = createFileRoute('/app/products/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write'))
      throw redirect({ to: '/app/products' })
  },
  validateSearch: z.object({ search: z.string().optional() }),
  loaderDeps: ({ search }) => ({ search: search.search }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(productsGridQuery({ search: deps.search })),
  component: NewProductPage,
})

function NewProductPage() {
  const data = Route.useLoaderData()
  const { search } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const refresh = useRefresh()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function close() {
    router.navigate({ to: '/app/products' })
  }

  return (
    <ProductsContent
      data={data}
      search={search}
      onSearch={(value) => navigate({ search: { search: value || undefined } })}
    >
      <RouteDialog title="Add product" onClose={close}>
        <ProductForm
          categories={data.categories}
          loading={loading}
          error={error}
          onCancel={close}
          onSubmit={async (values) => {
            setLoading(true)
            setError('')
            try {
              await createProduct({ data: values })
              await refresh()
              close()
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to save')
            } finally {
              setLoading(false)
            }
          }}
        />
      </RouteDialog>
    </ProductsContent>
  )
}
```
(`ProductForm`'s `categories` prop takes `{ id, name }[]` — `data.categories` is exactly that shape, so the separate `categoriesListQuery` load is no longer needed here.)

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` (no errors in the two route files), then
`npx eslint src/routes/app/products/index.tsx src/routes/app/products/new.tsx`
Expected: exit 0. Fix any introduced errors (drop unnecessary casts, type index access as possibly-undefined where a `!x` guard is used, prefer `data.role` without cast — same fixes the suppliers/expenses slices needed). If `ProductForm`'s prop type rejects `data.categories` (e.g. it expects a different field set), adapt minimally and report.

- [ ] **Step 4: Boot**

Run: `npm run dev`, wait for the ready URL (no stack traces), then stop it (long-running — timeout/background, confirm ready, kill).

- [ ] **Step 5: Commit**
```bash
git add web/src/routes/app/products/index.tsx web/src/routes/app/products/new.tsx
git commit -m "feat(products): editable grid with relation cells, permissions, locks, audit"
```

---

## Task P5: Regression — tests, lint, build

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: all prior tests + the new products/relation assertions pass. Report totals.

- [ ] **Step 2: Lint the feature surface**

Run: `npx eslint src/lib/grid src/components/grid src/routes/app/products src/lib/products.ts src/lib/queries.ts`
Expected: exit 0. Fix any new errors (the repo has a pre-existing dirty baseline elsewhere — do not touch unrelated files).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Final commit (only if lint produced fixes)**
```bash
git add -- web/src/lib/grid web/src/components/grid web/src/routes/app/products
git commit -m "chore(grid): lint pass for products rollout"
```

---

## Manual verification (needs a logged-in browser)

1. As **owner**, open `/app/products`. The grid shows Name, Category (dropdown), Buy price, Sell price, Stock (greyed/read-only), Low-stock alert, Barcode.
2. Edit Sell price → persists on reload; row **Edits** popover shows old→new; `/app/activity` shows "changed sellingPrice".
3. Change Category via the dropdown → the cell label updates and persists; audited.
4. Confirm **Stock** is never editable (greyed for everyone incl. owner); the helper note points to Adjust.
5. Search + category filter still work; the per-row **Variants / Ledger / Adjust / Edit / Delete** tools work; Delete removes the row.
6. In **Settings → Edit permissions**, the Products block lists Name/Category/Buy/Sell/Low-stock/Barcode (NOT Stock). Uncheck **manager → sellingPrice**.
7. As a **manager**, Sell price is read-only; other permitted fields editable only when the owner has **unlocked** that row. As a **cashier**, the whole grid is read-only (cashier lacks `products:write`).
8. The **+ Add product** modal still works (category select populated).

---

## Self-Review (plan author)

**Spec coverage (spec §11 "Products: edit existing; price/stock are financial"):**
- Edit existing + permissions + lock + audit ✓ (P1/P3/P4 reuse the generic `updateRecordField`). buyingPrice/sellingPrice `financial` + manager-locked-by-default ✓. Stock handled as display-only with a documented domain reason (ledger integrity) — stronger than the spec's "financial" hint, and surfaced to the user with an on-page note.
- **Relation cells** (category) ✓ — new primitive (P1 `relation` kind + P2 `optionsByField` threading), reusing the proven dropdown cell. Supplier relation deferred (it lives on the edit page); noted.

**Type consistency:** `CellKind` gains `'relation'` (P1) → handled by `cellModel` (P1) and rendered via the existing `'enum'` dropdown branch (no glide change beyond options threading, P2). `GlideGridProps.optionsByField` (P2) flows through `DataGridProps extends GlideGridProps` to the page (P4) — `DataGrid` itself unchanged. `GridData`/`ProductRow`/`isEditable`/`onEdit`/`toggleLock`/`optionsByField` mirror the proven Expenses shapes (P4). `listProductsGrid` returns `{rows, categories, perms, locks, role}` (P3) matching `productsGridQuery` and the loaders.

**Placeholder scan:** none — every step has runnable code/commands. The relation display-sync on edit (`categoryName` recompute) and the dead-query cleanup are handled explicitly.

**Watch-points:** (1) After P4, `productsListQuery` and `categoriesListQuery` lose their last consumers — they become dead and should be removed in the lint pass / review (mirrors the suppliers/expenses cleanup; check no other importer first). (2) `ProductForm` prop shape — adapt if it expects more than `{id,name}` categories (P4 Step 3). (3) Relation target not validated against the shop server-side (noted under Domain decisions) — acceptable v1, future hardening. (4) `wholeNumber` zod behaviour across 4.4.x (P1 Step 3 note).
