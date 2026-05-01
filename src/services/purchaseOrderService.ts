import i18n from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
import { recalculateStockFromMovements } from '@/services/stockReconcileService'
import {
  DEFAULT_WAREHOUSE_ID,
  fetchActiveTenderRegistersForDocument,
  resolveRegisterWarehouseForRetainedPayment,
  takeRegisterFromTenderPool,
} from '@/services/warehouseService'
import { getProductById } from '@/services/productService'
import { updateProduct } from '@/services/productService'
import {
  getLedgerDocumentLineCreatedAt,
  getNextStandaloneLedgerRef,
  insertBalanceTransactionRow,
  listActiveLedgerPaymentOperationRouteIdsForDocument,
  mapPersonRow,
  roundMoney,
  supabaseErrorMessage,
  throwHistoricalSnapshotMigrationError,
  voidLedgerPaymentOperationsForDocumentCancel,
  voidLedgerPurchaseOrderDocumentRowForCancel,
} from '@/services/peopleService'
import { insertPurchaseOrderPaymentsRows } from '@/services/paymentInstallmentInserts'
import { insertStockAlert } from '@/services/stockAlertsService'
import { createPurchaseOrderPayment } from '@/services/paymentService'
import {
  appendLedgerDocSuffix,
  retainedPaymentCreatedAt,
} from '@/utils/ledgerDocSuffix'
import type {
  PurchaseOrder,
  PurchaseOrderWithItems,
  PurchaseOrderItemWithProduct,
  PurchaseOrderPayment,
  PurchaseOrderStatus,
  PaymentMethod,
  Product,
  WalletDirection,
} from '@/types'

const PURCHASE_ORDERS = 'purchase_orders'
const PURCHASE_ORDER_ITEMS = 'purchase_order_items'
const PURCHASE_ORDER_PAYMENTS = 'purchase_order_payments'

async function afterPoStockMutation(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds)].filter(Boolean)
  if (!ids.length) return
  try {
    await recalculateStockFromMovements(ids)
  } catch {
    /* unmigrated DB */
  }
}

export type PurchaseOrderFilters = {
  status?: PurchaseOrderStatus
  search?: string
  from?: string
  to?: string
  historical_snapshot?: 'all' | 'only' | 'exclude'
}

function assertPurchaseOrderNotHistoricalSnapshot(
  order: PurchaseOrderWithItems,
  action: string
): void {
  if (order.is_historical_snapshot) {
    throw new Error(`HISTORICAL_PO_IMMUTABLE: ${action}`)
  }
}

function toPurchaseOrderWithItems(row: {
  id: string
  order_number: number
  supplier_name: string | null
  note: string | null
  total_amount: number
  subtotal?: number | null
  discount_amount?: number | null
  discount_rate?: number | null
  paid_amount?: number
  remaining_amount?: number
  status: PurchaseOrderStatus
  person_id: string | null
  warehouse_id?: number | string | null
  created_at: string
  updated_at: string
  purchase_order_items?: Array<{
    id: string
    purchase_order_id: string
    product_id: string
    quantity: number
    cost_price: number
    line_discount_rate?: number | null
    total_price: number
    previous_cost_price: number | null
    cost_price_updated: boolean
    catalog_customer_price?: number | null
    catalog_business_price?: number | null
    previous_customer_price?: number | null
    previous_business_price?: number | null
    created_at: string
    product: Product
  }>
}): PurchaseOrderWithItems {
  const { purchase_order_items, ...orderRest } = row
  const total = roundMoney(Number(orderRest.total_amount))
  const paid = roundMoney(Number(orderRest.paid_amount ?? 0))
  const remaining_amount =
    orderRest.remaining_amount != null
      ? roundMoney(Number(orderRest.remaining_amount))
      : roundMoney(total - paid)
  const whRaw = orderRest.warehouse_id
  const warehouse_id =
    whRaw != null && whRaw !== '' && Number.isFinite(Number(whRaw))
      ? Number(whRaw)
      : DEFAULT_WAREHOUSE_ID
  const subtotal =
    orderRest.subtotal != null
      ? roundMoney(Number(orderRest.subtotal))
      : total
  const discount_amount =
    orderRest.discount_amount != null
      ? roundMoney(Number(orderRest.discount_amount))
      : 0
  const discount_rate =
    orderRest.discount_rate != null
      ? roundMoney(Number(orderRest.discount_rate))
      : 0
  const order = {
    ...orderRest,
    person_id: orderRest.person_id ?? null,
    warehouse_id,
    subtotal,
    discount_amount,
    discount_rate,
    paid_amount: paid,
    remaining_amount,
    is_historical_snapshot: Boolean(
      (orderRest as { is_historical_snapshot?: boolean }).is_historical_snapshot
    ),
  }
  const items: PurchaseOrderItemWithProduct[] = (purchase_order_items ?? []).map(
    (poi) => ({
      id: poi.id,
      purchase_order_id: poi.purchase_order_id,
      product_id: poi.product_id,
      quantity: poi.quantity,
      cost_price: poi.cost_price,
      line_discount_rate: roundMoney(
        Number(poi.line_discount_rate ?? 0)
      ),
      total_price: poi.total_price,
      previous_cost_price: poi.previous_cost_price,
      cost_price_updated: poi.cost_price_updated,
      catalog_customer_price:
        poi.catalog_customer_price != null
          ? Number(poi.catalog_customer_price)
          : null,
      catalog_business_price:
        poi.catalog_business_price != null
          ? Number(poi.catalog_business_price)
          : null,
      previous_customer_price:
        poi.previous_customer_price != null
          ? Number(poi.previous_customer_price)
          : null,
      previous_business_price:
        poi.previous_business_price != null
          ? Number(poi.previous_business_price)
          : null,
      created_at: poi.created_at,
      product: poi.product,
    })
  )
  return { ...order, items }
}

