import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { can } from '#/lib/permissions'
import { listProducts } from '#/lib/products'
import { createPurchaseOrder } from '#/lib/purchase-orders'
import { listSuppliers } from '#/lib/suppliers'

export const Route = createFileRoute('/app/purchase-orders/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'purchase_orders'))
      throw redirect({ to: '/app/dashboard' })
  },
  loader: async () => {
    const [products, suppliers] = await Promise.all([
      listProducts({ data: {} }),
      listSuppliers(),
    ])
    return { products, suppliers }
  },
  component: NewPurchaseOrderPage,
})

interface POLine {
  productId: string
  name: string
  quantity: number
  unitCost: string
}

function NewPurchaseOrderPage() {
  const { products, suppliers } = Route.useLoaderData()
  const router = useRouter()

  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<POLine[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  function addLine(p: (typeof products)[number]) {
    setLines((prev) => {
      if (prev.some((l) => l.productId === p.id)) return prev
      return [
        ...prev,
        { productId: p.id, name: p.name, quantity: 1, unitCost: p.buyingPrice },
      ]
    })
  }

  function updateLine(id: string, patch: Partial<POLine>) {
    setLines((prev) =>
      prev.map((l) => (l.productId === id ? { ...l, ...patch } : l)),
    )
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.productId !== id))
  }

  const total = lines.reduce(
    (sum, l) => sum + Number(l.unitCost) * l.quantity,
    0,
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lines.length === 0) {
      setError('Add at least one product')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { id } = await createPurchaseOrder({
        data: {
          supplierId: supplierId || undefined,
          notes: notes || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      })
      await router.navigate({
        to: '/app/purchase-orders/$poId',
        params: { poId: id },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
        New Purchase Order
      </h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Product picker */}
        <div className="app-card p-4 space-y-3">
          <h3 className="font-semibold text-sea-ink">Products</h3>
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addLine(p)}
                className="w-full flex items-center justify-between px-2 py-2.5 hover:bg-sea-ink/[0.04] text-left"
              >
                <div>
                  <p className="text-sm font-medium text-sea-ink">{p.name}</p>
                  <p className="text-xs text-sea-ink-soft">
                    Stock: {p.stockQty}
                  </p>
                </div>
                <span className="text-xs text-sea-ink-soft">
                  Cost: {p.buyingPrice}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Order */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Supplier (optional)</Label>
            <select
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">— No supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="app-card p-4 space-y-3">
            <h3 className="font-semibold text-sea-ink">Order lines</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-sea-ink-soft">No products added.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.productId} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sea-ink truncate">
                        {l.name}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={l.quantity}
                      onChange={(e) =>
                        updateLine(l.productId, {
                          quantity: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-16 border border-line rounded px-2 py-1 text-sm text-center focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
                      title="Quantity"
                    />
                    <span className="text-sea-ink-soft text-xs">×</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={l.unitCost}
                      onChange={(e) =>
                        updateLine(l.productId, { unitCost: e.target.value })
                      }
                      className="w-20 border border-line rounded px-2 py-1 text-sm text-right focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
                      title="Unit cost"
                    />
                    <span className="w-16 text-right text-sm font-medium">
                      {(Number(l.unitCost) * l.quantity).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(l.productId)}
                      className="text-sea-ink-soft hover:text-red-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-2 border-t border-line flex justify-between font-medium text-sea-ink">
              <span>Total</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivery expected Friday"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || lines.length === 0}>
              {loading ? 'Creating…' : 'Create order'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.navigate({ to: '/app/purchase-orders' })}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
