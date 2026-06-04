import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  History,
} from 'lucide-react'

import { can } from '#/lib/permissions'
import { getStockLedger } from '#/lib/stock-ledger'

export const Route = createFileRoute('/app/products/$productId/ledger')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/products' })
  },
  loader: ({ params }) => getStockLedger({ data: { productId: params.productId } }),
  component: LedgerPage,
})

const kindColor: Record<string, string> = {
  sale: 'text-red-600 bg-red-50',
  return: 'text-amber-600 bg-amber-50',
  po: 'text-green-600 bg-green-50',
  restock: 'text-green-600 bg-green-50',
  write_off: 'text-red-600 bg-red-50',
  correction: 'text-blue-600 bg-blue-50',
  initial_count: 'text-blue-600 bg-blue-50',
}

function LedgerPage() {
  const { product, rows } = Route.useLoaderData()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/products" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Stock History — {product.name}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Current stock:{' '}
            <span className="font-medium text-gray-900">{product.stockQty}</span>{' '}
            · every movement with running balance
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          <History size={32} className="mx-auto mb-2 opacity-40" />
          No stock movements recorded yet.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Change</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleString('en-GH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${kindColor[m.kind] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {m.delta >= 0 ? (
                        <ArrowUpRight size={11} />
                      ) : (
                        <ArrowDownLeft size={11} />
                      )}
                      {m.label}
                    </span>
                    {m.note && (
                      <span className="text-xs text-gray-400 ml-2">{m.note}</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${m.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {m.delta >= 0 ? '+' : ''}
                    {m.delta}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">
                    {m.balanceAfter}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
