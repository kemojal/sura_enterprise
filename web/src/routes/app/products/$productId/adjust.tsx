import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useRefresh } from '#/lib/use-refresh'
import { useState } from 'react'
import { ArrowLeft, Minus, Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { can } from '#/lib/permissions'
import {
  createStockAdjustment,
  getProductAdjustments,
} from '#/lib/stock-adjustments'

export const Route = createFileRoute('/app/products/$productId/adjust')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/products' })
  },
  loader: ({ params }) =>
    getProductAdjustments({ data: { productId: params.productId } }),
  component: AdjustStockPage,
})

const adjTypes = [
  { value: 'restock', label: 'Restock', icon: Plus, color: 'text-palm', bg: 'bg-green-50 border-green-200', desc: 'Received new stock from supplier' },
  { value: 'initial_count', label: 'Initial Count', icon: Plus, color: 'text-lagoon-deep', bg: 'bg-lagoon/10 border-lagoon/20', desc: 'Set correct quantity from physical count' },
  { value: 'write_off', label: 'Write-off', icon: Minus, color: 'text-red-600', bg: 'bg-red-50 border-red-200', desc: 'Damaged, expired, or lost items' },
  { value: 'correction', label: 'Correction', icon: Plus, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', desc: 'Positive count discrepancy correction' },
] as const

const typeLabel: Record<string, string> = {
  restock: 'Restock',
  initial_count: 'Initial Count',
  write_off: 'Write-off',
  correction: 'Correction',
}

function AdjustStockPage() {
  const { product, adjustments } = Route.useLoaderData()
  const { productId } = Route.useParams()
  const refresh = useRefresh()

  const [type, setType] = useState<(typeof adjTypes)[number]['value']>('restock')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ newQty: number } | null>(null)

  const isDecrease = type === 'write_off'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseInt(quantity, 10)
    if (!qty || qty < 1) {
      setError('Enter a positive quantity')
      return
    }
    setLoading(true)
    setError('')
    setSuccess(null)
    try {
      const result = await createStockAdjustment({
        data: { productId, type, quantity: qty, note: note || undefined },
      })
      setSuccess({ newQty: result.newQty })
      setQuantity('')
      setNote('')
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/app/products"
          className="text-sea-ink-soft hover:text-sea-ink"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
            Adjust Stock — {product.name}
          </h2>
          <p className="text-sm text-sea-ink-soft mt-0.5">
            Current stock:{' '}
            <span className="font-medium text-sea-ink">{product.stockQty}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Adjustment form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Adjustment type</Label>
            <div className="grid grid-cols-2 gap-2">
              {adjTypes.map((t) => {
                const Icon = t.icon
                const selected = type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? `${t.bg} border-current`
                        : 'bg-white border-line hover:bg-sea-ink/[0.04]'
                    }`}
                  >
                    <Icon
                      size={14}
                      className={`mt-0.5 shrink-0 ${selected ? t.color : 'text-sea-ink-soft'}`}
                    />
                    <div>
                      <p
                        className={`text-xs font-medium ${
                          selected ? t.color : 'text-sea-ink'
                        }`}
                      >
                        {t.label}
                      </p>
                      <p className="text-xs text-sea-ink-soft mt-0.5 leading-tight">
                        {t.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="adj-qty">
              Quantity to {isDecrease ? 'remove' : 'add'}
            </Label>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-bold w-5 text-center ${
                  isDecrease ? 'text-red-500' : 'text-palm'
                }`}
              >
                {isDecrease ? '−' : '+'}
              </span>
              <Input
                id="adj-qty"
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-32"
                placeholder="0"
              />
              {quantity && (
                <span className="text-sm text-sea-ink-soft">
                  →{' '}
                  <span className="font-medium text-sea-ink">
                    {product.stockQty +
                      (isDecrease ? -parseInt(quantity) : parseInt(quantity))}
                  </span>{' '}
                  in stock
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="adj-note">Note (optional)</Label>
            <Input
              id="adj-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received from supplier invoice #42"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <p className="text-sm text-palm font-medium">
              Stock updated. New quantity: {success.newQty}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save adjustment'}
          </Button>
        </form>

        {/* History */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-sea-ink">
            Recent adjustments
          </h3>
          {adjustments.length === 0 ? (
            <p className="text-sm text-sea-ink-soft">No adjustments yet.</p>
          ) : (
            <div className="space-y-2">
              {adjustments.map((a) => {
                const isNeg = a.quantity < 0
                return (
                  <div
                    key={a.id}
                    className="app-card rounded-lg px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-sea-ink">
                          {typeLabel[a.type] ?? a.type}
                        </span>
                        {a.staffName && (
                          <span className="text-xs text-sea-ink-soft">
                            · {a.staffName}
                          </span>
                        )}
                      </div>
                      {a.note && (
                        <p className="text-xs text-sea-ink-soft mt-0.5 truncate">
                          {a.note}
                        </p>
                      )}
                      <p className="text-xs text-sea-ink-soft mt-0.5">
                        {new Date(a.createdAt).toLocaleDateString('en-GH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold shrink-0 ${
                        isNeg ? 'text-red-600' : 'text-palm'
                      }`}
                    >
                      {isNeg ? '' : '+'}
                      {a.quantity}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
