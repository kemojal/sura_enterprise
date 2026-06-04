import { createFileRoute, Link, redirect } from '@tanstack/react-router'

import { Button } from '#/components/ui/button'
import { can } from '#/lib/permissions'
import { listQuotes } from '#/lib/quotes'

export const Route = createFileRoute('/app/quotes/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'sales')) throw redirect({ to: '/app/dashboard' })
  },
  loader: () => listQuotes(),
  component: QuotesPage,
})

const statusStyle: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
}

function QuotesPage() {
  const quotes = Route.useLoaderData()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Quotes</h2>
        <Link to="/app/quotes/new">
          <Button size="sm">+ New quote</Button>
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No quotes yet.</div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {q.customerName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {q.totalAmount}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {q.validUntil
                      ? new Date(q.validUntil).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[q.status] ?? ''}`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/app/quotes/$quoteId"
                      params={{ quoteId: q.id }}
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
    </div>
  )
}
