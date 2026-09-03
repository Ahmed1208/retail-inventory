import { OverPurchaseReturnConfirmError } from '@/errors/overPurchaseReturnConfirmError'
import type { OverPurchaseReturnViolation } from '@/errors/overPurchaseReturnConfirmError'
import i18n from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import {
  insertBalanceTransactionRow,
  roundMoney,
  throwHistoricalSnapshotMigrationError,
  voidReturnCancelLedgerInPlace,
} from '@/services/peopleService'
import {
  adjustStock,
  getProductQuantitiesByWarehouse,
} from '@/services/productService'
import { recalculateStockFromMovements } from '@/services/stockReconcileService'
import {
  DEFAULT_WAREHOUSE_ID,
  resolveRegisterWarehouseForOrderConfirm,
} from '@/services/warehouseService'
import { normalizePaymentMethod } from '@/utils/paymentMethod'
import type {
  PaymentMethod,
  Product,
  PurchaseOrderStatus,
  PurchaseReturn,
  PurchaseReturnItemWithProduct,
  PurchaseReturnSettlement,
  PurchaseReturnStatusFlow,
  PurchaseReturnWithItems,
  PurchaseReturnableLine,
} from '@/types'

const PURCHASE_RETURNS = 'purchase_returns'
const PURCHASE_RETURN_ITEMS = 'purchase_return_items'
const PURCHASE_ORDERS = 'purchase_orders'
const PURCHASE_ORDER_ITEMS = 'purchase_order_items'

const PURCHASE_RETURN_SELECT = `
  *,
  purchase_return_items(
    *,
    product:products(
      *,
      brand:brands(name),
      category:categories(name)
    )
  )
`

export type PurchaseReturnFilters = {
  status_flow?: PurchaseReturnStatusFlow | 'all'
  search?: string
  from?: string
  to?: string
  source_purchase_order_id?: string
  historical_snapshot?: 'all' | 'only' | 'exclude'
}

/** One line the caller wants to send back, keyed to the source PO line it came from. */
export type PurchaseReturnLineInput = {
  source_purchase_order_item_id: string
  quantity: number
}

/** A product left below zero on hand by a confirm, so the caller can ping the admin. */
export type NegativeStockLine = {
  product_id: string
  product_name: string
  quantity_after: number
}

type PurchaseReturnRow = Record<string, unknown> & {
  id: string
  return_number: number
  purchase_return_items?: Array<{
    id: string
    purchase_return_id: string
    source_purchase_order_item_id: string
    product_id: string
    quantity: number
    cost_price: number
    total_price: number
    created_at: string
    product: Product
  }>
}

