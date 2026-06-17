import type { StaffRole } from '#/lib/permissions'
import { getField, getResource } from './registry'
import { isLocked, resolveFieldPermission } from './permissions'
import type { LockRow, PermRow } from './permissions'

export interface AuthzInput {
  resource: string
  field: string
  role: StaffRole
  rawValue: unknown
  entityId: string
  perms: PermRow[]
  locks: LockRow[]
}

export type AuthzResult =
  | { ok: true; parsed: unknown; entityType: string; financial: boolean }
  | { ok: false; reason: string }

export function authorizeFieldEdit(input: AuthzInput): AuthzResult {
  const def = getResource(input.resource)
  const fieldDef = getField(input.resource, input.field)
  if (!def || !fieldDef) return { ok: false, reason: 'Unknown field' }

  if (fieldDef.displayOnly) {
    return { ok: false, reason: 'This column is read-only' }
  }

  const parsed = fieldDef.validator.safeParse(input.rawValue)
  if (!parsed.success) return { ok: false, reason: 'Invalid value' }

  if (input.role !== 'owner') {
    if (!resolveFieldPermission(input.perms, input.resource, input.field, input.role)) {
      return { ok: false, reason: 'You are not allowed to edit this field' }
    }
    if (isLocked(input.locks, def.entityType, input.entityId)) {
      return { ok: false, reason: 'Record is locked — ask the owner to unlock it' }
    }
  }

  return {
    ok: true,
    parsed: parsed.data,
    entityType: def.entityType,
    financial: !!fieldDef.financial,
  }
}
