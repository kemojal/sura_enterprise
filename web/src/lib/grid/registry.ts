import { z } from 'zod'
import type { PgTable } from 'drizzle-orm/pg-core'

import { suppliers } from '#/db/schema'
import type { Resource, StaffRole } from '#/lib/permissions'

export type CellKind = 'text' | 'number' | 'currency' | 'enum' | 'boolean'
export type NonOwnerRole = Exclude<StaffRole, 'owner'>

export interface FieldDef {
  key: string // drizzle column property + logical field key
  label: string
  kind: CellKind
  validator: z.ZodType // validates + normalizes the incoming value
  financial?: boolean
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
}

export function getResource(resource: string): ResourceDef | undefined {
  return REGISTRY[resource]
}

export function getField(resource: string, field: string): FieldDef | undefined {
  return REGISTRY[resource]?.fields.find((f) => f.key === field)
}
