import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
import { getProductById } from '@/services/productService'
import { updateProduct } from '@/services/productService'
import type {
  PurchaseOrder,
  PurchaseOrderWithItems,
  PurchaseOrderItemWithProduct,
  PurchaseOrderStatus,
  Product,
} from '@/types'

const PURCHASE_ORDERS = 'purchase_orders'
const PURCHASE_ORDER_ITEMS = 'purchase_order_items'

export type PurchaseOrderFilters = {
  status?: PurchaseOrderStatus
  search?: string
  from?: string
  to?: string
}

function toPurchaseOrderWithItems(row: {
  id: string
  order_number: number
  supplier_name: string | null
  note: string | null
  total_amount: number
  status: PurchaseOrderStatus
  created_at: string
  updated_at: string
  purchase_order_items?: Array<{
    id: string
    purchase_order_id: string
    product_id: string
    quantity: number
    cost_price: number
    total_price: number
    previous_cost_price: number | null
    cost_price_updated: boolean
    created_at: string
    product: Product
  }>
}): PurchaseOrderWithItems {
  const { purchase_order_items, ...order } = row
  const items: PurchaseOrderItemWithProduct[] = (purchase_order_items ?? []).map(
    (poi) => ({
      id: poi.id,
      purchase_order_id: poi.purchase_order_id,
      product_id: poi.product_id,
      quantity: poi.quantity,
      cost_price: poi.cost_price,
      total_price: poi.total_price,
      previous_cost_price: poi.previous_cost_price,
      cost_price_updated: poi.cost_price_updated,
      created_at: poi.created_at,
      product: poi.product,
    })
  )
  return { ...order, items }
}

export async function getAllPurchaseOrders(
  filters?: PurchaseOrderFilters
): Promise<PurchaseOrderWithItems[]> {
  let query = supabase
    .from(PURCHASE_ORDERS)
    .select(
      `
      *,
      purchase_order_items(
        *,
        product:products(*)
      )
    `
    )
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.from) {
    query = query.gte('created_at', filters.from)
  }
  if (filters?.to) {
    const toEnd = new Date(filters.to)
    toEnd.setHours(23, 59, 59, 999)
    query = query.lte('created_at', toEnd.toISOString())
  }

  const { data, error } = await query
  if (error) throw error

  let orders = (data ?? []).map(toPurchaseOrderWithItems)

  if (filters?.search?.trim()) {
    const search = filters.search.trim().toLowerCase()
    orders = orders.filter((o) =>
      String(o.order_number).toLowerCase().includes(search)
    )
  }

  return orders
}

export async function getPurchaseOrderById(
  id: string
): Promise<PurchaseOrderWithItems | null> {
  const { data, error } = await supabase
    .from(PURCHASE_ORDERS)
    .select(
      `
      *,
      purchase_order_items(
        *,
        product:products(*)
      )
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return toPurchaseOrderWithItems(data as Parameters<typeof toPurchaseOrderWithItems>[0])
}

export async function createPurchaseOrder(data: {
  supplier_name?: string
  note?: string
  items: {
    product_id: string
    quantity: number
    cost_price: number
    update_default_cost_price: boolean
  }[]
}): Promise<PurchaseOrderWithItems> {
  if (!data.items.length) {
    throw new Error('At least one product is required')
  }

  // 1. For each item, fetch current product cost_price as previous_cost_price
  const productCosts = new Map<string, number>()
  for (const item of data.items) {
    const product = await getProductById(item.product_id)
    if (!product) throw new Error(`Product not found: ${item.product_id}`)
    productCosts.set(item.product_id, product.cost_price)
  }

  // 2. Calculate total_amount
  const total_amount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.cost_price,
    0
  )

  // Get next order_number
  const { data: maxRow, error: maxError } = await supabase
    .from(PURCHASE_ORDERS)
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) throw maxError
  const order_number = (maxRow?.order_number ?? 0) + 1

  // 3. Insert purchase_order
  const orderPayload = {
    order_number,
    supplier_name: data.supplier_name?.trim() || null,
    note: data.note?.trim() || null,
    total_amount,
    status: 'received' as PurchaseOrderStatus,
  }

  const { data: insertedOrder, error: orderError } = await supabase
    .from(PURCHASE_ORDERS)
    .insert(orderPayload)
    .select()
    .single()

  if (orderError) throw orderError
  const orderId = (insertedOrder as PurchaseOrder).id

  // 4. Insert purchase_order_items
  const itemsPayload: Array<{
    purchase_order_id: string
    product_id: string
    quantity: number
    cost_price: number
    total_price: number
    previous_cost_price: number | null
    cost_price_updated: boolean
  }> = data.items.map((item) => ({
    purchase_order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    cost_price: item.cost_price,
    total_price: item.quantity * item.cost_price,
    previous_cost_price: productCosts.get(item.product_id) ?? null,
    cost_price_updated: item.update_default_cost_price,
  }))

  const { error: itemsError } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .insert(itemsPayload)

  if (itemsError) throw itemsError

  // 5. For each item, adjustStock type 'in'
  const note = `Purchase Order #${order_number}`
  for (const item of data.items) {
    await adjustStock(item.product_id, 'in', item.quantity, note)
  }

  // 6. If update_default_cost_price, update product cost_price
  for (const item of data.items) {
    if (item.update_default_cost_price) {
      await updateProduct(item.product_id, { cost_price: item.cost_price })
    }
  }

  // 7. Return created PurchaseOrderWithItems
  const created = await getPurchaseOrderById(orderId)
  if (!created) throw new Error('Failed to fetch created purchase order')
  return created
}

export async function cancelPurchaseOrder(id: string): Promise<void> {
  const order = await getPurchaseOrderById(id)
  if (!order) throw new Error('Purchase order not found')
  if (order.status === 'cancelled') {
    throw new Error('Purchase order is already cancelled')
  }

  // Update status to cancelled
  const { error: updateError } = await supabase
    .from(PURCHASE_ORDERS)
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) throw updateError

  const note = `Cancelled Purchase Order #${order.order_number}`

  for (const item of order.items) {
    await adjustStock(item.product_id, 'out', item.quantity, note)
  }

  for (const item of order.items) {
    if (item.cost_price_updated && item.previous_cost_price != null) {
      await updateProduct(item.product_id, {
        cost_price: item.previous_cost_price,
      })
    }
  }
}
