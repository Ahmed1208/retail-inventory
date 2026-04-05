import { supabase } from '@/lib/supabase'
import { adjustStock } from '@/services/productService'
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
  voidLedgerPaymentOperationsForDocumentCancel,
  voidLedgerPurchaseOrderDocumentRowForCancel,
} from '@/services/peopleService'
import { insertPurchaseOrderPaymentsRows } from '@/services/paymentInstallmentInserts'
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
  paid_amount?: number
  remaining_amount?: number
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
  const order = {
    ...orderRest,
    person_id: orderRest.person_id ?? null,
    paid_amount: paid,
    remaining_amount,
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
  return applyPaidRemainingFromPayments(order)
}

export async function updatePurchaseOrderNote(
  id: string,
  note: string
): Promise<void> {
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
  return orders.map(applyPaidRemainingFromPayments)
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
    update_default_cost_price: boolean
    /** When set with catalog_business_price, receive updates retail + wholesale + cost on the product. */
    catalog_customer_price?: number | null
    catalog_business_price?: number | null
  }[]
  /** Save as draft: no stock, ledger, or payments until confirmed. */
  asDraft?: boolean
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

  // 2. Calculate total_amount
  const total_amount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.cost_price,
    0
  )

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

  // Get next order_number
  const { data: maxRow, error: maxError } = await supabase
    .from(PURCHASE_ORDERS)
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) throw maxError
  const order_number = (maxRow?.order_number ?? 0) + 1

  // 3. Insert purchase_order (omit paid_amount/remaining_amount so DBs without migration 009 still work;
  //    paid/remaining are derived from purchase_order_payments in applyPaidRemainingFromPayments.)
  const orderPayload = {
    order_number,
    supplier_name: data.supplier_name?.trim() || null,
    note: data.note?.trim() || null,
    total_amount: total,
    status: (asDraft ? 'draft' : 'received') as PurchaseOrderStatus,
    person_id: supplierId,
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
  }> = data.items.map((item) => {
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
      total_price: item.quantity * item.cost_price,
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

  if (!asDraft) {
    const note = `Purchase Order #${order_number}`
    for (const item of data.items) {
      await adjustStock(item.product_id, 'in', item.quantity, note, {
        inboundUnitCost: item.cost_price,
      })
    }

    for (const item of data.items) {
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
      orderNumber: order_number,
      totalAmount: total,
      payments,
    })
  }

  // Return created PurchaseOrderWithItems
  const created = await getPurchaseOrderById(orderId)
  if (!created) throw new Error('Failed to fetch created purchase order')
  return created
}

export async function confirmPurchaseOrder(
  id: string,
  data: {
    payments?: { payment_method: PaymentMethod; amount: number }[]
    allow_remaining_on_account?: boolean
    note?: string | null
  }
): Promise<PurchaseOrderWithItems> {
  const order = await getPurchaseOrderById(id)
  if (!order) throw new Error('Purchase order not found')
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

  const stockNote = `Purchase Order #${order.order_number}`
  for (const item of order.items) {
    await adjustStock(item.product_id, 'in', item.quantity, stockNote, {
      inboundUnitCost: item.cost_price,
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

      const { data: balRow0, error: b0e } = await supabase
        .from('people')
        .select('balance')
        .eq('id', order.person_id)
        .single()
      if (b0e) throw b0e
      let bal = roundMoney(Number((balRow0 as { balance: number }).balance))

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
              `Retained · ${refPo} — cancelled PO #${order.order_number} (prepaid kept on account)`,
              order.id
            ),
            payment_method: p.payment_method,
            payment_group_id: paymentGroupId,
            wallet_direction: null,
            created_at: retainedPaymentCreatedAt(anchorIso),
          })
          bal = roundMoney(bal + toward)
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
              `Overpayment retained · ${refPo} — cancelled PO #${order.order_number}`,
              order.id
            ),
            payment_method: null,
            payment_group_id: paymentGroupId,
            wallet_direction: 'in' as WalletDirection,
            created_at: retainedPaymentCreatedAt(anchorIso),
          })
          bal = roundMoney(bal + walletPart)
        }
      }

      const { error: pbErr } = await supabase
        .from('people')
        .update({
          balance: bal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.person_id)
      if (pbErr) throw pbErr
    } else {
      const { data: balAfter, error: bae } = await supabase
        .from('people')
        .select('balance')
        .eq('id', order.person_id)
        .single()
      if (bae) throw bae
      const bal = roundMoney(Number((balAfter as { balance: number }).balance))

      const { error: pbErr } = await supabase
        .from('people')
        .update({
          balance: bal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.person_id)
      if (pbErr) throw pbErr
    }
  }

  const note = `Cancelled Purchase Order #${order.order_number}`

  for (const item of order.items) {
    await adjustStock(item.product_id, 'out', item.quantity, note)
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
}
