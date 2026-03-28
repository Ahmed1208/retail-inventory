import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
import { getProductById } from '@/services/productService'
import { updateProduct } from '@/services/productService'
import { mapPersonRow, roundMoney } from '@/services/peopleService'
import type {
  PurchaseOrder,
  PurchaseOrderWithItems,
  PurchaseOrderItemWithProduct,
  PurchaseOrderPayment,
  PurchaseOrderStatus,
  PaymentMethod,
  Product,
} from '@/types'

const PURCHASE_ORDERS = 'purchase_orders'
const PURCHASE_ORDER_ITEMS = 'purchase_order_items'
const PURCHASE_ORDER_PAYMENTS = 'purchase_order_payments'

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
  person_id: string | null
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
  const { purchase_order_items, ...orderRest } = row
  const order = {
    ...orderRest,
    person_id: orderRest.person_id ?? null,
  }
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

  const orderIds = orders.map((o) => o.id)
  if (orderIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from(PURCHASE_ORDER_PAYMENTS)
      .select('id, purchase_order_id, payment_method, amount')
      .in('purchase_order_id', orderIds)
    if (paymentsData && paymentsData.length > 0) {
      const byOrderId = new Map<string, PurchaseOrderPayment[]>()
      for (const p of paymentsData as Array<{
        id: string
        purchase_order_id: string
        payment_method: PaymentMethod
        amount: number
      }>) {
        const list = byOrderId.get(p.purchase_order_id) ?? []
        list.push({
          id: p.id,
          payment_method: p.payment_method,
          amount: Number(p.amount),
        })
        byOrderId.set(p.purchase_order_id, list)
      }
      orders = orders.map((o) => ({
        ...o,
        payments: byOrderId.get(o.id),
      }))
    }
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

  const order = toPurchaseOrderWithItems(data as Parameters<typeof toPurchaseOrderWithItems>[0])
  const { data: paymentsData } = await supabase
    .from(PURCHASE_ORDER_PAYMENTS)
    .select('id, payment_method, amount')
    .eq('purchase_order_id', id)
  if (paymentsData && paymentsData.length > 0) {
    order.payments = (paymentsData as Array<{
      id: string
      payment_method: PaymentMethod
      amount: number
    }>).map((p) => ({
      id: p.id,
      payment_method: p.payment_method,
      amount: Number(p.amount),
    }))
  }
  return order
}

export async function getPurchaseOrdersByPersonId(
  personId: string
): Promise<PurchaseOrderWithItems[]> {
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
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  if (error) throw error

  let orders = (data ?? []).map(toPurchaseOrderWithItems)
  const orderIds = orders.map((o) => o.id)
  if (orderIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from(PURCHASE_ORDER_PAYMENTS)
      .select('id, purchase_order_id, payment_method, amount')
      .in('purchase_order_id', orderIds)
    if (paymentsData && paymentsData.length > 0) {
      const byOrderId = new Map<string, PurchaseOrderPayment[]>()
      for (const p of paymentsData as Array<{
        id: string
        purchase_order_id: string
        payment_method: PaymentMethod
        amount: number
      }>) {
        const list = byOrderId.get(p.purchase_order_id) ?? []
        list.push({
          id: p.id,
          payment_method: p.payment_method,
          amount: Number(p.amount),
        })
        byOrderId.set(p.purchase_order_id, list)
      }
      orders = orders.map((o) => ({
        ...o,
        payments: byOrderId.get(o.id),
      }))
    }
  }
  return orders
}

export async function createPurchaseOrder(data: {
  supplier_name?: string
  note?: string
  person_id?: string
  /** Multiple payments with amounts; sum must equal order total */
  payments?: { payment_method: PaymentMethod; amount: number }[]
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

  const payments = (data.payments ?? []).filter((p) => p.amount > 0)
  const paymentsSum = payments.reduce((s, p) => s + p.amount, 0)
  if (payments.length > 0 && Math.abs(paymentsSum - total_amount) > 0.01) {
    throw new Error(
      `Payment total (${paymentsSum}) must equal order total (${total_amount})`
    )
  }

  // Get next order_number
  const { data: maxRow, error: maxError } = await supabase
    .from(PURCHASE_ORDERS)
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) throw maxError
  const order_number = (maxRow?.order_number ?? 0) + 1

  if (data.person_id) {
    const { data: prow, error: pe } = await supabase
      .from('people')
      .select('*')
      .eq('id', data.person_id)
      .maybeSingle()
    if (pe) throw pe
    if (!prow) throw new Error('Person not found')
    const p = mapPersonRow(prow as Record<string, unknown>)
    if (!p.roles.includes('supplier')) {
      throw new Error('Selected person must have the supplier role')
    }
  }

  // 3. Insert purchase_order
  const orderPayload = {
    order_number,
    supplier_name: data.supplier_name?.trim() || null,
    note: data.note?.trim() || null,
    total_amount,
    status: 'received' as PurchaseOrderStatus,
    person_id: data.person_id ?? null,
  }

  const { data: insertedOrder, error: orderError } = await supabase
    .from(PURCHASE_ORDERS)
    .insert(orderPayload)
    .select()
    .single()

  if (orderError) throw orderError
  const orderId = (insertedOrder as PurchaseOrder).id

  if (payments.length > 0) {
    const paymentsPayload = payments.map((p) => ({
      purchase_order_id: orderId,
      payment_method: p.payment_method,
      amount: p.amount,
    }))
    const { error: paymentsError } = await supabase
      .from(PURCHASE_ORDER_PAYMENTS)
      .insert(paymentsPayload)
    if (paymentsError) {
      const msg = paymentsError.message ?? ''
      const tableMissing =
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        paymentsError.code === '42P01'
      if (!tableMissing) throw paymentsError
    }
  }

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

  if (data.person_id) {
    const delta = roundMoney(-total_amount)
    const { error: btErr } = await supabase
      .from('balance_transactions')
      .insert({
        person_id: data.person_id,
        type: 'purchase_order',
        amount: delta,
        reference_id: orderId,
        reference_number: `PO-${order_number}`,
      })
    if (btErr) throw btErr

    const { data: balRow, error: bErr } = await supabase
      .from('people')
      .select('balance')
      .eq('id', data.person_id)
      .single()
    if (bErr) throw bErr
    const newBal = roundMoney(
      Number((balRow as { balance: number }).balance) + delta
    )
    const { error: pbErr } = await supabase
      .from('people')
      .update({
        balance: newBal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.person_id)
    if (pbErr) throw pbErr
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

  if (order.person_id) {
    const reversal = roundMoney(order.total_amount)
    const { error: btErr } = await supabase
      .from('balance_transactions')
      .insert({
        person_id: order.person_id,
        type: 'purchase_order',
        amount: reversal,
        reference_id: order.id,
        reference_number: `PO-${order.order_number}`,
      })
    if (btErr) throw btErr

    const { data: balRow, error: bErr } = await supabase
      .from('people')
      .select('balance')
      .eq('id', order.person_id)
      .single()
    if (bErr) throw bErr
    const newBal = roundMoney(
      Number((balRow as { balance: number }).balance) + reversal
    )
    const { error: pbErr } = await supabase
      .from('people')
      .update({
        balance: newBal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.person_id)
    if (pbErr) throw pbErr
  }

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
