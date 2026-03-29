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

export type StockMovementType = 'in' | 'out' | 'adjustment'

export interface StockMovement {
  id: string
  product_id: string
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
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export type PersonRole = 'customer' | 'supplier'
export type BalanceTransactionType =
  | 'order'
  | 'purchase_order'
  | 'payment_in'
  | 'payment_out'
  | 'adjustment'

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
  person_id: string
  type: BalanceTransactionType
  amount: number
  reference_id: string | null
  reference_number: string | null
  note: string | null
  created_at: string
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

export type PurchaseOrderStatus = 'received' | 'cancelled'

export interface PurchaseOrder {
  id: string
  order_number: number
  supplier_name: string | null
  note: string | null
  total_amount: number
  status: PurchaseOrderStatus
  person_id: string | null
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
