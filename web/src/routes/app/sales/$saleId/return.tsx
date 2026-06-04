import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Undo2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { can } from '#/lib/permissions'
import { createReturn, getReturnableItems } from '#/lib/returns'

export const Route = createFileRoute('/app/sales/$saleId/return')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/sales' })
  },
  loader: ({ params }) => getReturnableItems({ data: { saleId: params.saleId } }),
  component: ReturnPage,
})

function ReturnPage() {
  const { sale, items } = Route.useLoaderData()
  const { saleId } = Route.useParams()
  const router = useRouter()

  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const anyReturnable = items.some((i) => i.returnableQty > 0)

  function setQty(saleItemId: string, qty: number, max: number) {
    const clamped = Math.max(0, Math.min(qty, max))
    setReturnQty((prev) => ({ ...prev, [saleItemId]: clamped }))
  }

  const refundTotal = items.reduce((sum, i) => {
    const qty = returnQty[i.saleItemId] ?? 0
    return sum + qty * Number(i.unitPrice)
  }, 0)

  const selectedItems = items
    .filter((i) => (returnQty[i.saleItemId] ?? 0) > 0)
    .map((i) => ({ saleItemId: i.saleItemId, quantity: returnQty[i.saleItemId] }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedItems.length === 0) {
      setError('Select at least one item to return')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createReturn({
        data: { saleId, reason: reason || undefined, items: selectedItems },
      })
      await router.navigate({
        to: '/app/sales/$saleId/receipt',
        params: { saleId },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process return')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/app/sales/$saleId/receipt"
          params={{ saleId }}
          className="text-gray-400 hover:text-gray-700"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Return / Refund</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Receipt #{saleId.slice(-8).toUpperCase()} · Status: {sale.status}
          </p>
        </div>
      </div>

      {!anyReturnable ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
          All items on this sale have already been returned.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium text-center">Sold</th>
                  <th className="px-4 py-3 font-medium text-center">Returnable</th>
                  <th className="px-4 py-3 font-medium text-center">Return Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((i) => {
                  const max = i.returnableQty
                  const qty = returnQty[i.saleItemId] ?? 0
                  return (
                    <tr key={i.saleItemId} className={max === 0 ? 'opacity-40' : ''}>
                      <td className="px-4 py-3 text-gray-900">
                        {i.productName ?? 'Item'}
                        <span className="text-gray-400 text-xs ml-1">
                          @ {i.unitPrice}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {i.quantity}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {max}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={max === 0}
                            onClick={() => setQty(i.saleItemId, qty - 1, max)}
                            className="w-6 h-6 rounded border text-gray-600 hover:bg-gray-100 text-sm disabled:opacity-30"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={max}
                            disabled={max === 0}
                            value={qty || ''}
                            onChange={(e) =>
                              setQty(i.saleItemId, Number(e.target.value), max)
                            }
                            className="w-12 text-center border rounded py-1 text-sm"
                          />
                          <button
                            type="button"
                            disabled={max === 0}
                            onClick={() => setQty(i.saleItemId, qty + 1, max)}
                            className="w-6 h-6 rounded border text-gray-600 hover:bg-gray-100 text-sm disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ret-reason">Reason (optional)</Label>
            <Input
              id="ret-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Damaged item, wrong product"
            />
          </div>

          <div className="bg-gray-50 border rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Refund amount</span>
            <span className="text-lg font-bold text-gray-900">
              {refundTotal.toFixed(2)}
            </span>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || refundTotal === 0}>
              <Undo2 size={15} className="mr-1.5" />
              {loading ? 'Processing…' : 'Process return'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.navigate({ to: '/app/sales/$saleId/receipt', params: { saleId } })
              }
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
