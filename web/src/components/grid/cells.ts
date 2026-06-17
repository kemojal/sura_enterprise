import type { FieldDef } from '#/lib/grid/registry'

export interface GridColumnModel {
  id: string
  title: string
  width: number
}

export interface CellModel {
  kind: 'text' | 'number' | 'enum'
  value: string
  display: string
  readonly: boolean
  options?: ReadonlyArray<{ value: string; label: string }>
}

export function buildColumns(fields: FieldDef[]): GridColumnModel[] {
  return fields.map((f) => ({ id: f.key, title: f.label, width: 180 }))
}

export function cellModel(
  field: FieldDef,
  raw: unknown,
  editable: boolean,
): CellModel {
  const readonly = !editable || field.displayOnly === true
  const value = raw == null ? '' : String(raw)

  if (field.kind === 'enum') {
    const opt = field.options?.find((o) => o.value === value)
    return {
      kind: 'enum',
      value,
      display: opt?.label ?? value,
      readonly,
      options: field.options,
    }
  }

  if (field.kind === 'number' || field.kind === 'currency') {
    return { kind: 'number', value, display: value, readonly }
  }

  if (field.kind === 'date') {
    // raw arrives as an ISO string over the wire; show the yyyy-mm-dd portion.
    return { kind: 'text', value, display: value.slice(0, 10), readonly }
  }

  return { kind: 'text', value, display: value, readonly }
}
