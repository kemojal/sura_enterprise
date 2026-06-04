import { useState } from 'react'

import { createExpense } from '#/lib/expenses'
import { FormActions, FormField, FormSelect, FormTextarea, useFormSubmit } from './field'

const categories = [
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'internet', label: 'Internet' },
  { value: 'salary', label: 'Salary' },
  { value: 'supplier_payment', label: 'Supplier Payment' },
  { value: 'transport', label: 'Transport' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'misc', label: 'Miscellaneous' },
] as const

type ExpenseCategory = (typeof categories)[number]['value']

interface ExpenseFormProps {
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

export function ExpenseForm({ onCancel, onSaved }: ExpenseFormProps) {
  const [category, setCategory] = useState<ExpenseCategory>('misc')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const { loading, error, handleSubmit } = useFormSubmit(async () => {
    await createExpense({ data: { category, amount, description, date } })
    await onSaved()
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormSelect
        label="Category"
        value={category}
        onChange={(v) => setCategory(v as ExpenseCategory)}
        options={categories.map((c) => ({ value: c.value, label: c.label }))}
      />
      <FormField
        label="Amount"
        required
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <FormField
        label="Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <FormTextarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <FormActions
        loading={loading}
        error={error}
        saveLabel="Save expense"
        onCancel={onCancel}
      />
    </form>
  )
}
