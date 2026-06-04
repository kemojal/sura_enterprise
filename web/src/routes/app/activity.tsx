import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  Package,
  PackageCheck,
  ShoppingCart,
  Undo2,
  UserPlus,
  Activity as ActivityIcon,
} from 'lucide-react'
import { z } from 'zod'

import { listActivity } from '#/lib/activity'
import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/activity')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'activity')) throw redirect({ to: '/app/dashboard' })
  },
  validateSearch: z.object({ entityType: z.string().optional() }),
  loaderDeps: ({ search }) => ({ entityType: search.entityType }),
  loader: ({ deps }) => listActivity({ data: { entityType: deps.entityType } }),
  component: ActivityPage,
})

const actionIcon: Record<string, typeof ShoppingCart> = {
  'sale.created': ShoppingCart,
  'sale.returned': Undo2,
  'stock.adjusted': ArrowLeftRight,
  'po.created': Package,
  'po.received': PackageCheck,
  'product.deleted': Package,
  'staff.added': UserPlus,
  'staff.suspended': UserPlus,
  'staff.reactivated': UserPlus,
}

const actionColor: Record<string, string> = {
  'sale.created': 'text-green-600 bg-green-50',
  'sale.returned': 'text-amber-600 bg-amber-50',
  'stock.adjusted': 'text-blue-600 bg-blue-50',
  'po.created': 'text-purple-600 bg-purple-50',
  'po.received': 'text-green-600 bg-green-50',
  'product.deleted': 'text-red-600 bg-red-50',
  'staff.added': 'text-blue-600 bg-blue-50',
  'staff.suspended': 'text-red-600 bg-red-50',
  'staff.reactivated': 'text-green-600 bg-green-50',
}

const filters = [
  { value: undefined, label: 'All' },
  { value: 'sale', label: 'Sales' },
  { value: 'product', label: 'Inventory' },
  { value: 'purchase_order', label: 'Purchase Orders' },
  { value: 'staff', label: 'Staff' },
]

function ActivityPage() {
  const log = Route.useLoaderData()
  const { entityType } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <ActivityIcon size={20} className="text-gray-700" />
        <h2 className="text-xl font-semibold text-gray-900">Activity Log</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = entityType === f.value
          return (
            <button
              key={f.label}
              onClick={() => navigate({ search: { entityType: f.value } })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {log.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No activity recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {log.map((entry) => {
            const Icon = actionIcon[entry.action] ?? ActivityIcon
            const color = actionColor[entry.action] ?? 'text-gray-500 bg-gray-50'
            return (
              <div
                key={entry.id}
                className="bg-white border rounded-xl px-4 py-3 flex items-start gap-3"
              >
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{entry.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.actorName ?? entry.staffName ?? 'System'} ·{' '}
                    {new Date(entry.createdAt).toLocaleString('en-GH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
