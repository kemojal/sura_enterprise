import { createFileRoute, Link, redirect } from '@tanstack/react-router'

import { Button } from '#/components/ui/button'
import { can } from '#/lib/permissions'
import { listPurchaseOrders } from '#/lib/purchase-orders'

export const Route = createFileRoute('/app/purchase-orders/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'purchase_orders'))
      throw redirect({ to: '/app/dashboard' })
  },
  loader: () => listPurchaseOrders(),
  component: PurchaseOrdersPage,
})

const statusStyle: Record<string, string> = {
  ordered: 'bg-lagoon/15 text-lagoon-deep',
  received: 'bg-palm/12 text-palm',
  cancelled: 'bg-sea-ink/[0.06] text-sea-ink-soft',
}

function PurchaseOrdersPage() {
  const orders = Route.useLoaderData()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">Purchase Orders</h2>
        <div className="flex items-center gap-2">
          <Link to="/app/purchase-orders/reorder">
            <Button size="sm" variant="outline">
              Reorder low stock
            </Button>
          </Link>
          <Link to="/app/purchase-orders/new">
            <Button size="sm">+ New order</Button>
          </Link>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-sea-ink-soft">
          No purchase orders yet.
        </div>
      ) : (
        <div className="app-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sea-ink/[0.03] text-sea-ink-soft text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((po) => {
                const owed = Number(po.totalAmount) - Number(po.amountPaid)
                return (
                  <tr key={po.id} className="hover:bg-sea-ink/[0.04]">
                    <td className="px-4 py-3 text-sea-ink-soft whitespace-nowrap">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sea-ink">
                      {po.supplierName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-sea-ink">
                      {po.totalAmount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {owed > 0 ? (
                        <span className="text-red-600">
                          {po.amountPaid}{' '}
                          <span className="text-xs text-sea-ink-soft">
                            (owe {owed.toFixed(2)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-palm">Paid</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[po.status] ?? ''}`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/app/purchase-orders/$poId"
                        params={{ poId: po.id }}
                        className="text-lagoon-deep hover:underline text-xs"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
