import { InsufficientStockConfirmError } from '@/errors/insufficientStockConfirmError'
import i18n from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
import { recalculateStockFromMovements } from '@/services/stockReconcileService'
import {
  DEFAULT_WAREHOUSE_ID,
  fetchActiveTenderRegistersForDocument,
  resolveRegisterWarehouseForOrderConfirm,
  resolveRegisterWarehouseForRetainedPayment,
  takeRegisterFromTenderPool,
} from '@/services/warehouseService'
import {
  getLedgerDocumentLineCreatedAt,
  getNextStandaloneLedgerRef,
  insertBalanceTransactionRow,
  listActiveLedgerPaymentOperationRouteIdsForDocument,
  mapPersonRow,
  roundMoney,
  supabaseErrorMessage,
  throwHistoricalSnapshotMigrationError,
  voidLedgerOrderDocumentRowForCancel,
  voidLedgerPaymentOperationsForDocumentCancel,
  voidWalkInOrderCancelLedgerInPlace,
} from '@/services/peopleService'
import {
  insertOrderPaymentInstallments,
  insertOrderPaymentsRows,
} from '@/services/paymentInstallmentInserts'
import { insertStockAlert } from '@/services/stockAlertsService'
import {
  createOrderPayment,
  OVERPAYMENT_REQUIRES_PERSON,
} from '@/services/paymentService'
import {
  appendLedgerDocSuffix,
  retainedPaymentCreatedAt,
} from '@/utils/ledgerDocSuffix'
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

async function afterOrderStockMutation(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds)].filter(Boolean)
  if (!ids.length) return
  try {
    await recalculateStockFromMovements(ids)
  } catch {
    /* RPC may be missing on unmigrated DB */
  }
}

export type CancelOrderSettlement =
  | 'reverse_payments'
  | 'retain_paid_as_wallet_credit'

const ORDERS = 'orders'
const ORDER_ITEMS = 'order_items'
const ORDER_PAYMENTS = 'order_payments'
const PAYMENT_INSTALLMENTS = 'payment_installments'

