import { describe, expect, it } from 'vitest'
import { buildColumns, cellModel } from './cells'
import type { FieldDef } from '#/lib/grid/registry'

const nameField: FieldDef = {
  key: 'name',
  label: 'Name',
  kind: 'text',
  validator: {} as never,
}
const priceField: FieldDef = {
  key: 'price',
  label: 'Price',
  kind: 'currency',
  validator: {} as never,
}

describe('buildColumns', () => {
  it('maps field defs to grid columns', () => {
    expect(buildColumns([nameField])).toEqual([{ id: 'name', title: 'Name', width: 180 }])
  })
})

describe('cellModel', () => {
  it('text cell, editable', () => {
    expect(cellModel(nameField, 'Acme', true)).toEqual({
      kind: 'text',
      value: 'Acme',
      display: 'Acme',
      readonly: false,
    })
  })
  it('null → empty string', () => {
    expect(cellModel(nameField, null, true).value).toBe('')
  })
  it('currency/number kind maps to number cell, readonly when locked', () => {
    const c = cellModel(priceField, '12.50', false)
    expect(c.kind).toBe('number')
    expect(c.readonly).toBe(true)
    expect(c.display).toBe('12.50')
  })
})

const catField: FieldDef = {
  key: 'category',
  label: 'Category',
  kind: 'enum',
  validator: {} as never,
  options: [
    { value: 'rent', label: 'Rent' },
    { value: 'misc', label: 'Miscellaneous' },
  ],
}
const dateField: FieldDef = {
  key: 'date',
  label: 'Date',
  kind: 'date',
  validator: {} as never,
  displayOnly: true,
}

describe('cellModel: enum', () => {
  it('shows the option label, keeps the raw value, carries options', () => {
    const c = cellModel(catField, 'rent', true)
    expect(c.kind).toBe('enum')
    expect(c.value).toBe('rent')
    expect(c.display).toBe('Rent')
    expect(c.readonly).toBe(false)
    expect(c.options).toBe(catField.options)
  })
  it('falls back to the raw value when no matching option', () => {
    expect(cellModel(catField, 'unknown', true).display).toBe('unknown')
  })
})

describe('cellModel: date / displayOnly', () => {
  it('date renders the ISO date portion and is always read-only', () => {
    const c = cellModel(dateField, '2026-06-17T10:00:00.000Z', true)
    expect(c.kind).toBe('text')
    expect(c.display).toBe('2026-06-17')
    expect(c.readonly).toBe(true) // displayOnly overrides editable
  })
})
