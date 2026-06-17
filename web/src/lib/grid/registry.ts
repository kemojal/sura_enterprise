import { z } from 'zod'
import type { PgTable } from 'drizzle-orm/pg-core'

import { expenses, suppliers } from '#/db/schema'
import type { Resource, StaffRole } from '#/lib/permissions'
import { expenseCats } from '#/lib/expenses'

export type CellKind = 'text' | 'number' | 'currency' | 'enum' | 'boolean' | 'date'
export type NonOwnerRole = Exclude<StaffRole, 'owner'>

export interface FieldDef {
  key: string // drizzle column property + logical field key
  label: string
  kind: CellKind
  validator: z.ZodType // validates + normalizes the incoming value
  financial?: boolean
  displayOnly?: boolean // shown in the grid but never editable (e.g. timestamps)
  options?: ReadonlyArray<{ value: string; label: string }> // for enum fields
  editableByDefault?: Partial<Record<NonOwnerRole, boolean>>
}

export interface ResourceDef {
  resource: string
  entityType: string // for record_locks / field_edits
  permission: Resource // permission gate for the underlying mutation
  table: PgTable
  fields: FieldDef[]
}

// Optional free text: blank string normalizes to null.
const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))

const optionalEmail = z
  .string()
  .trim()
  .email()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: 'Rent',
  electricity: 'Electricity',
  internet: 'Internet',
  salary: 'Salary',
  supplier_payment: 'Supplier Payment',
  transport: 'Transport',
  maintenance: 'Maintenance',
  packaging: 'Packaging',
  misc: 'Miscellaneous',
}

const EXPENSE_CATEGORY_OPTIONS = expenseCats.map((v) => ({
  value: v,
  label: EXPENSE_CATEGORY_LABELS[v] ?? v,
}))

// Coerce a number or numeric string to a non-negative 2-decimal string
// (the amount column is a Postgres numeric stored as a string).
const currency = z
  .coerce.number()
  .finite()
  .nonnegative()
  .transform((n) => n.toFixed(2))

export const REGISTRY: Record<string, ResourceDef> = {
  suppliers: {
    resource: 'suppliers',
    entityType: 'supplier',
    permission: 'suppliers',
    table: suppliers,
    fields: [
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        validator: z.string().trim().min(1).max(200),
        editableByDefault: { manager: true },
      },
      {
        key: 'phone',
        label: 'Phone',
        kind: 'text',
        validator: optionalText,
        editableByDefault: { manager: true },
      },
      {
        key: 'email',
        label: 'Email',
        kind: 'text',
        validator: optionalEmail,
        editableByDefault: { manager: true },
      },
      {
        key: 'address',
        label: 'Address',
        kind: 'text',
        validator: optionalText,
        editableByDefault: { manager: true },
      },
      {
        key: 'notes',
        label: 'Notes',
        kind: 'text',
        validator: optionalText,
        editableByDefault: { manager: true },
      },
    ],
  },
  expenses: {
    resource: 'expenses',
    entityType: 'expense',
    permission: 'expenses',
    table: expenses,
    fields: [
      { key: 'date', label: 'Date', kind: 'date', validator: z.any(), displayOnly: true },
      {
        key: 'category', label: 'Category', kind: 'enum',
        validator: z.enum(expenseCats), options: EXPENSE_CATEGORY_OPTIONS,
        editableByDefault: { manager: true },
      },
      {
        key: 'description', label: 'Description', kind: 'text',
        validator: optionalText, editableByDefault: { manager: true },
      },
      {
        key: 'amount', label: 'Amount', kind: 'currency',
        validator: currency, financial: true, editableByDefault: { manager: false },
      },
    ],
  },
}

export function getResource(resource: string): ResourceDef | undefined {
  return REGISTRY[resource]
}

export function getField(resource: string, field: string): FieldDef | undefined {
  return getResource(resource)?.fields.find((f) => f.key === field)
}
