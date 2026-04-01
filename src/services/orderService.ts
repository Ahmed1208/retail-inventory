import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
import {
  insertBalanceTransactionRow,
  mapPersonRow,
  roundMoney,
  supabaseErrorMessage,
} from '@/services/peopleService'
import {
  insertOrderPaymentInstallments,
  insertOrderPaymentsRows,
} from '@/services/paymentInstallmentInserts'
import {
  createOrderPayment,
  OVERPAYMENT_REQUIRES_PERSON,
} from '@/services/paymentService'
import { normalizePaymentMethod } from '@/utils/paymentMethod'
import type {
  Order,
  OrderWithItemsAndPayments,
  OrderItemWithProduct,
  OrderPayment,
  OrderStatus,
  OrderStatusFlow,
  OrderType,
  PaymentMethod,
  PaymentInstallment,
  Product,
  WalletDirection,
} from '@/types'

const ORDERS = 'orders'
const ORDER_ITEMS = 'order_items'
const ORDER_PAYMENTS = 'order_payments'
const PAYMENT_INSTALLMENTS = 'payment_installments'
const PRODUCTS = 'products'

const ORDER_SELECT = `
  *,
  order_items(
    *,
    product:products(*)
  ),
  payment_installments(*)
`

export type OrderFilters = {
  status?: OrderStatus
  status_flow?: OrderStatusFlow | 'all'
  type?: OrderType
  search?: string
  from?: string
  to?: string
}

type OrderRow = Record<string, unknown> & {
  id: string
  order_number: number
  type: OrderType
  status: OrderStatus
  payment_method: PaymentMethod | null
  note: string | null
  total_amount: number
  person_id: string | null
  created_at: string
  updated_at: string
  order_items?: Array<{
    id: string
    order_id: string
    product_id: string
    quantity: number
    unit_price: number
    total_price: number
    line_discount_rate?: number
    created_at: string
    product: Product
  }>
  payment_installments?: Array<{
    id: string
    order_id: string
    method: PaymentMethod
    amount: number
    note: string | null
    created_at: string
  }>
}

function syncStatusFromFlow(flow: OrderStatusFlow): OrderStatus {
  if (flow === 'completed') return 'completed'
  if (flow === 'cancelled') return 'cancelled'
  return 'pending'
}

