import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { ExportButton } from '#/components/export-button'
import type { listSales } from '#/lib/sales'
import { salesListQuery } from '#/lib/queries'

export const Route = createFileRoute('/app/sales/')({
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(salesListQuery(deps)),
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
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
          Sales
        </h2>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={sales}
            filename="sales"
            columns={[
              {
                header: 'Date',
                value: (s) => new Date(s.createdAt).toLocaleString(),
              },
              { header: 'Customer', value: (s) => s.customerName ?? '' },
              { header: 'Cashier', value: (s) => s.cashierName ?? '' },
              { header: 'Method', value: (s) => methodLabel[s.paymentMethod] },
              { header: 'Total', value: (s) => s.totalAmount },
              { header: 'Paid', value: (s) => s.amountPaid },
              { header: 'Status', value: (s) => s.status },
            ]}
          />
          <Link to="/app/sales/new">
            <Button size="sm">+ New sale</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <input
          type="date"
          className="border border-line rounded-md px-3 py-1.5 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
          value={from ?? ''}
          onChange={(e) => onFilter({ from: e.target.value || undefined })}
        />
        <span className="text-sea-ink-soft text-sm">to</span>
        <input
          type="date"
          className="border border-line rounded-md px-3 py-1.5 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
          value={to ?? ''}
          onChange={(e) => onFilter({ to: e.target.value || undefined })}
        />
      </div>

      {sales.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">No sales yet.</div>
      ) : (
        <div className="app-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
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
            <tbody className="divide-y divide-line">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-sea-ink/[0.04]">
                  <td className="px-4 py-3 text-sea-ink-soft whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sea-ink">
                    {s.customerName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sea-ink-soft">
                    {s.cashierName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sea-ink-soft">
                    {methodLabel[s.paymentMethod]}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-sea-ink">
                    {s.totalAmount}
                  </td>
                  <td className="px-4 py-3 text-right text-sea-ink-soft">
                    {s.amountPaid}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'credit'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-palm/12 text-palm'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/app/sales/$saleId/receipt"
                      params={{ saleId: s.id }}
                      className="text-xs text-lagoon-deep hover:underline"
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
