import { describe, expect, it } from 'vitest'
import { REGISTRY, getField } from './registry'

describe('registry: suppliers', () => {
  it('exposes a suppliers resource with a name field', () => {
    expect(REGISTRY.suppliers.entityType).toBe('supplier')
    expect(getField('suppliers', 'name')?.label).toBe('Name')
  })

  it('name validator rejects empty, accepts non-empty (trimmed)', () => {
    const name = getField('suppliers', 'name')!.validator
    expect(name.safeParse('').success).toBe(false)
    expect(name.safeParse('  Acme  ').success).toBe(true)
    expect(name.safeParse('  Acme  ').data).toBe('Acme')
  })

  it('email validator accepts blank→null and valid email, rejects junk', () => {
    const email = getField('suppliers', 'email')!.validator
    expect(email.safeParse('').data).toBe(null)
    expect(email.safeParse('a@b.com').data).toBe('a@b.com')
    expect(email.safeParse('nope').success).toBe(false)
  })

  it('getField returns undefined for unknown field', () => {
    expect(getField('suppliers', 'bogus')).toBeUndefined()
  })
})
