import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeftRight, Building2, Star } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  createBranch,
  listBranches,
  setMainBranch,
  updateBranch,
} from '#/lib/branches'
import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/branches/')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'settings')) throw redirect({ to: '/app/dashboard' })
  },
  loader: () => listBranches(),
  component: BranchesPage,
})

function BranchesPage() {
  const { branches, activeBranchId } = Route.useLoaderData()
  const router = useRouter()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
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
    if (!name.trim()) return
    await run(async () => {
      await createBranch({ data: { name, address: address || undefined, phone: phone || undefined } })
      setName('')
      setAddress('')
      setPhone('')
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Branches</h2>
        <Link to="/app/branches/transfer">
          <Button size="sm" variant="outline">
            <ArrowLeftRight size={14} className="mr-1.5" /> Transfer stock
          </Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {branches.map((b) => (
          <div
            key={b.id}
            className={`rounded-xl border bg-white p-4 ${
              b.id === activeBranchId ? 'border-gray-800 ring-1 ring-gray-800' : ''
            } ${b.isActive ? '' : 'opacity-60'}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-1.5">
                    {b.name}
                    {b.isMain && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600 text-xs">
                        <Star size={11} fill="currentColor" /> main
                      </span>
                    )}
                  </p>
                  {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
                  {b.phone && <p className="text-xs text-gray-500">{b.phone}</p>}
                </div>
              </div>
              {b.id === activeBranchId && (
                <span className="text-[11px] font-medium text-gray-500">active</span>
              )}
            </div>

            <div className="mt-3 flex gap-6 text-sm">
              <div>
                <span className="text-gray-400 text-xs">SKUs</span>
                <p className="font-semibold text-gray-900">{b.skuCount}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Units in stock</span>
                <p className="font-semibold text-gray-900">{b.unitsInStock}</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 border-t pt-3">
              {!b.isMain && (
                <button
                  disabled={busy}
                  onClick={() => run(() => setMainBranch({ data: { id: b.id } }))}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  Set as main
                </button>
              )}
              {!b.isMain &&
                (b.isActive ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => updateBranch({ data: { id: b.id, name: b.name, address: b.address ?? undefined, phone: b.phone ?? undefined, isActive: false } }))
                    }
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => updateBranch({ data: { id: b.id, name: b.name, address: b.address ?? undefined, phone: b.phone ?? undefined, isActive: true } }))
                    }
                    className="text-xs text-green-600 hover:text-green-800"
                  >
                    Reactivate
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add branch */}
      <form onSubmit={handleAdd} className="rounded-xl border bg-white p-4 space-y-3 max-w-md">
        <h3 className="font-medium text-gray-700">Add a branch</h3>
        <div className="space-y-1">
          <Label htmlFor="b-name">Name *</Label>
          <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spintex" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="b-addr">Address</Label>
            <Input id="b-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b-phone">Phone</Label>
            <Input id="b-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          Add branch
        </Button>
      </form>
    </div>
  )
}
