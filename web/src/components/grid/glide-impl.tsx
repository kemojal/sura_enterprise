import { DataEditor, GridCellKind } from '@glideapps/glide-data-grid'
import type {
  EditableGridCell,
  GridCell,
  Item,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { useCallback } from 'react'

import type { FieldDef } from '#/lib/grid/registry'
import { buildColumns, cellModel } from './cells'

export interface GlideGridProps {
  fields: FieldDef[]
  rows: Array<Record<string, unknown>>
  // (rowIndex, fieldKey) → can this cell be edited right now?
  isEditable: (rowIndex: number, fieldKey: string) => boolean
  // Commit one cell edit; resolve with true on success, false to revert.
  onEdit: (rowIndex: number, fieldKey: string, value: unknown) => Promise<boolean>
}

const lockedTheme = { bgCell: '#f3f4f6', textDark: '#9ca3af' }

export default function GlideGrid({
  fields,
  rows,
  isEditable,
  onEdit,
}: GlideGridProps) {
  const columns = buildColumns(fields).map((c) => ({ id: c.id, title: c.title, width: c.width }))

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const field = fields[col]
      const editable = isEditable(row, field.key)
      const m = cellModel(field, rows[row]?.[field.key], editable)
      const themeOverride = editable ? undefined : lockedTheme
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
      const value =
        newValue.kind === GridCellKind.Number ? newValue.data : (newValue.data as string)
      // Glide is synchronous here; the parent updates `rows` state on success
      // (which redraws) or leaves it unchanged on failure (which reverts).
      void onEdit(row, field.key, value)
    },
    [fields, onEdit],
  )

  return (
    <div className="app-card overflow-hidden" style={{ height: 560, width: '100%' }}>
      <DataEditor
        columns={columns}
        rows={rows.length}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        rowMarkers="number"
        width="100%"
        height={560}
      />
    </div>
  )
}
