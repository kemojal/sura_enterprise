import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

// ─── better-auth required tables ─────────────────────────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

// ─── Enums ────────────────────────────────────────────────────────────────────

export const staffRoleEnum = pgEnum('staff_role', [
  'owner',
  'manager',
  'cashier',
])

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'credit',
  'mobile_money',
])

export const saleStatusEnum = pgEnum('sale_status', [
  'completed',
  'credit',
  'partially_refunded',
  'refunded',
])

export const expenseCategoryEnum = pgEnum('expense_category', [
  'rent',
  'electricity',
  'internet',
  'salary',
  'supplier_payment',
  'transport',
  'maintenance',
  'packaging',
  'misc',
])

export const poStatusEnum = pgEnum('po_status', [
  'ordered',
  'received',
  'cancelled',
])

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'sent',
  'accepted',
  'declined',
  'converted',
])

export const shiftStatusEnum = pgEnum('shift_status', ['open', 'closed'])

// ─── App tables ───────────────────────────────────────────────────────────────

export const shops = pgTable('shops', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  currency: text('currency').notNull().default('GHS'),
  logoUrl: text('logo_url'),
  receiptFooter: text('receipt_footer'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  taxInclusive: boolean('tax_inclusive').notNull().default(true),
  loyaltyEnabled: boolean('loyalty_enabled').notNull().default(false),
  // Points earned per 1 unit of currency spent
  loyaltyEarnRate: decimal('loyalty_earn_rate', { precision: 8, scale: 4 })
    .notNull()
    .default('1'),
  // Currency value of 1 point when redeemed
  loyaltyPointValue: decimal('loyalty_point_value', { precision: 8, scale: 4 })
    .notNull()
    .default('0.01'),
  dailyTarget: decimal('daily_target', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  monthlyTarget: decimal('monthly_target', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  lowStockAlertsEnabled: boolean('low_stock_alerts_enabled')
    .notNull()
    .default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: staffRoleEnum('role').notNull().default('cashier'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
})

export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  buyingPrice: decimal('buying_price', { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal('selling_price', { precision: 12, scale: 2 }).notNull(),
  stockQty: integer('stock_qty').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  supplierId: text('supplier_id').references(() => suppliers.id, {
    onDelete: 'set null',
  }),
  barcode: text('barcode'),
  expiryDate: timestamp('expiry_date'),
  imageUrl: text('image_url'),
  hasVariants: boolean('has_variants').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  branchId: text('branch_id').references(() => branches.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Variants are the sellable SKUs of a product that has variants (e.g. size,
// colour). When products.hasVariants is true, the parent's own stock/price is
// ignored and these carry stock + price.
export const productVariants = pgTable('product_variants', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g. "Large / Red"
  barcode: text('barcode'),
  buyingPrice: decimal('buying_price', { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal('selling_price', { precision: 12, scale: 2 }).notNull(),
  stockQty: integer('stock_qty').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  notes: text('notes'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sales = pgTable('sales', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  cashierId: text('cashier_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  customerId: text('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  pointsEarned: integer('points_earned').notNull().default(0),
  pointsRedeemed: integer('points_redeemed').notNull().default(0),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
  status: saleStatusEnum('status').notNull().default('completed'),
  shiftId: text('shift_id'),
  branchId: text('branch_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const saleItems = pgTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  variantId: text('variant_id').references(() => productVariants.id, {
    onDelete: 'set null',
  }),
  variantName: text('variant_name'),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
})

// Parked carts — paused mid-checkout, resumed later. Not yet a sale, so no
// stock movement. The cart is a JSON snapshot of line items + discount.
export const heldSales = pgTable('held_sales', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  customerId: text('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  label: text('label'),
  itemsJson: text('items_json').notNull(),
  discountType: text('discount_type'),
  discountValue: text('discount_value'),
  itemCount: integer('item_count').notNull().default(0),
  total: decimal('total', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const saleReturns = pgTable('sale_returns', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  saleId: text('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  refundAmount: decimal('refund_amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const saleReturnItems = pgTable('sale_return_items', {
  id: text('id').primaryKey(),
  returnId: text('return_id')
    .notNull()
    .references(() => saleReturns.id, { onDelete: 'cascade' }),
  saleItemId: text('sale_item_id')
    .notNull()
    .references(() => saleItems.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
})

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  recordedById: text('recorded_by_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  category: expenseCategoryEnum('category').notNull().default('misc'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  date: timestamp('date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Monthly budget per expense category (one row per shop+category).
export const expenseBudgets = pgTable('expense_budgets', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  category: expenseCategoryEnum('category').notNull(),
  monthlyAmount: decimal('monthly_amount', { precision: 12, scale: 2 }).notNull(),
})

export const stockAdjTypeEnum = pgEnum('stock_adj_type', [
  'restock',
  'write_off',
  'correction',
  'initial_count',
])

export const stockAdjustments = pgTable('stock_adjustments', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  type: stockAdjTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(), // positive = increase, negative = decrease
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const customerPayments = pgTable('customer_payments', {
  id: text('id').primaryKey(),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  saleId: text('sale_id').references(() => sales.id, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id').references(() => suppliers.id, {
    onDelete: 'set null',
  }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  status: poStatusEnum('status').notNull().default('ordered'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  notes: text('notes'),
  receivedAt: timestamp('received_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: text('id').primaryKey(),
  poId: text('po_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  quantity: integer('quantity').notNull(),
  unitCost: decimal('unit_cost', { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
})

export const activityLog = pgTable('activity_log', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  actorName: text('actor_name'), // denormalized so log survives staff deletion
  action: text('action').notNull(), // e.g. sale.created, stock.adjusted
  entityType: text('entity_type').notNull(), // sale, product, purchase_order…
  entityId: text('entity_id'),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// End-of-day cash drawer count vs expected cash sales.
export const cashReconciliations = pgTable('cash_reconciliations', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  actorName: text('actor_name'),
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }).notNull(),
  countedCash: decimal('counted_cash', { precision: 12, scale: 2 }).notNull(),
  variance: decimal('variance', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Quotes / proforma invoices — not a sale until converted.
export const quotes = pgTable('quotes', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  status: quoteStatusEnum('status').notNull().default('draft'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  validUntil: timestamp('valid_until'),
  convertedSaleId: text('converted_sale_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const quoteItems = pgTable('quote_items', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  variantId: text('variant_id').references(() => productVariants.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
})

// Cashier shifts — drawer session per cashier; sales link to the open shift.
export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  cashierId: text('cashier_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  cashierName: text('cashier_name'),
  status: shiftStatusEnum('status').notNull().default('open'),
  openingFloat: decimal('opening_float', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  // Filled on close:
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }),
  countedCash: decimal('counted_cash', { precision: 12, scale: 2 }),
  variance: decimal('variance', { precision: 12, scale: 2 }),
  notes: text('notes'),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
})

// Physical branches / locations under one shop. Each product row belongs to a
// branch, giving per-branch stock; a sale records the branch it happened at.
export const branches = pgTable('branches', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  isMain: boolean('is_main').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Stock moved between two branches. Items reference the source product row;
// the matching product row in the destination branch is found or created.
export const stockTransfers = pgTable('stock_transfers', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  fromBranchId: text('from_branch_id')
    .notNull()
    .references(() => branches.id, { onDelete: 'cascade' }),
  toBranchId: text('to_branch_id')
    .notNull()
    .references(() => branches.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  actorName: text('actor_name'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const stockTransferItems = pgTable('stock_transfer_items', {
  id: text('id').primaryKey(),
  transferId: text('transfer_id')
    .notNull()
    .references(() => stockTransfers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull(),
})

// ─── Editable-grid: field permissions, record locks, field-level audit ───────

// Owner-configured per-role × per-field edit rights. Missing row → coded
// default in the registry resolver. Owner is always allowed (never stored).
export const fieldPermissions = pgTable(
  'field_permissions',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    resource: text('resource').notNull(), // 'suppliers' | 'expenses' | …
    field: text('field').notNull(), // registry field key
    role: text('role').notNull(), // 'manager' | 'cashier'
    canEdit: boolean('can_edit').notNull().default(false),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [unique('field_perm_uq').on(t.shopId, t.resource, t.field, t.role)],
)

// A record is LOCKED for staff editing unless an unlocked=true row exists.
// Owner edits always bypass the lock.
export const recordLocks = pgTable(
  'record_locks',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'supplier' | 'expense' | …
    entityId: text('entity_id').notNull(),
    unlocked: boolean('unlocked').notNull().default(false),
    unlockedById: text('unlocked_by_id').references(() => staffMembers.id, {
      onDelete: 'set null',
    }),
    unlockedAt: timestamp('unlocked_at'),
  },
  (t) => [unique('record_lock_uq').on(t.shopId, t.entityType, t.entityId)],
)

// Field-level before→after audit. Actor name denormalized so the trail
// survives staff deletion.
export const fieldEdits = pgTable('field_edits', {
  id: text('id').primaryKey(),
  shopId: text('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').references(() => staffMembers.id, {
    onDelete: 'set null',
  }),
  actorName: text('actor_name'),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