function mapPurchaseReturnFields(row: PurchaseReturnRow): PurchaseReturn {
  const whRaw = row.warehouse_id as number | string | null | undefined
  const warehouse_id =
    whRaw != null && whRaw !== '' && Number.isFinite(Number(whRaw))
      ? Number(whRaw)
      : DEFAULT_WAREHOUSE_ID
  const settlementRaw = row.settlement as string | null | undefined
  return {
    id: String(row.id),
    return_number: Number(row.return_number),
    source_purchase_order_id: String(row.source_purchase_order_id),
    person_id: (row.person_id as string | null) ?? null,
    warehouse_id,
    status_flow: (row.status_flow as PurchaseReturnStatusFlow) ?? 'draft',
    settlement:
      settlementRaw === 'refund_to_register' ||
      settlementRaw === 'debit_from_account'
        ? settlementRaw
        : null,
    refund_method: normalizePaymentMethod(row.refund_method),
    total_amount: Number(row.total_amount ?? 0),
    note: (row.note as string | null) ?? null,
    is_historical_snapshot: Boolean(row.is_historical_snapshot),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapPurchaseReturnItems(
  row: PurchaseReturnRow
): PurchaseReturnItemWithProduct[] {
  return (row.purchase_return_items ?? []).map((ri) => ({
    id: ri.id,
    purchase_return_id: ri.purchase_return_id,
    source_purchase_order_item_id: ri.source_purchase_order_item_id,
    product_id: ri.product_id,
    quantity: Math.trunc(Number(ri.quantity)),
    cost_price: Number(ri.cost_price),
    total_price: Number(ri.total_price),
    created_at: ri.created_at,
    product: ri.product,
  }))
}

function rowToPurchaseReturnWithItems(
  row: PurchaseReturnRow
): PurchaseReturnWithItems {
  return {
    ...mapPurchaseReturnFields(row),
    items: mapPurchaseReturnItems(row),
  }
}

function assertNotHistoricalSnapshot(
  ret: PurchaseReturn,
  action: string
): void {
  if (ret.is_historical_snapshot) {
    throw new Error(`HISTORICAL_PURCHASE_RETURN_IMMUTABLE: ${action}`)
  }
}

export async function getAllPurchaseReturns(
  filters?: PurchaseReturnFilters
): Promise<PurchaseReturnWithItems[]> {
  let query = supabase
    .from(PURCHASE_RETURNS)
    .select(PURCHASE_RETURN_SELECT)
    .order('created_at', { ascending: false })

  if (filters?.status_flow && filters.status_flow !== 'all') {
    query = query.eq('status_flow', filters.status_flow)
  }
  if (filters?.source_purchase_order_id) {
    query = query.eq(
      'source_purchase_order_id',
      filters.source_purchase_order_id
    )
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

  const returns = ((data ?? []) as PurchaseReturnRow[]).map(
    rowToPurchaseReturnWithItems
  )

  if (!filters?.search?.trim()) return returns

  const q = filters.search.trim().toLowerCase()
  const personIds = [
    ...new Set(returns.map((r) => r.person_id).filter(Boolean)),
  ] as string[]

  const personNames = new Map<string, string>()
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

  return returns.filter((r) => {
    if (String(r.return_number).includes(q)) return true
    const name = r.person_id ? personNames.get(r.person_id) : ''
    return name ? name.includes(q) : false
  })
}

export async function getPurchaseReturnById(
  id: string
): Promise<PurchaseReturnWithItems | null> {
  const { data, error } = await supabase
    .from(PURCHASE_RETURNS)
    .select(PURCHASE_RETURN_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return rowToPurchaseReturnWithItems(data as PurchaseReturnRow)
}

/** Source-PO numbers for a set of returns, for list/detail display. */
export async function getSourcePurchaseOrderNumbers(
  purchaseOrderIds: string[]
): Promise<Map<string, number>> {
  const ids = [...new Set(purchaseOrderIds)].filter(Boolean)
  const out = new Map<string, number>()
  if (ids.length === 0) return out
  const { data, error } = await supabase
    .from(PURCHASE_ORDERS)
    .select('id, order_number')
    .in('id', ids)
  if (error) throw error
  for (const row of data ?? []) {
    const r = row as { id: string; order_number: number }
    out.set(r.id, Number(r.order_number))
  }
  return out
}

/** CSV import identifies the source PO by its human-facing number. */
export async function getPurchaseOrderIdByNumber(
  orderNumber: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from(PURCHASE_ORDERS)
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (error) throw error
  return data ? String((data as { id: string }).id) : null
}

type SourcePurchaseOrderRow = {
  id: string
  order_number: number
  status: PurchaseOrderStatus
  person_id: string | null
  warehouse_id: number | string | null
  discount_rate: number | null
  is_historical_snapshot: boolean | null
}

async function fetchSourcePurchaseOrder(
  purchaseOrderId: string
): Promise<SourcePurchaseOrderRow> {
  const { data, error } = await supabase
    .from(PURCHASE_ORDERS)
    .select(
      'id, order_number, status, person_id, warehouse_id, discount_rate, is_historical_snapshot'
    )
    .eq('id', purchaseOrderId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Source purchase order not found')
  return data as SourcePurchaseOrderRow
}

/**
 * Effective per-unit cost actually paid: the line total already has the line discount
 * applied, so only the order-level discount is still to come off.
 */
function effectiveUnitCost(
  lineTotal: number,
  quantity: number,
  orderDiscountRate: number
): number {
  if (quantity <= 0) return 0
  const dr = Math.min(100, Math.max(0, orderDiscountRate))
  return roundMoney((lineTotal / quantity) * (1 - dr / 100))
}

/**
 * Source PO lines with the quantity still available to return: received minus everything
 * already committed by non-cancelled returns. `excludeReturnId` lets a draft being edited
 * count its own lines as available. On-hand comes along so the form can warn before the
 * confirm drives stock negative.
 */
export async function getReturnablePurchaseLinesForOrder(
  purchaseOrderId: string,
  opts?: { excludeReturnId?: string }
): Promise<PurchaseReturnableLine[]> {
  const po = await fetchSourcePurchaseOrder(purchaseOrderId)

  const { data: itemRows, error: itemsErr } = await supabase
    .from(PURCHASE_ORDER_ITEMS)
    .select('id, product_id, quantity, total_price, product:products(*)')
    .eq('purchase_order_id', purchaseOrderId)
    .order('created_at', { ascending: true })
  if (itemsErr) throw itemsErr

  const items = (itemRows ?? []) as unknown as Array<{
    id: string
    product_id: string
    quantity: number
    total_price: number
    product: Product
  }>
  if (items.length === 0) return []

  const alreadyByLine = await getReturnedQuantitiesByPurchaseOrderItem(
    items.map((i) => i.id),
    opts?.excludeReturnId
  )

  const whRaw = po.warehouse_id
  const warehouseId =
    whRaw != null && Number.isFinite(Number(whRaw))
      ? Math.trunc(Number(whRaw))
      : DEFAULT_WAREHOUSE_ID
  const onHand = await getProductQuantitiesByWarehouse(warehouseId)

  const orderDiscountRate = Number(po.discount_rate ?? 0)

  return items.map((it) => {
    const received = Math.trunc(Number(it.quantity))
    const already = alreadyByLine.get(it.id) ?? 0
    return {
      source_purchase_order_item_id: it.id,
      product_id: it.product_id,
      product: it.product,
      cost_price: effectiveUnitCost(
        Number(it.total_price),
        received,
        orderDiscountRate
      ),
      received_quantity: received,
      already_returned: already,
      returnable_quantity: Math.max(0, received - already),
      on_hand_quantity: onHand.get(it.product_id) ?? 0,
    }
  })
}

/** Quantities committed per source PO line by every non-cancelled purchase return. */
async function getReturnedQuantitiesByPurchaseOrderItem(
  purchaseOrderItemIds: string[],
  excludeReturnId?: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (purchaseOrderItemIds.length === 0) return out

  const { data, error } = await supabase
    .from(PURCHASE_RETURN_ITEMS)
    .select(
      'source_purchase_order_item_id, quantity, purchase_returns!inner(id, status_flow)'
    )
    .in('source_purchase_order_item_id', purchaseOrderItemIds)
  if (error) throw error

  for (const raw of data ?? []) {
    const row = raw as unknown as {
      source_purchase_order_item_id: string
      quantity: number
      purchase_returns: { id: string; status_flow: string } | null
    }
    const parent = row.purchase_returns
    if (!parent) continue
    if (parent.status_flow === 'cancelled') continue
    if (excludeReturnId && parent.id === excludeReturnId) continue
    const key = row.source_purchase_order_item_id
    out.set(key, (out.get(key) ?? 0) + Math.trunc(Number(row.quantity)))
  }
  return out
}

type CostedLine = {
  source_purchase_order_item_id: string
  product_id: string
  quantity: number
  cost_price: number
  total_price: number
}

/**
 * Validates requested quantities against what is still returnable and costs them from the
 * source PO. The confirm RPC re-checks the cap in-transaction; this is the friendly error.
 */
async function costAndValidateLines(
  purchaseOrderId: string,
  items: PurchaseReturnLineInput[],
  excludeReturnId?: string
): Promise<CostedLine[]> {
  if (items.length === 0) {
    throw new Error('Add at least one line to the purchase return')
  }

  const returnable = await getReturnablePurchaseLinesForOrder(purchaseOrderId, {
    excludeReturnId,
  })
  const byLineId = new Map(
    returnable.map((l) => [l.source_purchase_order_item_id, l])
  )

  const merged = new Map<string, number>()
  for (const item of items) {
    const qty = Math.trunc(Number(item.quantity))
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error('Return quantity must be at least 1')
    }
    merged.set(
      item.source_purchase_order_item_id,
      (merged.get(item.source_purchase_order_item_id) ?? 0) + qty
    )
  }

  const out: CostedLine[] = []
  for (const [lineId, qty] of merged) {
    const src = byLineId.get(lineId)
    if (!src) {
      throw new Error('Line does not belong to the source purchase order')
    }
    if (qty > src.returnable_quantity) {
      throw new Error(
        `Cannot return ${qty} of ${src.product.name}; only ${src.returnable_quantity} left to return`
      )
    }
    out.push({
      source_purchase_order_item_id: lineId,
      product_id: src.product_id,
      quantity: qty,
      cost_price: src.cost_price,
      total_price: roundMoney(src.cost_price * qty),
    })
  }
  return out
}

function linesTotal(lines: CostedLine[]): number {
  return roundMoney(lines.reduce((s, l) => s + l.total_price, 0))
}

async function insertPurchaseReturnItems(
  purchaseReturnId: string,
  lines: CostedLine[]
): Promise<void> {
  const payload = lines.map((l) => ({
    purchase_return_id: purchaseReturnId,
    source_purchase_order_item_id: l.source_purchase_order_item_id,
    product_id: l.product_id,
    quantity: l.quantity,
    cost_price: l.cost_price,
    total_price: l.total_price,
  }))
  const { error } = await supabase
    .from(PURCHASE_RETURN_ITEMS)
    .insert(payload)
  if (error) throw error
}

export async function createPurchaseReturn(data: {
  source_purchase_order_id: string
  items: PurchaseReturnLineInput[]
  note?: string
}): Promise<PurchaseReturnWithItems> {
  const po = await fetchSourcePurchaseOrder(data.source_purchase_order_id)
  if (po.is_historical_snapshot) {
    throw new Error('Historical snapshot purchase orders cannot be returned')
  }
  if (po.status !== 'received') {
    throw new Error('Only received purchase orders can be returned')
  }

  const lines = await costAndValidateLines(
    data.source_purchase_order_id,
    data.items
  )

  const whRaw = po.warehouse_id
  const warehouse_id =
    whRaw != null && Number.isFinite(Number(whRaw))
      ? Math.trunc(Number(whRaw))
      : DEFAULT_WAREHOUSE_ID

  const { data: inserted, error } = await supabase
    .from(PURCHASE_RETURNS)
    .insert({
      source_purchase_order_id: data.source_purchase_order_id,
      person_id: po.person_id,
      warehouse_id,
      status_flow: 'draft' as PurchaseReturnStatusFlow,
      total_amount: linesTotal(lines),
      note: data.note?.trim() || null,
      is_historical_snapshot: false,
    })
    .select('id')
    .single()
  if (error) throw error

  const returnId = (inserted as { id: string }).id
  await insertPurchaseReturnItems(returnId, lines)

  const created = await getPurchaseReturnById(returnId)
  if (!created) throw new Error('Failed to fetch created purchase return')
  return created
}

export async function updatePurchaseReturnItems(
  id: string,
  items: PurchaseReturnLineInput[]
): Promise<PurchaseReturnWithItems> {
  const ret = await getPurchaseReturnById(id)
  if (!ret) throw new Error('Purchase return not found')
  assertNotHistoricalSnapshot(ret, 'edit')
  if (ret.status_flow !== 'draft') {
    throw new Error('Only draft purchase returns can be edited')
  }

  const lines = await costAndValidateLines(
    ret.source_purchase_order_id,
    items,
    id
  )

  const { error: delErr } = await supabase
    .from(PURCHASE_RETURN_ITEMS)
    .delete()
    .eq('purchase_return_id', id)
  if (delErr) throw delErr

  await insertPurchaseReturnItems(id, lines)

  const { error: updErr } = await supabase
    .from(PURCHASE_RETURNS)
    .update({
      total_amount: linesTotal(lines),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updErr) throw updErr

  const updated = await getPurchaseReturnById(id)
  if (!updated) throw new Error('Purchase return not found')
  return updated
}

export async function updatePurchaseReturnNote(
  id: string,
  note: string
): Promise<PurchaseReturnWithItems> {
  const ret = await getPurchaseReturnById(id)
  if (!ret) throw new Error('Purchase return not found')
  assertNotHistoricalSnapshot(ret, 'edit note')

  const { error } = await supabase
    .from(PURCHASE_RETURNS)
    .update({
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error

  const updated = await getPurchaseReturnById(id)
  if (!updated) throw new Error('Purchase return not found')
  return updated
}

function parseOverReturnViolations(
  raw: unknown
): OverPurchaseReturnViolation[] {
  const out: OverPurchaseReturnViolation[] = []
  if (!Array.isArray(raw)) return out
  for (const v of raw) {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      out.push({
        product_id: String(o.product_id ?? ''),
        product_name: String(o.product_name ?? ''),
        received: Math.trunc(Number(o.received ?? 0)),
        already_returned: Math.trunc(Number(o.already_returned ?? 0)),
        requested: Math.trunc(Number(o.requested ?? 0)),
      })
    }
  }
  return out
}

function parseNegativeStock(raw: unknown): NegativeStockLine[] {
  const out: NegativeStockLine[] = []
  if (!Array.isArray(raw)) return out
  for (const v of raw) {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      out.push({
        product_id: String(o.product_id ?? ''),
        product_name: String(o.product_name ?? ''),
        quantity_after: Math.trunc(Number(o.quantity_after ?? 0)),
      })
    }
  }
  return out
}

/**
 * Ledger for a confirmed purchase return. The negative `purchase_order` row reverses the
 * original supplier obligation; a `refund_to_register` return adds a `payment_in` row so
 * the cash actually lands in the drawer and the supplier keeps no credit.
 */
async function insertConfirmPurchaseReturnLedgerLines(
  ret: PurchaseReturn,
  registerWarehouseId: number
): Promise<void> {
  const total = roundMoney(ret.total_amount)
  if (total < 0.01) return

  const refNum = `PR-${ret.return_number}`

  await insertBalanceTransactionRow({
    person_id: ret.person_id,
    type: 'purchase_order',
    amount: roundMoney(-total),
    reference_id: ret.id,
    reference_number: refNum,
    note: `Purchase return #${ret.return_number}`,
    payment_method: null,
    payment_group_id: null,
    wallet_direction: null,
  })

  if (ret.settlement === 'refund_to_register') {
    await insertBalanceTransactionRow({
      person_id: ret.person_id,
      type: 'payment_in',
      amount: roundMoney(total),
      reference_id: ret.id,
      reference_number: refNum,
      note: `Refund for purchase return #${ret.return_number}`,
      payment_method: ret.refund_method,
      payment_group_id: null,
      wallet_direction: null,
      register_warehouse_id: registerWarehouseId,
    })
  }
}

/**
 * Confirming can leave stock below zero when the goods were already sold. That is allowed,
 * so the caller gets the affected products back and records them on the return, where the
 * `@[admin]` mention turns into an admin notification.
 */
export async function confirmPurchaseReturn(
  id: string,
  options: {
    settlement: PurchaseReturnSettlement
    refund_method?: PaymentMethod
  }
): Promise<{
  purchaseReturn: PurchaseReturnWithItems
  negatives: NegativeStockLine[]
}> {
  const ret = await getPurchaseReturnById(id)
  if (!ret) throw new Error('Purchase return not found')
  assertNotHistoricalSnapshot(ret, 'confirm')
  if (ret.status_flow !== 'draft') {
    throw new Error('Only draft purchase returns can be confirmed')
  }
  if (ret.items.length === 0) {
    throw new Error('Add at least one line to the purchase return')
  }

  const settlement = options.settlement
  if (settlement === 'debit_from_account' && !ret.person_id) {
    throw new Error(
      'Select a supplier purchase order to take the refund off an account, or refund to the register'
    )
  }
  const refundMethod =
    settlement === 'refund_to_register'
      ? normalizePaymentMethod(options.refund_method)
      : null
  if (settlement === 'refund_to_register' && !refundMethod) {
    throw new Error('Choose how the refund arrives in the register')
  }

  const registerWhId = await resolveRegisterWarehouseForOrderConfirm(
    ret.warehouse_id
  )

  const { error: settleErr } = await supabase
    .from(PURCHASE_RETURNS)
    .update({
      settlement,
      refund_method: refundMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (settleErr) throw settleErr

  const { data: rpcRaw, error: rpcErr } = await supabase.rpc(
    'confirm_purchase_return_apply_stock',
    { p_purchase_return_id: id }
  )
  if (rpcErr) throw rpcErr

  const rpcData = typeof rpcRaw === 'string' ? JSON.parse(rpcRaw) : rpcRaw
  const result = rpcData as {
    ok?: boolean
    violations?: unknown
    negatives?: unknown
    error?: string
  } | null

  if (!result?.ok) {
    const violations = parseOverReturnViolations(result?.violations)
    if (violations.length > 0) {
      throw new OverPurchaseReturnConfirmError(violations)
    }
    throw new Error(
      result?.error === 'not_draft'
        ? 'Only draft purchase returns can be confirmed'
        : result?.error === 'return_not_found'
          ? 'Purchase return not found'
          : result?.error === 'historical_snapshot'
            ? 'Historical snapshot purchase returns cannot be confirmed'
            : result?.error === 'no_lines'
              ? 'Add at least one line to the purchase return'
              : result?.error === 'source_line_not_found'
                ? 'A source purchase order line for this return no longer exists'
                : 'Could not confirm purchase return stock'
    )
  }

  const negatives = parseNegativeStock(result?.negatives)

  const confirmed = await getPurchaseReturnById(id)
  if (!confirmed) throw new Error('Purchase return not found after confirm')

  await insertConfirmPurchaseReturnLedgerLines(confirmed, registerWhId)
  await afterPurchaseReturnStockMutation(
    confirmed.items.map((i) => i.product_id)
  )

  return { purchaseReturn: confirmed, negatives }
}

/**
 * Records negative on-hand on the return's own note. `@[admin]` is the token the mention
 * scanner looks for, so writing it here is what makes the notification appear.
 */
export function buildNegativeStockNote(
  existingNote: string | null,
  negatives: NegativeStockLine[]
): string {
  const detail = negatives
    .map((n) => `${n.product_name} (${n.quantity_after})`)
    .join(', ')
  const line = `@[admin] Stock is now negative after this return: ${detail}`
  const base = (existingNote ?? '').trim()
  return base ? `${base}\n${line}` : line
}

async function appendNegativeStockNote(
  id: string,
  negatives: NegativeStockLine[]
): Promise<string> {
  const ret = await getPurchaseReturnById(id)
  if (!ret) throw new Error('Purchase return not found')
  const note = buildNegativeStockNote(ret.note, negatives)
  const { error } = await supabase
    .from(PURCHASE_RETURNS)
    .update({ note, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  return note
}

/**
 * The confirm every caller should use: applies the return, then records any negative
 * on-hand on the note so the `@[admin]` mention raises an admin notification.
 */
export async function confirmPurchaseReturnWithAdminNotice(
  id: string,
  options: {
    settlement: PurchaseReturnSettlement
    refund_method?: PaymentMethod
  }
): Promise<{
  purchaseReturn: PurchaseReturnWithItems
  negatives: NegativeStockLine[]
}> {
  const { purchaseReturn, negatives } = await confirmPurchaseReturn(id, options)
  if (negatives.length === 0) return { purchaseReturn, negatives }

  const note = await appendNegativeStockNote(id, negatives)
  await createAdminMentionNotificationIfNeeded({
    noteText: note,
    title: i18n.t('notifications.mentionTitlePurchaseReturnNegativeStock', {
      number: String(purchaseReturn.return_number),
    }),
    redirectBasePath: `/purchase-orders/returns/${id}`,
    sourceType: 'purchase_return_note',
    sourceEntityId: id,
  })

  return { purchaseReturn: { ...purchaseReturn, note }, negatives }
}

async function afterPurchaseReturnStockMutation(
  productIds: string[]
): Promise<void> {
  const ids = [...new Set(productIds)].filter(Boolean)
  if (!ids.length) return
  try {
    await recalculateStockFromMovements(ids)
  } catch {
    /* RPC may be missing on unmigrated DB */
  }
}

export async function cancelPurchaseReturn(id: string): Promise<void> {
  const ret = await getPurchaseReturnById(id)
  if (!ret) throw new Error('Purchase return not found')
  assertNotHistoricalSnapshot(ret, 'cancel')
  if (ret.status_flow === 'cancelled') {
    throw new Error('Purchase return is already cancelled')
  }

  const reverseStock = ret.status_flow === 'confirmed'

  if (reverseStock) {
    const note = `Reversed from cancelled purchase return #${ret.return_number}`
    for (const item of ret.items) {
      await adjustStock(item.product_id, 'in', item.quantity, note, {
        warehouseId: ret.warehouse_id,
      })
    }
    await voidReturnCancelLedgerInPlace(
      ret.id,
      ret.return_number,
      ret.person_id,
      'purchase'
    )
  }

  const { error } = await supabase
    .from(PURCHASE_RETURNS)
    .update({
      status_flow: 'cancelled' as PurchaseReturnStatusFlow,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error

  if (reverseStock) {
    await afterPurchaseReturnStockMutation(ret.items.map((i) => i.product_id))
  }
}

/**
 * CSV backfill: a confirmed-looking purchase return that must not drive stock, register,
 * or ledger. Mirrors `importHistoricalPurchaseOrderSnapshot`.
 */
export async function importHistoricalPurchaseReturnSnapshot(data: {
  source_purchase_order_id: string
  return_number?: number
  items: Array<{
    source_purchase_order_item_id: string
    product_id: string
    quantity: number
    cost_price: number
  }>
  note?: string
  created_at?: string
}): Promise<PurchaseReturnWithItems> {
  if (data.items.length === 0) {
    throw new Error('Historical purchase return needs at least one line')
  }
  const po = await fetchSourcePurchaseOrder(data.source_purchase_order_id)

  const lines: CostedLine[] = data.items.map((it) => {
    const qty = Math.trunc(Number(it.quantity))
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error('Return quantity must be at least 1')
    }
    const cost = roundMoney(Number(it.cost_price))
    return {
      source_purchase_order_item_id: it.source_purchase_order_item_id,
      product_id: it.product_id,
      quantity: qty,
      cost_price: cost,
      total_price: roundMoney(cost * qty),
    }
  })

  const whRaw = po.warehouse_id
  const warehouse_id =
    whRaw != null && Number.isFinite(Number(whRaw))
      ? Math.trunc(Number(whRaw))
      : DEFAULT_WAREHOUSE_ID

  const createdAt = data.created_at?.trim()
  const payload: Record<string, unknown> = {
    source_purchase_order_id: data.source_purchase_order_id,
    person_id: po.person_id,
    warehouse_id,
    status_flow: 'confirmed' as PurchaseReturnStatusFlow,
    total_amount: linesTotal(lines),
    note: data.note?.trim() || null,
    is_historical_snapshot: true,
    created_at:
      createdAt && !Number.isNaN(Date.parse(createdAt))
        ? new Date(createdAt).toISOString()
        : new Date().toISOString(),
  }
  if (data.return_number != null) {
    payload.return_number = Math.trunc(Number(data.return_number))
  }

  const { data: inserted, error } = await supabase
    .from(PURCHASE_RETURNS)
    .insert(payload)
    .select('id')
    .single()
  if (error) throwHistoricalSnapshotMigrationError(error)

  const returnId = (inserted as { id: string }).id
  try {
    await insertPurchaseReturnItems(returnId, lines)
  } catch (e) {
    throwHistoricalSnapshotMigrationError(e)
  }

  const created = await getPurchaseReturnById(returnId)
  if (!created) throw new Error('Failed to fetch historical purchase return')
  return created
}
