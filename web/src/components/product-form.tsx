import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { getProductImageUploadUrl } from '#/lib/r2'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface ProductFormValues {
  name: string
  categoryId?: string
  buyingPrice: string
  sellingPrice: string
  stockQty: number
  lowStockThreshold: number
  expiryDate?: string
  imageUrl?: string
  barcode?: string
}

interface Props {
  defaultValues?: Partial<ProductFormValues>
  categories: { id: string; name: string }[]
  onSubmit: (values: ProductFormValues) => Promise<void>
  onCancel: () => void
  loading?: boolean
  error?: string
}

export function ProductForm({
  defaultValues,
  categories,
  onSubmit,
  onCancel,
  loading,
  error,
}: Props) {
  const [values, setValues] = useState<ProductFormValues>({
    name: defaultValues?.name ?? '',
    categoryId: defaultValues?.categoryId ?? '',
    buyingPrice: defaultValues?.buyingPrice ?? '',
    sellingPrice: defaultValues?.sellingPrice ?? '',
    stockQty: defaultValues?.stockQty ?? 0,
    lowStockThreshold: defaultValues?.lowStockThreshold ?? 5,
    expiryDate: defaultValues?.expiryDate ?? '',
    imageUrl: defaultValues?.imageUrl ?? '',
    barcode: defaultValues?.barcode ?? '',
  })
  const [imagePreview, setImagePreview] = useState<string>(defaultValues?.imageUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Max file size is 5MB')
      return
    }

    setUploading(true)
    setUploadError('')

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const { uploadUrl, objectUrl } = await getProductImageUploadUrl({
        data: { filename: file.name, contentType: file.type },
      })

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)

      set('imageUrl', objectUrl)
      setImagePreview(objectUrl)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setImagePreview('')
      set('imageUrl', '')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function clearImage() {
    set('imageUrl', '')
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {/* Image upload */}
      <div className="space-y-2">
        <Label>Product image</Label>
        {imagePreview ? (
          <div className="relative w-32 h-32">
            <img
              src={imagePreview}
              alt="Product"
              className="w-32 h-32 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 shadow hover:bg-gray-50"
            >
              <X size={14} className="text-gray-600" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <ImagePlus size={24} className="text-gray-400" />
            <span className="text-xs text-gray-400 mt-2">
              {uploading ? 'Uploading…' : 'Add image'}
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="pf-name">Product name *</Label>
        <Input
          id="pf-name"
          required
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="pf-cat">Category</Label>
        <select
          id="pf-cat"
          className="w-full border rounded-md px-3 py-2 text-sm"
          value={values.categoryId ?? ''}
          onChange={(e) => set('categoryId', e.target.value || undefined)}
        >
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="pf-buy">Buying price *</Label>
          <Input
            id="pf-buy"
            required
            type="number"
            step="0.01"
            min="0"
            value={values.buyingPrice}
            onChange={(e) => set('buyingPrice', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pf-sell">Selling price *</Label>
          <Input
            id="pf-sell"
            required
            type="number"
            step="0.01"
            min="0"
            value={values.sellingPrice}
            onChange={(e) => set('sellingPrice', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="pf-stock">Stock quantity</Label>
          <Input
            id="pf-stock"
            type="number"
            min="0"
            value={values.stockQty}
            onChange={(e) => set('stockQty', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pf-low">Low stock alert at</Label>
          <Input
            id="pf-low"
            type="number"
            min="0"
            value={values.lowStockThreshold}
            onChange={(e) => set('lowStockThreshold', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="pf-expiry">Expiry date</Label>
        <Input
          id="pf-expiry"
          type="date"
          value={values.expiryDate ?? ''}
          onChange={(e) => set('expiryDate', e.target.value || undefined)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="pf-barcode">Barcode</Label>
        <Input
          id="pf-barcode"
          value={values.barcode ?? ''}
          onChange={(e) => set('barcode', e.target.value || undefined)}
          placeholder="EAN-13, QR, or custom code"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || uploading}>
          {loading ? 'Saving…' : 'Save product'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
