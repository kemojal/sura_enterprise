import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Clock, PlayCircle } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { can } from '#/lib/permissions'
import {
  closeShift,
  getMyOpenShift,
  listShifts,
  openShift,
} from '#/lib/shifts'

export const Route = createFileRoute('/app/shifts/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'sales')) throw redirect({ to: '/app/dashboard' })
  },
  loader: async () => {
    const [open, history] = await Promise.all([getMyOpenShift(), listShifts()])
    return { open, history }
  },
  component: ShiftsPage,
})

function ShiftsPage() {
  const { open, history } = Route.useLoaderData()
  const router = useRouter()

  const [float, setFloat] = useState('')
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const money = (n: number | string) =>
    new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      maximumFractionDigits: 2,
    }).format(Number(n))

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await openShift({ data: { openingFloat: float || '0' } })
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open shift')
    } finally {
      setLoading(false)
    }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault()
    if (!open) return
    setLoading(true)
    setError('')
    try {
      const { id } = await closeShift({
        data: { id: open.shift.id, countedCash: counted || '0', notes: notes || undefined },
      })
      await router.navigate({ to: '/app/shifts/$shiftId', params: { shiftId: id } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not close shift')
      setLoading(false)
    }
  }

  const expected = open ? Number(open.shift.openingFloat) + open.summary.cash : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Cashier shifts</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {open ? (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <div className="flex items-center gap-2 text-green-700">
            <Clock size={18} />
            <span className="font-medium">Shift open</span>
            <span className="text-gray-400 text-sm">
              since {new Date(open.shift.openedAt).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Opening float" value={money(open.shift.openingFloat)} />
            <Stat label="Transactions" value={String(open.summary.txns)} />
            <Stat label="Cash sales" value={money(open.summary.cash)} />
            <Stat label="Expected drawer" value={money(expected)} accent />
          </div>

          <form onSubmit={handleClose} className="border-t pt-5 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="counted">Counted cash in drawer</Label>
              <Input
                id="counted"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                required
              />
              {counted !== '' && (
                <p className="text-xs text-gray-500">
                  Variance:{' '}
                  <span
                    className={
                      Number(counted) - expected < 0
                        ? 'text-red-600 font-medium'
                        : 'text-green-600 font-medium'
                    }
                  >
                    {money(Number(counted) - expected)}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Closing…' : 'Close shift & view Z-report'}
            </Button>
          </form>
        </div>
      ) : (
        <form
          onSubmit={handleOpen}
          className="bg-white rounded-xl border p-6 space-y-4 max-w-sm"
        >
          <div className="flex items-center gap-2 text-gray-700">
            <PlayCircle size={18} />
            <span className="font-medium">Start a new shift</span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="float">Opening float</Label>
            <Input
              id="float"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
            />
            <p className="text-xs text-gray-500">Cash you start the drawer with.</p>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Opening…' : 'Open shift'}
          </Button>
        </form>
      )}

      {/* History */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Shift history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No shifts yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Opened</th>
                  <th className="px-4 py-3 font-medium">Cashier</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Variance</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(s.openedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.cashierName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === 'open'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.variance == null ? (
                        '—'
                      ) : (
                        <span
                          className={
                            Number(s.variance) < 0
                              ? 'text-red-600'
                              : Number(s.variance) > 0
                                ? 'text-green-600'
                                : 'text-gray-600'
                          }
                        >
                          {money(s.variance)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/app/shifts/$shiftId"
                        params={{ shiftId: s.id }}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Z-report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-semibold ${accent ? 'text-gray-900 text-lg' : 'text-gray-700'}`}>
        {value}
      </p>
    </div>
  )
}
