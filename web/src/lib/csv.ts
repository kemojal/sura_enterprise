type CsvValue = string | number | null | undefined

/**
 * Parse CSV text into an array of row objects keyed by header.
 * Handles quoted fields, escaped quotes (""), and commas/newlines inside quotes.
 */
export function parseCsv(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f.length > 0)) rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  // Trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((f) => f.length > 0)) rows.push(row)
  }

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim()
    })
    return obj
  })
}

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
