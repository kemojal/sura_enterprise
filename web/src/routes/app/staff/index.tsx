import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { can } from '#/lib/permissions'
import { listStaff, updateStaffStatus } from '#/lib/staff'

export const Route = createFileRoute('/app/staff/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'staff')) throw redirect({ to: '/app/dashboard' })
  },
  loader: () => listStaff(),
  component: StaffPage,
})

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  cashier: 'bg-gray-100 text-gray-700',
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
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)

  async function toggleStatus(id: string, current: boolean) {
    setUpdating(id)
    await updateStaffStatus({ data: { id, isActive: !current } })
    setUpdating(null)
    router.invalidate()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Staff</h2>
        <Link to="/app/staff/new">
          <Button size="sm">+ Add staff</Button>
        </Link>
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No staff yet.</div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[s.role] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {s.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.role !== 'owner' && (
                      <button
                        onClick={() => toggleStatus(s.id, s.isActive)}
                        disabled={updating === s.id}
                        className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
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
