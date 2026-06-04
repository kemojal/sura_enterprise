import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { can } from '#/lib/permissions'
import { listSuppliers } from '#/lib/suppliers'

export const Route = createFileRoute('/app/suppliers/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'suppliers'))
      throw redirect({ to: '/app/dashboard' })
  },
  loader: () => listSuppliers(),
  component: SuppliersPage,
})

function SuppliersPage() {
  const suppliers = Route.useLoaderData()

  return <SuppliersContent suppliers={suppliers} />
}

export function SuppliersContent({
  suppliers,
  children,
}: {
  suppliers: Awaited<ReturnType<typeof listSuppliers>>
  children?: ReactNode
}) {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Suppliers</h2>
        <Link to="/app/suppliers/new">
          <Button size="sm">+ Add supplier</Button>
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No suppliers yet.</div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.address ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/app/suppliers/$supplierId"
                      params={{ supplierId: s.id }}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View
                    </Link>
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
