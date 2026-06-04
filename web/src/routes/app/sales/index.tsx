import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { listSales } from '#/lib/sales'

export const Route = createFileRoute('/app/sales/')({
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listSales({ data: deps }),
  component: SalesPage,
})

const methodLabel: Record<string, string> = {
  cash: 'Cash',
  credit: 'Credit',
  mobile_money: 'Mobile Money',
}

function SalesPage() {
  const sales = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const { from, to } = Route.useSearch()

  return (
    <SalesContent
      sales={sales}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    />
  )
}

export function SalesContent({
  sales,
  from,
  to,
  onFilter,
  children,
}: {
  sales: Awaited<ReturnType<typeof listSales>>
  from?: string
  to?: string
  onFilter: (values: { from?: string; to?: string }) => void
  children?: ReactNode
}) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sales</h2>
        <Link to="/app/sales/new">
          <Button size="sm">+ New sale</Button>
        </Link>
      </div>

      <div className="flex gap-3 items-center">
        <input
          type="date"
          className="border rounded-md px-3 py-1.5 text-sm"
          value={from ?? ''}
          onChange={(e) => onFilter({ from: e.target.value || undefined })}
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          className="border rounded-md px-3 py-1.5 text-sm"
          value={to ?? ''}
          onChange={(e) => onFilter({ to: e.target.value || undefined })}
        />
      </div>

      {sales.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No sales yet.</div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.customerName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.cashierName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {methodLabel[s.paymentMethod]}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {s.totalAmount}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {s.amountPaid}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'credit'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/app/sales/$saleId/receipt"
                      params={{ saleId: s.id }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Receipt
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {children}
    </div>
  )
}
