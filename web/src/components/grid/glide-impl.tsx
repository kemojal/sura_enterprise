import { DataEditor, GridCellKind } from '@glideapps/glide-data-grid'
import type {
  EditableGridCell,
  GridCell,
  Item,
} from '@glideapps/glide-data-grid'
import { DropdownCell } from '@glideapps/glide-data-grid-cells'
import '@glideapps/glide-data-grid/dist/index.css'
import { useCallback } from 'react'

import type { FieldDef } from '#/lib/grid/registry'
import { buildColumns, cellModel } from './cells'

export interface GlideGridProps {
  fields: FieldDef[]
  rows: Array<Record<string, unknown>>
  isEditable: (rowIndex: number, fieldKey: string) => boolean
  onEdit: (rowIndex: number, fieldKey: string, value: unknown) => Promise<boolean>
}

const lockedTheme = { bgCell: '#f3f4f6', textDark: '#9ca3af' }

// Only the dropdown renderer — avoid `allCells`, which pulls in toast-ui and
// react-select and bloats/breaks the bundle.
const customRenderers = [DropdownCell]

export default function GlideGrid({
  fields,
  rows,
  isEditable,
  onEdit,
}: GlideGridProps) {
  const columns = buildColumns(fields).map((c) => ({
    id: c.id,
    title: c.title,
    width: c.width,
  }))

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const field = fields[col]
      const editable = isEditable(row, field.key)
      const m = cellModel(field, rows[row]?.[field.key], editable)
      const themeOverride = editable ? undefined : lockedTheme

      if (m.kind === 'enum') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: editable,
          readonly: !editable,
          copyData: m.display,
          themeOverride,
          data: {
            kind: 'dropdown-cell',
            allowedValues: (m.options ?? []).map((o) => ({
              value: o.value,
              label: o.label,
            })),
            value: m.value,
          },
        } as GridCell
      }

      if (m.kind === 'number') {
        const n = rows[row]?.[field.key]
        return {
          kind: GridCellKind.Number,
          data: n == null || n === '' ? undefined : Number(n),
          displayData: m.display,
          allowOverlay: editable,
          readonly: !editable,
          themeOverride,
        }
      }

      return {
        kind: GridCellKind.Text,
        data: m.value,
        displayData: m.display,
        allowOverlay: editable,
        readonly: !editable,
        themeOverride,
      }
    },
    [fields, rows, isEditable],
  )

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell
      const field = fields[col]
      let value: unknown
      if (newValue.kind === GridCellKind.Number) {
        value = newValue.data
      } else if (newValue.kind === GridCellKind.Custom) {
        const data = newValue.data as { value?: string }
        value = data.value
      } else {
        value = (newValue.data as string)
      }
      void onEdit(row, field.key, value)
    },
    [fields, onEdit],
  )

  return (
    <div
      className="app-card overflow-hidden"
      style={{ height: 560, width: '100%' }}
    >
      <DataEditor
        columns={columns}
        rows={rows.length}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        customRenderers={customRenderers}
        rowMarkers="number"
        width="100%"
        height={560}
      />
    </div>
  )
}
