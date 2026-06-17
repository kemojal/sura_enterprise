import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
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

  // Re-sync grid state when the loader returns new data (search/category
  // filter change, or a refetch). Inline edits don't refetch, so optimistic
  // row state is preserved between filter changes.
  useEffect(() => {
    setRows(data.rows)
    setLocks(data.locks)
  }, [data.rows, data.locks])

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
