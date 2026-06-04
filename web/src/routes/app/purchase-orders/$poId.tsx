import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, PackageCheck } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { can } from '#/lib/permissions'
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  recordPoPayment,
} from '#/lib/purchase-orders'

export const Route = createFileRoute('/app/purchase-orders/$poId')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'purchase_orders'))
      throw redirect({ to: '/app/dashboard' })
  },
  loader: ({ params }) => getPurchaseOrder({ data: { id: params.poId } }),
  component: PurchaseOrderDetailPage,
})

const statusStyle: Record<string, string> = {
  ordered: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function PurchaseOrderDetailPage() {
  const { po, items } = Route.useLoaderData()
  const { poId } = Route.useParams()
  const router = useRouter()

  const [payAmount, setPayAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const owed = Number(po.totalAmount) - Number(po.amountPaid)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/app/purchase-orders"
            className="text-gray-400 hover:text-gray-700"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Purchase Order #{poId.slice(-8).toUpperCase()}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {po.supplierName ?? 'No supplier'} ·{' '}
              {new Date(po.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[po.status] ?? ''}`}
        >
          {po.status}
        </span>
      </div>

      {/* Items */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium text-center">Qty</th>
              <th className="px-4 py-3 font-medium text-right">Unit Cost</th>
              <th className="px-4 py-3 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 text-gray-900">
                  {i.productName ?? 'Item'}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {i.quantity}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {i.unitCost}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {i.subtotal}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-700">
                Total
              </td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">
                {po.totalAmount}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {po.notes && (
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">Notes:</span> {po.notes}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {po.status === 'ordered' && (
          <>
            <Button
              disabled={busy}
              onClick={() => run(() => receivePurchaseOrder({ data: { id: poId } }))}
            >
              <PackageCheck size={15} className="mr-1.5" />
              Receive stock
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run(() => cancelPurchaseOrder({ data: { id: poId } }))}
            >
              Cancel order
            </Button>
          </>
        )}
        {po.status === 'received' && (
          <span className="text-sm text-green-700 flex items-center gap-1.5">
            <PackageCheck size={15} />
            Received{' '}
            {po.receivedAt && new Date(po.receivedAt).toLocaleDateString()} — stock updated
          </span>
        )}
      </div>

      {/* Supplier payment */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Supplier Payment</h3>
          <span className="text-sm">
            {owed > 0 ? (
              <span className="text-red-600 font-medium">
                Owe {owed.toFixed(2)}
              </span>
            ) : (
              <span className="text-green-600 font-medium">Fully paid</span>
            )}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Paid {po.amountPaid} of {po.totalAmount}
        </p>
        {owed > 0 && po.status !== 'cancelled' && (
          <div className="flex gap-2 items-end">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={owed}
              placeholder="Amount"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-36"
            />
            <Button
              disabled={busy || !payAmount}
              onClick={() =>
                run(async () => {
                  await recordPoPayment({ data: { id: poId, amount: payAmount } })
                  setPayAmount('')
                })
              }
            >
              Record payment
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
