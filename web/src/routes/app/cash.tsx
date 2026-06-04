import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Banknote, CheckCircle2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import {
  createReconciliation,
  getCashSummary,
  listReconciliations,
} from '#/lib/cash'
import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/cash')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'cash')) throw redirect({ to: '/app/dashboard' })
  },
  loader: async () => {
    const [summary, history] = await Promise.all([
      getCashSummary(),
      listReconciliations(),
    ])
    return { summary, history }
  },
  component: CashPage,
})

function CashPage() {
  const { summary, history } = Route.useLoaderData()
  const router = useRouter()

  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ variance: string } | null>(null)

  const currency = summary.currency
  function fmt(n: number | string) {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n))
  }

  const countedNum = Number(counted)
  const previewVariance =
    counted && !isNaN(countedNum) ? countedNum - summary.expected : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!counted) return
    setLoading(true)
    setError('')
    try {
      const res = await createReconciliation({ data: { countedCash: counted, note } })
      setDone({ variance: res.variance })
      setCounted('')
      setNote('')
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  function varianceColor(v: number) {
    if (v === 0) return 'text-green-700'
    return v > 0 ? 'text-blue-600' : 'text-red-600'
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Banknote size={20} className="text-gray-700" />
        <h2 className="text-xl font-semibold text-gray-900">Cash Reconciliation</h2>
      </div>

      {/* Today's close */}
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Expected cash today</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {fmt(summary.expected)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              From completed cash sales since midnight.
            </p>
          </div>
          {summary.reconciledToday && (
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={13} />
              Counted today
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-5">
          <div className="space-y-1">
            <Label htmlFor="counted">Counted cash in drawer</Label>
            <Input
              id="counted"
              type="number"
              step="0.01"
              min="0"
              required
              value={counted}
              onChange={(e) => { setCounted(e.target.value); setDone(null) }}
              placeholder="0.00"
              className="max-w-48"
            />
          </div>

          {previewVariance !== null && (
            <div className="text-sm">
              Variance:{' '}
              <span className={`font-semibold ${varianceColor(previewVariance)}`}>
                {previewVariance >= 0 ? '+' : ''}
                {fmt(previewVariance)}
              </span>
              <span className="text-gray-400 ml-2">
                {previewVariance === 0
                  ? 'balanced'
                  : previewVariance > 0
                    ? 'over'
                    : 'short'}
              </span>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="cash-note">Note (optional)</Label>
            <Textarea
              id="cash-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 20 note found on floor"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && (
            <p className="text-sm text-green-700 font-medium">
              Saved. Variance {Number(done.variance) >= 0 ? '+' : ''}
              {fmt(done.variance)}.
            </p>
          )}

          <Button type="submit" disabled={loading || !counted}>
            {loading ? 'Saving…' : 'Record count'}
          </Button>
        </form>
      </div>

      {/* History */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No counts recorded yet.</p>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">By</th>
                  <th className="px-4 py-3 font-medium text-right">Expected</th>
                  <th className="px-4 py-3 font-medium text-right">Counted</th>
                  <th className="px-4 py-3 font-medium text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => {
                  const v = Number(h.variance)
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(h.createdAt).toLocaleString('en-GH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {h.actorName ?? h.staffName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {fmt(h.expectedCash)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {fmt(h.countedCash)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${varianceColor(v)}`}>
                        {v >= 0 ? '+' : ''}
                        {fmt(v)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
