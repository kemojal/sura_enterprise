type CsvValue = string | number | null | undefined

/**
 * Convert an array of objects to CSV text.
 * columns: ordered list of [header, accessor] pairs.
 */
export function toCsv<T>(
  rows: T[],
  columns: { header: string; value: (row: T) => CsvValue }[],
): string {
  const escape = (v: CsvValue): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    // Quote if it contains comma, quote, or newline
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const headerLine = columns.map((c) => escape(c.header)).join(',')
  const dataLines = rows.map((row) =>
    columns.map((c) => escape(c.value(row))).join(','),
  )

  return [headerLine, ...dataLines].join('\n')
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  // Prepend BOM so Excel opens UTF-8 (₵, etc.) correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
