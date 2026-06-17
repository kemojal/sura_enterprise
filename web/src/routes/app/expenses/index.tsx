import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { ExportButton } from '#/components/export-button'
import { DataGrid } from '#/components/grid/data-grid'
import { RecordHistory } from '#/components/grid/record-history'
import { REGISTRY } from '#/lib/grid/registry'
import { isLocked, resolveFieldPermission } from '#/lib/grid/permissions'
import type { LockRow, PermRow } from '#/lib/grid/permissions'
import { setRecordLock, updateRecordField } from '#/lib/grid/server'
import { can } from '#/lib/permissions'
import type { listExpensesGrid } from '#/lib/expenses'
import { expensesGridQuery } from '#/lib/queries'

export const Route = createFileRoute('/app/expenses/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'expenses')) throw redirect({ to: '/app/dashboard' })
  },
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(expensesGridQuery(deps)),
  component: ExpensesPage,
})

const FIELDS = REGISTRY.expenses.fields
const catLabel: Record<string, string> = Object.fromEntries(
  (REGISTRY.expenses.fields.find((f) => f.key === 'category')?.options ?? []).map(
    (o) => [o.value, o.label],
  ),
)

type GridData = Awaited<ReturnType<typeof listExpensesGrid>>
type ExpenseRow = GridData['rows'][number]

function ExpensesPage() {
  const data = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const { from, to } = Route.useSearch()
  return (
    <ExpensesContent
      data={data}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    />
  )
}

export function ExpensesContent({
  data,
  from,
  to,
  onFilter,
  children,
}: {
  data: GridData
  from?: string
  to?: string
  onFilter: (values: { from?: string; to?: string }) => void
  children?: ReactNode
}) {
  const router = useRouter()
  const [rows, setRows] = useState<ExpenseRow[]>(data.rows)
  const perms = data.perms as PermRow[]
  const [locks, setLocks] = useState<LockRow[]>(data.locks as LockRow[])
  const role = data.role
  const isOwner = role === 'owner'
  const total = rows.reduce((sum, e) => sum + Number(e.amount), 0)

  const isEditable = useMemo(
    () => (rowIndex: number, fieldKey: string) => {
      const rec = rows[rowIndex] as ExpenseRow | undefined
      if (!rec) return false
      if (!resolveFieldPermission(perms, 'expenses', fieldKey, role)) return false
      if (role !== 'owner' && isLocked(locks, 'expense', rec.id)) return false
      return true
    },
    [rows, perms, locks, role],
  )

  async function onEdit(rowIndex: number, fieldKey: string, value: unknown) {
    const rec = rows[rowIndex]
    try {
      const updated = (await updateRecordField({
        data: { resource: 'expenses', id: rec.id, field: fieldKey, value },
      })) as Partial<ExpenseRow>
      setRows((prev) =>
        prev.map((r, i) => (i === rowIndex ? { ...r, ...updated } : r)),
      )
      return true
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Edit rejected')
      setRows((prev) => [...prev])
      return false
    }
  }

  async function toggleLock(id: string, currentlyLocked: boolean) {
    // A record is "locked" unless an unlocked=true row exists (see isLocked).
    // Unlocking a locked row writes unlocked=true — new value equals
    // currentlyLocked. Not a typo; do not invert.
    try {
      await setRecordLock({
        data: { entityType: 'expense', entityId: id, unlocked: currentlyLocked },
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not change lock')
      return
    }
    setLocks((prev) => {
      const rest = prev.filter(
        (l) => !(l.entityType === 'expense' && l.entityId === id),
      )
      return [
        ...rest,
        { entityType: 'expense', entityId: id, unlocked: currentlyLocked },
      ]
    })
    router.invalidate()
  }

  const fallbackTable = (
    <div className="app-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
          <tr>
            {FIELDS.map((f) => (
              <th key={f.key} className="px-4 py-3 font-medium">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((e) => (
            <tr key={e.id} className="hover:bg-sea-ink/[0.04]">
              {FIELDS.map((f) => (
                <td key={f.key} className="px-4 py-3 text-sea-ink-soft">
                  {f.key === 'date'
                    ? new Date(e.date).toLocaleDateString()
                    : f.key === 'category'
                      ? (catLabel[e.category] ?? e.category)
                      : ((e[f.key as keyof ExpenseRow] as string | null) ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
          Expenses
        </h2>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={rows}
            filename="expenses"
            columns={[
              {
                header: 'Date',
                value: (e) => new Date(e.date).toLocaleDateString(),
              },
              {
                header: 'Category',
                value: (e) => catLabel[e.category] ?? e.category,
              },
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
        {rows.length > 0 && (
          <span className="ml-auto text-sm text-sea-ink-soft">
            Total: <strong>{total.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No expenses yet.
        </div>
      ) : (
        <>
          <DataGrid
            fields={FIELDS}
            rows={rows}
            isEditable={isEditable}
            onEdit={onEdit}
            fallback={fallbackTable}
          />

          {isOwner && (
            <div className="app-card p-4">
              <p className="text-sm font-semibold text-sea-ink mb-2">
                Lock / unlock for staff editing
              </p>
              <ul className="divide-y divide-line text-sm">
                {rows.map((e) => {
                  const locked = isLocked(locks, 'expense', e.id)
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sea-ink">
                        {new Date(e.date).toLocaleDateString()} ·{' '}
                        {catLabel[e.category] ?? e.category} ·{' '}
                        {Number(e.amount).toFixed(2)}
                      </span>
                      <span className="flex items-center gap-3">
                        <RecordHistory
                          entityType="expense"
                          entityId={e.id}
                          label={`${catLabel[e.category] ?? e.category} expense`}
                        />
                        <button
                          onClick={() => toggleLock(e.id, locked)}
                          className="text-xs text-lagoon-deep hover:underline"
                        >
                          {locked ? 'Unlock' : 'Lock'}
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {children}
    </div>
  )
}
