import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { getSupplier, updateSupplier } from '#/lib/suppliers'

export const Route = createFileRoute('/app/suppliers/$supplierId')({
  loader: ({ params }) =>
    getSupplier({ data: { id: params.supplierId } }),
  component: SupplierDetailPage,
})

function SupplierDetailPage() {
  const { supplier, products } = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(supplier.name)
  const [phone, setPhone] = useState(supplier.phone ?? '')
  const [email, setEmail] = useState(supplier.email ?? '')
  const [address, setAddress] = useState(supplier.address ?? '')
  const [notes, setNotes] = useState(supplier.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await updateSupplier({
        data: {
          id: supplier.id,
          name,
          phone,
          email,
          address,
          notes,
        },
      })
      setEditing(false)
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{supplier.name}</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Link
            to="/app/suppliers"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back
          </Link>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4 max-w-lg">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      ) : (
        <div className="bg-white rounded-xl border p-5 grid grid-cols-2 gap-4 text-sm max-w-lg">
          <div>
            <p className="text-gray-500">Phone</p>
            <p className="text-gray-900 mt-0.5">{supplier.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="text-gray-900 mt-0.5">{supplier.email ?? '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">Address</p>
            <p className="text-gray-900 mt-0.5">{supplier.address ?? '—'}</p>
          </div>
          {supplier.notes && (
            <div className="col-span-2">
              <p className="text-gray-500">Notes</p>
              <p className="text-gray-900 mt-0.5">{supplier.notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-medium text-gray-700">Products from this supplier</h3>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400">No products linked.</p>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Selling Price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.stockQty}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.sellingPrice}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
