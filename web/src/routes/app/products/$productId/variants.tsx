import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { can } from '#/lib/permissions'
import {
  createVariant,
  deleteVariant,
  listVariants,
  updateVariant,
} from '#/lib/variants'

export const Route = createFileRoute('/app/products/$productId/variants')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/products' })
  },
  loader: ({ params }) => listVariants({ data: { productId: params.productId } }),
  component: VariantsPage,
})

function VariantsPage() {
  const { product, variants } = Route.useLoaderData()
  const { productId } = Route.useParams()
  const router = useRouter()

  const [name, setName] = useState('')
  const [buyingPrice, setBuyingPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [stockQty, setStockQty] = useState('')
  const [barcode, setBarcode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !buyingPrice || !sellingPrice) {
      setError('Name, buying and selling price are required')
      return
    }
    await run(async () => {
      await createVariant({
        data: {
          productId,
          name,
          barcode: barcode || undefined,
          buyingPrice,
          sellingPrice,
          stockQty: Number(stockQty || 0),
        },
      })
      setName('')
      setBuyingPrice('')
      setSellingPrice('')
      setStockQty('')
      setBarcode('')
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/products" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Variants — {product.name}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Each variant is sold as its own item with its own stock & price.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Existing variants */}
      {variants.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium text-right">Buy</th>
                <th className="px-4 py-3 font-medium text-right">Sell</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((v) => (
                <VariantRow
                  key={v.id}
                  variant={v}
                  productId={productId}
                  busy={busy}
                  onSave={(patch) =>
                    run(() => updateVariant({ data: { id: v.id, productId, ...patch } }))
                  }
                  onDelete={() =>
                    run(() => deleteVariant({ data: { id: v.id, productId } }))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add variant */}
      <form onSubmit={handleAdd} className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-gray-700 flex items-center gap-1.5">
          <Plus size={15} /> Add variant
        </h3>
        <div className="space-y-1">
          <Label htmlFor="v-name">Name *</Label>
          <Input
            id="v-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Large / Red"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="v-buy">Buying *</Label>
            <Input id="v-buy" type="number" step="0.01" min="0" value={buyingPrice} onChange={(e) => setBuyingPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="v-sell">Selling *</Label>
            <Input id="v-sell" type="number" step="0.01" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="v-stock">Stock</Label>
            <Input id="v-stock" type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="v-barcode">Barcode</Label>
          <Input id="v-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Optional" />
        </div>
        <Button type="submit" disabled={busy}>
          Add variant
        </Button>
      </form>
    </div>
  )
}

function VariantRow({
  variant,
  busy,
  onSave,
  onDelete,
}: {
  variant: {
    id: string
    name: string
    buyingPrice: string
    sellingPrice: string
    stockQty: number
    barcode: string | null
  }
  productId: string
  busy: boolean
  onSave: (patch: {
    name: string
    barcode?: string
    buyingPrice: string
    sellingPrice: string
    stockQty: number
  }) => void
  onDelete: () => void
}) {
  const [sell, setSell] = useState(variant.sellingPrice)
  const [stock, setStock] = useState(String(variant.stockQty))
  const dirty = sell !== variant.sellingPrice || stock !== String(variant.stockQty)

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-900 font-medium">{variant.name}</td>
      <td className="px-4 py-3 text-right text-gray-600">{variant.buyingPrice}</td>
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          step="0.01"
          value={sell}
          onChange={(e) => setSell(e.target.value)}
          className="w-20 border rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="w-16 border rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {dirty && (
            <button
              disabled={busy}
              onClick={() =>
                onSave({
                  name: variant.name,
                  barcode: variant.barcode ?? undefined,
                  buyingPrice: variant.buyingPrice,
                  sellingPrice: sell,
                  stockQty: Number(stock),
                })
              }
              className="text-xs text-blue-600 hover:underline"
            >
              Save
            </button>
          )}
          <button
            disabled={busy}
            onClick={onDelete}
            className="text-red-400 hover:text-red-600"
            title="Delete variant"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
