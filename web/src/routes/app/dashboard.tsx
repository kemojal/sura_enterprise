import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { can } from '#/lib/permissions'
import { getDashboardStats } from '#/lib/dashboard'

export const Route = createFileRoute('/app/dashboard')({
  loader: () => getDashboardStats(),
  component: DashboardPage,
})

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && (
        <p
          className={`text-xs mt-1 flex items-center gap-1 ${
            positive === undefined
              ? 'text-gray-400'
              : positive
                ? 'text-green-600'
                : 'text-red-500'
          }`}
        >
          {positive !== undefined &&
            (positive ? (
              <ArrowUpRight size={12} />
            ) : (
              <ArrowDownRight size={12} />
            ))}
          {sub}
        </p>
      )}
    </div>
  )
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function salesDelta(today: number, yesterday: number): { text: string; positive: boolean } | null {
  if (yesterday === 0) {
    return today > 0 ? { text: 'New activity vs yesterday', positive: true } : null
  }
  const pct = ((today - yesterday) / yesterday) * 100
  const rounded = Math.abs(pct).toFixed(0)
  return {
    text: `${pct >= 0 ? '+' : '−'}${rounded}% vs yesterday`,
    positive: pct >= 0,
  }
}

function WeeklyChart({
  data,
  currency,
}: {
  data: { date: string; label: string; total: number }[]
  currency: string
}) {
  const max = Math.max(...data.map((d) => d.total), 1)
  const today = data[data.length - 1]?.date

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-blue-500" />
        <h3 className="font-medium text-gray-900">Last 7 Days</h3>
      </div>
      <div className="flex items-end justify-between gap-2 h-40">
        {data.map((d) => {
          const heightPct = (d.total / max) * 100
          const isToday = d.date === today
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] text-gray-400 font-medium">
                {d.total > 0 ? Math.round(d.total) : ''}
              </span>
              <div
                className={`w-full rounded-t transition-all ${isToday ? 'bg-blue-500' : 'bg-blue-200'}`}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                title={fmt(d.total, currency)}
              />
              <span className={`text-xs ${isToday ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DashboardPage() {
  const stats = Route.useLoaderData()
  const { role } = Route.useRouteContext()
  const delta = salesDelta(stats.todaySales, stats.yesterdaySales)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Link
            to="/app/sales/new"
            className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            <Plus size={15} /> New sale
          </Link>
          {can(role, 'products:write') && (
            <Link
              to="/app/products/new"
              className="flex items-center gap-1.5 border px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Package size={15} /> Add product
            </Link>
          )}
          {can(role, 'expenses') && (
            <Link
              to="/app/expenses/new"
              className="flex items-center gap-1.5 border px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Wallet size={15} /> Add expense
            </Link>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={fmt(stats.todaySales, stats.currency)}
          sub={delta?.text}
          positive={delta?.positive}
        />
        <StatCard
          label="Today's Expenses"
          value={fmt(stats.todayExpenses, stats.currency)}
          positive={false}
        />
        <StatCard
          label="Est. Profit Today"
          value={fmt(stats.estimatedProfit, stats.currency)}
          positive={stats.estimatedProfit >= 0}
        />
        <StatCard
          label="Customer Debt"
          value={fmt(stats.totalDebt, stats.currency)}
          positive={false}
        />
      </div>

      {/* Weekly sales chart */}
      <WeeklyChart data={stats.weeklySales} currency={stats.currency} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Low stock */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="font-medium text-gray-900">Low Stock</h3>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-gray-400">All products well stocked.</p>
          ) : (
            <ul className="divide-y text-sm">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="py-2 flex justify-between">
                  <span className="text-gray-700">{p.name}</span>
                  <span className="text-amber-600 font-medium">
                    {p.stockQty} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Out of stock */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-medium text-gray-900">Out of Stock</h3>
          </div>
          {stats.outOfStock.length === 0 ? (
            <p className="text-sm text-gray-400">No out-of-stock items.</p>
          ) : (
            <ul className="divide-y text-sm">
              {stats.outOfStock.map((p) => (
                <li key={p.id} className="py-2 text-gray-700">
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl border p-5 space-y-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            <h3 className="font-medium text-gray-900">Best Sellers</h3>
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">No sales recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 font-normal">Product</th>
                  <th className="pb-2 font-normal text-right">Units Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.topProducts.map((p, i) => (
                  <tr key={p.productId ?? i}>
                    <td className="py-2 text-gray-700">{p.name}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">
                      {p.totalQty}
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
