import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { z } from 'zod'

import { can } from '#/lib/permissions'
import { getDashboardStats  } from '#/lib/dashboard'
import type {DashboardPeriod} from '#/lib/dashboard';

export const Route = createFileRoute('/app/dashboard')({
  validateSearch: z.object({
    period: z.enum(['today', '7d', '30d', 'month']).optional(),
  }),
  loaderDeps: ({ search }) => ({ period: search.period ?? 'today' }),
  loader: ({ deps }) => getDashboardStats({ data: { period: deps.period } }),
  component: DashboardPage,
})

const periodLabels: Record<DashboardPeriod, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
}

const periodOptions: DashboardPeriod[] = ['today', '7d', '30d', 'month']

function StatCard({
  label,
  value,
  sub,
  positive,
  icon: Icon,
  tint,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
  icon: LucideIcon
  tint: string
}) {
  return (
    <div className="app-tile p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-sea-ink-soft">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="stat-num text-[1.7rem] text-sea-ink mt-2 leading-none">{value}</p>
      {sub && (
        <p
          className={`text-xs mt-2.5 inline-flex items-center gap-1 font-medium ${
            positive === undefined
              ? 'text-sea-ink-soft'
              : positive
                ? 'text-palm'
                : 'text-red-500'
          }`}
        >
          {positive !== undefined &&
            (positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)}
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

function salesDelta(
  current: number,
  previous: number,
): { text: string; positive: boolean } | null {
  if (previous === 0) {
    return current > 0 ? { text: 'New activity vs prev period', positive: true } : null
  }
  const pct = ((current - previous) / previous) * 100
  const rounded = Math.abs(pct).toFixed(0)
  return {
    text: `${pct >= 0 ? '+' : '−'}${rounded}% vs prev period`,
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
    <div className="app-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-lagoon-deep" />
        <h3 className="font-semibold text-sea-ink">Last 7 days</h3>
      </div>
      <div className="flex items-end justify-between gap-2 h-40">
        {data.map((d) => {
          const heightPct = (d.total / max) * 100
          const isToday = d.date === today
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] text-sea-ink-soft font-medium">
                {d.total > 0 ? Math.round(d.total) : ''}
              </span>
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday
                    ? 'bg-gradient-to-t from-lagoon to-lagoon-deep'
                    : 'bg-gradient-to-t from-lagoon/25 to-lagoon/45'
                }`}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                title={fmt(d.total, currency)}
              />
              <span
                className={`text-xs ${isToday ? 'font-semibold text-sea-ink' : 'text-sea-ink-soft'}`}
              >
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TargetBar({
  label,
  actual,
  target,
  currency,
}: {
  label: string
  actual: number
  target: number
  currency: string
}) {
  const pct = target > 0 ? (actual / target) * 100 : 0
  const hit = actual >= target
  return (
    <div className="app-tile p-5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-sea-ink-soft">{label}</p>
        <p className="text-xs font-medium text-sea-ink-soft">
          {pct.toFixed(0)}%
        </p>
      </div>
      <p className="stat-num text-xl text-sea-ink">
        {fmt(actual, currency)}
        <span className="text-sm font-normal text-sea-ink-soft">
          {' '}
          / {fmt(target, currency)}
        </span>
      </p>
      <div className="h-2 bg-sea-ink/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${hit ? 'bg-palm' : 'bg-lagoon'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {hit && (
        <p className="text-xs text-palm font-medium">Target reached 🎉</p>
      )}
    </div>
  )
}

function DashboardPage() {
  const stats = Route.useLoaderData()
  const { role } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const period = stats.period
  const delta = salesDelta(stats.periodSales, stats.prevSales)
  const periodWord = periodLabels[period]

  return (
    <div className="p-5 sm:p-7 max-w-6xl mx-auto space-y-7">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">Dashboard</h2>
          <p className="text-sm text-sea-ink-soft mt-0.5">Here's how your shop is doing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/sales/new"
            className="btn-ink inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-sm font-medium text-white no-underline"
          >
            <Plus size={15} /> New sale
          </Link>
          {can(role, 'products:write') && (
            <Link
              to="/app/products/new"
              className="inline-flex items-center gap-1.5 border border-line bg-white px-3.5 h-9 rounded-lg text-sm font-medium text-sea-ink no-underline shadow-sm transition-colors hover:bg-sea-ink/[0.03]"
            >
              <Package size={15} /> Add product
            </Link>
          )}
          {can(role, 'expenses') && (
            <Link
              to="/app/expenses/new"
              className="inline-flex items-center gap-1.5 border border-line bg-white px-3.5 h-9 rounded-lg text-sm font-medium text-sea-ink no-underline shadow-sm transition-colors hover:bg-sea-ink/[0.03]"
            >
              <Wallet size={15} /> Add expense
            </Link>
          )}
        </div>
      </div>

      {/* Period selector — segmented control */}
      <div className="inline-flex items-center gap-0.5 p-1 rounded-xl border border-line bg-white shadow-sm">
        {periodOptions.map((p) => {
          const active = period === p
          return (
            <button
              key={p}
              onClick={() => navigate({ search: { period: p } })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-sea-ink text-white shadow-sm'
                  : 'text-sea-ink-soft hover:text-sea-ink hover:bg-sea-ink/[0.04]'
              }`}
            >
              {periodLabels[p]}
            </button>
          )
        })}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={`${periodWord} Sales`}
          value={fmt(stats.periodSales, stats.currency)}
          sub={delta?.text}
          positive={delta?.positive}
          icon={ShoppingCart}
          tint="bg-lagoon/12 text-lagoon-deep"
        />
        <StatCard
          label={`${periodWord} Expenses`}
          value={fmt(stats.periodExpenses, stats.currency)}
          positive={false}
          icon={Wallet}
          tint="bg-amber-500/12 text-amber-600"
        />
        <StatCard
          label={`${periodWord} Profit`}
          value={fmt(stats.estimatedProfit, stats.currency)}
          positive={stats.estimatedProfit >= 0}
          icon={TrendingUp}
          tint="bg-palm/12 text-palm"
        />
        <StatCard
          label="Customer Debt"
          value={fmt(stats.totalDebt, stats.currency)}
          positive={false}
          icon={Coins}
          tint="bg-red-500/10 text-red-500"
        />
      </div>

      {/* Sales targets */}
      {(stats.dailyTarget > 0 || stats.monthlyTarget > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stats.dailyTarget > 0 && (
            <TargetBar
              label="Today vs daily target"
              actual={stats.todayRevenue}
              target={stats.dailyTarget}
              currency={stats.currency}
            />
          )}
          {stats.monthlyTarget > 0 && (
            <TargetBar
              label="This month vs monthly target"
              actual={stats.monthRevenue}
              target={stats.monthlyTarget}
              currency={stats.currency}
            />
          )}
        </div>
      )}

      {/* Weekly sales chart */}
      <WeeklyChart data={stats.weeklySales} currency={stats.currency} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Low stock */}
        <div className="app-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="font-semibold text-sea-ink">Low stock</h3>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-sea-ink-soft">All products well stocked.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="py-2 flex justify-between">
                  <span className="text-sea-ink">{p.name}</span>
                  <span className="text-amber-600 font-medium">{p.stockQty} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Out of stock */}
        <div className="app-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-semibold text-sea-ink">Out of stock</h3>
          </div>
          {stats.outOfStock.length === 0 ? (
            <p className="text-sm text-sea-ink-soft">No out-of-stock items.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {stats.outOfStock.map((p) => (
                <li key={p.id} className="py-2 text-sea-ink">
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top products */}
        <div className="app-card p-5 space-y-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-lagoon-deep" />
            <h3 className="font-semibold text-sea-ink">Best sellers</h3>
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-sea-ink-soft">No sales recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sea-ink-soft text-left">
                  <th className="pb-2 font-normal">Product</th>
                  <th className="pb-2 font-normal text-right">Units sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.topProducts.map((p, i) => (
                  <tr key={p.productId ?? i}>
                    <td className="py-2 text-sea-ink">{p.name}</td>
                    <td className="py-2 text-right text-sea-ink font-semibold">{p.totalQty}</td>
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
