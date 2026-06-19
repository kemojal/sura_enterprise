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
  'sale.created': 'text-palm bg-palm/12',
  'sale.returned': 'text-amber-600 bg-amber-50',
  'stock.adjusted': 'text-lagoon-deep bg-lagoon/10',
  'po.created': 'text-purple-600 bg-purple-50',
  'po.received': 'text-palm bg-palm/12',
  'product.deleted': 'text-red-600 bg-red-50',
  'staff.added': 'text-lagoon-deep bg-lagoon/10',
  'staff.suspended': 'text-red-600 bg-red-50',
  'staff.reactivated': 'text-palm bg-palm/12',
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
        <ActivityIcon size={20} className="text-sea-ink" />
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">Activity Log</h2>
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
                  ? 'btn-ink text-white'
                  : 'border border-line bg-white text-sea-ink hover:bg-sea-ink/[0.03]'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {log.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No activity recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {log.map((entry) => {
            const Icon = actionIcon[entry.action] ?? ActivityIcon
            const color = actionColor[entry.action] ?? 'text-sea-ink-soft bg-sea-ink/[0.04]'
            return (
              <div
                key={entry.id}
                className="app-card px-4 py-3 flex items-start gap-3"
              >
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-sea-ink">{entry.description}</p>
                  <p className="text-xs text-sea-ink-soft mt-0.5">
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