function mapOrderFields(row: OrderRow): Order {
  return {
    id: row.id,
    order_number: Number(row.order_number),
    type: row.type as OrderType,
    status: row.status as OrderStatus,
    status_flow: (row.status_flow as OrderStatusFlow) ?? 'confirmed',
    payment_method: normalizePaymentMethod(row.payment_method),
    note: (row.note as string | null) ?? null,
    total_amount: Number(row.total_amount ?? 0),
    person_id: (row.person_id as string | null) ?? null,
    paid_amount: Number(row.paid_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    discount_amount: Number(row.discount_amount ?? 0),
    discount_rate: Number(row.discount_rate ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    allow_remaining_on_account: Boolean(row.allow_remaining_on_account),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapItems(row: OrderRow): OrderItemWithProduct[] {
  return (row.order_items ?? []).map((oi) => ({
    id: oi.id,
    order_id: oi.order_id,
    product_id: oi.product_id,
    quantity: oi.quantity,
    unit_price: Number(oi.unit_price),
    total_price: Number(oi.total_price),
    line_discount_rate: Number(oi.line_discount_rate ?? 0),
    created_at: oi.created_at,
    product: oi.product,
  }))
}

function mapInstallmentsFromJoin(
  row: OrderRow
): PaymentInstallment[] {
  const raw = row.payment_installments ?? []
  return raw.map((p) => ({
    id: p.id,
    order_id: p.order_id,
    method: normalizePaymentMethod(p.method) ?? 'cash',
    amount: Number(p.amount),
    note: p.note,
    created_at: p.created_at,
  }))
}

async function loadLegacyPaymentsAsInstallments(
  orderId: string
): Promise<PaymentInstallment[]> {
  const { data } = await supabase
    .from(ORDER_PAYMENTS)
    .select('id, payment_method, amount, created_at')
    .eq('order_id', orderId)
  if (!data?.length) return []
  return (data as Array<{
    id: string
    payment_method: PaymentMethod
    amount: number
    created_at: string
  }>).map((p) => ({
    id: p.id,
    order_id: orderId,
    method: normalizePaymentMethod(p.payment_method) ?? 'cash',
    amount: Number(p.amount),
    note: null,
    created_at: p.created_at,
  }))
}

async function mergeInstallments(
  row: OrderRow,
  orderId: string
): Promise<PaymentInstallment[]> {
  const fromJoin = mapInstallmentsFromJoin(row)
  if (fromJoin.length > 0) return fromJoin
  return loadLegacyPaymentsAsInstallments(orderId)
}

export async function rowToOrderWithPayments(
  row: OrderRow
): Promise<OrderWithItemsAndPayments> {
  const base = mapOrderFields(row)
  const items = mapItems(row)
  const payment_installments = await mergeInstallments(row, base.id)

  const payments: OrderPayment[] | undefined = payment_installments.length
    ? payment_installments.map((p) => ({
        id: p.id,
        payment_method: p.method,
        amount: p.amount,
      }))
    : undefined

  return {
    ...base,
    items,
    payments,
    payment_installments,
  }
}

export async function getAllOrders(
  filters?: OrderFilters
): Promise<OrderWithItemsAndPayments[]> {
  let query = supabase.from(ORDERS).select(ORDER_SELECT).order('created_at', {
    ascending: false,
  })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.status_flow && filters.status_flow !== 'all') {
    query = query.eq('status_flow', filters.status_flow)
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

  const rows = (data ?? []) as OrderRow[]
  const orders = await Promise.all(rows.map((r) => rowToOrderWithPayments(r)))

  if (!filters?.search?.trim()) return orders

  const q = filters.search.trim().toLowerCase()
  const personIds = [
    ...new Set(orders.map((o) => o.person_id).filter(Boolean)),
  ] as string[]

  let personNames = new Map<string, string>()
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from('people')
      .select('id, name')
      .in('id', personIds)
    for (const p of people ?? []) {
      personNames.set(
        (p as { id: string }).id,
        String((p as { name: string }).name).toLowerCase()
      )
    }
  }

  return orders.filter((o) => {
    if (String(o.order_number).includes(q)) return true
    const name = o.person_id ? personNames.get(o.person_id) : ''
    return name ? name.includes(q) : false
  })
}

export async function getOrderById(
  id: string
): Promise<OrderWithItemsAndPayments | null> {
  const { data, error } = await supabase
    .from(ORDERS)
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToOrderWithPayments(data as OrderRow)
}

export async function getOrdersByPersonId(
  personId: string
): Promise<OrderWithItemsAndPayments[]> {
  const { data, error } = await supabase
    .from(ORDERS)
    .select(ORDER_SELECT)
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as OrderRow[]
  return Promise.all(rows.map((r) => rowToOrderWithPayments(r)))
}

export type PosOrderLineInput = {
  product_id: string
  quantity: number
  unit_price: number
  line_discount_rate?: number
}

export async function createOrder(data: {
  type: OrderType
  note?: string
  items: PosOrderLineInput[]
  payments: { payment_method: PaymentMethod; amount: number }[]
  person_id?: string
  apply_person_discount?: boolean
  /** Manual order-level discount % (0–100); overrides person rate when set */
  order_discount_rate?: number
  allow_remaining_on_account: boolean
}): Promise<OrderWithItemsAndPayments> {
  if (!data.items.length) {
    throw new Error('Order must have at least one item')
  }

  let person: ReturnType<typeof mapPersonRow> | null = null
  if (data.person_id) {
    const { data: prow, error: pe } = await supabase
      .from('people')
      .select('*')
      .eq('id', data.person_id)
      .maybeSingle()
    if (pe) throw pe
    if (!prow) throw new Error('Person not found')
    person = mapPersonRow(prow as Record<string, unknown>)
    if (!person.roles.includes('customer')) {
      throw new Error('Selected person must have the customer role')
    }
  }

  let discount_rate = 0
  if (data.order_discount_rate != null && data.order_discount_rate >= 0) {
    discount_rate = roundMoney(Math.min(100, data.order_discount_rate))
  } else if (
    person &&
    data.apply_person_discount !== false &&
    person.discount_rate > 0
  ) {
    discount_rate = person.discount_rate
  }

  const lines = data.items.map((item) => {
    const ld = roundMoney(Math.min(100, item.line_discount_rate ?? 0))
    const gross = item.quantity * item.unit_price
    const lineTotal = roundMoney(gross * (1 - ld / 100))
    return { ...item, line_discount_rate: ld, lineTotal }
  })

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0))
  const discount_amount = roundMoney(subtotal * (discount_rate / 100))
  const total_amount = roundMoney(subtotal - discount_amount)

  const payments = (data.payments ?? []).filter((p) => p.amount > 0)
  const paidSum = roundMoney(
    payments.reduce((s, p) => s + p.amount, 0)
  )
  if (paidSum > total_amount + 0.01 && !data.person_id) {
    throw new Error(OVERPAYMENT_REQUIRES_PERSON)
  }
  const paid_amount = roundMoney(
    paidSum > total_amount ? total_amount : paidSum
  )
  const remaining_amount = roundMoney(total_amount - paid_amount)

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
    status_flow: 'draft' as OrderStatusFlow,
    payment_method,
    note: data.note?.trim() || null,
    total_amount,
    person_id: data.person_id ?? null,
    subtotal,
    discount_amount,
    discount_rate,
    paid_amount,
    remaining_amount,
    allow_remaining_on_account: data.allow_remaining_on_account,
  }

  const { data: insertedOrder, error: orderError } = await supabase
    .from(ORDERS)
    .insert(orderPayload)
    .select('id')
    .single()

  if (orderError) throw orderError
  const orderId = (insertedOrder as { id: string }).id

  const itemsPayload = lines.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.lineTotal,
    line_discount_rate: item.line_discount_rate,
  }))

  const { error: itemsError } = await supabase
    .from(ORDER_ITEMS)
    .insert(itemsPayload)

  if (itemsError) throw itemsError

  if (payments.length > 0) {
    await insertOrderPaymentInstallments(
      payments.map((p) => ({
        order_id: orderId,
        method: p.payment_method,
        amount: p.amount,
        note: null as string | null,
      }))
    )

    try {
      await insertOrderPaymentsRows(
        payments.map((p) => ({
          order_id: orderId,
          payment_method: p.payment_method,
          amount: p.amount,
        }))
      )
    } catch (opErr: unknown) {
      const msg = supabaseErrorMessage(opErr).toLowerCase()
      const code =
        typeof opErr === 'object' && opErr !== null && 'code' in opErr
          ? String((opErr as { code: unknown }).code)
          : ''
      if (
        !msg.includes('does not exist') &&
        !msg.includes('relation') &&
        code !== '42P01'
      ) {
        throw opErr
      }
    }
  }

  const created = await getOrderById(orderId)
  if (!created) throw new Error('Failed to fetch created order')
  return created
}

