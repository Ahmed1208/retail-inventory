// ============ Base table types (match Supabase schema) ============

export interface Product {
  id: string
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
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export interface Order {
  id: string
  order_number: number
  type: OrderType
  status: OrderStatus
  payment_method: PaymentMethod | null
  note: string | null
  total_amount: number
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

export interface OrderWithItems extends Order {
  items: OrderItemWithProduct[]
  /** When present, order was paid with multiple methods; otherwise use payment_method */
  payments?: OrderPayment[]
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
