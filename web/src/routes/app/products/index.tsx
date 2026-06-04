import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { ExportButton } from '#/components/export-button'
import { Input } from '#/components/ui/input'
import { deleteProduct, listCategories, listProducts } from '#/lib/products'

type CategoryOption = { id: string; name: string }

export const Route = createFileRoute('/app/products/')({
  validateSearch: z.object({
    search: z.string().optional(),
    categoryId: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({
    search: search.search,
    categoryId: search.categoryId,
  }),
  loader: async ({ deps }) => {
    const [products, categories] = await Promise.all([
      listProducts({ data: { search: deps.search, categoryId: deps.categoryId } }),
      listCategories(),
    ])
    return { products, categories }
  },
  component: ProductsPage,
})

function ProductsPage() {
  const { products, categories } = Route.useLoaderData()
  const { search, categoryId } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ProductsContent
      products={products}
      categories={categories}
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
  products,
  categories,
  search,
  categoryId,
  onSearch,
  onCategoryChange,
  children,
}: {
  products: Awaited<ReturnType<typeof listProducts>>
  categories?: CategoryOption[]
  search?: string
  categoryId?: string
  onSearch: (value: string) => void
  onCategoryChange?: (value: string) => void
  children?: ReactNode
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    await deleteProduct({ data: { id } })
    setDeleting(null)
    router.invalidate()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Products</h2>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={products}
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
        {categories && categories.length > 0 && onCategoryChange && (
          <select
            value={categoryId ?? ''}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No products yet.{' '}
          <Link
            to="/app/products/new"
            className="text-blue-600 hover:underline"
          >
            Add your first product.
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium w-10"></th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Buy</th>
                <th className="px-4 py-3 font-medium text-right">Sell</th>
                <th className="px-4 py-3 font-medium text-right">Margin</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => {
                const isLow =
                  p.stockQty > 0 && p.stockQty <= p.lowStockThreshold
                const isOut = p.stockQty === 0
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-9 h-9 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-gray-100 border flex items-center justify-center text-gray-300 text-xs">
                          —
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.categoryName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.buyingPrice}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.sellingPrice}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const buy = Number(p.buyingPrice)
                        const sell = Number(p.sellingPrice)
                        const margin = sell - buy
                        // Margin % is profit over revenue (matches reports)
                        const marginPct = sell > 0 ? (margin / sell) * 100 : 0
                        return (
                          <span
                            className={
                              margin < 0
                                ? 'text-red-600'
                                : margin === 0
                                  ? 'text-gray-400'
                                  : 'text-green-600'
                            }
                          >
                            {margin.toFixed(2)}
                            {sell > 0 && (
                              <span className="text-xs text-gray-400 ml-1">
                                ({marginPct.toFixed(0)}%)
                              </span>
                            )}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          isOut
                            ? 'bg-red-100 text-red-700'
                            : isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {isOut ? 'Out' : p.stockQty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to="/app/products/$productId/adjust"
                          params={{ productId: p.id }}
                          className="text-gray-500 hover:text-gray-900 text-xs"
                        >
                          Adjust
                        </Link>
                        <Link
                          to="/app/products/$productId/edit"
                          params={{ productId: p.id }}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="text-red-500 hover:underline text-xs disabled:opacity-50"
                        >
                          {deleting === p.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {children}
    </div>
  )
}
