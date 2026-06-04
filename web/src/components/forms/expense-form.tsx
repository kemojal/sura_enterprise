import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { createExpense } from '#/lib/expenses'

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

interface ExpenseFormProps {
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

export function ExpenseForm({ onCancel, onSaved }: ExpenseFormProps) {
  const [category, setCategory] =
    useState<(typeof categories)[number]['value']>('misc')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createExpense({ data: { category, amount, description, date } })
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
        <Label>Category</Label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as (typeof categories)[number]['value'])
          }
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="exp-amount">Amount *</Label>
        <Input
          id="exp-amount"
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="exp-date">Date</Label>
        <Input
          id="exp-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="exp-desc">Description</Label>
        <Textarea
          id="exp-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save expense'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
