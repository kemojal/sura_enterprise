import { useState } from 'react'

import { createCustomer } from '#/lib/customers'
import { FormActions, FormField, FormTextarea, useFormSubmit } from './field'

interface CustomerFormProps {
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

export function CustomerForm({ onCancel, onSaved }: CustomerFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const { loading, error, handleSubmit } = useFormSubmit(async () => {
    await createCustomer({ data: { name, phone, email, notes } })
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
      <FormTextarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <FormActions
        loading={loading}
        error={error}
        saveLabel="Save customer"
        onCancel={onCancel}
      />
    </form>
  )
}
