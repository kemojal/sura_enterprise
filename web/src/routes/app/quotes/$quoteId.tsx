import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Printer, Check, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { can } from '#/lib/permissions'
import {
  convertQuoteToSale,
  getQuote,
  updateQuoteStatus,
} from '#/lib/quotes'

export const Route = createFileRoute('/app/quotes/$quoteId')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'sales')) throw redirect({ to: '/app/dashboard' })
  },
  loader: ({ params }) => getQuote({ data: { id: params.quoteId } }),
  component: QuoteDetailPage,
})

function QuoteDetailPage() {
  const { quote, items, shop } = Route.useLoaderData()
  const { quoteId } = Route.useParams()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const currency = shop?.currency ?? 'GHS'
  const money = (n: number | string) =>
    new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n))

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function convert() {
    setBusy(true)
    setError('')
    try {
      const { saleId } = await convertQuoteToSale({ data: { id: quoteId } })
      await router.navigate({
        to: '/app/sales/$saleId/receipt',
        params: { saleId },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to convert')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar */}
      <div className="print:hidden flex items-center justify-between px-6 py-3 bg-white border-b flex-wrap gap-2">
        <Link
          to="/app/quotes"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Back to quotes
        </Link>
        <div className="flex items-center gap-2">
          {quote.status !== 'converted' && (
            <>
              {quote.status !== 'accepted' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => updateQuoteStatus({ data: { id: quoteId, status: 'accepted' } }))}
                >
                  <Check size={14} className="mr-1" /> Mark accepted
                </Button>
              )}
              {quote.status !== 'declined' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => updateQuoteStatus({ data: { id: quoteId, status: 'declined' } }))}
                >
                  <X size={14} className="mr-1" /> Decline
                </Button>
              )}
              <Button size="sm" disabled={busy} onClick={convert}>
                Convert to sale
              </Button>
            </>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {error && (
        <p className="print:hidden text-sm text-red-600 px-6 pt-3">{error}</p>
      )}

      {quote.status === 'converted' && quote.convertedSaleId && (
        <div className="print:hidden px-6 pt-3">
          <Link
            to="/app/sales/$saleId/receipt"
            params={{ saleId: quote.convertedSaleId }}
            className="text-sm text-purple-700 underline"
          >
            This quote was converted — view the sale receipt
          </Link>
        </div>
      )}

      {/* Document */}
      <div className="flex justify-center py-8 print:py-0">
        <div className="bg-white w-full max-w-2xl print:max-w-none print:shadow-none shadow-lg p-8">
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              {shop?.logoUrl && (
                <img src={shop.logoUrl} alt={shop.name} className="h-12 mb-2 object-contain" />
              )}
              <h1 className="text-lg font-bold text-gray-900">{shop?.name ?? 'StoreFlow'}</h1>
              {shop?.address && <p className="text-xs text-gray-500">{shop.address}</p>}
              {shop?.phone && <p className="text-xs text-gray-500">{shop.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                Quote
              </p>
              <p className="text-xs text-gray-500 mt-1">
                #{quote.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(quote.createdAt).toLocaleDateString()}
              </p>
              {quote.validUntil && (
                <p className="text-xs text-gray-500">
                  Valid until {new Date(quote.validUntil).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {quote.customerName && (
            <div className="py-4 border-b text-sm">
              <p className="text-gray-400 text-xs">Quote for</p>
              <p className="font-medium text-gray-900">{quote.customerName}</p>
              {quote.customerPhone && (
                <p className="text-gray-500 text-xs">{quote.customerPhone}</p>
              )}
            </div>
          )}

          <table className="w-full text-sm my-4">
            <thead>
              <tr className="text-gray-400 text-left border-b">
                <th className="py-2 font-normal">Item</th>
                <th className="py-2 font-normal text-center">Qty</th>
                <th className="py-2 font-normal text-right">Unit</th>
                <th className="py-2 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="py-2 text-gray-800">{it.name}</td>
                  <td className="py-2 text-center text-gray-600">{it.quantity}</td>
                  <td className="py-2 text-right text-gray-600">
                    {money(it.unitPrice)}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-900">
                    {money(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={3} className="py-3 text-right font-medium text-gray-700">
                  Total
                </td>
                <td className="py-3 text-right font-bold text-gray-900">
                  {money(quote.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {quote.notes && (
            <p className="text-xs text-gray-500 border-t pt-3">
              <span className="font-medium text-gray-700">Notes:</span> {quote.notes}
            </p>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            This is a quotation, not a tax invoice. Prices subject to change after
            the validity date.
          </p>
        </div>
      </div>
    </div>
  )
}
