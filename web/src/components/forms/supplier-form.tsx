import { useState } from 'react'

import { createSupplier } from '#/lib/suppliers'
import { FormActions, FormField, FormTextarea, useFormSubmit } from './field'

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

  const { loading, error, handleSubmit } = useFormSubmit(async () => {
    await createSupplier({ data: { name, phone, email, address, notes } })
    await onSaved()
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <FormField
        label="Phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <FormField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FormField
        label="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <FormTextarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <FormActions
        loading={loading}
        error={error}
        saveLabel="Save supplier"
        onCancel={onCancel}
      />
    </form>
  )
}
