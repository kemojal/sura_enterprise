import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { ExportButton } from '#/components/export-button'
import { can } from '#/lib/permissions'
import { listExpenses } from '#/lib/expenses'

export const Route = createFileRoute('/app/expenses/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'expenses')) throw redirect({ to: '/app/dashboard' })
  },
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listExpenses({ data: deps }),
  component: ExpensesPage,
})

const catLabel: Record<string, string> = {
  rent: 'Rent',
  electricity: 'Electricity',
  internet: 'Internet',
  salary: 'Salary',
  supplier_payment: 'Supplier Payment',
  transport: 'Transport',
  maintenance: 'Maintenance',
  packaging: 'Packaging',
  misc: 'Miscellaneous',
}

function ExpensesPage() {
  const expenses = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const { from, to } = Route.useSearch()

  return (
    <ExpensesContent
      expenses={expenses}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    />
  )
}

export function ExpensesContent({
  expenses,
  from,
  to,
  onFilter,
  children,
}: {
  expenses: Awaited<ReturnType<typeof listExpenses>>
  from?: string
  to?: string
  onFilter: (values: { from?: string; to?: string }) => void
  children?: ReactNode
}) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Expenses</h2>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={expenses}
            filename="expenses"
            columns={[
              { header: 'Date', value: (e) => new Date(e.date).toLocaleDateString() },
              { header: 'Category', value: (e) => catLabel[e.category] ?? e.category },
              { header: 'Description', value: (e) => e.description ?? '' },
              { header: 'Recorded By', value: (e) => e.recordedBy ?? '' },
              { header: 'Amount', value: (e) => Number(e.amount).toFixed(2) },
            ]}
          />
          <Link to="/app/expenses/new">
            <Button size="sm">+ Add expense</Button>
          </Link>
        </div>
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
        {expenses.length > 0 && (
          <span className="ml-auto text-sm text-gray-600">
            Total: <strong>{total.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No expenses yet.</div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Recorded by</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {catLabel[e.category] ?? e.category}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {e.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {e.recordedBy ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(e.amount).toFixed(2)}
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
