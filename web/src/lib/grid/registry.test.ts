import { describe, expect, it } from 'vitest'
import { REGISTRY, getField, getResource } from './registry'

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

describe('registry: expenses', () => {
  it('exposes an expenses resource with the right fields', () => {
    expect(REGISTRY.expenses.entityType).toBe('expense')
    expect(REGISTRY.expenses.permission).toBe('expenses')
    expect(getField('expenses', 'amount')?.financial).toBe(true)
    expect(getField('expenses', 'date')?.displayOnly).toBe(true)
  })

  it('category is an enum field with options', () => {
    const cat = getField('expenses', 'category')!
    expect(cat.kind).toBe('enum')
    expect(cat.options?.map((o) => o.value)).toContain('rent')
    expect(cat.validator.safeParse('rent').success).toBe(true)
    expect(cat.validator.safeParse('not_a_cat').success).toBe(false)
  })

  it('amount currency validator coerces to a 2dp string, rejects junk/negatives', () => {
    const amt = getField('expenses', 'amount')!.validator
    expect(amt.safeParse(150).data).toBe('150.00')
    expect(amt.safeParse('12.5').data).toBe('12.50')
    expect(amt.safeParse(-3).success).toBe(false)
    expect(amt.safeParse('abc').success).toBe(false)
  })

  it('getResource returns the expenses def', () => {
    expect(getResource('expenses')?.table).toBeDefined()
  })
})

describe('registry: products', () => {
  it('exposes a products resource gated by products:write', () => {
    expect(REGISTRY.products.entityType).toBe('product')
    expect(REGISTRY.products.permission).toBe('products:write')
  })

  it('category is a relation field; stock is display-only; prices are financial', () => {
    expect(getField('products', 'categoryId')?.kind).toBe('relation')
    expect(getField('products', 'stockQty')?.displayOnly).toBe(true)
    expect(getField('products', 'buyingPrice')?.financial).toBe(true)
    expect(getField('products', 'sellingPrice')?.financial).toBe(true)
  })

  it('lowStockThreshold validator accepts whole numbers, rejects negatives/decimals/junk', () => {
    const v = getField('products', 'lowStockThreshold')!.validator
    expect(v.safeParse(5).data).toBe(5)
    expect(v.safeParse('5').data).toBe(5)
    expect(v.safeParse(-1).success).toBe(false)
    expect(v.safeParse(2.5).success).toBe(false)
    expect(v.safeParse('abc').success).toBe(false)
  })

  it('categoryId validator maps blank to null, passes an id through', () => {
    const v = getField('products', 'categoryId')!.validator
    expect(v.safeParse('').data).toBe(null)
    expect(v.safeParse('cat_123').data).toBe('cat_123')
  })
})
