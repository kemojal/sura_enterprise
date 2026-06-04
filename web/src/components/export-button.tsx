import { Download } from 'lucide-react'

import { downloadCsv, toCsv, dateStamp } from '#/lib/csv'

interface ExportButtonProps<T> {
  rows: T[]
  columns: { header: string; value: (row: T) => string | number | null | undefined }[]
  filename: string
  label?: string
}

export function ExportButton<T>({
  rows,
  columns,
  filename,
  label = 'Export CSV',
}: ExportButtonProps<T>) {
  function handleExport() {
    const csv = toCsv(rows, columns)
    downloadCsv(`${filename}-${dateStamp()}`, csv)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="flex items-center gap-1.5 border px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download size={15} />
      {label}
    </button>
  )
}
