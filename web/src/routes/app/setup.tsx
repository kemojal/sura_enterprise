import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { createShop } from '#/lib/shop'

export const Route = createFileRoute('/app/setup')({
  component: SetupPage,
})

function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState('GHS')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createShop({ data: { name, address, phone, currency } })
      await router.navigate({ to: '/app/dashboard' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create shop')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="island-shell min-h-screen flex items-center justify-center p-4">
      <div className="app-card w-full max-w-md p-8 space-y-6">
        <div>
          <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">Set up your shop</h2>
          <p className="text-sm text-sea-ink-soft mt-1">
            Tell us about your business
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="shop-name">Shop name *</Label>
            <Input
              id="shop-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ama's Provisions"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main Street, Accra"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 24 000 0000"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/25 outline-none transition"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="GHS">GHS — Ghanaian Cedi</option>
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="btn-ink w-full text-white" disabled={loading}>
            {loading ? 'Creating shop…' : 'Create shop'}
          </Button>
        </form>
      </div>
    </div>
  )
}
