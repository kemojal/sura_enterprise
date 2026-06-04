import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, PackagePlus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { can } from '#/lib/permissions'
import {
  createPurchaseOrder,
  getReorderSuggestions,
} from '#/lib/purchase-orders'

export const Route = createFileRoute('/app/purchase-orders/reorder')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'purchase_orders'))
      throw redirect({ to: '/app/dashboard' })
  },
  loader: () => getReorderSuggestions(),
  component: ReorderPage,
})

type Suggestion = Awaited<ReturnType<typeof getReorderSuggestions>>[number]

interface LineState {
  include: boolean
  quantity: number
  unitCost: string
}

function ReorderPage() {
  const suggestions = Route.useLoaderData()
  const router = useRouter()

  const [lines, setLines] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      suggestions.map((s) => [
        s.id,
        { include: true, quantity: s.suggestedQty, unitCost: s.buyingPrice },
      ]),
    ),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [createdGroups, setCreatedGroups] = useState<string[]>([])

  function setLine(id: string, patch: Partial<LineState>) {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  // Group suggestions by supplier (null supplier => "Unassigned")
  const groups = new Map<string, { name: string; items: Suggestion[] }>()
  for (const s of suggestions) {
    const key = s.supplierId ?? '__none__'
    if (!groups.has(key)) {
      groups.set(key, { name: s.supplierName ?? 'No supplier', items: [] })
    }
    groups.get(key)!.items.push(s)
  }

  async function createGroupPO(
    key: string,
    supplierId: string | null,
    items: Suggestion[],
  ) {
    const selected = items
      .filter((i) => lines[i.id]?.include && lines[i.id]?.quantity > 0)
      .map((i) => ({
        productId: i.id,
        quantity: lines[i.id].quantity,
        unitCost: lines[i.id].unitCost,
      }))
    if (selected.length === 0) {
      setError('Select at least one item in this group')
      return
    }
    setBusy(key)
    setError('')
    try {
      await createPurchaseOrder({
        data: {
          supplierId: supplierId || undefined,
          notes: 'Auto-reorder from low stock',
          items: selected,
        },
      })
      setCreatedGroups((g) => [...g, key])
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/purchase-orders" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reorder Low Stock</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Suggested quantities top stock up to 2× the alert threshold. One
            order is created per supplier.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {suggestions.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          Nothing to reorder — all products are above their low-stock threshold.
        </div>
      ) : (
        [...groups.entries()].map(([key, group]) => {
          const created = createdGroups.includes(key)
          const supplierId = key === '__none__' ? null : key
          return (
            <div
              key={key}
              className={`bg-white border rounded-xl overflow-hidden ${created ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <span className="font-medium text-gray-900">{group.name}</span>
                {created ? (
                  <span className="text-xs text-green-700 font-medium">
                    Order created ✓
                  </span>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy === key}
                    onClick={() => createGroupPO(key, supplierId, group.items)}
                  >
                    <PackagePlus size={14} className="mr-1.5" />
                    {busy === key ? 'Creating…' : 'Create order'}
                  </Button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="text-gray-400 text-left">
                  <tr>
                    <th className="px-4 py-2 font-normal w-8"></th>
                    <th className="px-4 py-2 font-normal">Product</th>
                    <th className="px-4 py-2 font-normal text-center">Stock</th>
                    <th className="px-4 py-2 font-normal text-right">Order Qty</th>
                    <th className="px-4 py-2 font-normal text-right">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {group.items.map((i) => {
                    const line = lines[i.id]
                    const isOut = i.stockQty === 0
                    return (
                      <tr key={i.id} className={!line.include ? 'opacity-40' : ''}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={line.include}
                            disabled={created}
                            onChange={(e) =>
                              setLine(i.id, { include: e.target.checked })
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-gray-900">
                          {i.name}
                          <span
                            className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
                          >
                            {isOut ? 'Out' : `${i.stockQty} left`}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-gray-500">
                          {i.stockQty}/{i.lowStockThreshold}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            disabled={created}
                            onChange={(e) =>
                              setLine(i.id, {
                                quantity: Math.max(1, Number(e.target.value)),
                              })
                            }
                            className="w-16 border rounded px-2 py-1 text-sm text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitCost}
                            disabled={created}
                            onChange={(e) =>
                              setLine(i.id, { unitCost: e.target.value })
                            }
                            className="w-20 border rounded px-2 py-1 text-sm text-right"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}
