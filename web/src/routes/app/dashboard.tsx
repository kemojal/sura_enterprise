import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react'

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

function DashboardPage() {
  const stats = Route.useLoaderData()

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={fmt(stats.todaySales, stats.currency)}
          positive={stats.todaySales > 0}
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
