import { createFileRoute, Link } from '@tanstack/react-router'
import { Printer, ArrowLeft, MessageCircle, Undo2 } from 'lucide-react'

import { can } from '#/lib/permissions'
import { getSaleDetail } from '#/lib/sales'

export const Route = createFileRoute('/app/sales/$saleId/receipt')({
  loader: ({ params }) => getSaleDetail({ data: { id: params.saleId } }),
  component: ReceiptPage,
})

const methodLabel: Record<string, string> = {
  cash: 'Cash',
  credit: 'Credit',
  mobile_money: 'Mobile Money',
}

function fmt(amount: string | number, currency: string) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount))
}

function ReceiptPage() {
  const { sale, items, shop } = Route.useLoaderData()
  const { saleId } = Route.useParams()
  const { role } = Route.useRouteContext()
  const currency = shop?.currency ?? 'GHS'
  const canReturn =
    can(role, 'products:write') && sale.status !== 'refunded'

  const total = Number(sale.totalAmount)
  const paid = Number(sale.amountPaid)
  const change = sale.paymentMethod === 'cash' ? Math.max(0, paid - total) : 0
  const balance = total - paid

  function buildWhatsAppMessage() {
    const lines: string[] = []
    lines.push(`🧾 *${shop?.name ?? 'StoreFlow'}*`)
    if (shop?.address) lines.push(shop.address)
    lines.push('')
    lines.push(`Receipt: #${sale.id.slice(-8).toUpperCase()}`)
    lines.push(
      `Date: ${new Date(sale.createdAt).toLocaleString('en-GH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`,
    )
    if (sale.customerName) lines.push(`Customer: ${sale.customerName}`)
    lines.push('')
    lines.push('*Items:*')
    for (const item of items) {
      lines.push(
        `• ${item.productName ?? 'Item'}${item.variantName ? ` — ${item.variantName}` : ''} x${item.quantity} = ${fmt(item.subtotal, currency)}`,
      )
    }
    lines.push('')
    lines.push(`*Total: ${fmt(total, currency)}*`)
    lines.push(`Paid: ${fmt(paid, currency)} (${methodLabel[sale.paymentMethod]})`)
    if (change > 0) lines.push(`Change: ${fmt(change, currency)}`)
    if (sale.status === 'credit' && balance > 0)
      lines.push(`⚠️ Balance due: ${fmt(balance, currency)}`)
    lines.push('')
    lines.push(shop?.receiptFooter || 'Thank you for your business! 🙏')

    return lines.join('\n')
  }

  function shareOnWhatsApp() {
    const msg = encodeURIComponent(buildWhatsAppMessage())
    // If customer has a phone, open direct chat; otherwise open share sheet
    const phone = sale.customerPhone
      ? sale.customerPhone.replace(/\D/g, '')
      : ''
    const url = phone
      ? `https://wa.me/${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden flex items-center justify-between px-6 py-3 bg-white border-b border-line">
        <Link
          to="/app/sales"
          className="flex items-center gap-2 text-sm text-sea-ink-soft hover:text-sea-ink"
        >
          <ArrowLeft size={16} />
          Back to sales
        </Link>
        <div className="flex items-center gap-2">
          {canReturn && (
            <Link
              to="/app/sales/$saleId/return"
              params={{ saleId }}
              className="flex items-center gap-2 border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-50"
            >
              <Undo2 size={16} />
              Return
            </Link>
          )}
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button
            onClick={() => window.print()}
            className="btn-ink flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* Receipt */}
      <div className="flex justify-center py-8 print:py-0">
        <div
          className="bg-white w-full max-w-sm print:max-w-none print:shadow-none shadow-lg"
          id="receipt"
        >
          {/* Header */}
          <div className="text-center px-6 pt-8 pb-4 border-b border-dashed">
            {shop?.logoUrl && (
              <img
                src={shop.logoUrl}
                alt={shop.name}
                className="h-16 mx-auto mb-2 object-contain"
              />
            )}
            <h1 className="text-xl font-bold text-sea-ink uppercase tracking-wide">
              {shop?.name ?? 'StoreFlow'}
            </h1>
            {shop?.address && (
              <p className="text-xs text-sea-ink-soft mt-1">{shop.address}</p>
            )}
            {shop?.phone && (
              <p className="text-xs text-sea-ink-soft">{shop.phone}</p>
            )}
          </div>

          {/* Meta */}
          <div className="px-6 py-4 border-b border-dashed space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-sea-ink-soft">Receipt</span>
              <span className="font-mono text-sea-ink">#{sale.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sea-ink-soft">Date</span>
              <span className="text-sea-ink">
                {new Date(sale.createdAt).toLocaleString('en-GH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            {sale.cashierName && (
              <div className="flex justify-between">
                <span className="text-sea-ink-soft">Cashier</span>
                <span className="text-sea-ink">{sale.cashierName}</span>
              </div>
            )}
            {sale.customerName && (
              <div className="flex justify-between">
                <span className="text-sea-ink-soft">Customer</span>
                <span className="text-sea-ink">{sale.customerName}</span>
              </div>
            )}
            {sale.customerPhone && (
              <div className="flex justify-between">
                <span className="text-sea-ink-soft">Phone</span>
                <span className="text-sea-ink">{sale.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="px-6 py-4 border-b border-dashed">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-sea-ink-soft text-left">
                  <th className="pb-2 font-normal">Item</th>
                  <th className="pb-2 font-normal text-center w-8">Qty</th>
                  <th className="pb-2 font-normal text-right">Price</th>
                  <th className="pb-2 font-normal text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-line">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 text-sea-ink pr-2">
                      {item.productName ?? 'Item'}
                      {item.variantName && (
                        <span className="text-sea-ink-soft">
                          {' '}
                          — {item.variantName}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-center text-sea-ink-soft">
                      {item.quantity}
                    </td>
                    <td className="py-1.5 text-right text-sea-ink-soft">
                      {Number(item.unitPrice).toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right font-medium text-sea-ink">
                      {Number(item.subtotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 border-b border-dashed space-y-1.5 text-xs">
            {Number(sale.discountAmount) > 0 && (
              <>
                <div className="flex justify-between text-sea-ink-soft">
                  <span>Subtotal</span>
                  <span>
                    {fmt(
                      total - Number(sale.taxAmount) + Number(sale.discountAmount),
                      currency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-palm">
                  <span>Discount</span>
                  <span>−{fmt(Number(sale.discountAmount), currency)}</span>
                </div>
              </>
            )}
            {Number(sale.taxAmount) > 0 && (
              <>
                {Number(sale.discountAmount) === 0 && (
                  <div className="flex justify-between text-sea-ink-soft">
                    <span>Subtotal</span>
                    <span>{fmt(total - Number(sale.taxAmount), currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sea-ink-soft">
                  <span>Tax</span>
                  <span>{fmt(Number(sale.taxAmount), currency)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-sm text-sea-ink">
              <span>TOTAL</span>
              <span>{fmt(total, currency)}</span>
            </div>
            <div className="flex justify-between text-sea-ink-soft">
              <span>Paid ({methodLabel[sale.paymentMethod]})</span>
              <span>{fmt(paid, currency)}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between text-sea-ink-soft">
                <span>Change</span>
                <span>{fmt(change, currency)}</span>
              </div>
            )}
            {sale.status === 'credit' && balance > 0 && (
              <div className="flex justify-between font-medium text-red-600">
                <span>Balance due</span>
                <span>{fmt(balance, currency)}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-6 text-center text-xs text-sea-ink-soft">
            <p className="whitespace-pre-line">
              {shop?.receiptFooter || 'Thank you for your business!'}
            </p>
            <p className="mt-1 font-mono text-gray-300">
              {sale.id.toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { margin: 0; }
          #receipt { width: 80mm; font-size: 11px; }
        }
      `}</style>
    </div>
  )
}
