export type StaffRole = 'owner' | 'manager' | 'cashier'

export type Resource =
  | 'products'
  | 'products:write'
  | 'categories'
  | 'sales'
  | 'expenses'
  | 'staff'
  | 'customers'
  | 'customers:write'
  | 'suppliers'
  | 'purchase_orders'
  | 'activity'
  | 'cash'
  | 'reports'
  | 'dashboard'
  | 'settings'

const matrix: Record<Resource, StaffRole[]> = {
  dashboard: ['owner', 'manager', 'cashier'],
  products: ['owner', 'manager', 'cashier'],
  'products:write': ['owner', 'manager'],
  categories: ['owner', 'manager'],
  sales: ['owner', 'manager', 'cashier'],
  expenses: ['owner', 'manager'],
  staff: ['owner'],
  customers: ['owner', 'manager', 'cashier'],
  'customers:write': ['owner', 'manager'],
  suppliers: ['owner', 'manager'],
  purchase_orders: ['owner', 'manager'],
  activity: ['owner', 'manager'],
  cash: ['owner', 'manager'],
  reports: ['owner', 'manager'],
  settings: ['owner'],
}

export function can(role: StaffRole, resource: Resource): boolean {
  return matrix[resource].includes(role)
}

export function requireRole(role: StaffRole, resource: Resource): void {
  if (!can(role, resource)) {
    throw new Error(`Access denied: ${resource} requires ${matrix[resource].join(' or ')}`)
  }
}
