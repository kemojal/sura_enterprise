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