/** When `purchase_order_payments` exist, derive paid/remaining (works without DB columns). */
function applyPaidRemainingFromPayments(
  o: PurchaseOrderWithItems
): PurchaseOrderWithItems {
  const pays = o.payments
  if (!pays?.length) return o
  const total = roundMoney(o.total_amount)
  const sum = roundMoney(pays.reduce((s, p) => s + p.amount, 0))
  let paid_amount: number
  let remaining_amount: number
  if (sum > total + 0.01) {
    paid_amount = total
    remaining_amount = 0
  } else {
    paid_amount = roundMoney(sum)
    remaining_amount = roundMoney(total - paid_amount)
  }
  return { ...o, paid_amount, remaining_amount }
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
        product:products(
          *,
          brand:brands(name),
          category:categories(name)
        )
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
  if (filters?.historical_snapshot === 'only') {
    query = query.eq('is_historical_snapshot', true)
  }
  if (filters?.historical_snapshot === 'exclude') {
    query = query.eq('is_historical_snapshot', false)
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

  return orders.map(applyPaidRemainingFromPayments)
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
        product:products(
          *,
          brand:brands(name),
          category:categories(name)
        )
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
  return applyPaidRemainingFromPayments(order)
}

export async function updatePurchaseOrderNote(
  id: string,
  note: string
): Promise<void> {
  const existing = await getPurchaseOrderById(id)
  if (!existing) throw new Error('Purchase order not found')
  assertPurchaseOrderNotHistoricalSnapshot(existing, 'update note')
  const trimmed = note.trim()
  const { error } = await supabase
    .from(PURCHASE_ORDERS)
    .update({
      note: trimmed || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
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
        product:products(
          *,
          brand:brands(name),
          category:categories(name)
        )
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
  return orders.map(applyPaidRemainingFromPayments)
}

/** One line from a **received** PO for supplier analytics on the person detail page. */
export type SupplierPurchaseLine = {
  lineId: string
  productId: string
  quantity: number
  lineTotal: number
  purchaseOrderId: string
  orderNumber: number
  createdAt: string
}

export type SupplierPurchaseAnalyticsFilters = {
  from?: string
  to?: string
}

/**
 * Purchase lines for one supplier from **received** POs only (mirrors completed orders for sales).
 */
export async function getSupplierPurchaseLinesAnalytics(
  personId: string,
  filters?: SupplierPurchaseAnalyticsFilters
): Promise<SupplierPurchaseLine[]> {
  const { data, error } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .select(
      `
      id,
      quantity,
      total_price,
      product_id,
      purchase_orders!inner (
        id,
        person_id,
        order_number,
        created_at,
        status
      )
    `
    )
    .eq('purchase_orders.person_id', personId)
    .eq('purchase_orders.status', 'received')

  if (error) throw error

  type PoEmbed = {
    id: string
    person_id: string | null
    order_number: number
    created_at: string
    status: string
  }
  type RawRow = {
    id: string
    quantity: number
    total_price: number
    product_id: string
    purchase_orders: PoEmbed | PoEmbed[] | null
  }

  const rows = (data ?? []) as RawRow[]
  const out: SupplierPurchaseLine[] = []

  for (const r of rows) {
    const po = Array.isArray(r.purchase_orders)
      ? r.purchase_orders[0] ?? null
      : r.purchase_orders
    if (!po) continue

    const day = po.created_at.slice(0, 10)
    if (filters?.from && day < filters.from) continue
    if (filters?.to && day > filters.to) continue

    out.push({
      lineId: r.id,
      productId: String(r.product_id),
      quantity: Number(r.quantity),
      lineTotal: Number(r.total_price),
      purchaseOrderId: po.id,
      orderNumber: Number(po.order_number),
      createdAt: po.created_at,
    })
  }

  return out
}

/** Received PO line for one product (for product detail analytics). */
export type ProductPurchaseLine = {
  lineId: string
  quantity: number
  lineTotal: number
  purchaseOrderId: string
  orderNumber: number
  createdAt: string
  warehouseId: number
}

export type ProductPurchaseAnalyticsFilters = {
  from?: string
  to?: string
}

/**
 * Purchase lines for one product from **received** POs only.
 * Date filters apply to the parent PO's `created_at` (local calendar day).
 */
export async function getProductPurchaseAnalytics(
  productId: string,
  filters?: ProductPurchaseAnalyticsFilters
): Promise<ProductPurchaseLine[]> {
  const { data, error } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .select(
      `
      id,
      quantity,
      total_price,
      purchase_orders!inner (
        id,
        order_number,
        created_at,
        status,
        warehouse_id
      )
    `
    )
    .eq('product_id', productId)
    .eq('purchase_orders.status', 'received')

  if (error) throw error

  type PoEmbed = {
    id: string
    order_number: number
    created_at: string
    status: string
    warehouse_id?: number | string | null
  }
  type RawRow = {
    id: string
    quantity: number
    total_price: number
    purchase_orders: PoEmbed | PoEmbed[] | null
  }

  const rows = (data ?? []) as RawRow[]
  const out: ProductPurchaseLine[] = []

  for (const r of rows) {
    const po = Array.isArray(r.purchase_orders)
      ? r.purchase_orders[0] ?? null
      : r.purchase_orders
    if (!po) continue

    const day = po.created_at.slice(0, 10)
    if (filters?.from && day < filters.from) continue
    if (filters?.to && day > filters.to) continue

    const whRaw = po.warehouse_id
    const warehouseId =
      whRaw != null && Number.isFinite(Number(whRaw))
        ? Math.trunc(Number(whRaw))
        : DEFAULT_WAREHOUSE_ID

    out.push({
      lineId: r.id,
      quantity: Number(r.quantity),
      lineTotal: Number(r.total_price),
      purchaseOrderId: po.id,
      orderNumber: Number(po.order_number),
      createdAt: po.created_at,
      warehouseId,
    })
  }

  return out
}

export async function createPurchaseOrder(data: {
  supplier_name?: string
  note?: string
  person_id?: string
  /** When true, unpaid remainder stays on the supplier balance (payables). */
  allow_remaining_on_account?: boolean
  /** Payments made now; remainder may stay on account if allowed. */
  payments?: { payment_method: PaymentMethod; amount: number }[]
  items: {
    product_id: string
    quantity: number
    cost_price: number
    /** Per-line discount % (0–100), same shape as sales order lines */
    line_discount_rate?: number
    update_default_cost_price: boolean
    /** When set with catalog_business_price, receive updates retail + wholesale + cost on the product. */
    catalog_customer_price?: number | null
    catalog_business_price?: number | null
  }[]
  /** When true (default), use supplier person discount % unless `order_discount_rate` is set. */
  apply_supplier_discount?: boolean
  /** Manual PO-level discount % (0–100); when set, overrides supplier rate (same rules as sales orders). */
  order_discount_rate?: number
  /** Save as draft: no stock, ledger, or payments until confirmed. */
  asDraft?: boolean
  warehouse_id?: number
  /** When PO warehouse has no register, pick which register books supplier payments. */
  register_warehouse_id?: number | null
  /** Optional row timestamp (e.g. CSV import); omit for “now” */
  created_at?: string
}): Promise<PurchaseOrderWithItems> {
  if (!data.items.length) {
    throw new Error('At least one product is required')
  }

  if (!data.person_id?.trim()) {
    throw new Error(
      'Select a supplier from your directory. Walk-in and unlinked suppliers are not allowed for purchase orders.'
    )
  }

  const asDraft = Boolean(data.asDraft)
  const supplierId = data.person_id.trim()
  const { data: prow, error: peSup } = await supabase
    .from('people')
    .select('*')
    .eq('id', supplierId)
    .maybeSingle()
  if (peSup) throw peSup
  if (!prow) throw new Error('Supplier not found')
  const supplierPerson = mapPersonRow(prow as Record<string, unknown>)
  if (!supplierPerson.roles.includes('supplier')) {
    throw new Error('Selected person must have the supplier role')
  }

  // 1. Snapshot catalog prices per product (for previous_* on lines and rollback)
  type ProductPriceSnap = {
    cost: number
    customer: number
    business: number
  }
  const productSnap = new Map<string, ProductPriceSnap>()
  for (const item of data.items) {
    if (productSnap.has(item.product_id)) continue
    const product = await getProductById(item.product_id)
    if (!product) throw new Error(`Product not found: ${item.product_id}`)
    productSnap.set(item.product_id, {
      cost: product.cost_price,
      customer: product.customer_price,
      business: product.business_price,
    })
  }

  // 2. Line totals (after line discount), subtotal, order-level discount, total
  let poDiscountRate = 0
  if (
    data.order_discount_rate != null &&
    !Number.isNaN(data.order_discount_rate) &&
    data.order_discount_rate >= 0
  ) {
    poDiscountRate = roundMoney(Math.min(100, data.order_discount_rate))
  } else if (
    data.apply_supplier_discount !== false &&
    supplierPerson.discount_rate > 0
  ) {
    poDiscountRate = supplierPerson.discount_rate
  }

  const computedLines = data.items.map((item) => {
    const ld = roundMoney(Math.min(100, item.line_discount_rate ?? 0))
    const gross = item.quantity * item.cost_price
    const lineTotal = roundMoney(gross * (1 - ld / 100))
    return { ...item, line_discount_rate: ld, lineTotal }
  })

  const subtotal = roundMoney(
    computedLines.reduce((s, l) => s + l.lineTotal, 0)
  )
  const discount_amount = roundMoney(subtotal * (poDiscountRate / 100))
  const total_amount = roundMoney(subtotal - discount_amount)

  const payments = (data.payments ?? [])
    .map((p) => ({
      payment_method: p.payment_method,
      amount: roundMoney(p.amount),
    }))
    .filter((p) => p.amount > 0.001)
  const total = roundMoney(total_amount)
  const paymentsSum = roundMoney(
    payments.reduce((s, p) => s + p.amount, 0)
  )
  const paid_amount = roundMoney(
    paymentsSum > total ? total : paymentsSum
  )
  const remaining_amount = roundMoney(total - paid_amount)
  const allowRem = Boolean(data.allow_remaining_on_account)
  if (!asDraft && remaining_amount > 0.01) {
    if (!allowRem) {
      throw new Error(
        'Pay the full amount or enable adding the remainder to the supplier balance'
      )
    }
  }

  // 3. Insert purchase_order (omit paid_amount/remaining_amount so DBs without migration 009 still work;
  //    paid/remaining are derived from purchase_order_payments in applyPaidRemainingFromPayments.)
  const warehouse_id =
    data.warehouse_id != null && Number.isFinite(Number(data.warehouse_id))
      ? Math.trunc(Number(data.warehouse_id))
      : DEFAULT_WAREHOUSE_ID

  const orderPayload: Record<string, unknown> = {
    supplier_name: data.supplier_name?.trim() || null,
    note: data.note?.trim() || null,
    subtotal,
    discount_amount,
    discount_rate: poDiscountRate,
    total_amount: total,
    status: (asDraft ? 'draft' : 'received') as PurchaseOrderStatus,
    person_id: supplierId,
    warehouse_id,
    is_historical_snapshot: false,
  }
  const docTs = data.created_at?.trim()
  if (docTs && !Number.isNaN(Date.parse(docTs))) {
    orderPayload.created_at = new Date(docTs).toISOString()
  }

  const { data: insertedOrder, error: orderError } = await supabase
    .from(PURCHASE_ORDERS)
    .insert(orderPayload)
    .select()
    .single()

  if (orderError) throw orderError
  const orderId = (insertedOrder as PurchaseOrder).id

  if (!asDraft && payments.length > 0) {
    try {
      await insertPurchaseOrderPaymentsRows(
        payments.map((p) => ({
          purchase_order_id: orderId,
          payment_method: p.payment_method,
          amount: p.amount,
        }))
      )
    } catch (e: unknown) {
      const msg = supabaseErrorMessage(e).toLowerCase()
      const code =
        typeof e === 'object' && e !== null && 'code' in e
          ? String((e as { code: unknown }).code)
          : ''
      const tableMissing =
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        code === '42P01'
      if (!tableMissing) throw e
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
    catalog_customer_price: number | null
    catalog_business_price: number | null
    previous_customer_price: number | null
    previous_business_price: number | null
  }> = computedLines.map((item) => {
    const snap = productSnap.get(item.product_id)!
    const fullCatalog =
      item.update_default_cost_price &&
      item.catalog_customer_price != null &&
      item.catalog_business_price != null
    return {
      purchase_order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      cost_price: item.cost_price,
      line_discount_rate: item.line_discount_rate,
      total_price: item.lineTotal,
      previous_cost_price: snap.cost,
      previous_customer_price: snap.customer,
      previous_business_price: snap.business,
      cost_price_updated: item.update_default_cost_price,
      catalog_customer_price: fullCatalog ? item.catalog_customer_price! : null,
      catalog_business_price: fullCatalog ? item.catalog_business_price! : null,
    }
  })

  const { error: itemsError } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .insert(itemsPayload)

  if (itemsError) throw itemsError

  const createdForNumber = await getPurchaseOrderById(orderId)
  const assignedPoNumber = createdForNumber?.order_number

  if (!asDraft && assignedPoNumber != null) {
    const note = `Purchase Order #${assignedPoNumber}`
    for (const item of computedLines) {
      await adjustStock(item.product_id, 'in', item.quantity, note, {
        inboundUnitCost: item.cost_price,
        warehouseId: warehouse_id,
      })
    }

    for (const item of computedLines) {
      if (item.update_default_cost_price) {
        const full =
          item.catalog_customer_price != null &&
          item.catalog_business_price != null
        await updateProduct(
          item.product_id,
          full
            ? {
                cost_price: item.cost_price,
                customer_price: item.catalog_customer_price!,
                business_price: item.catalog_business_price!,
              }
            : { cost_price: item.cost_price }
        )
      }
    }

    await createPurchaseOrderPayment({
      personId: supplierId,
      purchaseOrderId: orderId,
      orderNumber: assignedPoNumber,
      totalAmount: total,
      payments,
      poWarehouseId: warehouse_id,
      registerWarehouseId: data.register_warehouse_id,
    })

    await afterPoStockMutation(computedLines.map((i) => i.product_id))
  }

  // Return created PurchaseOrderWithItems
  const created = await getPurchaseOrderById(orderId)
  if (!created) throw new Error('Failed to fetch created purchase order')
  return created
}

/** Replace draft PO lines and header totals (no stock, ledger, or confirm). */
export async function saveDraftPurchaseOrder(
  id: string,
  data: {
    supplier_name?: string
    note?: string
    person_id: string
    items: {
      product_id: string
      quantity: number
      cost_price: number
      line_discount_rate?: number
      update_default_cost_price: boolean
      catalog_customer_price?: number | null
      catalog_business_price?: number | null
    }[]
    apply_supplier_discount?: boolean
    order_discount_rate?: number
    warehouse_id?: number
  }
): Promise<PurchaseOrderWithItems> {
  const existing = await getPurchaseOrderById(id)
  if (!existing) throw new Error('Purchase order not found')
  assertPurchaseOrderNotHistoricalSnapshot(existing, 'save draft')
  if (existing.status !== 'draft') {
    throw new Error('Only draft purchase orders can be edited')
  }

  if (!data.items.length) {
    throw new Error('At least one product is required')
  }

  const supplierId = data.person_id.trim()
  const { data: prow, error: peSup } = await supabase
    .from('people')
    .select('*')
    .eq('id', supplierId)
    .maybeSingle()
  if (peSup) throw peSup
  if (!prow) throw new Error('Supplier not found')
  const supplierPerson = mapPersonRow(prow as Record<string, unknown>)
  if (!supplierPerson.roles.includes('supplier')) {
    throw new Error('Selected person must have the supplier role')
  }

  type ProductPriceSnap = {
    cost: number
    customer: number
    business: number
  }
  const productSnap = new Map<string, ProductPriceSnap>()
  for (const item of data.items) {
    if (productSnap.has(item.product_id)) continue
    const product = await getProductById(item.product_id)
    if (!product) throw new Error(`Product not found: ${item.product_id}`)
    productSnap.set(item.product_id, {
      cost: product.cost_price,
      customer: product.customer_price,
      business: product.business_price,
    })
  }

  let poDiscountRate = 0
  if (
    data.order_discount_rate != null &&
    !Number.isNaN(data.order_discount_rate) &&
    data.order_discount_rate >= 0
  ) {
    poDiscountRate = roundMoney(Math.min(100, data.order_discount_rate))
  } else if (
    data.apply_supplier_discount !== false &&
    supplierPerson.discount_rate > 0
  ) {
    poDiscountRate = supplierPerson.discount_rate
  }

  const computedLines = data.items.map((item) => {
    const ld = roundMoney(Math.min(100, item.line_discount_rate ?? 0))
    const gross = item.quantity * item.cost_price
    const lineTotal = roundMoney(gross * (1 - ld / 100))
    return { ...item, line_discount_rate: ld, lineTotal }
  })

  const subtotal = roundMoney(
    computedLines.reduce((s, l) => s + l.lineTotal, 0)
  )
  const discount_amount = roundMoney(subtotal * (poDiscountRate / 100))
  const total_amount = roundMoney(subtotal - discount_amount)

  const warehouse_id =
    data.warehouse_id != null && Number.isFinite(Number(data.warehouse_id))
      ? Math.trunc(Number(data.warehouse_id))
      : DEFAULT_WAREHOUSE_ID

  const { error: updOrderErr } = await supabase
    .from(PURCHASE_ORDERS)
    .update({
      supplier_name: data.supplier_name?.trim() || null,
      note: data.note?.trim() || null,
      subtotal,
      discount_amount,
      discount_rate: poDiscountRate,
      total_amount,
      person_id: supplierId,
      warehouse_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updOrderErr) throw updOrderErr

  const { error: delErr } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .delete()
    .eq('purchase_order_id', id)
  if (delErr) throw delErr

  const itemsPayload = computedLines.map((item) => {
    const snap = productSnap.get(item.product_id)!
    const fullCatalog =
      item.update_default_cost_price &&
      item.catalog_customer_price != null &&
      item.catalog_business_price != null
    return {
      purchase_order_id: id,
      product_id: item.product_id,
      quantity: item.quantity,
      cost_price: item.cost_price,
      line_discount_rate: item.line_discount_rate,
      total_price: item.lineTotal,
      previous_cost_price: snap.cost,
      previous_customer_price: snap.customer,
      previous_business_price: snap.business,
      cost_price_updated: item.update_default_cost_price,
      catalog_customer_price: fullCatalog ? item.catalog_customer_price! : null,
      catalog_business_price: fullCatalog ? item.catalog_business_price! : null,
    }
  })

  const { error: itemsError } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .insert(itemsPayload)
  if (itemsError) throw itemsError

  const out = await getPurchaseOrderById(id)
  if (!out) throw new Error('Failed to fetch purchase order')
  return out
}

/**
 * CSV / backfill: received PO visible in purchase analytics only.
 * No stock in, no catalog price updates, no supplier ledger/register.
 */
export async function importHistoricalPurchaseOrderSnapshot(data: {
  person_id: string
  supplier_name?: string | null
  note?: string | null
  order_discount_rate?: number
  created_at?: string | null
  warehouse_id?: number
  items: {
    product_id: string
    quantity: number
    cost_price: number
    line_discount_rate?: number
    update_default_cost_price: boolean
    catalog_customer_price?: number | null
    catalog_business_price?: number | null
  }[]
}): Promise<PurchaseOrderWithItems> {
  if (!data.items.length) {
    throw new Error('At least one product is required')
  }
  const supplierId = data.person_id.trim()
  const { data: prow, error: peSup } = await supabase
    .from('people')
    .select('*')
    .eq('id', supplierId)
    .maybeSingle()
  if (peSup) throw peSup
  if (!prow) throw new Error('Supplier not found')
  const supplierPerson = mapPersonRow(prow as Record<string, unknown>)
  if (!supplierPerson.roles.includes('supplier')) {
    throw new Error('Selected person must have the supplier role')
  }

  type ProductPriceSnap = { cost: number; customer: number; business: number }
  const productSnap = new Map<string, ProductPriceSnap>()
  for (const item of data.items) {
    if (productSnap.has(item.product_id)) continue
    const product = await getProductById(item.product_id)
    if (!product) throw new Error(`Product not found: ${item.product_id}`)
    productSnap.set(item.product_id, {
      cost: product.cost_price,
      customer: product.customer_price,
      business: product.business_price,
    })
  }

  let poDiscountRate = 0
  if (
    data.order_discount_rate != null &&
    !Number.isNaN(data.order_discount_rate) &&
    data.order_discount_rate >= 0
  ) {
    poDiscountRate = roundMoney(Math.min(100, data.order_discount_rate))
  } else if (supplierPerson.discount_rate > 0) {
    poDiscountRate = supplierPerson.discount_rate
  }

  const computedLines = data.items.map((item) => {
    const ld = roundMoney(Math.min(100, item.line_discount_rate ?? 0))
    const gross = item.quantity * item.cost_price
    const lineTotal = roundMoney(gross * (1 - ld / 100))
    return { ...item, line_discount_rate: ld, lineTotal }
  })

  const subtotal = roundMoney(
    computedLines.reduce((s, l) => s + l.lineTotal, 0)
  )
  const discount_amount = roundMoney(subtotal * (poDiscountRate / 100))
  const total_amount = roundMoney(subtotal - discount_amount)
  const total = roundMoney(total_amount)

  const { data: maxRow, error: maxError } = await supabase
    .from(PURCHASE_ORDERS)
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxError) throw maxError
  const order_number = (maxRow?.order_number ?? 0) + 1

  const warehouse_id =
    data.warehouse_id != null && Number.isFinite(Number(data.warehouse_id))
      ? Math.trunc(Number(data.warehouse_id))
      : DEFAULT_WAREHOUSE_ID

  const payload: Record<string, unknown> = {
    order_number,
    supplier_name:
      data.supplier_name?.trim() || supplierPerson.name || null,
    note: data.note?.trim() || null,
    subtotal,
    discount_amount,
    discount_rate: poDiscountRate,
    total_amount: total,
    status: 'received' as PurchaseOrderStatus,
    person_id: supplierId,
    warehouse_id,
    paid_amount: total,
    remaining_amount: 0,
    is_historical_snapshot: true,
    updated_at: new Date().toISOString(),
  }
  const ca = data.created_at?.trim()
  payload.created_at =
    ca && !Number.isNaN(Date.parse(ca))
      ? new Date(ca).toISOString()
      : new Date().toISOString()

  const { data: insertedOrder, error: orderError } = await supabase
    .from(PURCHASE_ORDERS)
    .insert(payload)
    .select()
    .single()
  if (orderError) throwHistoricalSnapshotMigrationError(orderError)
  const orderId = (insertedOrder as PurchaseOrder).id

  const itemsPayload = computedLines.map((item) => {
    const snap = productSnap.get(item.product_id)!
    const fullCatalog =
      item.update_default_cost_price &&
      item.catalog_customer_price != null &&
      item.catalog_business_price != null
    return {
      purchase_order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      cost_price: item.cost_price,
      line_discount_rate: item.line_discount_rate,
      total_price: item.lineTotal,
      previous_cost_price: snap.cost,
      previous_customer_price: snap.customer,
      previous_business_price: snap.business,
      cost_price_updated: item.update_default_cost_price,
      catalog_customer_price: fullCatalog ? item.catalog_customer_price! : null,
      catalog_business_price: fullCatalog ? item.catalog_business_price! : null,
    }
  })

  const { error: itemsError } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .insert(itemsPayload)
  if (itemsError) throwHistoricalSnapshotMigrationError(itemsError)

  const out = await getPurchaseOrderById(orderId)
  if (!out) throw new Error('Failed to fetch historical purchase order')
  return out
}

export async function confirmPurchaseOrder(
  id: string,
  data: {
    payments?: { payment_method: PaymentMethod; amount: number }[]
    allow_remaining_on_account?: boolean
    note?: string | null
    register_warehouse_id?: number | null
  }
): Promise<PurchaseOrderWithItems> {
  const order = await getPurchaseOrderById(id)
  if (!order) throw new Error('Purchase order not found')
  assertPurchaseOrderNotHistoricalSnapshot(order, 'confirm')
  if (order.status !== 'draft') {
    throw new Error('Only draft purchase orders can be confirmed')
  }
  if (!order.person_id?.trim()) {
    throw new Error('Supplier is required')
  }
  const supplierId = order.person_id.trim()

  const payments = (data.payments ?? [])
    .map((p) => ({
      payment_method: p.payment_method,
      amount: roundMoney(p.amount),
    }))
    .filter((p) => p.amount > 0.001)
  const total = roundMoney(order.total_amount)
  const paymentsSum = roundMoney(
    payments.reduce((s, p) => s + p.amount, 0)
  )
  const paid_amount = roundMoney(
    paymentsSum > total ? total : paymentsSum
  )
  const remaining_amount = roundMoney(total - paid_amount)
  const allowRem = Boolean(data.allow_remaining_on_account)
  if (remaining_amount > 0.01) {
    if (!allowRem) {
      throw new Error(
        'Pay the full amount or enable adding the remainder to the supplier balance'
      )
    }
  }

  if (payments.length > 0) {
    try {
      await insertPurchaseOrderPaymentsRows(
        payments.map((p) => ({
          purchase_order_id: id,
          payment_method: p.payment_method,
          amount: p.amount,
        }))
      )
    } catch (e: unknown) {
      const msg = supabaseErrorMessage(e).toLowerCase()
      const code =
        typeof e === 'object' && e !== null && 'code' in e
          ? String((e as { code: unknown }).code)
          : ''
      const tableMissing =
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        code === '42P01'
      if (!tableMissing) throw e
    }
  }

  const whId =
    order.warehouse_id != null && Number.isFinite(Number(order.warehouse_id))
      ? Math.trunc(Number(order.warehouse_id))
      : DEFAULT_WAREHOUSE_ID
  const stockNote = `Purchase Order #${order.order_number}`
  for (const item of order.items) {
    await adjustStock(item.product_id, 'in', item.quantity, stockNote, {
      inboundUnitCost: item.cost_price,
      warehouseId: whId,
    })
  }

  for (const item of order.items) {
    if (item.cost_price_updated) {
      const full =
        item.catalog_customer_price != null &&
        item.catalog_business_price != null
      await updateProduct(
        item.product_id,
        full
          ? {
              cost_price: item.cost_price,
              customer_price: item.catalog_customer_price!,
              business_price: item.catalog_business_price!,
            }
          : { cost_price: item.cost_price }
      )
    }
  }

  await createPurchaseOrderPayment({
    personId: supplierId,
    purchaseOrderId: id,
    orderNumber: order.order_number,
    totalAmount: total,
    payments,
    poWarehouseId: whId,
    registerWarehouseId: data.register_warehouse_id,
  })

  const noteUp =
    data.note !== undefined
      ? (data.note?.trim() ?? '') || null
      : undefined
  const { error: updErr } = await supabase
    .from(PURCHASE_ORDERS)
    .update({
      status: 'received' as PurchaseOrderStatus,
      ...(noteUp !== undefined ? { note: noteUp } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updErr) throw updErr

  await afterPoStockMutation(order.items.map((i) => i.product_id))

  const out = await getPurchaseOrderById(id)
  if (!out) throw new Error('Failed to fetch purchase order')
  return out
}

export type CancelPurchaseOrderSettlement =
  | 'reverse_payments'
  | 'retain_paid_as_wallet_credit'

export async function cancelPurchaseOrder(
  id: string,
  options?: { settlement?: CancelPurchaseOrderSettlement }
): Promise<void> {
  const order = await getPurchaseOrderById(id)
  if (!order) throw new Error('Purchase order not found')
  assertPurchaseOrderNotHistoricalSnapshot(order, 'cancel')
  if (order.status === 'cancelled') {
    throw new Error('Purchase order is already cancelled')
  }

  if (order.status === 'draft') {
    const { error: draftUpdateErr } = await supabase
      .from(PURCHASE_ORDERS)
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (draftUpdateErr) throw draftUpdateErr
    const { error: draftDelPayErr } = await supabase
      .from(PURCHASE_ORDER_PAYMENTS)
      .delete()
      .eq('purchase_order_id', id)
    if (draftDelPayErr) throw draftDelPayErr
    return
  }

  const retainWalletCredit =
    Boolean(order.person_id) &&
    options?.settlement === 'retain_paid_as_wallet_credit'

  // Update status to cancelled
  const { error: updateError } = await supabase
    .from(PURCHASE_ORDERS)
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) throw updateError

  const { error: delPayErr } = await supabase
    .from(PURCHASE_ORDER_PAYMENTS)
    .delete()
    .eq('purchase_order_id', id)
  if (delPayErr) throw delPayErr

  if (order.person_id) {
    const paidAtPo = roundMoney(
      (order.payments ?? []).reduce((s, p) => s + p.amount, 0)
    )
    const poTotal = roundMoney(order.total_amount)
    const refPo = `PO-${order.order_number}`

    let poLedgerAnchor: string | null = null
    if (retainWalletCredit && paidAtPo > 0.01) {
      poLedgerAnchor = await getLedgerDocumentLineCreatedAt(
        order.id,
        refPo,
        'purchase_order',
        order.person_id
      )
    }

    const poWhId =
      order.warehouse_id != null && Number.isFinite(Number(order.warehouse_id))
        ? Math.trunc(Number(order.warehouse_id))
        : DEFAULT_WAREHOUSE_ID

    const tenderRegisterPoolWorking =
      retainWalletCredit && paidAtPo > 0.01
        ? [...(await fetchActiveTenderRegistersForDocument(order.id, 'payment_out'))]
        : []
    const firstLedgerRegister =
      tenderRegisterPoolWorking.length > 0
        ? tenderRegisterPoolWorking[0].register_warehouse_id
        : null

    const routeIds = await listActiveLedgerPaymentOperationRouteIdsForDocument(
      order.id,
      refPo,
      'payment_out',
      order.person_id
    )
    await voidLedgerPaymentOperationsForDocumentCancel(routeIds)
    await voidLedgerPurchaseOrderDocumentRowForCancel(
      order.id,
      order.order_number,
      order.person_id
    )

    if (retainWalletCredit && paidAtPo > 0.01) {
      const anchorIso = poLedgerAnchor ?? new Date().toISOString()

      const registerForRetainedLine = async (
        method: PaymentMethod,
        lineAmount: number
      ) => {
        const matched = takeRegisterFromTenderPool(
          tenderRegisterPoolWorking,
          method,
          lineAmount
        )
        const prior = matched ?? firstLedgerRegister
        return resolveRegisterWarehouseForRetainedPayment(poWhId, prior ?? null)
      }

      const payLines = (order.payments ?? []).filter(
        (p) => roundMoney(p.amount) > 0.01
      )
      let remainingLiability = poTotal
      const paymentGroupId =
        payLines.length > 1 ? crypto.randomUUID() : null
      const standaloneRef = await getNextStandaloneLedgerRef('payment_out')

      for (const p of payLines) {
        const a = roundMoney(p.amount)
        const toward = roundMoney(Math.min(a, remainingLiability))
        const walletPart = roundMoney(a - toward)

        if (toward > 0.01) {
          await insertBalanceTransactionRow({
            person_id: order.person_id,
            type: 'payment_out',
            amount: roundMoney(toward),
            reference_id: null,
            reference_number: standaloneRef,
            note: appendLedgerDocSuffix(
              `Supplier account credit from cancelled ${refPo} — PO voided; separate ledger payment (no cash refund)`,
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
          remainingLiability = roundMoney(remainingLiability - toward)
        }

        if (walletPart > 0.01) {
          await insertBalanceTransactionRow({
            person_id: order.person_id,
            type: 'wallet',
            amount: roundMoney(walletPart),
            reference_id: null,
            reference_number: null,
            note: appendLedgerDocSuffix(
              `Wallet from cancelled ${refPo} — PO voided; overpayment split (no cash refund)`,
              order.id
            ),
            payment_method: null,
            payment_group_id: paymentGroupId,
            wallet_direction: 'in' as WalletDirection,
            created_at: retainedPaymentCreatedAt(anchorIso),
          })
        }
      }
    }
  }

  const whId =
    order.warehouse_id != null && Number.isFinite(Number(order.warehouse_id))
      ? Math.trunc(Number(order.warehouse_id))
      : DEFAULT_WAREHOUSE_ID
  const note = `Cancelled Purchase Order #${order.order_number}`

  for (const item of order.items) {
    await adjustStock(item.product_id, 'out', item.quantity, note, {
      warehouseId: whId,
    })
  }

  for (const item of order.items) {
    if (!item.cost_price_updated || item.previous_cost_price == null) continue
    const full =
      item.catalog_customer_price != null &&
      item.catalog_business_price != null &&
      item.previous_customer_price != null &&
      item.previous_business_price != null
    if (full) {
      await updateProduct(item.product_id, {
        cost_price: item.previous_cost_price,
        customer_price: item.previous_customer_price!,
        business_price: item.previous_business_price!,
      })
    } else {
      await updateProduct(item.product_id, {
        cost_price: item.previous_cost_price,
      })
    }
  }

  await afterPoStockMutation(order.items.map((i) => i.product_id))
}

/**
 * Cancels the source PO (same semantics as {@link cancelPurchaseOrder}), then creates a new **draft**
 * PO with the same supplier, warehouse, lines, discount rate, note, and optional draft payment splits.
 */
export async function clonePurchaseOrderAsReplacementDraft(
  id: string,
  options?: { settlement?: CancelPurchaseOrderSettlement }
): Promise<PurchaseOrderWithItems> {
  const source = await getPurchaseOrderById(id)
  if (!source) throw new Error('Purchase order not found')
  assertPurchaseOrderNotHistoricalSnapshot(source, 'clone as replacement')
  if (source.status === 'cancelled') {
    throw new Error('Purchase order is already cancelled')
  }
  if (!source.items.length) {
    throw new Error('Purchase order has no lines to copy')
  }
  if (!source.person_id?.trim()) {
    throw new Error('Purchase order has no supplier to copy')
  }

  const settlement: CancelPurchaseOrderSettlement =
    source.person_id &&
    options?.settlement === 'retain_paid_as_wallet_credit'
      ? 'retain_paid_as_wallet_credit'
      : 'reverse_payments'

  const items = source.items.map((it) => ({
    product_id: it.product_id,
    quantity: it.quantity,
    cost_price: it.cost_price,
    line_discount_rate: it.line_discount_rate,
    update_default_cost_price: it.cost_price_updated,
    catalog_customer_price: it.catalog_customer_price,
    catalog_business_price: it.catalog_business_price,
  }))

  const payments = (source.payments ?? [])
    .map((p) => ({
      payment_method: p.payment_method,
      amount: roundMoney(p.amount),
    }))
    .filter((p) => p.amount > 0.001)

  const baseNote = (source.note ?? '').trim()
  /** Use ledger-style `PO-# · doc:uuid` so {@link splitNoteIntoParts} links to the cancelled source PO. */
  const cloneTag = `[from PO] PO-${source.order_number} · doc:${source.id}`
  const note = baseNote ? `${baseNote} ${cloneTag}` : cloneTag

  await cancelPurchaseOrder(id, { settlement })

  const created = await createPurchaseOrder({
    supplier_name: source.supplier_name ?? undefined,
    note,
    person_id: source.person_id.trim(),
    asDraft: true,
    items,
    payments: payments.length > 0 ? payments : undefined,
    order_discount_rate: source.discount_rate,
    apply_supplier_discount: false,
    warehouse_id: source.warehouse_id,
  })

  const sourceNoteBefore = (source.note ?? '').trim()
  const replacementRef = `[Edited to] PO-${created.order_number} · doc:${created.id}`
  const sourceNoteAfter = sourceNoteBefore
    ? `${sourceNoteBefore} ${replacementRef}`
    : replacementRef
  await updatePurchaseOrderNote(id, sourceNoteAfter)

  const { data: auth } = await supabase.auth.getUser()
  const u = auth.user
  const um = u?.user_metadata as Record<string, unknown> | undefined
  const operatorLabel =
    (typeof um?.username === 'string' && um.username.trim()) ||
    u?.email?.trim() ||
    null

  void insertStockAlert({
    alert_type: 'info',
    title: i18n.t('stockAlerts.poCloneAdminTitle'),
    message: i18n.t('stockAlerts.poCloneAdminMessage', {
      source: source.order_number,
      dest: created.order_number,
      operator: operatorLabel ?? i18n.t('stockAlerts.unknownOperator'),
    }),
    meta: {
      admin_only: true,
      kind: 'po_replacement_draft',
      source_purchase_order_id: source.id,
      source_order_number: source.order_number,
      new_purchase_order_id: created.id,
      new_order_number: created.order_number,
    },
  }).catch((e) => {
    console.warn('insertStockAlert PO clone', e)
  })

  return created
}
