import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { can } from '#/lib/permissions'
import { staffListQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'
import type { listStaff } from '#/lib/staff'
import { updateStaffStatus } from '#/lib/staff'

export const Route = createFileRoute('/app/staff/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'staff')) throw redirect({ to: '/app/dashboard' })
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(staffListQuery()),
  component: StaffPage,
})

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-lagoon/12 text-lagoon-deep',
  cashier: 'bg-sea-ink/[0.06] text-sea-ink-soft',
}

function StaffPage() {
  const staff = Route.useLoaderData()

  return <StaffContent staff={staff} />
}

export function StaffContent({
  staff,
  children,
}: {
  staff: Awaited<ReturnType<typeof listStaff>>
  children?: ReactNode
}) {
  const refresh = useRefresh()
  const [updating, setUpdating] = useState<string | null>(null)

  async function toggleStatus(id: string, current: boolean) {
    setUpdating(id)
    await updateStaffStatus({ data: { id, isActive: !current } })
    setUpdating(null)
    refresh()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">
          Staff
        </h2>
        <Link to="/app/staff/new">
          <Button size="sm">+ Add staff</Button>
        </Link>
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">No staff yet.</div>
      ) : (
        <div className="app-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-sea-ink/[0.04]">
                  <td className="px-4 py-3 font-medium text-sea-ink">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-sea-ink-soft">{s.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[s.role] ?? 'bg-sea-ink/[0.06] text-sea-ink-soft'}`}
                    >
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.isActive ? 'bg-palm/12 text-palm' : 'bg-red-100 text-red-700'}`}
                    >
                      {s.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.role !== 'owner' && (
                      <button
                        onClick={() => toggleStatus(s.id, s.isActive)}
                        disabled={updating === s.id}
                        className="text-xs text-sea-ink-soft hover:text-sea-ink disabled:opacity-50"
                      >
                        {updating === s.id
                          ? '…'
                          : s.isActive
                            ? 'Suspend'
                            : 'Reactivate'}
                      </button>
                    )}
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
