import type { StaffRole } from '#/lib/permissions'
import { getField } from './registry'

export interface PermRow {
  resource: string
  field: string
  role: string
  canEdit: boolean
}

export interface LockRow {
  entityType: string
  entityId: string
  unlocked: boolean
}

export function resolveFieldPermission(
  perms: PermRow[],
  resource: string,
  field: string,
  role: StaffRole,
): boolean {
  if (role === 'owner') return true
  const fieldDef = getField(resource, field)
  if (!fieldDef) return false
  const row = perms.find(
    (p) => p.resource === resource && p.field === field && p.role === role,
  )
  if (row) return row.canEdit
  return fieldDef.editableByDefault?.[role as 'manager' | 'cashier'] ?? false
}

// A record is locked unless an explicit unlocked=true row exists for it.
export function isLocked(
  locks: LockRow[],
  entityType: string,
  entityId: string,
): boolean {
  const row = locks.find(
    (l) => l.entityType === entityType && l.entityId === entityId,
  )
  return row?.unlocked !== true
}
