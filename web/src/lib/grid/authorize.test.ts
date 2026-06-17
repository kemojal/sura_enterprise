import { describe, expect, it } from 'vitest'
import { authorizeFieldEdit } from './authorize'

const base = {
  resource: 'suppliers',
  field: 'name',
  entityId: 's1',
  perms: [],
  locks: [{ entityType: 'supplier', entityId: 's1', unlocked: true }],
}

describe('authorizeFieldEdit', () => {
  it('owner bypasses lock and permission, value validated', () => {
    const r = authorizeFieldEdit({ ...base, role: 'owner', locks: [], rawValue: 'Acme' })
    expect(r).toEqual({ ok: true, parsed: 'Acme', entityType: 'supplier', financial: false })
  })
  it('rejects unknown resource/field', () => {
    expect(authorizeFieldEdit({ ...base, resource: 'x', role: 'owner', rawValue: 'a' }).ok).toBe(false)
    expect(authorizeFieldEdit({ ...base, field: 'x', role: 'owner', rawValue: 'a' }).ok).toBe(false)
  })
  it('rejects invalid value', () => {
    const r = authorizeFieldEdit({ ...base, role: 'owner', rawValue: '' })
    expect(r.ok).toBe(false)
  })
  it('non-owner: rejected when locked', () => {
    const r = authorizeFieldEdit({
      ...base,
      role: 'manager',
      locks: [], // locked by default
      rawValue: 'Acme',
    })
    expect(r).toMatchObject({ ok: false })
  })
  it('non-owner: rejected when field not permitted', () => {
    const r = authorizeFieldEdit({
      ...base,
      role: 'cashier', // no default for suppliers.name
      rawValue: 'Acme',
    })
    expect(r).toMatchObject({ ok: false })
  })
  it('non-owner: allowed when unlocked + permitted', () => {
    const r = authorizeFieldEdit({ ...base, role: 'manager', rawValue: 'Acme' })
    expect(r).toMatchObject({ ok: true, parsed: 'Acme' })
  })
})

describe('authorizeFieldEdit: displayOnly', () => {
  it('rejects a display-only field even for owner', () => {
    const r = authorizeFieldEdit({
      resource: 'expenses',
      field: 'date',
      role: 'owner',
      rawValue: '2026-01-01',
      entityId: 'e1',
      perms: [],
      locks: [],
    })
    expect(r).toMatchObject({ ok: false })
  })
})