const ORDER_SELECT = `
  *,
  order_items(
    *,
    product:products(
      *,
      brand:brands(name),
      category:categories(name)
    )
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
  /** Filter CSV “historical snapshot” rows vs operational orders */
  historical_snapshot?: 'all' | 'only' | 'exclude'
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
  const whRaw = row.warehouse_id as number | string | null | undefined
  const warehouse_id =
    whRaw != null && whRaw !== '' && Number.isFinite(Number(whRaw))
      ? Number(whRaw)
      : DEFAULT_WAREHOUSE_ID
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
    warehouse_id,
    is_historical_snapshot: Boolean(row.is_historical_snapshot),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function assertOrderNotHistoricalSnapshot(
  order: Order,
  action: string
): void {
  if (order.is_historical_snapshot) {
    throw new Error(
      `HISTORICAL_ORDER_IMMUTABLE: ${action}`
    )
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
  if (filters?.historical_snapshot === 'only') {
    query = query.eq('is_historical_snapshot', true)
  }
  if (filters?.historical_snapshot === 'exclude') {
    query = query.eq('is_historical_snapshot', false)
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

/** Completed-order line for a single product (for product detail analytics). */
export type ProductSaleLine = {
  lineId: string
  quantity: number
  unitPrice: number
  lineTotal: number
  orderId: string
  orderNumber: number
  orderCreatedAt: string
  orderType: OrderType
  /** Ship-from warehouse on the parent order. */
  warehouseId: number
}

export type ProductSalesAnalyticsFilters = {
  /** Inclusive ISO date `YYYY-MM-DD` (order `created_at` date) */
  from?: string
  /** Inclusive ISO date `YYYY-MM-DD` */
  to?: string
}

/**
 * Sales lines for one product from **completed** orders only.
 * Date filters apply to the parent order's `created_at` (local calendar day).
 */
export async function getProductSalesAnalytics(
  productId: string,
  filters?: ProductSalesAnalyticsFilters
): Promise<ProductSaleLine[]> {
  const { data, error } = await supabase
    .from(ORDER_ITEMS)
    .select(
      `
      id,
      quantity,
      unit_price,
      total_price,
      orders (
        id,
        order_number,
        created_at,
        status_flow,
        type,
        warehouse_id
      )
    `
    )
    .eq('product_id', productId)

  if (error) throw error

  type OrderEmbed = {
    id: string
    order_number: number
    created_at: string
    status_flow: string
    type: string
    warehouse_id?: number | string | null
  }
  type RawRow = {
    id: string
    quantity: number
    unit_price: number
    total_price: number
    orders: OrderEmbed | OrderEmbed[] | null
  }

  const rows = (data ?? []) as RawRow[]
  const out: ProductSaleLine[] = []

  for (const r of rows) {
    const o = Array.isArray(r.orders) ? r.orders[0] ?? null : r.orders
    if (!o || o.status_flow !== 'completed') continue

    const day = o.created_at.slice(0, 10)
    if (filters?.from && day < filters.from) continue
    if (filters?.to && day > filters.to) continue

    const whRaw = o.warehouse_id
    const warehouseId =
      whRaw != null && Number.isFinite(Number(whRaw))
        ? Math.trunc(Number(whRaw))
        : DEFAULT_WAREHOUSE_ID

    out.push({
      lineId: r.id,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      lineTotal: Number(r.total_price),
      orderId: o.id,
      orderNumber: Number(o.order_number),
      orderCreatedAt: o.created_at,
      orderType: o.type as OrderType,
      warehouseId,
    })
  }

  return out
}

/** Completed-order line for one customer (person detail gross profit & sales analytics). */
export type PersonSaleLine = ProductSaleLine & { productId: string }

/**
 * Sales lines for one person from **completed** orders only.
 * Same shape as product analytics plus `productId` for per-line WAC.
 */
export async function getPersonSalesAnalytics(
  personId: string,
  filters?: ProductSalesAnalyticsFilters
): Promise<PersonSaleLine[]> {
  const { data, error } = await supabase
    .from(ORDER_ITEMS)
    .select(
      `
      id,
      quantity,
      unit_price,
      total_price,
      product_id,
      orders!inner (
        id,
        person_id,
        order_number,
        created_at,
        status_flow,
        type,
        warehouse_id
      )
    `
    )
    .eq('orders.person_id', personId)

  if (error) throw error

  type OrderEmbed = {
    id: string
    person_id: string | null
    order_number: number
    created_at: string
    status_flow: string
    type: string
    warehouse_id?: number | string | null
  }
  type RawRow = {
    id: string
    quantity: number
    unit_price: number
    total_price: number
    product_id: string
    orders: OrderEmbed | OrderEmbed[] | null
  }

  const rows = (data ?? []) as RawRow[]
  const out: PersonSaleLine[] = []

  for (const r of rows) {
    const o = Array.isArray(r.orders) ? r.orders[0] ?? null : r.orders
    if (!o || o.status_flow !== 'completed') continue

    const day = o.created_at.slice(0, 10)
    if (filters?.from && day < filters.from) continue
    if (filters?.to && day > filters.to) continue

    const whRaw = o.warehouse_id
    const warehouseId =
      whRaw != null && Number.isFinite(Number(whRaw))
        ? Math.trunc(Number(whRaw))
        : DEFAULT_WAREHOUSE_ID

    out.push({
      lineId: r.id,
      productId: String(r.product_id),
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      lineTotal: Number(r.total_price),
      orderId: o.id,
      orderNumber: Number(o.order_number),
      orderCreatedAt: o.created_at,
      orderType: o.type as OrderType,
      warehouseId,
    })
  }

  return out
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
  warehouse_id?: number
  /** Optional row timestamp (e.g. CSV import); omit for “now” */
  created_at?: string
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

  const payment_method: PaymentMethod | null =
    payments.length > 0 ? payments[0].payment_method : null

  const warehouse_id =
    data.warehouse_id != null && Number.isFinite(Number(data.warehouse_id))
      ? Math.trunc(Number(data.warehouse_id))
      : DEFAULT_WAREHOUSE_ID

  const orderPayload: Record<string, unknown> = {
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
    warehouse_id,
    is_historical_snapshot: false,
  }
  const docCreated = data.created_at?.trim()
  if (docCreated && !Number.isNaN(Date.parse(docCreated))) {
    orderPayload.created_at = new Date(docCreated).toISOString()
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
 * CSV / backfill: completed order visible in sales analytics only.
 * Does not post stock movements, register lines, or balance_transactions.
 */
export async function importHistoricalOrderSnapshot(data: {
  type: OrderType
  warehouse_id: number
  person_id: string | null
  note?: string | null
  discount_rate?: number
  /** Optional backfill document date (ISO). */
  created_at?: string | null
  items: PosOrderLineInput[]
}): Promise<OrderWithItemsAndPayments> {
  if (!data.items.length) {
    throw new Error('Order must have at least one item')
  }
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

  const dr = roundMoney(Math.min(100, Math.max(0, data.discount_rate ?? 0)))
  const lines = data.items.map((item) => {
    const ld = roundMoney(Math.min(100, item.line_discount_rate ?? 0))
    const gross = item.quantity * item.unit_price
    const lineTotal = roundMoney(gross * (1 - ld / 100))
    return { ...item, line_discount_rate: ld, lineTotal }
  })
  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0))
  const discount_amount = roundMoney(subtotal * (dr / 100))
  const total_amount = roundMoney(subtotal - discount_amount)

  const whId =
    data.warehouse_id != null && Number.isFinite(Number(data.warehouse_id))
      ? Math.trunc(Number(data.warehouse_id))
      : DEFAULT_WAREHOUSE_ID

  const { data: maxOrder, error: maxError } = await supabase
    .from(ORDERS)
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxError) throwHistoricalSnapshotMigrationError(maxError)
  const order_number = (maxOrder?.order_number ?? 0) + 1

  const payload: Record<string, unknown> = {
    order_number,
    type: data.type,
    status: 'completed' as OrderStatus,
    status_flow: 'completed' as OrderStatusFlow,
    payment_method: null,
    note: data.note?.trim() || null,
    total_amount,
    person_id: data.person_id ?? null,
    subtotal,
    discount_amount,
    discount_rate: dr,
    paid_amount: total_amount,
    remaining_amount: 0,
    allow_remaining_on_account: false,
    warehouse_id: whId,
    is_historical_snapshot: true,
    updated_at: new Date().toISOString(),
  }
  const ca = data.created_at?.trim()
  payload.created_at =
    ca && !Number.isNaN(Date.parse(ca))
      ? new Date(ca).toISOString()
      : new Date().toISOString()

  const { data: insertedOrder, error: orderError } = await supabase
    .from(ORDERS)
    .insert(payload)
    .select('id')
    .single()
  if (orderError) throwHistoricalSnapshotMigrationError(orderError)
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
  if (itemsError) throwHistoricalSnapshotMigrationError(itemsError)

  const created = await getOrderById(orderId)
  if (!created) throw new Error('Failed to fetch historical order')
  return created
}

/**
 * Writes `balance_transactions` for a confirmed order. When `personId` is null (walk-in),
 * rows are still recorded for the transaction log but `people.balance` is not updated.
 */
async function insertConfirmOrderLedgerLines(
  order: OrderWithItemsAndPayments,
  personId: string | null,
  registerWarehouseId: number
): Promise<void> {
  const total = roundMoney(order.total_amount)
  const paid = roundMoney(order.paid_amount)

  await insertBalanceTransactionRow({
    person_id: personId,
    type: 'order',
    amount: total,
    reference_id: order.id,
    reference_number: `O-${order.order_number}`,
    payment_method: null,
    payment_group_id: null,
    wallet_direction: null,
  })

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
            reference_number: `O-${order.order_number}`,
            note: inst.note?.trim() || 'Order payment',
            payment_method: inst.method,
            payment_group_id: paymentGroupId,
            wallet_direction: null,
            register_warehouse_id: registerWarehouseId,
          })
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
            reference_number: `O-${order.order_number}`,
            note,
            payment_method: null,
            payment_group_id: paymentGroupId,
            wallet_direction: 'out' as WalletDirection,
          })
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
          reference_number: `O-${order.order_number}`,
          note: 'Payment at confirmation',
          payment_method: null,
          payment_group_id: null,
          wallet_direction: null,
          register_warehouse_id: registerWarehouseId,
        })
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
          reference_number: `O-${order.order_number}`,
          note,
          payment_method: null,
          payment_group_id: null,
          wallet_direction: 'out' as WalletDirection,
        })
      }
    }
  }
}

/** Reverse walk-in ledger rows when a confirmed/completed order is cancelled (in-place void; no mirror rows). */
async function applyWalkInCancelLedger(order: OrderWithItemsAndPayments) {
  if (order.person_id) return
  await voidWalkInOrderCancelLedgerInPlace(order.id, order.order_number)
}

export async function confirmOrder(id: string): Promise<OrderWithItemsAndPayments> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  assertOrderNotHistoricalSnapshot(order, 'confirm')
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

  const whId =
    order.warehouse_id != null && Number.isFinite(Number(order.warehouse_id))
      ? Math.trunc(Number(order.warehouse_id))
      : DEFAULT_WAREHOUSE_ID
  const registerWhId = await resolveRegisterWarehouseForOrderConfirm(whId)
  const productIds = [...new Set(order.items.map((i) => i.product_id))]

  const { data: stockRpcRaw, error: stockRpcErr } = await supabase.rpc(
    'confirm_order_apply_stock_strict',
    { p_order_id: id }
  )
  if (stockRpcErr) throw stockRpcErr

  const stockRpcData =
    typeof stockRpcRaw === 'string'
      ? (JSON.parse(stockRpcRaw) as unknown)
      : stockRpcRaw

  const stockResult = stockRpcData as {
    ok?: boolean
    violations?: unknown
    error?: string
  } | null
  if (!stockResult?.ok) {
    const raw = stockResult?.violations
    const violations: {
      product_id: string
      product_name: string
      available: number
      needed: number
    }[] = []
    if (Array.isArray(raw)) {
      for (const v of raw) {
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>
          violations.push({
            product_id: String(o.product_id ?? ''),
            product_name: String(o.product_name ?? ''),
            available: Math.trunc(Number(o.available ?? 0)),
            needed: Math.trunc(Number(o.needed ?? 0)),
          })
        }
      }
    }
    if (violations.length > 0) {
      throw new InsufficientStockConfirmError(violations)
    }
    throw new Error(
      stockResult?.error === 'not_draft'
        ? 'Only draft orders can be confirmed'
        : stockResult?.error === 'order_not_found'
          ? 'Order not found'
          : stockResult?.error === 'historical_snapshot'
            ? 'Historical snapshot orders cannot be confirmed'
            : 'Could not confirm order stock'
    )
  }

  const confirmed = await getOrderById(id)
  if (!confirmed) throw new Error('Order not found after confirm')

  await insertConfirmOrderLedgerLines(
    confirmed,
    confirmed.person_id,
    registerWhId
  )

  await afterOrderStockMutation(productIds)

  if (confirmed.remaining_amount <= 0.01) {
    return completeOrder(id)
  }
  return confirmed
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

  assertOrderNotHistoricalSnapshot(order, 'complete')

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

/**
 * Person order cancel: void checkout `payment_in` + original `order` line in place.
 * Retain prepaid: same voids under the cancelled document, then standalone `payment_in` (and wallet
 * splits) duplicated at the original order ledger timestamp.
 */
async function applyPersonOrderCancelLedger(
  order: OrderWithItemsAndPayments,
  settlement: CancelOrderSettlement
) {
  if (!order.person_id) return

  const retain = settlement === 'retain_paid_as_wallet_credit'
  const paid = roundMoney(order.paid_amount)
  const total = roundMoney(order.total_amount)
  const refNum = `O-${order.order_number}`

  let orderLedgerAnchor: string | null = null
  if (retain && paid > 0.01) {
    orderLedgerAnchor = await getLedgerDocumentLineCreatedAt(
      order.id,
      refNum,
      'order',
      order.person_id
    )
  }

  const orderWhId =
    order.warehouse_id != null && Number.isFinite(Number(order.warehouse_id))
      ? Math.trunc(Number(order.warehouse_id))
      : DEFAULT_WAREHOUSE_ID

  const tenderRegisterPoolWorking =
    retain && paid > 0.01
      ? [...(await fetchActiveTenderRegistersForDocument(order.id, 'payment_in'))]
      : []
  const firstLedgerRegister =
    tenderRegisterPoolWorking.length > 0
      ? tenderRegisterPoolWorking[0].register_warehouse_id
      : null

  const routeIds = await listActiveLedgerPaymentOperationRouteIdsForDocument(
    order.id,
    refNum,
    'payment_in',
    order.person_id
  )
  await voidLedgerPaymentOperationsForDocumentCancel(routeIds)
  await voidLedgerOrderDocumentRowForCancel(
    order.id,
    order.order_number,
    order.person_id
  )

  if (retain && paid > 0.01) {
    const anchorIso = orderLedgerAnchor ?? new Date().toISOString()

    const registerForRetainedLine = async (
      method: PaymentMethod | null,
      lineAmount: number
    ) => {
      const m = method ?? 'cash'
      const matched = takeRegisterFromTenderPool(
        tenderRegisterPoolWorking,
        m,
        lineAmount
      )
      const prior = matched ?? firstLedgerRegister
      return resolveRegisterWarehouseForRetainedPayment(orderWhId, prior ?? null)
    }

    const insts = [...(order.payment_installments ?? [])]
      .filter((i) => roundMoney(i.amount) > 0.01)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      )

    let remainingToOrder = total

    if (insts.length > 0) {
      const paymentGroupId =
        insts.length > 1 ? crypto.randomUUID() : null
      const standaloneRef = await getNextStandaloneLedgerRef('payment_in')
      for (const inst of insts) {
        const a = roundMoney(inst.amount)
        const toward = roundMoney(Math.min(a, remainingToOrder))
        const walletPart = roundMoney(a - toward)

        if (toward > 0.01) {
          await insertBalanceTransactionRow({
            person_id: order.person_id,
            type: 'payment_in',
            amount: roundMoney(-toward),
            reference_id: null,
            reference_number: standaloneRef,
            note: appendLedgerDocSuffix(
              `Account credit from cancelled ${refNum} — order voided; separate ledger payment (no cash refund)`,
              order.id
            ),
            payment_method: inst.method,
            payment_group_id: paymentGroupId,
            wallet_direction: null,
            created_at: retainedPaymentCreatedAt(anchorIso),
            register_warehouse_id: await registerForRetainedLine(
              inst.method,
              toward
            ),
          })
          remainingToOrder = roundMoney(remainingToOrder - toward)
        }

        if (walletPart > 0.01) {
          await insertBalanceTransactionRow({
            person_id: order.person_id,
            type: 'wallet',
            amount: roundMoney(-walletPart),
            reference_id: null,
            reference_number: null,
            note: appendLedgerDocSuffix(
              `Wallet from cancelled ${refNum} — order voided; overpayment split (no cash refund)`,
              order.id
            ),
            payment_method: null,
            payment_group_id: paymentGroupId,
            wallet_direction: 'out' as WalletDirection,
            created_at: retainedPaymentCreatedAt(anchorIso),
          })
        }
      }
    } else if (order.payments && order.payments.length > 0) {
      const payLines = order.payments.filter(
        (p) => roundMoney(p.amount) > 0.01
      )
      const paymentGroupId =
        payLines.length > 1 ? crypto.randomUUID() : null
      const standaloneRef = await getNextStandaloneLedgerRef('payment_in')
      for (const p of payLines) {
        const a = roundMoney(p.amount)
        const toward = roundMoney(Math.min(a, remainingToOrder))
        const walletPart = roundMoney(a - toward)

        if (toward > 0.01) {
          await insertBalanceTransactionRow({
            person_id: order.person_id,
            type: 'payment_in',
            amount: roundMoney(-toward),
            reference_id: null,
            reference_number: standaloneRef,
            note: appendLedgerDocSuffix(
              `Account credit from cancelled ${refNum} — order voided; separate ledger payment (no cash refund)`,
              order.id
            ),
            payment_method: p.payment_method,
            payment_group_id: paymentGroupId,
            wallet_direction: null,
            created_at: retainedPaymentCreatedAt(anchorIso),
            register_warehouse_id: await registerForRetainedLine(
              p.payment_method,
              toward
            ),
          })
          remainingToOrder = roundMoney(remainingToOrder - toward)
        }

        if (walletPart > 0.01) {
          await insertBalanceTransactionRow({
            person_id: order.person_id,
            type: 'wallet',
            amount: roundMoney(-walletPart),
            reference_id: null,
            reference_number: null,
            note: appendLedgerDocSuffix(
              `Wallet from cancelled ${refNum} — order voided; overpayment split (no cash refund)`,
              order.id
            ),
            payment_method: null,
            payment_group_id: paymentGroupId,
            wallet_direction: 'out' as WalletDirection,
            created_at: retainedPaymentCreatedAt(anchorIso),
          })
        }
      }
    } else {
      const standaloneRef = await getNextStandaloneLedgerRef('payment_in')
      const toward = roundMoney(Math.min(paid, total))
      const walletPart = roundMoney(paid - toward)
      if (toward > 0.01) {
        await insertBalanceTransactionRow({
          person_id: order.person_id,
          type: 'payment_in',
          amount: roundMoney(-toward),
          reference_id: null,
          reference_number: standaloneRef,
          note: appendLedgerDocSuffix(
            `Account credit from cancelled ${refNum} — order voided; separate ledger payment (no cash refund)`,
            order.id
          ),
          payment_method: order.payment_method,
          payment_group_id: null,
          wallet_direction: null,
          created_at: retainedPaymentCreatedAt(anchorIso),
          register_warehouse_id: await registerForRetainedLine(
            order.payment_method,
            toward
          ),
        })
      }
      if (walletPart > 0.01) {
        await insertBalanceTransactionRow({
          person_id: order.person_id,
          type: 'wallet',
          amount: roundMoney(-walletPart),
          reference_id: null,
          reference_number: null,
          note: appendLedgerDocSuffix(
            `Wallet from cancelled ${refNum} — order voided; overpayment split (no cash refund)`,
            order.id
          ),
          payment_method: null,
          payment_group_id: null,
          wallet_direction: 'out' as WalletDirection,
          created_at: retainedPaymentCreatedAt(anchorIso),
        })
      }
    }

    return
  }
}

export async function cancelOrder(
  id: string,
  options?: { settlement?: CancelOrderSettlement }
): Promise<void> {
  const order = await getOrderById(id)
  if (!order) throw new Error('Order not found')
  assertOrderNotHistoricalSnapshot(order, 'cancel')
  if (order.status_flow === 'cancelled') {
    throw new Error('Order is already cancelled')
  }

  const settlement: CancelOrderSettlement =
    order.person_id &&
    options?.settlement === 'retain_paid_as_wallet_credit'
      ? 'retain_paid_as_wallet_credit'
      : 'reverse_payments'

  const restoreStock =
    order.status_flow === 'confirmed' || order.status_flow === 'completed'

  if (restoreStock) {
    const whId =
      order.warehouse_id != null && Number.isFinite(Number(order.warehouse_id))
        ? Math.trunc(Number(order.warehouse_id))
        : DEFAULT_WAREHOUSE_ID
    const note = `Restored from cancelled order #${order.order_number}`
    for (const item of order.items) {
      await adjustStock(item.product_id, 'in', item.quantity, note, {
        warehouseId: whId,
      })
    }

    const { error: delInstErr } = await supabase
      .from(PAYMENT_INSTALLMENTS)
      .delete()
      .eq('order_id', id)
    if (delInstErr) throw delInstErr

    const { error: delPayErr } = await supabase
      .from(ORDER_PAYMENTS)
      .delete()
      .eq('order_id', id)
    if (delPayErr) throw delPayErr

    if (order.person_id) {
      await applyPersonOrderCancelLedger(order, settlement)
    } else {
      await applyWalkInCancelLedger(order)
    }
  }

  const totalAmt = roundMoney(order.total_amount)
  const { error: updateError } = await supabase
    .from(ORDERS)
    .update({
      status_flow: 'cancelled',
      status: syncStatusFromFlow('cancelled'),
      ...(restoreStock
        ? { paid_amount: 0, remaining_amount: totalAmt }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) throw updateError

  if (restoreStock) {
    await afterOrderStockMutation(order.items.map((i) => i.product_id))
  }
}

/** Build draft payment splits for cloning from installments, legacy rows, or paid + primary method. */
function orderPaymentsPayloadForClone(
  order: OrderWithItemsAndPayments
): { payment_method: PaymentMethod; amount: number }[] {
  const out: { payment_method: PaymentMethod; amount: number }[] = []
  if (order.payment_installments?.length) {
    for (const pi of order.payment_installments) {
      const a = roundMoney(pi.amount)
      if (a > 0.001) out.push({ payment_method: pi.method, amount: a })
    }
    return out
  }
  if (order.payments?.length) {
    for (const p of order.payments) {
      const a = roundMoney(p.amount)
      if (a > 0.001)
        out.push({ payment_method: p.payment_method, amount: a })
    }
    return out
  }
  const paid = roundMoney(order.paid_amount)
  if (paid > 0.001 && order.payment_method) {
    out.push({ payment_method: order.payment_method, amount: paid })
  }
  return out
}

/**
 * Cancels the source order (same semantics as {@link cancelOrder}), then creates a new **draft**
 * order with the same warehouse, lines, discount rate, customer, note, and draft-style payment splits.
 * Ledger/register logic is unchanged: reuse cancel + create only.
 */
export async function cloneOrderAsReplacementDraft(
  id: string,
  options?: { settlement?: CancelOrderSettlement }
): Promise<OrderWithItemsAndPayments> {
  const source = await getOrderById(id)
  if (!source) throw new Error('Order not found')
  assertOrderNotHistoricalSnapshot(source, 'clone as replacement')
  if (source.status_flow === 'cancelled') {
    throw new Error('Order is already cancelled')
  }
  if (!source.items.length) {
    throw new Error('Order has no lines to copy')
  }

  const settlement: CancelOrderSettlement =
    source.person_id &&
    options?.settlement === 'retain_paid_as_wallet_credit'
      ? 'retain_paid_as_wallet_credit'
      : 'reverse_payments'

  const items: PosOrderLineInput[] = source.items.map((it) => ({
    product_id: it.product_id,
    quantity: it.quantity,
    unit_price: it.unit_price,
    line_discount_rate: it.line_discount_rate,
  }))
  const payments = orderPaymentsPayloadForClone(source)
  const baseNote = (source.note ?? '').trim()
  const cloneTag = `[from order #${source.order_number}]`
  const note = baseNote ? `${baseNote} ${cloneTag}` : cloneTag

  await cancelOrder(id, { settlement })

  const created = await createOrder({
    type: source.type,
    note,
    items,
    payments,
    person_id: source.person_id ?? undefined,
    apply_person_discount: false,
    order_discount_rate: source.discount_rate,
    allow_remaining_on_account: source.allow_remaining_on_account,
    warehouse_id: source.warehouse_id,
  })

  const { data: auth } = await supabase.auth.getUser()
  const u = auth.user
  const um = u?.user_metadata as Record<string, unknown> | undefined
  const operatorLabel =
    (typeof um?.username === 'string' && um.username.trim()) ||
    u?.email?.trim() ||
    null

  void insertStockAlert({
    alert_type: 'info',
    title: i18n.t('stockAlerts.orderCloneAdminTitle'),
    message: i18n.t('stockAlerts.orderCloneAdminMessage', {
      source: source.order_number,
      dest: created.order_number,
      operator: operatorLabel ?? i18n.t('stockAlerts.unknownOperator'),
    }),
    meta: {
      admin_only: true,
      kind: 'order_replacement_draft',
      source_order_id: source.id,
      source_order_number: source.order_number,
      new_order_id: created.id,
      new_order_number: created.order_number,
    },
  }).catch((e) => {
    console.warn('insertStockAlert order clone', e)
  })

  return created
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
  assertOrderNotHistoricalSnapshot(order, 'add payment')
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
  assertOrderNotHistoricalSnapshot(order, 'edit lines')
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
  assertOrderNotHistoricalSnapshot(order, 'change discount')
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
  assertOrderNotHistoricalSnapshot(order, 'change payments')
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
    warehouse_id?: number
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
  if (data.warehouse_id !== undefined) {
    const wid =
      data.warehouse_id != null && Number.isFinite(Number(data.warehouse_id))
        ? Math.trunc(Number(data.warehouse_id))
        : DEFAULT_WAREHOUSE_ID
    const { error: whErr } = await supabase
      .from(ORDERS)
      .update({
        warehouse_id: wid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (whErr) throw whErr
  }
  const o = await getOrderById(id)
  if (!o) throw new Error('Order not found')
  return o
}

export async function updateOrderNote(
  id: string,
  note: string
): Promise<Order> {
  const existing = await getOrderById(id)
  if (!existing) throw new Error('Order not found')
  assertOrderNotHistoricalSnapshot(existing, 'update note')
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
  assertOrderNotHistoricalSnapshot(order, 'update customer/discount')
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
