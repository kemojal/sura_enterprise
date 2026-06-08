import { useEffect, useState } from 'react'
import { ChevronDown, Store } from 'lucide-react'

import { listActiveBranches } from '#/lib/branches'

interface Branch {
  id: string
  name: string
  isMain: boolean
}

function setBranchCookie(id: string) {
  document.cookie = `sf_branch=${encodeURIComponent(id)}; path=/; max-age=31536000`
}

// Switches the active branch by setting a cookie and reloading, so every
// server loader re-runs scoped to the chosen branch. Hidden for single-branch
// shops (nothing to switch).
export function BranchSwitcher() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeId, setActiveId] = useState<string | undefined>()

  useEffect(() => {
    listActiveBranches()
      .then((r) => {
        setBranches(r.branches)
        setActiveId(r.activeBranchId)
      })
      .catch(() => {})
  }, [])

  if (branches.length < 2) return null

  return (
    <div className="px-5 pb-3">
      <label className="relative flex items-center gap-2 rounded-lg border border-line bg-white/60 px-2.5 py-2 text-sm">
        <Store size={15} className="shrink-0 text-sea-ink-soft" />
        <select
          value={activeId ?? ''}
          onChange={(e) => {
            setBranchCookie(e.target.value)
            window.location.reload()
          }}
          className="flex-1 min-w-0 bg-transparent outline-none appearance-none cursor-pointer text-sea-ink font-medium"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.isMain ? ' (main)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="shrink-0 text-sea-ink-soft pointer-events-none" />
      </label>
    </div>
  )
}
