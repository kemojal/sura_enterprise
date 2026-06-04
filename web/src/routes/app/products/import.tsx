import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ArrowLeft, Upload, CheckCircle2, AlertCircle } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { parseCsv } from '#/lib/csv'
import { can } from '#/lib/permissions'
import { bulkImportProducts } from '#/lib/products'

export const Route = createFileRoute('/app/products/import')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/products' })
  },
  component: ImportPage,
})

interface ParsedRow {
  name: string
  categoryName?: string
  buyingPrice: string
  sellingPrice: string
  stockQty: number
  lowStockThreshold: number
  barcode?: string
  _error?: string
}

// Accept several header spellings (matches the export + common variants)
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find((h) => h.toLowerCase() === k.toLowerCase())
    if (found && row[found]) return row[found]
  }
  return ''
}

function validate(raw: Record<string, string>[]): ParsedRow[] {
  return raw.map((r) => {
    const name = pick(r, 'Name', 'Product', 'Product Name')
    const buyingPrice = pick(r, 'Buying Price', 'Buy', 'Cost')
    const sellingPrice = pick(r, 'Selling Price', 'Sell', 'Price')
    const stock = pick(r, 'Stock', 'Stock Qty', 'Quantity')
    const lowAlert = pick(r, 'Low Stock Alert', 'Low Stock Threshold', 'Low Stock')

    const row: ParsedRow = {
      name,
      categoryName: pick(r, 'Category') || undefined,
      buyingPrice,
      sellingPrice,
      stockQty: Number(stock || 0),
      lowStockThreshold: Number(lowAlert || 5),
      barcode: pick(r, 'Barcode') || undefined,
    }

    if (!name) row._error = 'Missing name'
    else if (!buyingPrice || isNaN(Number(buyingPrice)))
      row._error = 'Invalid buying price'
    else if (!sellingPrice || isNaN(Number(sellingPrice)))
      row._error = 'Invalid selling price'
    else if (isNaN(row.stockQty) || row.stockQty < 0)
      row._error = 'Invalid stock'

    return row
  })
}

function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null)

  const validRows = rows.filter((r) => !r._error)
  const invalidRows = rows.filter((r) => r._error)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = validate(parseCsv(text))
        if (parsed.length === 0) {
          setError('No rows found in file')
          setRows([])
        } else {
          setRows(parsed)
        }
      } catch {
        setError('Could not parse the file')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (validRows.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await bulkImportProducts({
        data: {
          rows: validRows.map((r) => ({
            name: r.name,
            categoryName: r.categoryName,
            buyingPrice: r.buyingPrice,
            sellingPrice: r.sellingPrice,
            stockQty: r.stockQty,
            lowStockThreshold: r.lowStockThreshold,
            barcode: r.barcode,
          })),
        },
      })
      setResult(res)
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/products" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">Import Products</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Upload a CSV with columns: <strong>Name</strong>, Category, Buying Price,
        Selling Price, Stock, Low Stock Alert, Barcode. Products matching an
        existing name are updated; others are created. Tip: export your products
        first to get the exact format.
      </div>

      {/* File picker */}
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload size={15} className="mr-1.5" />
          Choose CSV
        </Button>
        {fileName && <span className="text-sm text-gray-500">{fileName}</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-sm text-green-800">
          <CheckCircle2 size={18} />
          Imported successfully — {result.created} created, {result.updated} updated.
          <Link to="/app/products" className="ml-auto font-medium underline">
            View products
          </Link>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && !result && (
        <>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 size={15} />
              {validRows.length} valid
            </span>
            {invalidRows.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <AlertCircle size={15} />
                {invalidRows.length} skipped
              </span>
            )}
          </div>

          <div className="border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium text-right">Buy</th>
                  <th className="px-3 py-2 font-medium text-right">Sell</th>
                  <th className="px-3 py-2 font-medium text-right">Stock</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2 text-gray-900">{r.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {r.categoryName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.buyingPrice || '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.sellingPrice || '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.stockQty}
                    </td>
                    <td className="px-3 py-2">
                      {r._error ? (
                        <span className="text-xs text-red-600">{r._error}</span>
                      ) : (
                        <span className="text-xs text-green-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={handleImport} disabled={loading || validRows.length === 0}>
            {loading
              ? 'Importing…'
              : `Import ${validRows.length} product${validRows.length === 1 ? '' : 's'}`}
          </Button>
        </>
      )}
    </div>
  )
}
