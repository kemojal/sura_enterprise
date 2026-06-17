import { useState } from 'react'
import { History } from 'lucide-react'

import { listFieldEdits } from '#/lib/grid/server'

export function RecordHistory({
  entityType,
  entityId,
  label,
}: {
  entityType: string
  entityId: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [edits, setEdits] = useState<
    Awaited<ReturnType<typeof listFieldEdits>>
  >([])
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!open) {
      setLoading(true)
      try {
        setEdits(await listFieldEdits({ data: { entityType, entityId } }))
      } finally {
        setLoading(false)
      }
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={toggle}
        title="Edit history"
        className="inline-flex items-center gap-1 text-xs text-lagoon-deep hover:underline"
      >
        <History size={13} /> History
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-80 app-card p-3 text-xs shadow-xl">
          <p className="font-semibold text-sea-ink mb-2">{label} — edits</p>
          {loading ? (
            <p className="text-sea-ink-soft">Loading…</p>
          ) : edits.length === 0 ? (
            <p className="text-sea-ink-soft">No edits recorded.</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {edits.map((e) => (
                <li key={e.id} className="border-b border-line pb-1.5">
                  <span className="font-medium text-sea-ink">{e.field}</span>{' '}
                  <span className="text-sea-ink-soft">
                    {e.oldValue ?? '—'} → {e.newValue ?? '—'}
                  </span>
                  <div className="text-[11px] text-sea-ink-soft">
                    {e.actorName ?? 'Someone'} ·{' '}
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
