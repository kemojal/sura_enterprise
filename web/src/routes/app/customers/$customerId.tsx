import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
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
  const { customer, sales, payments, totalDebt } = Route.useLoaderData()
  const router = useRouter()
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { shop } = Route.useRouteContext()

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
      router.invalidate()
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
          <h2 className="text-xl font-semibold text-gray-900">
            {customer.name}
          </h2>
          <div className="text-sm text-gray-500 mt-1 space-x-4">
            {customer.phone && <span>{customer.phone}</span>}
            {customer.email && <span>{customer.email}</span>}
          </div>
        </div>
        <Link
          to="/app/customers"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back
        </Link>
      </div>

      {totalDebt > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-red-800">
              Outstanding Debt: {totalDebt.toFixed(2)}
            </p>
            <button
              onClick={sendDebtReminder}
              className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors"
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
          <h3 className="font-medium text-gray-700">Purchase History</h3>
          {sales.length === 0 ? (
            <p className="text-sm text-gray-400">No purchases.</p>
          ) : (
            <div className="bg-white rounded-xl border divide-y text-sm">
              {sales.map((s) => (
                <div
                  key={s.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-gray-700">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        s.status === 'credit'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{s.totalAmount}</p>
                    <p className="text-xs text-gray-500">
                      Paid: {s.amountPaid}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">Payment History</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments.</p>
          ) : (
            <div className="bg-white rounded-xl border divide-y text-sm">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-gray-700">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                    {p.note && (
                      <p className="text-xs text-gray-400">{p.note}</p>
                    )}
                  </div>
                  <p className="font-medium text-green-700">{p.amount}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
