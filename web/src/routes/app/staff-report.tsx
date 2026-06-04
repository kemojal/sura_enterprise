import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { can } from '#/lib/permissions'
import { getStaffPerformance } from '#/lib/reports'

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 6) // last 7 days inclusive
  return d.toISOString().slice(0, 10)
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10)
}

export const Route = createFileRoute('/app/staff-report')({
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
  loader: ({ deps }) => getStaffPerformance({ data: deps }),
  component: StaffReportPage,
})

function StaffReportPage() {
  const { rows, totals, currency } = Route.useLoaderData()
  const { from, to } = Route.useSearch()
  const navigate = Route.useNavigate()

  const money = (n: number) =>
    new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n)

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1)
  const rankStyle = ['text-amber-500', 'text-gray-400', 'text-amber-700']

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Staff performance</h2>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={from ?? defaultFrom()}
            onChange={(e) => navigate({ search: (p) => ({ ...p, from: e.target.value }) })}
            className="border rounded-md px-2 py-1"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={to ?? defaultTo()}
            onChange={(e) => navigate({ search: (p) => ({ ...p, to: e.target.value }) })}
            className="border rounded-md px-2 py-1"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total revenue" value={money(totals.revenue)} />
        <Stat label="Transactions" value={String(totals.txns)} />
        <Stat label="Units sold" value={String(totals.units)} />
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No sales in this period.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium w-10">#</th>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Txns</th>
                <th className="px-4 py-3 font-medium text-right">Avg basket</th>
                <th className="px-4 py-3 font-medium text-right">Units</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={r.staffId ?? `none-${i}`} className="hover:bg-gray-50">
                  <td className={`px-4 py-3 font-bold ${rankStyle[i] ?? 'text-gray-300'}`}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-gray-800"
                        style={{ width: `${(r.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {money(r.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.txns}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {money(r.avgBasket)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  )
}
