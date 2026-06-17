import type { FieldDef } from '#/lib/grid/registry'

export interface GridColumnModel {
  id: string
  title: string
  width: number
}

export interface CellModel {
  kind: 'text' | 'number'
  value: string
  display: string
  readonly: boolean
}

export function buildColumns(fields: FieldDef[]): GridColumnModel[] {
  return fields.map((f) => ({ id: f.key, title: f.label, width: 180 }))
}

export function cellModel(
  field: FieldDef,
  raw: unknown,
  editable: boolean,
): CellModel {
  const str = raw == null ? '' : String(raw)
  const kind: CellModel['kind'] =
    field.kind === 'number' || field.kind === 'currency' ? 'number' : 'text'
  return { kind, value: str, display: str, readonly: !editable }
}
