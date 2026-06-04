import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { addStaff } from '#/lib/staff'

interface StaffFormProps {
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

export function StaffForm({ onCancel, onSaved }: StaffFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'manager' | 'cashier'>('cashier')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await addStaff({ data: { name, email, role, password } })
      await onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add staff')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="st-name">Full name *</Label>
        <Input
          id="st-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="st-email">Email *</Label>
        <Input
          id="st-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label>Role</Label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as 'manager' | 'cashier')}
        >
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="st-pass">Temporary password *</Label>
        <Input
          id="st-pass"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Adding…' : 'Add staff'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
