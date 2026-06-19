import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { ExportButton } from '#/components/export-button'
import type { listCustomers } from '#/lib/customers'
import { customersListQuery } from '#/lib/queries'

export const Route = createFileRoute('/app/customers/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(customersListQuery()),
  component: CustomersPage,
})

function CustomersPage() {
  const customers = Route.useLoaderData()

  return <CustomersContent customers={customers} />
}

export function CustomersContent({
  customers,
  children,
}: {
  customers: Awaited<ReturnType<typeof listCustomers>>
  children?: ReactNode
}) {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
          Customers
        </h2>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={customers}
            filename="customers"
            columns={[
              { header: 'Name', value: (c) => c.name },
              { header: 'Phone', value: (c) => c.phone ?? '' },
              { header: 'Email', value: (c) => c.email ?? '' },
              {
                header: 'Outstanding Debt',
                value: (c) => Number(c.totalDebt).toFixed(2),
              },
            ]}
          />
          <Link to="/app/customers/new">
            <Button size="sm">+ Add customer</Button>
          </Link>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No customers yet.
        </div>
      ) : (
        <div className="app-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium text-right">
                  Outstanding Debt
                </th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-sea-ink/[0.04]">
                  <td className="px-4 py-3 font-medium text-sea-ink">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-sea-ink-soft">
                    {c.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sea-ink-soft">
                    {c.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(c.totalDebt) > 0 ? (
                      <span className="text-red-600 font-medium">
                        {Number(c.totalDebt).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sea-ink-soft">0.00</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/app/customers/$customerId"
                      params={{ customerId: c.id }}
                      className="text-lagoon-deep hover:underline text-xs"
                    >
                      View
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
