import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'

import { can } from '#/lib/permissions'
import { getShiftReport } from '#/lib/shifts'

export const Route = createFileRoute('/app/shifts/$shiftId')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'sales')) throw redirect({ to: '/app/dashboard' })
  },
  loader: ({ params }) => getShiftReport({ data: { id: params.shiftId } }),
  component: ZReportPage,
})

function ZReportPage() {
  const { shift, summary, expectedCash, shop } = Route.useLoaderData()

  const currency = shop?.currency ?? 'GHS'
  const money = (n: number | string | null) =>
    new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n ?? 0))

  const variance = shift.variance != null ? Number(shift.variance) : null

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden flex items-center justify-between px-6 py-3 bg-white border-b">
        <Link
          to="/app/shifts"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Back to shifts
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="flex justify-center py-8 print:py-0">
        <div className="bg-white w-full max-w-md print:max-w-none print:shadow-none shadow-lg p-8">
          <div className="text-center border-b pb-4">
            <h1 className="text-lg font-bold text-gray-900">{shop?.name ?? 'StoreFlow'}</h1>
            {shop?.address && <p className="text-xs text-gray-500">{shop.address}</p>}
            <p className="text-xl font-bold tracking-wide uppercase mt-3">Z-Report</p>
            <p className="text-xs text-gray-500">Shift #{shift.id.slice(-8).toUpperCase()}</p>
          </div>

          <dl className="text-sm py-4 space-y-2 border-b">
            <Row label="Cashier" value={shift.cashierName ?? '—'} />
            <Row label="Opened" value={new Date(shift.openedAt).toLocaleString()} />
            <Row
              label="Closed"
              value={shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'Still open'}
            />
            <Row
              label="Status"
              value={shift.status === 'open' ? 'OPEN' : 'CLOSED'}
            />
          </dl>

          <dl className="text-sm py-4 space-y-2 border-b">
            <Row label="Transactions" value={String(summary.txns)} />
            <Row label="Total sales" value={money(summary.total)} />
            <Row label="Cash sales" value={money(summary.cash)} />
            <Row label="Opening float" value={money(shift.openingFloat)} />
          </dl>

          <dl className="text-sm py-4 space-y-2">
            <Row label="Expected in drawer" value={money(shift.expectedCash ?? expectedCash)} bold />
            {shift.status === 'closed' && (
              <>
                <Row label="Counted" value={money(shift.countedCash)} bold />
                <div className="flex justify-between pt-2 border-t mt-2">
                  <dt className="font-semibold">Variance</dt>
                  <dd
                    className={`font-bold ${
                      variance != null && variance < 0
                        ? 'text-red-600'
                        : variance != null && variance > 0
                          ? 'text-green-600'
                          : 'text-gray-900'
                    }`}
                  >
                    {money(shift.variance)}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {shift.notes && (
            <p className="text-xs text-gray-500 border-t pt-3">
              <span className="font-medium text-gray-700">Notes:</span> {shift.notes}
            </p>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            Generated {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={bold ? 'font-semibold text-gray-900' : 'text-gray-800'}>{value}</dd>
    </div>
  )
}
