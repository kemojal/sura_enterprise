import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'

import { Barcode } from '#/components/barcode'
import { Input } from '#/components/ui/input'
import { can } from '#/lib/permissions'
import { listProducts } from '#/lib/products'
import { getShopSettings } from '#/lib/shop'

export const Route = createFileRoute('/app/products/labels')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write'))
      throw redirect({ to: '/app/products' })
  },
  loader: async () => {
    const products = await listProducts({ data: {} })
    let currency = 'GHS'
    try {
      const shop = await getShopSettings()
      currency = shop.currency
    } catch {
      // managers may not have settings access — fall back to default
    }
    return { products, currency }
  },
  component: LabelsPage,
})

// A barcode value is required; fall back to the product id when none is set.
function labelCode(p: { id: string; barcode?: string | null }) {
  return p.barcode && p.barcode.trim() ? p.barcode : p.id.slice(-12).toUpperCase()
}

function LabelsPage() {
  const { products, currency } = Route.useLoaderData()
  const [counts, setCounts] = useState<Record<string, number>>({})

  function setCount(id: string, n: number) {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, n) }))
  }

  // Build the flat list of labels to render (one per copy)
  const labels = products.flatMap((p) => {
    const n = counts[p.id] ?? 0
    return Array.from({ length: n }, (_, i) => ({ ...p, _key: `${p.id}-${i}` }))
  })

  const totalLabels = labels.length

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden">
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
          <Link
            to="/app/products"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to products
          </Link>
          <button
            onClick={() => window.print()}
            disabled={totalLabels === 0}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
          >
            <Printer size={16} />
            Print {totalLabels > 0 ? `(${totalLabels})` : ''}
          </button>
        </div>

        {/* Product selector */}
        <div className="p-6 max-w-3xl mx-auto space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Barcode Labels</h2>
          <p className="text-sm text-gray-500">
            Set how many labels to print per product, then click Print.
          </p>
          <div className="bg-white border rounded-xl divide-y">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    {labelCode(p)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setCount(p.id, (counts[p.id] ?? 0) - 1)}
                    className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100"
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    min="0"
                    value={counts[p.id] ?? 0}
                    onChange={(e) => setCount(p.id, Number(e.target.value))}
                    className="w-14 text-center"
                  />
                  <button
                    onClick={() => setCount(p.id, (counts[p.id] ?? 0) + 1)}
                    className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Printable label sheet */}
      <div className="label-sheet p-6 print:p-0">
        <div className="flex flex-wrap gap-2 print:gap-0">
          {labels.map((p) => (
            <div
              key={p._key}
              className="label border border-dashed border-gray-300 print:border-gray-200 rounded-md print:rounded-none p-2 flex flex-col items-center justify-center bg-white"
              style={{ width: '180px', height: '110px' }}
            >
              <p className="text-xs font-semibold text-gray-900 text-center leading-tight truncate w-full">
                {p.name}
              </p>
              <p className="text-sm font-bold text-gray-900 my-0.5">
                {new Intl.NumberFormat('en-GH', {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 2,
                }).format(Number(p.sellingPrice))}
              </p>
              <Barcode value={labelCode(p)} height={32} width={1.3} fontSize={10} />
            </div>
          ))}
        </div>

        {totalLabels === 0 && (
          <p className="print:hidden text-center text-gray-400 py-12">
            No labels selected yet.
          </p>
        )}
      </div>

      <style>{`
        @media print {
          @page { margin: 8mm; }
          .label-sheet { padding: 0; }
        }
      `}</style>
    </div>
  )
}
