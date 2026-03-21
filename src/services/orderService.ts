import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
import type {
  Order,
  OrderWithItems,
  OrderItemWithProduct,
  OrderPayment,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Product,
} from '@/types'

const ORDERS = 'orders'
const ORDER_ITEMS = 'order_items'
const ORDER_PAYMENTS = 'order_payments'
const PRODUCTS = 'products'

type OrderFilters = {
  status?: OrderStatus
  type?: OrderType
  search?: string
  from?: string
  to?: string
}

type OrderRow = {
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
  order_payments?: Array<{ id: string; payment_method: PaymentMethod; amount: number }>
}

function toOrderWithItems(row: OrderRow): OrderWithItems {
  const { order_items, order_payments, ...order } = row
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
  const payments: OrderPayment[] | undefined = (order_payments ?? []).length
    ? (order_payments ?? []).map((p) => ({
        id: p.id,
        payment_method: p.payment_method,
        amount: Number(p.amount),
      }))
    : undefined
  return { ...order, items, payments }
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

  let orders = (data ?? []).map((row) => toOrderWithItems(row as OrderRow))

  if (filters?.search?.trim()) {
    const search = filters.search.trim().toLowerCase()
    orders = orders.filter((o) =>
      String(o.order_number).toLowerCase().includes(search)
    )
  }

  const orderIds = orders.map((o) => o.id)
  if (orderIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from(ORDER_PAYMENTS)
      .select('id, order_id, payment_method, amount')
      .in('order_id', orderIds)
    if (paymentsData && paymentsData.length > 0) {
      const byOrderId = new Map<string, OrderPayment[]>()
      for (const p of paymentsData as Array<{ id: string; order_id: string; payment_method: PaymentMethod; amount: number }>) {
        const list = byOrderId.get(p.order_id) ?? []
        list.push({ id: p.id, payment_method: p.payment_method, amount: Number(p.amount) })
        byOrderId.set(p.order_id, list)
      }
      orders = orders.map((o) => ({
        ...o,
        payments: byOrderId.get(o.id),
      }))
    }
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

  const order = toOrderWithItems(data as OrderRow)
  const { data: paymentsData } = await supabase
    .from(ORDER_PAYMENTS)
    .select('id, payment_method, amount')
    .eq('order_id', id)
  if (paymentsData && paymentsData.length > 0) {
    order.payments = (paymentsData as Array<{ id: string; payment_method: PaymentMethod; amount: number }>).map(
      (p) => ({ id: p.id, payment_method: p.payment_method, amount: Number(p.amount) })
    )
  }
  return order
}

export async function createOrder(data: {
  type: OrderType
  /** Multiple payments with amounts; sum must equal order total */
  payments: { payment_method: PaymentMethod; amount: number }[]
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

  const payments = (data.payments ?? []).filter((p) => p.amount > 0)
  const paymentsSum = payments.reduce((s, p) => s + p.amount, 0)
  if (payments.length > 0 && Math.abs(paymentsSum - total_amount) > 0.01) {
    throw new Error(
      `Payment total (${paymentsSum}) must equal order total (${total_amount})`
    )
  }

  const { data: maxOrder, error: maxError } = await supabase
    .from(ORDERS)
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) throw maxError
  const order_number = (maxOrder?.order_number ?? 0) + 1

  const payment_method: PaymentMethod | null =
    payments.length > 0 ? payments[0].payment_method : null

  const orderPayload = {
    order_number,
    type: data.type,
    status: 'pending' as OrderStatus,
    payment_method,
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

  if (payments.length > 0) {
    const paymentsPayload = payments.map((p) => ({
      order_id: orderId,
      payment_method: p.payment_method,
      amount: p.amount,
    }))
    const { error: paymentsError } = await supabase
      .from(ORDER_PAYMENTS)
      .insert(paymentsPayload)
    if (paymentsError) {
      const msg = paymentsError.message ?? ''
      const tableMissing =
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        paymentsError.code === '42P01'
      if (tableMissing) {
        console.warn(
          'order_payments table missing. Run migration 002_order_payments.sql. Order created with primary payment method only.'
        )
      } else {
        throw paymentsError
      }
    }
  }

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
