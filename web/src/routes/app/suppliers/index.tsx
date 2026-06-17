import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { DataGrid } from '#/components/grid/data-grid'
import { RecordHistory } from '#/components/grid/record-history'
import { REGISTRY } from '#/lib/grid/registry'
import { isLocked, resolveFieldPermission } from '#/lib/grid/permissions'
import type { LockRow, PermRow } from '#/lib/grid/permissions'
import { setRecordLock, updateRecordField } from '#/lib/grid/server'
import { can } from '#/lib/permissions'
import type { listSuppliersGrid } from '#/lib/suppliers'
import { suppliersGridQuery } from '#/lib/queries'

export const Route = createFileRoute('/app/suppliers/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'suppliers'))
      throw redirect({ to: '/app/dashboard' })
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(suppliersGridQuery()),
  component: SuppliersPage,
})

const FIELDS = REGISTRY.suppliers.fields

type GridData = Awaited<ReturnType<typeof listSuppliersGrid>>
type SupplierRow = Record<string, unknown> & { id: string; name: string }

function SuppliersPage() {
  const data = Route.useLoaderData()
  return <SuppliersContent data={data} />
}

export function SuppliersContent({
  data,
  children,
}: {
  data: GridData
  children?: ReactNode
}) {
  const router = useRouter()
  const [rows, setRows] = useState<SupplierRow[]>(data.rows as SupplierRow[])
  const perms = data.perms as PermRow[]
  const [locks, setLocks] = useState<LockRow[]>(data.locks as LockRow[])
  const role = data.role
  const isOwner = role === 'owner'

  const isEditable = useMemo(
    () => (rowIndex: number, fieldKey: string) => {
      const rec = rows[rowIndex] as SupplierRow | undefined
      if (!rec) return false
      if (!resolveFieldPermission(perms, 'suppliers', fieldKey, role)) return false
      if (role !== 'owner' && isLocked(locks, 'supplier', rec.id)) return false
      return true
    },
    [rows, perms, locks, role],
  )

  async function onEdit(rowIndex: number, fieldKey: string, value: unknown) {
    const rec = rows[rowIndex]
    try {
      const updated = (await updateRecordField({
        data: { resource: 'suppliers', id: rec.id, field: fieldKey, value },
      })) as SupplierRow
      setRows((prev) =>
        prev.map((r, i) => (i === rowIndex ? { ...r, ...updated } : r)),
      )
      return true
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Edit rejected')
      setRows((prev) => [...prev]) // force redraw → revert the cell
      return false
    }
  }

  async function toggleLock(id: string, currentlyLocked: boolean) {
    // A record is "locked" unless an unlocked=true row exists (see isLocked).
    // So unlocking a currently-locked row means writing unlocked=true — i.e.
    // the new `unlocked` value equals `currentlyLocked`. Not a typo; do not invert.
    try {
      await setRecordLock({
        data: { entityType: 'supplier', entityId: id, unlocked: currentlyLocked },
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not change lock')
      return
    }
    setLocks((prev) => {
      const rest = prev.filter(
        (l) => !(l.entityType === 'supplier' && l.entityId === id),
      )
      return [
        ...rest,
        { entityType: 'supplier', entityId: id, unlocked: currentlyLocked },
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
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-sea-ink/[0.04]">
              {FIELDS.map((f) => (
                <td key={f.key} className="px-4 py-3 text-sea-ink-soft">
                  {(s[f.key] as string | null) ?? '—'}
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
          Suppliers
        </h2>
        <Link to="/app/suppliers/new">
          <Button size="sm">+ Add supplier</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No suppliers yet.
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
                {rows.map((s) => {
                  const locked = isLocked(locks, 'supplier', s.id)
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sea-ink">{s.name}</span>
                      <span className="flex items-center gap-3">
                        <RecordHistory
                          entityType="supplier"
                          entityId={s.id}
                          label={s.name}
                        />
                        <button
                          onClick={() => toggleLock(s.id, locked)}
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
