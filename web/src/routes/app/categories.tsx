import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Check, Pencil, Tag, Trash2, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  createCategory,
  deleteCategory,
  listCategoriesWithCounts,
  renameCategory,
} from '#/lib/categories'
import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/categories')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'categories')) throw redirect({ to: '/app/dashboard' })
  },
  loader: () => listCategoriesWithCounts(),
  component: CategoriesPage,
})

function CategoriesPage() {
  const categories = Route.useLoaderData()
  const router = useRouter()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
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
    if (!newName.trim()) return
    await run(async () => {
      await createCategory({ data: { name: newName } })
      setNewName('')
    })
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Tag size={20} className="text-gray-700" />
        <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="New category name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !newName.trim()}>
          Add
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {categories.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No categories yet. Add one above.
        </div>
      ) : (
        <div className="bg-white border rounded-xl divide-y">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3 gap-3"
            >
              {editingId === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        run(async () => {
                          await renameCategory({ data: { id: c.id, name: editName } })
                          setEditingId(null)
                        })
                      }
                      disabled={busy || !editName.trim()}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                      title="Save"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.productCount} product{c.productCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(c.id)
                        setEditName(c.name)
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                      title="Rename"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete "${c.name}"? Products in it will become uncategorized.`,
                          )
                        ) {
                          run(() => deleteCategory({ data: { id: c.id } }))
                        }
                      }}
                      disabled={busy}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
