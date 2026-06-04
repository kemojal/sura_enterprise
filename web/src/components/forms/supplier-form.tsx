import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { createSupplier } from '#/lib/suppliers'

interface SupplierFormProps {
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

export function SupplierForm({ onCancel, onSaved }: SupplierFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createSupplier({ data: { name, phone, email, address, notes } })
      await onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="su-name">Name *</Label>
        <Input
          id="su-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="su-phone">Phone</Label>
        <Input
          id="su-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="su-email">Email</Label>
        <Input
          id="su-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="su-addr">Address</Label>
        <Input
          id="su-addr"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="su-notes">Notes</Label>
        <Textarea
          id="su-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save supplier'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
