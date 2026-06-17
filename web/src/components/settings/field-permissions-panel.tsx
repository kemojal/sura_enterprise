import { useEffect, useState } from 'react'

import { REGISTRY } from '#/lib/grid/registry'
import { resolveFieldPermission } from '#/lib/grid/permissions'
import type { PermRow } from '#/lib/grid/permissions'
import { getFieldPermissions, setFieldPermission } from '#/lib/grid/server'

const ROLES = ['manager', 'cashier'] as const

export function FieldPermissionsPanel() {
  const [perms, setPerms] = useState<PermRow[]>([])
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    getFieldPermissions().then((rows) => setPerms(rows as PermRow[]))
  }, [])

  async function toggle(
    resource: string,
    field: string,
    role: (typeof ROLES)[number],
    next: boolean,
  ) {
    const key = `${resource}.${field}.${role}`
    setSaving(key)
    try {
      await setFieldPermission({ data: { resource, field, role, canEdit: next } })
      setPerms((prev) => {
        const rest = prev.filter(
          (p) => !(p.resource === resource && p.field === field && p.role === role),
        )
        return [...rest, { resource, field, role, canEdit: next }]
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="app-card p-5 space-y-5">
      <div>
        <h3 className="display-title text-lg font-bold text-sea-ink">
          Edit permissions
        </h3>
        <p className="text-sm text-sea-ink-soft">
          Choose which fields each role may edit in the grids. You (owner) can
          always edit. Every edit is recorded in Activity.
        </p>
      </div>

      {Object.values(REGISTRY).map((res) => (
        <div key={res.resource}>
          <p className="text-sm font-semibold text-sea-ink capitalize mb-2">
            {res.resource.replace('_', ' ')}
          </p>
          <table className="w-full text-sm">
            <thead className="text-sea-ink-soft text-left">
              <tr>
                <th className="py-1.5 font-medium">Field</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-1.5 font-medium capitalize w-24">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {res.fields
                .filter((f) => !f.displayOnly)
                .map((f) => (
                <tr key={f.key}>
                  <td className="py-2 text-sea-ink">{f.label}</td>
                  {ROLES.map((role) => {
                    const checked = resolveFieldPermission(
                      perms,
                      res.resource,
                      f.key,
                      role,
                    )
                    const key = `${res.resource}.${f.key}.${role}`
                    return (
                      <td key={role} className="py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving === key}
                          onChange={(e) =>
                            toggle(res.resource, f.key, role, e.target.checked)
                          }
                          className="w-4 h-4 accent-lagoon-deep"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
