// ============ Base table types (match Supabase schema) ============

export interface Product {
  id: string
  /** Unique business / POS id (set manually or auto-generated). */
  product_code: string
  name: string
  brand_id: string | null
  category_id: string | null
  customer_price: number
  business_price: number
  cost_price: number
  /** Moving weighted average cost for on-hand qty; null when qty is 0 or never valued via receipt. */
  average_unit_cost: number | null
  quantity: number
  low_stock_threshold: number
  unit: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Brand {
  id: string
  name: string
  created_at: string
}

export interface Warehouse {
  id: number
  /** Human-readable id, e.g. NASR-CITY-01 (legacy DB may fall back to WH-0001). */
  code: string
  name: string
  location: string | null
  is_default: boolean
  /** When true, this location has a cash register; POS and register-scoped ledger rows attach here. */
  has_register: boolean
  created_at: string
  updated_at: string
}

/** Stock move between two warehouses (no pricing). */
export interface InventoryTransfer {
  id: string
  transfer_number: number
  from_warehouse_id: number
  to_warehouse_id: number
  note: string | null
  created_at: string
  updated_at: string
}

export interface InventoryTransferItem {
  id: string
  transfer_id: string
  product_id: string
  quantity: number
}

export type StockMovementType = 'in' | 'out' | 'adjustment'

export interface StockMovement {
  id: string
  product_id: string
  warehouse_id: number
  type: StockMovementType
  quantity: number
  note: string | null
  created_at: string
}

// ============ Extended / relation types ============

export interface ProductWithRelations extends Omit<Product, 'brand_id' | 'category_id'> {
  brand: Brand | null
  category: Category | null
}

/** Append-only snapshot of catalog prices after a change (see product_price_history). */
export interface ProductPriceHistory {
  id: string
  product_id: string
  recorded_at: string
  customer_price: number
  business_price: number
  cost_price: number
}

export interface DashboardStats {
  totalProducts: number
  totalValue: number
  lowStockCount: number
  todayMovements: number
  totalPurchasesToday: number
  totalReceivables: number
  totalPayables: number
}

export interface StockMovementWithProduct extends StockMovement {
  product: Product
}

/** Movement with product that includes brand (for list views) */
export interface StockMovementWithProductDetails extends StockMovement {
  product: Product & { brand: Brand | null }
}

// ============ Order types ============

export type OrderType = 'retail' | 'wholesale'
export type OrderStatus = 'pending' | 'completed' | 'cancelled'
export type OrderStatusFlow = 'draft' | 'confirmed' | 'completed' | 'cancelled'
export type PaymentMethod = 'cash' | 'visa' | 'cheque' | 'instapay'

export type PersonRole = 'customer' | 'supplier'
export type BalanceTransactionType =
  | 'order'
  | 'purchase_order'
  | 'payment_in'
  | 'payment_out'
  | 'adjustment'
  | 'wallet'
  | 'register_deposit'
  | 'register_withdraw'

export type WalletDirection = 'in' | 'out'

export interface Person {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  roles: PersonRole[]
  balance: number
  discount_rate: number
  credit_limit: number | null
  created_at: string
  updated_at: string
}

export interface BalanceTransaction {
  id: string
  /** Null for walk-in sales: ledger row only, no linked person balance. */
  person_id: string | null
  type: BalanceTransactionType
  amount: number
  reference_id: string | null
  reference_number: string | null
  note: string | null
  /** Set for payment_in / payment_out rows when recorded with a method (split lines). */
  payment_method: PaymentMethod | null
  /** Same UUID on all lines of one split payment; null for single-line or legacy rows. */
  payment_group_id: string | null
  /** Set when type is `wallet` (overpayment credit). */
  wallet_direction: WalletDirection | null
  /** Cash register / drawer warehouse for register-affecting rows; null for wallet-only etc. */
  register_warehouse_id: number | null
  created_at: string
  /** Set when this row was undone by a reversal (migration 013+). */
  reversed_at?: string | null
}

export interface BalanceTransactionWithPerson extends BalanceTransaction {
  person: Person
}

export interface PersonWithTransactions extends Person {
  transactions: BalanceTransaction[]
}

export interface Order {
  id: string
  order_number: number
  type: OrderType
  status: OrderStatus
  status_flow: OrderStatusFlow
  payment_method: PaymentMethod | null
  note: string | null
  total_amount: number
  person_id: string | null
  paid_amount: number
  remaining_amount: number
  discount_amount: number
  discount_rate: number
  subtotal: number
  allow_remaining_on_account: boolean
  warehouse_id: number
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  line_discount_rate: number
  created_at: string
}

export interface OrderItemWithProduct extends OrderItem {
  product: Product
}

/** Single payment method and amount (for split payments) */
export interface OrderPayment {
  id?: string
  payment_method: PaymentMethod
  amount: number
}

export interface PaymentInstallment {
  id: string
  order_id: string
  method: PaymentMethod
  amount: number
  note: string | null
  created_at: string
}

export interface OrderWithItems extends Order {
  items: OrderItemWithProduct[]
  /** When present, order was paid with multiple methods; otherwise use payment_method */
  payments?: OrderPayment[]
}

export interface OrderWithItemsAndPayments extends OrderWithItems {
  payment_installments: PaymentInstallment[]
}

// ============ Purchase Order types ============

export type PurchaseOrderStatus = 'draft' | 'received' | 'cancelled'

export interface PurchaseOrder {
  id: string
  order_number: number
  supplier_name: string | null
  note: string | null
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: PurchaseOrderStatus
  person_id: string | null
  warehouse_id: number
  created_at: string
  updated_at: string
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  cost_price: number
  total_price: number
  previous_cost_price: number | null
  cost_price_updated: boolean
  /** When set with catalog_business_price and cost_price_updated, receive updates all three catalog prices. */
  catalog_customer_price: number | null
  catalog_business_price: number | null
  /** Product snapshot at PO line insert for cancel rollback. */
  previous_customer_price: number | null
  previous_business_price: number | null
  created_at: string
}

export interface PurchaseOrderItemWithProduct extends PurchaseOrderItem {
  product: Product
}

/** Single payment method and amount for a purchase order (split payments) */
export interface PurchaseOrderPayment {
  id?: string
  payment_method: PaymentMethod
  amount: number
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItemWithProduct[]
  /** When present, PO was paid with multiple methods */
  payments?: PurchaseOrderPayment[]
}
