import { createFileRoute, Link } from '@tanstack/react-router'
import { Printer, ArrowLeft, MessageCircle } from 'lucide-react'

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
  const currency = shop?.currency ?? 'GHS'

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
        `• ${item.productName ?? 'Item'} x${item.quantity} = ${fmt(item.subtotal, currency)}`,
      )
    }
    lines.push('')
    lines.push(`*Total: ${fmt(total, currency)}*`)
    lines.push(`Paid: ${fmt(paid, currency)} (${methodLabel[sale.paymentMethod]})`)
    if (change > 0) lines.push(`Change: ${fmt(change, currency)}`)
    if (sale.status === 'credit' && balance > 0)
      lines.push(`⚠️ Balance due: ${fmt(balance, currency)}`)
    lines.push('')
    lines.push('Thank you for your business! 🙏')

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
      <div className="print:hidden flex items-center justify-between px-6 py-3 bg-white border-b">
        <Link
          to="/app/sales"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to sales
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
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
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
              {shop?.name ?? 'StoreFlow'}
            </h1>
            {shop?.address && (
              <p className="text-xs text-gray-500 mt-1">{shop.address}</p>
            )}
            {shop?.phone && (
              <p className="text-xs text-gray-500">{shop.phone}</p>
            )}
          </div>

          {/* Meta */}
          <div className="px-6 py-4 border-b border-dashed space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Receipt</span>
              <span className="font-mono text-gray-700">#{sale.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="text-gray-700">
                {new Date(sale.createdAt).toLocaleString('en-GH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            {sale.cashierName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Cashier</span>
                <span className="text-gray-700">{sale.cashierName}</span>
              </div>
            )}
            {sale.customerName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="text-gray-700">{sale.customerName}</span>
              </div>
            )}
            {sale.customerPhone && (
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="text-gray-700">{sale.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="px-6 py-4 border-b border-dashed">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 font-normal">Item</th>
                  <th className="pb-2 font-normal text-center w-8">Qty</th>
                  <th className="pb-2 font-normal text-right">Price</th>
                  <th className="pb-2 font-normal text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 text-gray-800 pr-2">
                      {item.productName ?? 'Item'}
                    </td>
                    <td className="py-1.5 text-center text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                      {Number(item.unitPrice).toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-800">
                      {Number(item.subtotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 border-b border-dashed space-y-1.5 text-xs">
            <div className="flex justify-between font-bold text-sm text-gray-900">
              <span>TOTAL</span>
              <span>{fmt(total, currency)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Paid ({methodLabel[sale.paymentMethod]})</span>
              <span>{fmt(paid, currency)}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between text-gray-600">
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
          <div className="px-6 py-6 text-center text-xs text-gray-400">
            <p>Thank you for your business!</p>
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
