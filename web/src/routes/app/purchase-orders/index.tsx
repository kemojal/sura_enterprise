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
  ordered: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function PurchaseOrdersPage() {
  const orders = Route.useLoaderData()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Purchase Orders</h2>
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
        <div className="text-center py-16 text-gray-400">
          No purchase orders yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((po) => {
                const owed = Number(po.totalAmount) - Number(po.amountPaid)
                return (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {po.supplierName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {po.totalAmount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {owed > 0 ? (
                        <span className="text-red-600">
                          {po.amountPaid}{' '}
                          <span className="text-xs text-gray-400">
                            (owe {owed.toFixed(2)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-green-600">Paid</span>
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
                        className="text-blue-600 hover:underline text-xs"
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
