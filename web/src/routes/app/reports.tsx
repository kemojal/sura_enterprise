import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { getReport } from '#/lib/reports'

function defaultFrom() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10)
}

import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/reports')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'reports')) throw redirect({ to: '/app/dashboard' })
  },
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({
    from: search.from ?? defaultFrom(),
    to: search.to ?? defaultTo(),
  }),
  loader: ({ deps }) => getReport({ data: deps }),
  component: ReportsPage,
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

function ReportsPage() {
  const data = Route.useLoaderData()
  const { from, to } = Route.useSearch()
  const navigate = Route.useNavigate()

  function fmt(n: number) {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: data.currency,
      maximumFractionDigits: 2,
    }).format(n)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h2 className="text-xl font-semibold text-gray-900">Reports</h2>

      <div className="flex gap-3 items-center">
        <input
          type="date"
          className="border rounded-md px-3 py-1.5 text-sm"
          value={from ?? defaultFrom()}
          onChange={(e) =>
            navigate({ search: (s) => ({ ...s, from: e.target.value }) })
          }
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          className="border rounded-md px-3 py-1.5 text-sm"
          value={to ?? defaultTo()}
          onChange={(e) =>
            navigate({ search: (s) => ({ ...s, to: e.target.value }) })
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Revenue', value: fmt(data.revenue), pos: true },
          { label: 'Expenses', value: fmt(data.totalExpenses), pos: false },
          {
            label: 'Net Profit',
            value: fmt(data.profit),
            pos: data.profit >= 0,
          },
          { label: 'Sales Count', value: String(data.salesCount) },
        ].map(({ label, value, pos }) => (
          <div key={label} className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                pos === undefined
                  ? 'text-gray-900'
                  : pos
                    ? 'text-green-700'
                    : 'text-red-600'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-medium text-gray-700">Top Products</h3>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">No sales in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 font-normal">Product</th>
                  <th className="pb-2 font-normal text-right">Units</th>
                  <th className="pb-2 font-normal text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.topProducts.map((p, i) => (
                  <tr key={p.productId ?? i}>
                    <td className="py-2 text-gray-700">{p.name}</td>
                    <td className="py-2 text-right">{p.totalQty}</td>
                    <td className="py-2 text-right font-medium">
                      {Number(p.totalRevenue).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-medium text-gray-700">Expenses by Category</h3>
          {data.expByCategory.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 font-normal">Category</th>
                  <th className="pb-2 font-normal text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.expByCategory.map((e) => (
                  <tr key={e.category}>
                    <td className="py-2 text-gray-700">
                      {catLabel[e.category] ?? e.category}
                    </td>
                    <td className="py-2 text-right font-medium text-red-600">
                      {Number(e.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
