import { createFileRoute, Link } from '@tanstack/react-router'
import { useRefresh } from '#/lib/use-refresh'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { getSupplier, updateSupplier } from '#/lib/suppliers'

export const Route = createFileRoute('/app/suppliers/$supplierId')({
  loader: ({ params }) =>
    getSupplier({ data: { id: params.supplierId } }),
  component: SupplierDetailPage,
})

function SupplierDetailPage() {
  const { supplier, products, pos, stats, currency } = Route.useLoaderData()
  const refresh = useRefresh()
  const money = (n: number | string) =>
    new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n))
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(supplier.name)
  const [phone, setPhone] = useState(supplier.phone ?? '')
  const [email, setEmail] = useState(supplier.email ?? '')
  const [address, setAddress] = useState(supplier.address ?? '')
  const [notes, setNotes] = useState(supplier.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await updateSupplier({
        data: {
          id: supplier.id,
          name,
          phone,
          email,
          address,
          notes,
        },
      })
      setEditing(false)
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">{supplier.name}</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Link
            to="/app/suppliers"
            className="text-sm text-sea-ink-soft hover:text-sea-ink"
          >
            ← Back
          </Link>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4 max-w-lg">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      ) : (
        <div className="app-card p-5 grid grid-cols-2 gap-4 text-sm max-w-lg">
          <div>
            <p className="text-sea-ink-soft">Phone</p>
            <p className="text-sea-ink mt-0.5">{supplier.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-sea-ink-soft">Email</p>
            <p className="text-sea-ink mt-0.5">{supplier.email ?? '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sea-ink-soft">Address</p>
            <p className="text-sea-ink mt-0.5">{supplier.address ?? '—'}</p>
          </div>
          {supplier.notes && (
            <div className="col-span-2">
              <p className="text-sea-ink-soft">Notes</p>
              <p className="text-sea-ink mt-0.5">{supplier.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Statement */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Orders', value: String(stats.orderCount) },
          { label: 'Total ordered', value: money(stats.totalOrdered) },
          { label: 'Total paid', value: money(stats.totalPaid) },
          { label: 'Outstanding', value: money(stats.outstanding), warn: stats.outstanding > 0 },
        ].map((s) => (
          <div key={s.label} className="app-tile p-4">
            <p className="text-xs text-sea-ink-soft">{s.label}</p>
            <p
              className={`stat-num text-lg mt-1 ${s.warn ? 'text-red-600' : 'text-sea-ink'}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-sea-ink">Purchase Orders</h3>
        {pos.length === 0 ? (
          <p className="text-sm text-sea-ink-soft">No purchase orders yet.</p>
        ) : (
          <div className="app-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pos.map((po) => {
                  const owed = Number(po.totalAmount) - Number(po.amountPaid)
                  return (
                    <tr key={po.id} className="hover:bg-sea-ink/[0.02]">
                      <td className="px-4 py-3 text-sea-ink-soft whitespace-nowrap">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-sea-ink">
                        {money(po.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sea-ink-soft">
                        {owed > 0 && po.status !== 'cancelled' ? (
                          <span className="text-red-600">
                            {money(po.amountPaid)}
                          </span>
                        ) : (
                          money(po.amountPaid)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-sea-ink/[0.06] text-sea-ink-soft">
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/app/purchase-orders/$poId"
                          params={{ poId: po.id }}
                          className="text-lagoon-deep hover:underline text-xs"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-sea-ink">Products from this supplier</h3>
        {products.length === 0 ? (
          <p className="text-sm text-sea-ink-soft">No products linked.</p>
        ) : (
          <div className="app-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Selling Price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-sea-ink/[0.04]">
                    <td className="px-4 py-3 text-sea-ink">{p.name}</td>
                    <td className="px-4 py-3 text-right text-sea-ink-soft">
                      {p.stockQty}
                    </td>
                    <td className="px-4 py-3 text-right text-sea-ink-soft">
                      {p.sellingPrice}
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
