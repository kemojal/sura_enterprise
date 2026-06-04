import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export const saleStatusEnum = pgEnum('sale_status', ['completed', 'credit'])

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
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
  status: saleStatusEnum('status').notNull().default('completed'),
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