/**
 * Writes `balance_transactions` for a confirmed order. When `personId` is null (walk-in),
 * rows are still recorded for the transaction log but `people.balance` is not updated.
 */
async function insertConfirmOrderLedgerLines(
  order: OrderWithItemsAndPayments,
  personId: string | null
): Promise<void> {
  const total = roundMoney(order.total_amount)
  const paid = roundMoney(order.paid_amount)

  await insertBalanceTransactionRow({
    person_id: personId,
    type: 'order',
    amount: total,
    reference_id: order.id,
    reference_number: String(order.order_number),
    payment_method: null,
    payment_group_id: null,
    wallet_direction: null,
  })

  let bal: number | null = null
  if (personId) {
    const { data: b0, error: b0e } = await supabase
      .from('people')
      .select('balance')
      .eq('id', personId)
      .single()
    if (b0e) throw b0e
    bal = roundMoney(Number((b0 as { balance: number }).balance) + total)
  }

  if (paid > 0.01) {
    const payingInsts = [...(order.payment_installments ?? [])]
      .filter((inst) => roundMoney(inst.amount) > 0.01)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      )

    let remainingToOrder = total

    if (payingInsts.length > 0) {
      const paymentGroupId =
        payingInsts.length > 1 ? crypto.randomUUID() : null
      for (const inst of payingInsts) {
        const a = roundMoney(inst.amount)
        const toward = roundMoney(Math.min(a, remainingToOrder))
        const walletPart = roundMoney(a - toward)

        if (toward > 0.01) {
          await insertBalanceTransactionRow({
            person_id: personId,
            type: 'payment_in',
            amount: roundMoney(-toward),
            reference_id: order.id,
            reference_number: String(order.order_number),
            note: inst.note?.trim() || 'Order payment',
            payment_method: inst.method,
            payment_group_id: paymentGroupId,
            wallet_direction: null,
          })
          if (bal !== null) bal = roundMoney(bal - toward)
          remainingToOrder = roundMoney(remainingToOrder - toward)
        }

        if (walletPart > 0.01) {
          if (!personId) {
            throw new Error(OVERPAYMENT_REQUIRES_PERSON)
          }
          const note = `Overpayment from Order #${order.order_number} — EGP ${walletPart} added to wallet`
          await insertBalanceTransactionRow({
            person_id: personId,
            type: 'wallet',
            amount: roundMoney(-walletPart),
            reference_id: order.id,
            reference_number: String(order.order_number),
            note,
            payment_method: null,
            payment_group_id: paymentGroupId,
            wallet_direction: 'out' as WalletDirection,
          })
          bal = roundMoney(bal! - walletPart)
        }
      }
    } else {
      const toward = roundMoney(Math.min(paid, total))
      const walletPart = roundMoney(paid - toward)
      if (toward > 0.01) {
        await insertBalanceTransactionRow({
          person_id: personId,
          type: 'payment_in',
          amount: roundMoney(-toward),
          reference_id: order.id,
          reference_number: String(order.order_number),
          note: 'Payment at confirmation',
          payment_method: null,
          payment_group_id: null,
          wallet_direction: null,
        })
        if (bal !== null) bal = roundMoney(bal - toward)
      }
      if (walletPart > 0.01) {
        if (!personId) {
          throw new Error(OVERPAYMENT_REQUIRES_PERSON)
        }
        const note = `Overpayment from Order #${order.order_number} — EGP ${walletPart} added to wallet`
        await insertBalanceTransactionRow({
          person_id: personId,
          type: 'wallet',
          amount: roundMoney(-walletPart),
          reference_id: order.id,
          reference_number: String(order.order_number),
          note,
          payment_method: null,
          payment_group_id: null,
          wallet_direction: 'out' as WalletDirection,
        })
        bal = roundMoney(bal! - walletPart)
      }
    }
  }

  if (personId && bal !== null) {
    const { error: pb } = await supabase
      .from('people')
      .update({
        balance: bal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personId)
    if (pb) throw pb
  }
}

