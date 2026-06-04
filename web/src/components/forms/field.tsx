import { useId, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'

/**
 * Shared submit handling for the simple create-forms: tracks loading + error
 * and wraps the async action in the standard try/catch/finally.
 */
export function useFormSubmit(action: () => Promise<void>, fallbackError = 'Failed to save') {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await action()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : fallbackError)
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, handleSubmit }
}

interface FieldBaseProps {
  label: string
  required?: boolean
  hint?: string
}

type FormFieldProps = FieldBaseProps &
  Omit<React.ComponentProps<typeof Input>, 'id'>

/** Label + Input in the standard `space-y-1` wrapper used across all forms. */
export function FormField({ label, required, hint, ...inputProps }: FormFieldProps) {
  const id = useId()
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required && ' *'}
      </Label>
      <Input id={id} required={required} {...inputProps} />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

type FormTextareaProps = FieldBaseProps &
  Omit<React.ComponentProps<typeof Textarea>, 'id'>

export function FormTextarea({
  label,
  required,
  hint,
  rows = 3,
  ...props
}: FormTextareaProps) {
  const id = useId()
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required && ' *'}
      </Label>
      <Textarea id={id} required={required} rows={rows} {...props} />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

interface FormSelectProps extends FieldBaseProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function FormSelect({
  label,
  required,
  hint,
  value,
  onChange,
  options,
}: FormSelectProps) {
  const id = useId()
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required && ' *'}
      </Label>
      <select
        id={id}
        className="w-full border rounded-md px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

/** Standard error message + Save/Cancel button row shared by every form. */
export function FormActions({
  loading,
  error,
  saveLabel = 'Save',
  onCancel,
  disabled,
}: {
  loading?: boolean
  error?: string
  saveLabel?: string
  onCancel: () => void
  disabled?: boolean
}) {
  return (
    <>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading || disabled}>
          {loading ? 'Saving…' : saveLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  )
}
