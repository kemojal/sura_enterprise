import { useState } from 'react'

import { addStaff } from '#/lib/staff'
import { FormActions, FormField, FormSelect, useFormSubmit } from './field'

interface StaffFormProps {
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

export function StaffForm({ onCancel, onSaved }: StaffFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'manager' | 'cashier'>('cashier')
  const [password, setPassword] = useState('')

  const { loading, error, handleSubmit } = useFormSubmit(async () => {
    await addStaff({ data: { name, email, role, password } })
    await onSaved()
  }, 'Failed to add staff')

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Full name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <FormField
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FormSelect
        label="Role"
        value={role}
        onChange={(v) => setRole(v as 'manager' | 'cashier')}
        options={[
          { value: 'cashier', label: 'Cashier' },
          { value: 'manager', label: 'Manager' },
        ]}
      />
      <FormField
        label="Temporary password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <FormActions
        loading={loading}
        error={error}
        saveLabel="Add staff"
        onCancel={onCancel}
      />
    </form>
  )
}
