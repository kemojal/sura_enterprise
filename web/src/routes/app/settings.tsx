import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { can } from '#/lib/permissions'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty =
    name !== shop.name ||
    address !== (shop.address ?? '') ||
    phone !== (shop.phone ?? '') ||
    currency !== shop.currency

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
