import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { can } from '#/lib/permissions'
import { listProducts } from '#/lib/products'
import { bulkStocktake } from '#/lib/stock-adjustments'

export const Route = createFileRoute('/app/products/stocktake')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/products' })
  },
  loader: () => listProducts({ data: {} }),
  component: StocktakePage,
})

function StocktakePage() {
  const products = Route.useLoaderData()
  const router = useRouter()

  // counted[id] = string input; undefined means "not yet entered" (= no change)
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ adjusted: number } | null>(null)

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  // Rows where a count was entered and differs from current stock
  const changes = useMemo(
    () =>
      products.filter((p) => {
        const v = counted[p.id]
        return v !== undefined && v !== '' && Number(v) !== p.stockQty
      }),
    [counted, products],
  )

  async function handleSubmit() {
    if (changes.length === 0) {
      setError('No counts differ from current stock')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await bulkStocktake({
        data: {
          counts: changes.map((p) => ({
            productId: p.id,
            countedQty: Number(counted[p.id]),
          })),
        },
      })
      setResult(res)
      setCounted({})
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save stocktake')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/products" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Stocktake</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter the physical count for each product. Only mismatches are
            adjusted.
          </p>
        </div>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-sm text-green-800">
          <ClipboardCheck size={18} />
          Stocktake saved — {result.adjusted} product
          {result.adjusted === 1 ? '' : 's'} corrected.
          <Link to="/app/products" className="ml-auto font-medium underline">
            View products
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-gray-500">
          {changes.length > 0
            ? `${changes.length} change${changes.length === 1 ? '' : 's'}`
            : 'No changes'}
        </span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium text-right">System</th>
              <th className="px-4 py-3 font-medium text-right w-28">Counted</th>
              <th className="px-4 py-3 font-medium text-right">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => {
              const v = counted[p.id]
              const hasCount = v !== undefined && v !== ''
              const diff = hasCount ? Number(v) - p.stockQty : 0
              return (
                <tr key={p.id} className={diff !== 0 ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-2 text-gray-900">{p.name}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {p.stockQty}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={v ?? ''}
                      placeholder={String(p.stockQty)}
                      onChange={(e) =>
                        setCounted((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="w-20 border rounded px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {hasCount && diff !== 0 ? (
                      <span
                        className={diff > 0 ? 'text-green-600' : 'text-red-600'}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSubmit} disabled={loading || changes.length === 0}>
        <ClipboardCheck size={15} className="mr-1.5" />
        {loading
          ? 'Saving…'
          : `Apply ${changes.length} correction${changes.length === 1 ? '' : 's'}`}
      </Button>
    </div>
  )
}