/** Reverse walk-in ledger rows when a confirmed/completed order is cancelled. */
async function applyWalkInCancelLedger(order: OrderWithItemsAndPayments) {
  if (order.person_id) return
  const total = roundMoney(order.total_amount)
  const paid = roundMoney(order.paid_amount)
  if (total > 0.01) {
    await insertBalanceTransactionRow({
      person_id: null,
      type: 'adjustment',
      amount: roundMoney(-total),
      reference_id: order.id,
      reference_number: String(order.order_number),
      note: `Cancelled walk-in order #${order.order_number} (reverse sale)`,
      payment_method: null,
      payment_group_id: null,
      wallet_direction: null,
    })
  }
  if (paid > 0.01) {
    await insertBalanceTransactionRow({
      person_id: null,
      type: 'adjustment',
      amount: paid,
      reference_id: order.id,
      reference_number: String(order.order_number),
      note: `Cancelled walk-in order #${order.order_number} (reverse payment)`,
      payment_method: null,
      payment_group_id: null,
      wallet_direction: null,
    })
  }
}

export async function confirmOrder(id: string): Promise<OrderWithItemsAndPayments> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  if (order.status_flow !== 'draft') {
    throw new Error('Only draft orders can be confirmed')
  }

  const rem = roundMoney(order.remaining_amount)
  if (rem > 0.01 && !order.allow_remaining_on_account) {
    throw new Error(
      'Pay the full amount or enable adding the remainder to the customer balance'
    )
  }
  if (rem > 0.01 && !order.person_id) {
    throw new Error(
      'Select a customer to carry a remaining balance on account'
    )
  }

  if (order.person_id) {
    const { data: prow, error: pe } = await supabase
      .from('people')
      .select('*')
      .eq('id', order.person_id)
      .maybeSingle()
    if (pe) throw pe
    if (!prow) throw new Error('Person not found')
    const p = mapPersonRow(prow as Record<string, unknown>)
    if (p.credit_limit != null) {
      const projected = roundMoney(p.balance + rem)
      if (projected > roundMoney(p.credit_limit) + 1e-6) {
        const available = roundMoney(
          Math.max(0, p.credit_limit - p.balance)
        )
        throw new Error(
          `Credit limit exceeded. Available credit: ${available} EGP`
        )
      }
    }
  }

  const productIds = [...new Set(order.items.map((i) => i.product_id))]
  const { data: stockRows, error: stockErr } = await supabase
    .from(PRODUCTS)
    .select('id, quantity')
    .in('id', productIds)
  if (stockErr) throw stockErr
  const stockMap = new Map(
    (stockRows as { id: string; quantity: number }[]).map((r) => [
      r.id,
      r.quantity,
    ])
  )

  for (const item of order.items) {
    const q = stockMap.get(item.product_id) ?? 0
    if (q < item.quantity) {
      throw new Error(
        `Insufficient stock for a product: need ${item.quantity}, have ${q}`
      )
    }
  }

  for (const item of order.items) {
    await adjustStock(
      item.product_id,
      'out',
      item.quantity,
      `Order #${order.order_number}`
    )
  }

  const { error: upErr } = await supabase
    .from(ORDERS)
    .update({
      status_flow: 'confirmed',
      status: syncStatusFromFlow('confirmed'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (upErr) throw upErr

  await insertConfirmOrderLedgerLines(order, order.person_id)

  const updated = await getOrderById(id)
  if (!updated) throw new Error('Order not found after confirm')
  if (updated.remaining_amount <= 0.01) {
    return completeOrder(id)
  }
  return updated
}

export async function completeOrder(id: string): Promise<OrderWithItemsAndPayments> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  if (order.remaining_amount > 0.01) {
    throw new Error(
      `Order has remaining balance of ${roundMoney(order.remaining_amount)} EGP`
    )
  }
  if (order.status_flow === 'cancelled') {
    throw new Error('Cannot complete a cancelled order')
  }
  if (order.status_flow === 'completed') {
    return order
  }

  const { error } = await supabase
    .from(ORDERS)
    .update({
      status_flow: 'completed',
      status: syncStatusFromFlow('completed'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
  const out = await getOrderById(id)
  if (!out) throw new Error('Order not found')
  return out
}

async function applyPersonCancelReversal(order: OrderWithItemsAndPayments) {
  if (!order.person_id) return
  const net = roundMoney(order.total_amount - order.paid_amount)
  if (Math.abs(net) < 0.01 && order.paid_amount < 0.01) return

  if (Math.abs(net) > 0.01) {
    await insertBalanceTransactionRow({
      person_id: order.person_id,
      type: 'adjustment',
      amount: roundMoney(-net),
      reference_id: order.id,
      reference_number: String(order.order_number),
      note: `Cancelled order #${order.order_number}`,
      payment_method: null,
      payment_group_id: null,
      wallet_direction: null,
    })
  }

  const { data: b0, error: b0e } = await supabase
    .from('people')
    .select('balance')
    .eq('id', order.person_id)
    .single()
  if (b0e) throw b0e
  const cur = Number((b0 as { balance: number }).balance)
  const newBal = roundMoney(cur - net)

  const { error: pb } = await supabase
    .from('people')
    .update({
      balance: newBal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.person_id)
  if (pb) throw pb
}

export async function cancelOrder(id: string): Promise<void> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  if (order.status_flow === 'cancelled') {
    throw new Error('Order is already cancelled')
  }

  const restoreStock =
    order.status_flow === 'confirmed' || order.status_flow === 'completed'

  if (restoreStock) {
    const note = `Restored from cancelled order #${order.order_number}`
    for (const item of order.items) {
      await adjustStock(item.product_id, 'in', item.quantity, note)
    }
    await applyPersonCancelReversal(order)
    await applyWalkInCancelLedger(order)
  }

  const { error: updateError } = await supabase
    .from(ORDERS)
    .update({
      status_flow: 'cancelled',
      status: syncStatusFromFlow('cancelled'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) throw updateError
}

export async function addPaymentInstallment(data: {
  order_id: string
  method: PaymentMethod
  amount: number
  note?: string
}): Promise<OrderWithItemsAndPayments> {
  const amt = roundMoney(data.amount)
  if (amt < 0.01) throw new Error('Amount must be at least 0.01')

  const order = await getOrderById(data.order_id)
  if (!order) throw new Error('Order not found')
  if (order.status_flow === 'draft') {
    throw new Error('Confirm the order before adding payments')
  }
  if (order.status_flow === 'cancelled' || order.status_flow === 'completed') {
    throw new Error('Cannot add payment to this order')
  }

  await createOrderPayment({
    order,
    method: data.method,
    amount: amt,
    note: data.note,
  })

  const refreshed = await getOrderById(data.order_id)
  if (!refreshed) throw new Error('Order not found')
  if (refreshed.remaining_amount <= 0.01) {
    return completeOrder(data.order_id)
  }
  return refreshed
}

export async function updateOrderItems(
  id: string,
  items: PosOrderLineInput[]
): Promise<OrderWithItemsAndPayments> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  if (order.status_flow !== 'draft') {
    throw new Error('Only draft orders can be edited')
  }
  if (!items.length) throw new Error('Order must have at least one item')

  const discount_rate = order.discount_rate

  const lines = items.map((item) => {
    const ld = roundMoney(Math.min(100, item.line_discount_rate ?? 0))
    const gross = item.quantity * item.unit_price
    const lineTotal = roundMoney(gross * (1 - ld / 100))
    return { ...item, line_discount_rate: ld, lineTotal }
  })

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0))
  const discount_amount = roundMoney(subtotal * (discount_rate / 100))
  const total_amount = roundMoney(subtotal - discount_amount)

  if (order.paid_amount > total_amount + 0.01) {
    throw new Error('Current payments exceed the new order total')
  }

  const remaining_amount = roundMoney(total_amount - order.paid_amount)

  const { error: delErr } = await supabase
    .from(ORDER_ITEMS)
    .delete()
    .eq('order_id', id)
  if (delErr) throw delErr

  const itemsPayload = lines.map((item) => ({
    order_id: id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.lineTotal,
    line_discount_rate: item.line_discount_rate,
  }))

  const { error: insErr } = await supabase
    .from(ORDER_ITEMS)
    .insert(itemsPayload)
  if (insErr) throw insErr

  const { error: upErr } = await supabase
    .from(ORDERS)
    .update({
      subtotal,
      discount_amount,
      total_amount,
      remaining_amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (upErr) throw upErr

  const refreshed = await getOrderById(id)
  if (!refreshed) throw new Error('Order not found')
  return refreshed
}

export async function updateOrderDiscountRate(
  id: string,
  discount_rate: number
): Promise<OrderWithItemsAndPayments> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  if (order.status_flow !== 'draft') {
    throw new Error('Only draft orders can change discount')
  }

  const dr = roundMoney(Math.min(100, Math.max(0, discount_rate)))
  const discount_amount = roundMoney(order.subtotal * (dr / 100))
  const total_amount = roundMoney(order.subtotal - discount_amount)
  if (order.paid_amount > total_amount + 0.01) {
    throw new Error('Payments exceed the new total; reduce payments first')
  }
  const remaining_amount = roundMoney(total_amount - order.paid_amount)

  const { error } = await supabase
    .from(ORDERS)
    .update({
      discount_rate: dr,
      discount_amount,
      total_amount,
      remaining_amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
  const refreshed = await getOrderById(id)
  if (!refreshed) throw new Error('Order not found')
  return refreshed
}

export async function syncDraftOrderPayments(
  orderId: string,
  payments: { payment_method: PaymentMethod; amount: number }[]
): Promise<OrderWithItemsAndPayments> {
  const order = await getOrderById(orderId)
  if (!order) throw new Error('Order not found')
  if (order.status_flow !== 'draft') {
    throw new Error('Only draft orders can change payments')
  }

  const list = (payments ?? []).filter((p) => p.amount > 0)
  const paidSum = roundMoney(list.reduce((s, p) => s + p.amount, 0))
  if (paidSum > order.total_amount + 0.01 && !order.person_id) {
    throw new Error(OVERPAYMENT_REQUIRES_PERSON)
  }
  const paid_amount = roundMoney(
    paidSum > order.total_amount ? order.total_amount : paidSum
  )
  const remaining_amount = roundMoney(order.total_amount - paid_amount)

  await supabase.from(PAYMENT_INSTALLMENTS).delete().eq('order_id', orderId)
  await supabase.from(ORDER_PAYMENTS).delete().eq('order_id', orderId)

  if (list.length > 0) {
    await insertOrderPaymentInstallments(
      list.map((p) => ({
        order_id: orderId,
        method: p.payment_method,
        amount: p.amount,
        note: null as string | null,
      }))
    )

    try {
      await insertOrderPaymentsRows(
        list.map((p) => ({
          order_id: orderId,
          payment_method: p.payment_method,
          amount: p.amount,
        }))
      )
    } catch (opErr: unknown) {
      const msg = supabaseErrorMessage(opErr).toLowerCase()
      const code =
        typeof opErr === 'object' && opErr !== null && 'code' in opErr
          ? String((opErr as { code: unknown }).code)
          : ''
      if (
        !msg.includes('does not exist') &&
        !msg.includes('relation') &&
        code !== '42P01'
      ) {
        throw opErr
      }
    }
  }

  const { error: upErr } = await supabase
    .from(ORDERS)
    .update({
      paid_amount,
      remaining_amount,
      payment_method: list[0]?.payment_method ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (upErr) throw upErr

  const refreshed = await getOrderById(orderId)
  if (!refreshed) throw new Error('Order not found')
  return refreshed
}

export async function saveDraftOrder(
  id: string,
  data: {
    items: PosOrderLineInput[]
    payments: { payment_method: PaymentMethod; amount: number }[]
    person_id: string | null
    order_discount_rate: number
    allow_remaining_on_account: boolean
    note?: string
  }
): Promise<OrderWithItemsAndPayments> {
  await updateOrderItems(id, data.items)
  await updateOrderPersonAndDiscount(id, {
    person_id: data.person_id,
    discount_rate: data.order_discount_rate,
    allow_remaining_on_account: data.allow_remaining_on_account,
  })
  await syncDraftOrderPayments(id, data.payments)
  if (data.note !== undefined) {
    await updateOrderNote(id, data.note)
  }
  const o = await getOrderById(id)
  if (!o) throw new Error('Order not found')
  return o
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
    .select('*')
    .single()

  if (error) throw error
  return mapOrderFields(data as OrderRow)
}

export async function updateOrderPersonAndDiscount(
  id: string,
  data: {
    person_id: string | null
    discount_rate: number
    allow_remaining_on_account: boolean
  }
): Promise<OrderWithItemsAndPayments> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  if (order.status_flow !== 'draft') throw new Error('Only draft orders')

  if (data.person_id) {
    const { data: prow, error: pe } = await supabase
      .from('people')
      .select('*')
      .eq('id', data.person_id)
      .maybeSingle()
    if (pe) throw pe
    if (!prow) throw new Error('Person not found')
    const p = mapPersonRow(prow as Record<string, unknown>)
    if (!p.roles.includes('customer')) {
      throw new Error('Selected person must have the customer role')
    }
  }

  const dr = roundMoney(Math.min(100, Math.max(0, data.discount_rate)))
  const discount_amount = roundMoney(order.subtotal * (dr / 100))
  const total_amount = roundMoney(order.subtotal - discount_amount)
  if (order.paid_amount > total_amount + 0.01) {
    throw new Error('Payments exceed the new total')
  }
  const remaining_amount = roundMoney(total_amount - order.paid_amount)

  const { error } = await supabase
    .from(ORDERS)
    .update({
      person_id: data.person_id,
      discount_rate: dr,
      discount_amount,
      total_amount,
      remaining_amount,
      allow_remaining_on_account: data.allow_remaining_on_account,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
  const refreshed = await getOrderById(id)
  if (!refreshed) throw new Error('Order not found')
  return refreshed
}
