import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import {
  createTransfer,
  listActiveBranches,
  listBranchStock,
  listTransfers,
} from '#/lib/branches'
import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/branches/transfer')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/dashboard' })
  },
  loader: async () => {
    const [{ branches }, transfers] = await Promise.all([
      listActiveBranches(),
      listTransfers(),
    ])
    return { branches, transfers }
  },
  component: TransferPage,
})

interface Stock {
  id: string
  name: string
  stockQty: number
  barcode: string | null
}

function TransferPage() {
  const { branches, transfers } = Route.useLoaderData()
  const router = useRouter()

  const [fromBranchId, setFromBranchId] = useState('')
  const [toBranchId, setToBranchId] = useState('')
  const [stock, setStock] = useState<Stock[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function loadStock(branchId: string) {
    setFromBranchId(branchId)
    setStock([])
    setQty({})
    if (!branchId) return
    try {
      const rows = await listBranchStock({ data: { branchId } })
      setStock(rows)
    } catch {
      setStock([])
    }
  }

  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([productId, quantity]) => ({ productId, quantity }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (!fromBranchId || !toBranchId) return setError('Pick both branches')
    if (fromBranchId === toBranchId) return setError('Branches must differ')
    if (items.length === 0) return setError('Set a quantity on at least one product')
    setBusy(true)
    try {
      await createTransfer({
        data: { fromBranchId, toBranchId, note: note || undefined, items },
      })
      setDone(true)
      setQty({})
      setNote('')
      await loadStock(fromBranchId)
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link to="/app/branches" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 w-fit">
        <ArrowLeft size={16} /> Back to branches
      </Link>
      <h2 className="text-xl font-semibold text-gray-900">Transfer stock</h2>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>From branch</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={fromBranchId}
              onChange={(e) => loadStock(e.target.value)}
            >
              <option value="">— Select —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>To branch</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
            >
              <option value="">— Select —</option>
              {branches
                .filter((b) => b.id !== fromBranchId)
                .map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
          </div>
        </div>

        {fromBranchId && (
          <div className="border-t pt-4">
            {stock.length === 0 ? (
              <p className="text-sm text-gray-400">No transferable stock in this branch.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {stock.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 min-w-0 truncate text-gray-800">{s.name}</span>
                    <span className="text-gray-400 text-xs w-20 text-right">{s.stockQty} in stock</span>
                    <input
                      type="number"
                      min="0"
                      max={s.stockQty}
                      value={qty[s.id] ?? ''}
                      onChange={(e) =>
                        setQty((p) => ({ ...p, [s.id]: Math.min(s.stockQty, Math.max(0, Number(e.target.value))) }))
                      }
                      placeholder="0"
                      className="w-20 border rounded px-2 py-1 text-right"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="t-note">Note (optional)</Label>
          <Textarea id="t-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {done && <p className="text-sm text-green-600">Transfer recorded.</p>}

        <Button type="submit" disabled={busy || items.length === 0}>
          {busy ? 'Transferring…' : `Transfer ${items.length} item(s)`}
        </Button>
      </form>

      {/* History */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Recent transfers</h3>
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-400">No transfers yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">From → To</th>
                  <th className="px-4 py-3 font-medium text-right">Items</th>
                  <th className="px-4 py-3 font-medium text-right">Units</th>
                  <th className="px-4 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{t.fromName} → {t.toName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{t.itemCount}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{t.units}</td>
                    <td className="px-4 py-3 text-gray-500">{t.actorName ?? '—'}</td>
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
