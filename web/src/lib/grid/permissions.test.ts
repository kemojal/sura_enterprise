import { describe, expect, it } from 'vitest'
import { isLocked, resolveFieldPermission } from './permissions'

const perms = [
  { resource: 'suppliers', field: 'notes', role: 'cashier', canEdit: true },
  { resource: 'suppliers', field: 'name', role: 'manager', canEdit: false },
]

describe('resolveFieldPermission', () => {
  it('owner always true', () => {
    expect(resolveFieldPermission(perms, 'suppliers', 'name', 'owner')).toBe(true)
  })
  it('uses explicit DB row over default', () => {
    // manager default for name is true, but DB row says false
    expect(resolveFieldPermission(perms, 'suppliers', 'name', 'manager')).toBe(false)
    // cashier has no registry default (false) but DB grants notes
    expect(resolveFieldPermission(perms, 'suppliers', 'notes', 'cashier')).toBe(true)
  })
  it('falls back to registry default when no row', () => {
    expect(resolveFieldPermission([], 'suppliers', 'phone', 'manager')).toBe(true)
    expect(resolveFieldPermission([], 'suppliers', 'phone', 'cashier')).toBe(false)
  })
  it('unknown field/resource → false', () => {
    expect(resolveFieldPermission([], 'suppliers', 'bogus', 'manager')).toBe(false)
    expect(resolveFieldPermission([], 'bogus', 'x', 'manager')).toBe(false)
  })
})

describe('isLocked', () => {
  it('locked by default (no row)', () => {
    expect(isLocked([], 'supplier', 's1')).toBe(true)
  })
  it('unlocked row → not locked', () => {
    expect(
      isLocked([{ entityType: 'supplier', entityId: 's1', unlocked: true }], 'supplier', 's1'),
    ).toBe(false)
  })
  it('explicit unlocked=false → locked', () => {
    expect(
      isLocked([{ entityType: 'supplier', entityId: 's1', unlocked: false }], 'supplier', 's1'),
    ).toBe(true)
  })
})
