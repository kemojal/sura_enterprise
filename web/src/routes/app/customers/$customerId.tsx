import { createFileRoute, Link } from '@tanstack/react-router'
import { useRefresh } from '#/lib/use-refresh'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { getCustomer, recordPayment } from '#/lib/customers'

export const Route = createFileRoute('/app/customers/$customerId')({
  loader: ({ params }) =>
    getCustomer({ data: { id: params.customerId } }),
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const { customer, sales, payments, totalDebt, insights, topProducts } =
    Route.useLoaderData()
  const refresh = useRefresh()
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { shop } = Route.useRouteContext()
  const insightsCurrency = shop?.currency ?? 'GHS'
  const money = (n: number) =>
    new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: insightsCurrency,
      maximumFractionDigits: 2,
    }).format(n)

  function sendDebtReminder() {
    const currency = shop?.currency ?? 'GHS'
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-GH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

    const unpaidSales = sales.filter((s) => s.status === 'credit')
    const lines: string[] = []
    lines.push(`Dear ${customer.name},`)
    lines.push('')
    lines.push(`This is a friendly reminder from *${shop?.name ?? 'StoreFlow'}* about your outstanding balance.`)
    lines.push('')
    if (unpaidSales.length > 0) {
      lines.push('*Unpaid invoices:*')
      for (const s of unpaidSales) {
        const balance = Number(s.totalAmount) - Number(s.amountPaid)
        if (balance > 0) {
          lines.push(
            `• ${new Date(s.createdAt).toLocaleDateString('en-GH', { dateStyle: 'medium' })} — Balance: ${fmt(balance)}`,
          )
        }
      }
      lines.push('')
    }
    lines.push(`*Total outstanding: ${fmt(totalDebt)}*`)
    lines.push('')
    lines.push('Please make payment at your earliest convenience. Thank you! 🙏')

    const msg = encodeURIComponent(lines.join('\n'))
    const phone = customer.phone ? customer.phone.replace(/\D/g, '') : ''
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payAmount) return
    setLoading(true)
    setError('')
    try {
      await recordPayment({
        data: { customerId: customer.id, amount: payAmount, note: payNote },
      })
      setPayAmount('')
      setPayNote('')
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
            {customer.name}
          </h2>
          <div className="text-sm text-sea-ink-soft mt-1 space-x-4">
            {customer.phone && <span>{customer.phone}</span>}
            {customer.email && <span>{customer.email}</span>}
          </div>
        </div>
        <Link
          to="/app/customers"
          className="text-sm text-sea-ink-soft hover:text-sea-ink"
        >
          ← Back
        </Link>
      </div>

      {/* Purchase insights */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total spent', value: money(insights.totalSpent) },
          { label: 'Visits', value: String(insights.visitCount) },
          { label: 'Avg basket', value: money(insights.avgBasket) },
          {
            label: 'Last seen',
            value: insights.lastSeen
              ? new Date(insights.lastSeen).toLocaleDateString('en-GH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—',
          },
        ].map((s) => (
          <div key={s.label} className="app-tile p-4">
            <p className="text-xs text-sea-ink-soft">{s.label}</p>
            <p className="stat-num text-lg text-sea-ink mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {topProducts.length > 0 && (
        <div className="app-card p-5 space-y-3">
          <h3 className="font-semibold text-sea-ink">Most Bought</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-sea-ink-soft text-left">
                <th className="pb-2 font-normal">Product</th>
                <th className="pb-2 font-normal text-right">Units</th>
                <th className="pb-2 font-normal text-right">Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topProducts.map((p, i) => (
                <tr key={p.name ?? i}>
                  <td className="py-2 text-sea-ink">{p.name}</td>
                  <td className="py-2 text-right text-sea-ink-soft">{p.units}</td>
                  <td className="py-2 text-right font-medium text-sea-ink">
                    {money(Number(p.spent))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalDebt > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-red-800">
              Outstanding Debt: {totalDebt.toFixed(2)}
            </p>
            <button
              onClick={sendDebtReminder}
              className="flex items-center gap-1.5 text-xs font-medium text-palm bg-palm/12 hover:bg-palm/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <MessageCircle size={14} />
              Send reminder
            </button>
          </div>
          <form onSubmit={handlePayment} className="flex gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="pay-amt" className="text-red-800">
                Record payment
              </Label>
              <Input
                id="pay-amt"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-red-800">Note (optional)</Label>
              <Input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="e.g. Cash payment"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? '…' : 'Record'}
            </Button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-semibold text-sea-ink">Purchase History</h3>
          {sales.length === 0 ? (
            <p className="text-sm text-sea-ink-soft">No purchases.</p>
          ) : (
            <div className="app-card divide-y divide-line text-sm">
              {sales.map((s) => (
                <div
                  key={s.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sea-ink">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        s.status === 'credit'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-palm/12 text-palm'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sea-ink">{s.totalAmount}</p>
                    <p className="text-xs text-sea-ink-soft">
                      Paid: {s.amountPaid}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-sea-ink">Payment History</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-sea-ink-soft">No payments.</p>
          ) : (
            <div className="app-card divide-y divide-line text-sm">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sea-ink">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                    {p.note && (
                      <p className="text-xs text-sea-ink-soft">{p.note}</p>
                    )}
                  </div>
                  <p className="font-medium text-palm">{p.amount}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
