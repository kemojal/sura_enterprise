import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Target } from 'lucide-react'

import { Input } from '#/components/ui/input'
import { getBudgetVsActual, setBudget } from '#/lib/budgets'
import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/budgets')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'expenses')) throw redirect({ to: '/app/dashboard' })
  },
  loader: () => getBudgetVsActual(),
  component: BudgetsPage,
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

function BudgetsPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [savingCat, setSavingCat] = useState<string | null>(null)

  const currency = data.currency
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n)

  async function saveCat(category: string) {
    const val = edits[category]
    if (val === undefined) return
    setSavingCat(category)
    try {
      await setBudget({ data: { category: category as never, monthlyAmount: val } })
      setEdits((e) => {
        const next = { ...e }
        delete next[category]
        return next
      })
      router.invalidate()
    } finally {
      setSavingCat(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Target size={20} className="text-gray-700" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Expense Budgets
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Monthly budget vs actual for {data.month}. Set 0 to clear a budget.
          </p>
        </div>
      </div>

      {/* Overall */}
      <div className="bg-white border rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Total spent this month</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(data.totalActual)}
            {data.totalBudget > 0 && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                of {fmt(data.totalBudget)} budgeted
              </span>
            )}
          </p>
        </div>
        {data.totalBudget > 0 && (
          <div
            className={`text-sm font-medium ${data.totalActual > data.totalBudget ? 'text-red-600' : 'text-green-600'}`}
          >
            {data.totalActual > data.totalBudget ? 'Over' : 'Under'} by{' '}
            {fmt(Math.abs(data.totalBudget - data.totalActual))}
          </div>
        )}
      </div>

      {/* Per category */}
      <div className="bg-white border rounded-xl divide-y">
        {data.rows.map((r) => {
          const editing = edits[r.category]
          const pct = r.budget > 0 ? (r.actual / r.budget) * 100 : 0
          const over = r.budget > 0 && r.actual > r.budget
          return (
            <div key={r.category} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {catLabel[r.category]}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {fmt(r.actual)}
                    <span className="text-gray-300"> / </span>
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing ?? (r.budget > 0 ? String(r.budget) : '')}
                    placeholder="No budget"
                    onChange={(e) =>
                      setEdits((prev) => ({ ...prev, [r.category]: e.target.value }))
                    }
                    onBlur={() => editing !== undefined && saveCat(r.category)}
                    className="w-28 text-right"
                    disabled={savingCat === r.category}
                  />
                </div>
              </div>
              {r.budget > 0 && (
                <div className="space-y-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p
                    className={`text-xs ${over ? 'text-red-600' : 'text-gray-400'}`}
                  >
                    {pct.toFixed(0)}% used ·{' '}
                    {over
                      ? `${fmt(r.actual - r.budget)} over`
                      : `${fmt(r.remaining)} left`}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
