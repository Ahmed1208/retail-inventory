import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
import type {
  Order,
  OrderWithItems,
  OrderItemWithProduct,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Product,
} from '@/types'

const ORDERS = 'orders'
const ORDER_ITEMS = 'order_items'
const PRODUCTS = 'products'

type OrderFilters = {
  status?: OrderStatus
  type?: OrderType
  search?: string
  from?: string
  to?: string
}

function toOrderWithItems(row: {
  id: string
  order_number: number
  type: OrderType
  status: OrderStatus
  payment_method: PaymentMethod | null
  note: string | null
  total_amount: number
  created_at: string
  updated_at: string
  order_items?: Array<{
    id: string
    order_id: string
    product_id: string
    quantity: number
    unit_price: number
    total_price: number
    created_at: string
    product: Product
  }>
}): OrderWithItems {
  const { order_items, ...order } = row
  const items: OrderItemWithProduct[] = (order_items ?? []).map((oi) => ({
    id: oi.id,
    order_id: oi.order_id,
    product_id: oi.product_id,
    quantity: oi.quantity,
    unit_price: oi.unit_price,
    total_price: oi.total_price,
    created_at: oi.created_at,
    product: oi.product,
  }))
  return { ...order, items }
}

export async function getAllOrders(
  filters?: OrderFilters
): Promise<OrderWithItems[]> {
  let query = supabase
    .from(ORDERS)
    .select(
      `
      *,
      order_items(
        *,
        product:products(*)
      )
    `
    )
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.type) {
    query = query.eq('type', filters.type)
  }
  if (filters?.from) {
    query = query.gte('created_at', filters.from)
  }
  if (filters?.to) {
    const toEndOfDay = new Date(filters.to)
    toEndOfDay.setHours(23, 59, 59, 999)
    query = query.lte('created_at', toEndOfDay.toISOString())
  }

  const { data, error } = await query

  if (error) throw error

  let orders = (data ?? []).map(toOrderWithItems)

  if (filters?.search?.trim()) {
    const search = filters.search.trim().toLowerCase()
    orders = orders.filter((o) =>
      String(o.order_number).toLowerCase().includes(search)
    )
  }

  return orders
}

export async function getOrderById(
  id: string
): Promise<OrderWithItems | null> {
  const { data, error } = await supabase
    .from(ORDERS)
    .select(
      `
      *,
      order_items(
        *,
        product:products(*)
      )
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return toOrderWithItems(data as Parameters<typeof toOrderWithItems>[0])
}

export async function createOrder(data: {
  type: OrderType
  payment_method: PaymentMethod | null
  note?: string
  items: { product_id: string; quantity: number; unit_price: number }[]
}): Promise<OrderWithItems> {
  if (!data.items.length) {
    throw new Error('Order must have at least one item')
  }

  const productIds = [...new Set(data.items.map((i) => i.product_id))]
  const { data: products, error: productsError } = await supabase
    .from(PRODUCTS)
    .select('id, quantity')
    .in('id', productIds)

  if (productsError) throw productsError

  const productMap = new Map(
    (products as { id: string; quantity: number }[]).map((p) => [p.id, p])
  )

  for (const item of data.items) {
    const product = productMap.get(item.product_id)
    if (!product) {
      throw new Error(`Product not found: ${item.product_id}`)
    }
    if (product.quantity < item.quantity) {
      throw new Error(
        `Insufficient stock for product ${item.product_id}: has ${product.quantity}, need ${item.quantity}`
      )
    }
  }

  const total_amount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  )

  const { data: maxOrder, error: maxError } = await supabase
    .from(ORDERS)
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) throw maxError
  const order_number = (maxOrder?.order_number ?? 0) + 1

  const orderPayload = {
    order_number,
    type: data.type,
    status: 'pending' as OrderStatus,
    payment_method: data.payment_method,
    note: data.note ?? null,
    total_amount,
  }

  const { data: insertedOrder, error: orderError } = await supabase
    .from(ORDERS)
    .insert(orderPayload)
    .select()
    .single()

  if (orderError) throw orderError

  const orderId = (insertedOrder as Order).id

  const itemsPayload = data.items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.quantity * item.unit_price,
  }))

  const { error: itemsError } = await supabase
    .from(ORDER_ITEMS)
    .insert(itemsPayload)

  if (itemsError) throw itemsError

  for (const item of data.items) {
    await adjustStock(item.product_id, 'out', item.quantity)
  }

  const created = await getOrderById(orderId)
  if (!created) throw new Error('Failed to fetch created order')
  return created
}

export async function cancelOrder(id: string): Promise<void> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  if (order.status === 'cancelled') {
    throw new Error('Order is already cancelled')
  }

  const { error: updateError } = await supabase
    .from(ORDERS)
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) throw updateError

  const note = `Restored from cancelled order #${order.order_number}`

  for (const item of order.items) {
    await adjustStock(item.product_id, 'in', item.quantity, note)
  }
}

export async function updateOrderNote(
  id: string,
  note: string
): Promise<Order> {
  const { data, error } = await supabase
    .from(ORDERS)
    .update({
      note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Order
}
