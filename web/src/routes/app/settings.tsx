import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { can } from '#/lib/permissions'
import { getShopLogoUploadUrl } from '#/lib/r2'
import { getShopSettings, updateShop } from '#/lib/shop'

export const Route = createFileRoute('/app/settings')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'settings')) throw redirect({ to: '/app/dashboard' })
  },
  loader: () => getShopSettings(),
  component: SettingsPage,
})

const currencies = [
  { value: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'KES', label: 'KES — Kenyan Shilling' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'UGX', label: 'UGX — Ugandan Shilling' },
  { value: 'TZS', label: 'TZS — Tanzanian Shilling' },
]

function SettingsPage() {
  const shop = Route.useLoaderData()
  const router = useRouter()

  const [name, setName] = useState(shop.name)
  const [address, setAddress] = useState(shop.address ?? '')
  const [phone, setPhone] = useState(shop.phone ?? '')
  const [currency, setCurrency] = useState(shop.currency)
  const [logoUrl, setLogoUrl] = useState(shop.logoUrl ?? '')
  const [receiptFooter, setReceiptFooter] = useState(shop.receiptFooter ?? '')
  const [taxRate, setTaxRate] = useState(shop.taxRate ?? '0')
  const [taxInclusive, setTaxInclusive] = useState(shop.taxInclusive ?? true)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const dirty =
    name !== shop.name ||
    address !== (shop.address ?? '') ||
    phone !== (shop.phone ?? '') ||
    currency !== shop.currency ||
    logoUrl !== (shop.logoUrl ?? '') ||
    receiptFooter !== (shop.receiptFooter ?? '') ||
    taxRate !== (shop.taxRate ?? '0') ||
    taxInclusive !== (shop.taxInclusive ?? true)

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image')
      return
    }
    setUploadingLogo(true)
    setError('')
    try {
      const { uploadUrl, objectUrl } = await getShopLogoUploadUrl({
        data: { filename: file.name, contentType: file.type },
      })
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      setLogoUrl(objectUrl)
      setSaved(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Logo upload failed')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      await updateShop({
        data: {
          name,
          address: address || undefined,
          phone: phone || undefined,
          currency,
          logoUrl: logoUrl || undefined,
          receiptFooter: receiptFooter || undefined,
          taxRate: taxRate || '0',
          taxInclusive,
        },
      })
      setSaved(true)
      router.invalidate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Shop Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Update your shop profile and preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            Shop Profile
          </h3>

          <div className="space-y-1">
            <Label htmlFor="s-name">Shop name *</Label>
            <Input
              id="s-name"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false) }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="s-addr">Address</Label>
            <Input
              id="s-addr"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setSaved(false) }}
              placeholder="123 Main Street, Accra"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="s-phone">Phone</Label>
            <Input
              id="s-phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSaved(false) }}
              placeholder="+233 24 000 0000"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            Regional
          </h3>

          <div className="space-y-1">
            <Label htmlFor="s-currency">Currency</Label>
            <select
              id="s-currency"
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setSaved(false) }}
            >
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Changing currency affects all new receipts and reports. Existing
              records keep their original values.
            </p>
          </div>
        </div>

        {/* Tax */}
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            Tax / VAT
          </h3>

          <div className="space-y-1">
            <Label htmlFor="s-taxrate">Tax rate (%)</Label>
            <Input
              id="s-taxrate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => { setTaxRate(e.target.value); setSaved(false) }}
              className="max-w-32"
            />
            <p className="text-xs text-gray-400 mt-1">
              Set to 0 to disable tax. Applied to every new sale.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Pricing mode</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setTaxInclusive(true); setSaved(false) }}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm text-left ${taxInclusive ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <span className="font-medium block">Tax inclusive</span>
                <span className="text-xs text-gray-500">
                  Prices already include tax
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setTaxInclusive(false); setSaved(false) }}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm text-left ${!taxInclusive ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <span className="font-medium block">Tax exclusive</span>
                <span className="text-xs text-gray-500">
                  Tax added at checkout
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Receipt customization */}
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            Receipt
          </h3>

          <div className="space-y-2">
            <Label>Shop logo</Label>
            {logoUrl ? (
              <div className="relative inline-block">
                <img
                  src={logoUrl}
                  alt="Shop logo"
                  className="h-20 w-20 object-contain rounded-lg border bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => { setLogoUrl(''); setSaved(false) }}
                  className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 shadow hover:bg-gray-50"
                >
                  <X size={14} className="text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
              >
                <ImagePlus size={20} className="text-gray-400" />
                <span className="text-[10px] text-gray-400 mt-1">
                  {uploadingLogo ? 'Uploading…' : 'Add logo'}
                </span>
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogo}
            />
            <p className="text-xs text-gray-400">
              Shown at the top of printed receipts.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="s-footer">Receipt footer message</Label>
            <Textarea
              id="s-footer"
              rows={2}
              value={receiptFooter}
              onChange={(e) => { setReceiptFooter(e.target.value); setSaved(false) }}
              placeholder="Thank you for your business!"
            />
            <p className="text-xs text-gray-400">
              Appears at the bottom of receipts and WhatsApp messages. Leave
              blank for the default.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="text-sm text-green-700 font-medium">
            Settings saved successfully.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || !dirty}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
          {dirty && !loading && (
            <span className="text-xs text-gray-400">Unsaved changes</span>
          )}
        </div>
      </form>
    </div>
  )
}
