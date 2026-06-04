import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { listCustomers } from '#/lib/customers'
import { can } from '#/lib/permissions'
import { listSellableItems } from '#/lib/products'
import { createQuote } from '#/lib/quotes'

export const Route = createFileRoute('/app/quotes/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'sales')) throw redirect({ to: '/app/dashboard' })
  },
  loader: async () => {
    const [sellable, customers] = await Promise.all([
      listSellableItems(),
      listCustomers({ data: {} }),
    ])
    return {
      products: [...sellable.products, ...sellable.variants],
      customers,
    }
  },
  component: NewQuotePage,
})

interface Line {
  productId: string
  variantId: string | null
  name: string
  quantity: number
  unitPrice: string
}

function key(p: string, v: string | null) {
  return v ? `v:${v}` : `p:${p}`
}

function NewQuotePage() {
  const { products, customers } = Route.useLoaderData()
  const router = useRouter()

  const [lines, setLines] = useState<Line[]>([])
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  function add(p: (typeof products)[number]) {
    const v = p.variantId ?? null
    const k = key(p.id, v)
    setLines((prev) => {
      const existing = prev.find((l) => key(l.productId, l.variantId) === k)
      if (existing) {
        return prev.map((l) =>
          key(l.productId, l.variantId) === k
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        )
      }
      return [
        ...prev,
        { productId: p.id, variantId: v, name: p.name, quantity: 1, unitPrice: p.sellingPrice },
      ]
    })
  }

  function updateLine(k: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (key(l.productId, l.variantId) === k ? { ...l, ...patch } : l)),
    )
  }
  function removeLine(k: string) {
    setLines((prev) => prev.filter((l) => key(l.productId, l.variantId) !== k))
  }

  const total = lines.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lines.length === 0) {
      setError('Add at least one product')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { id } = await createQuote({
        data: {
          items: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || undefined,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          customerId: customerId || undefined,
          notes: notes || undefined,
          validUntil: validUntil || undefined,
        },
      })
      await router.navigate({ to: '/app/quotes/$quoteId', params: { quoteId: id } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create quote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">New Quote</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Product picker */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-medium text-gray-700">Products</h3>
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto divide-y">
            {filtered.map((p) => (
              <button
                key={key(p.id, p.variantId ?? null)}
                type="button"
                onClick={() => add(p)}
                className="w-full flex items-center justify-between px-2 py-2.5 hover:bg-gray-50 text-left"
              >
                <span className="text-sm font-medium text-gray-900">{p.name}</span>
                <span className="text-sm text-gray-700">{p.sellingPrice}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quote */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Customer (optional)</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— No customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-medium text-gray-700">Line items</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-400">No products added.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => {
                  const k = key(l.productId, l.variantId)
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                        {l.name}
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(k, { quantity: Math.max(1, Number(e.target.value)) })
                        }
                        className="w-14 border rounded px-2 py-1 text-sm text-center"
                      />
                      <span className="text-gray-400 text-xs">×</span>
                      <input
                        type="number"
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(k, { unitPrice: e.target.value })}
                        className="w-20 border rounded px-2 py-1 text-sm text-right"
                      />
                      <span className="w-16 text-right text-sm font-medium">
                        {(Number(l.unitPrice) * l.quantity).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(k)}
                        className="text-gray-300 hover:text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="pt-2 border-t flex justify-between font-medium">
              <span>Total</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="q-valid">Valid until</Label>
            <Input
              id="q-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="q-notes">Notes</Label>
            <Textarea
              id="q-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || lines.length === 0}>
              {loading ? 'Creating…' : 'Create quote'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.navigate({ to: '/app/quotes' })}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
