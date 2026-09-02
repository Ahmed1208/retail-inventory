import { OverReturnConfirmError } from '@/errors/overReturnConfirmError'
import type { OverReturnViolation } from '@/errors/overReturnConfirmError'
import { supabase } from '@/lib/supabase'
import {
  insertBalanceTransactionRow,
  roundMoney,
  throwHistoricalSnapshotMigrationError,
  voidReturnCancelLedgerInPlace,
} from '@/services/peopleService'
import { adjustStock } from '@/services/productService'
import { recalculateStockFromMovements } from '@/services/stockReconcileService'
import {
  DEFAULT_WAREHOUSE_ID,
  resolveRegisterWarehouseForOrderConfirm,
} from '@/services/warehouseService'
import { normalizePaymentMethod } from '@/utils/paymentMethod'
import type {
  OrderStatusFlow,
  PaymentMethod,
  Product,
  ReturnItemWithProduct,
  ReturnSettlement,
  ReturnStatusFlow,
  ReturnWithItems,
  ReturnableLine,
  SalesReturn,
} from '@/types'

const RETURNS = 'returns'
const RETURN_ITEMS = 'return_items'
const ORDERS = 'orders'
const ORDER_ITEMS = 'order_items'

const RETURN_SELECT = `
  *,
  return_items(
    *,
    product:products(
      *,
      brand:brands(name),
      category:categories(name)
    )
  )
`

export type ReturnFilters = {
  status_flow?: ReturnStatusFlow | 'all'
  search?: string
  from?: string
  to?: string
  source_order_id?: string
  historical_snapshot?: 'all' | 'only' | 'exclude'
}

/** One line the caller wants to take back, keyed to the source order line it came from. */
export type ReturnLineInput = {
  source_order_item_id: string
  quantity: number
}

type ReturnRow = Record<string, unknown> & {
  id: string
  return_number: number
  return_items?: Array<{
    id: string
    return_id: string
    source_order_item_id: string
    product_id: string
    quantity: number
    unit_price: number
    total_price: number
    created_at: string
    product: Product
  }>
}

function mapReturnFields(row: ReturnRow): SalesReturn {
  const whRaw = row.warehouse_id as number | string | null | undefined
  const warehouse_id =
    whRaw != null && whRaw !== '' && Number.isFinite(Number(whRaw))
      ? Number(whRaw)
      : DEFAULT_WAREHOUSE_ID
  const settlementRaw = row.settlement as string | null | undefined
  return {
    id: String(row.id),
    return_number: Number(row.return_number),
    source_order_id: String(row.source_order_id),
    person_id: (row.person_id as string | null) ?? null,
    warehouse_id,
    status_flow: (row.status_flow as ReturnStatusFlow) ?? 'draft',
    settlement:
      settlementRaw === 'refund_to_register' ||
      settlementRaw === 'credit_to_account'
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

function mapReturnItems(row: ReturnRow): ReturnItemWithProduct[] {
  return (row.return_items ?? []).map((ri) => ({
    id: ri.id,
    return_id: ri.return_id,
    source_order_item_id: ri.source_order_item_id,
    product_id: ri.product_id,
    quantity: Math.trunc(Number(ri.quantity)),
    unit_price: Number(ri.unit_price),
    total_price: Number(ri.total_price),
    created_at: ri.created_at,
    product: ri.product,
  }))
}

function rowToReturnWithItems(row: ReturnRow): ReturnWithItems {
  return { ...mapReturnFields(row), items: mapReturnItems(row) }
}

function assertReturnNotHistoricalSnapshot(
  ret: SalesReturn,
  action: string
): void {
  if (ret.is_historical_snapshot) {
    throw new Error(`HISTORICAL_RETURN_IMMUTABLE: ${action}`)
  }
}

export async function getAllReturns(
  filters?: ReturnFilters
): Promise<ReturnWithItems[]> {
  let query = supabase
    .from(RETURNS)
    .select(RETURN_SELECT)
    .order('created_at', { ascending: false })

  if (filters?.status_flow && filters.status_flow !== 'all') {
    query = query.eq('status_flow', filters.status_flow)
  }
  if (filters?.source_order_id) {
    query = query.eq('source_order_id', filters.source_order_id)
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

  const returns = ((data ?? []) as ReturnRow[]).map(rowToReturnWithItems)

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

export async function getReturnById(
  id: string
): Promise<ReturnWithItems | null> {
  const { data, error } = await supabase
    .from(RETURNS)
    .select(RETURN_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return rowToReturnWithItems(data as ReturnRow)
}

/** Source-order numbers for a set of returns, for list/detail display. */
export async function getSourceOrderNumbers(
  orderIds: string[]
): Promise<Map<string, number>> {
  const ids = [...new Set(orderIds)].filter(Boolean)
  const out = new Map<string, number>()
  if (ids.length === 0) return out
  const { data, error } = await supabase
    .from(ORDERS)
    .select('id, order_number')
    .in('id', ids)
  if (error) throw error
  for (const row of data ?? []) {
    const r = row as { id: string; order_number: number }
    out.set(r.id, Number(r.order_number))
  }
  return out
}

/** CSV import identifies the source order by its human-facing number. */
export async function getOrderIdByNumber(
  orderNumber: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from(ORDERS)
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (error) throw error
  return data ? String((data as { id: string }).id) : null
}

type SourceOrderRow = {
  id: string
  order_number: number
  status_flow: OrderStatusFlow
  person_id: string | null
  warehouse_id: number | string | null
  discount_rate: number | null
  is_historical_snapshot: boolean | null
}

async function fetchSourceOrder(orderId: string): Promise<SourceOrderRow> {
  const { data, error } = await supabase
    .from(ORDERS)
    .select(
      'id, order_number, status_flow, person_id, warehouse_id, discount_rate, is_historical_snapshot'
    )
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Source order not found')
  return data as SourceOrderRow
}

/**
 * Effective per-unit price actually paid: the line total already has the line discount
 * applied, so only the order-level discount is still to come off.
 */
function effectiveUnitPrice(
  lineTotal: number,
  quantity: number,
  orderDiscountRate: number
): number {
  if (quantity <= 0) return 0
  const dr = Math.min(100, Math.max(0, orderDiscountRate))
  return roundMoney((lineTotal / quantity) * (1 - dr / 100))
}

/**
 * Source order lines with the quantity still available to return: sold minus everything
 * already committed by non-cancelled returns. `excludeReturnId` lets a draft being edited
 * count its own lines as available.
 */
export async function getReturnableLinesForOrder(
  orderId: string,
  opts?: { excludeReturnId?: string }
): Promise<ReturnableLine[]> {
  const order = await fetchSourceOrder(orderId)

  const { data: itemRows, error: itemsErr } = await supabase
    .from(ORDER_ITEMS)
    .select('id, product_id, quantity, total_price, product:products(*)')
    .eq('order_id', orderId)
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

  const alreadyByLine = await getReturnedQuantitiesByOrderItem(
    items.map((i) => i.id),
    opts?.excludeReturnId
  )

  const orderDiscountRate = Number(order.discount_rate ?? 0)

  return items.map((it) => {
    const sold = Math.trunc(Number(it.quantity))
    const already = alreadyByLine.get(it.id) ?? 0
    return {
      source_order_item_id: it.id,
      product_id: it.product_id,
      product: it.product,
      unit_price: effectiveUnitPrice(
        Number(it.total_price),
        sold,
        orderDiscountRate
      ),
      sold_quantity: sold,
      already_returned: already,
      returnable_quantity: Math.max(0, sold - already),
    }
  })
}

/** Quantities committed per source order line by every non-cancelled return. */
async function getReturnedQuantitiesByOrderItem(
  orderItemIds: string[],
  excludeReturnId?: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (orderItemIds.length === 0) return out

  const { data, error } = await supabase
    .from(RETURN_ITEMS)
    .select('source_order_item_id, quantity, returns!inner(id, status_flow)')
    .in('source_order_item_id', orderItemIds)
  if (error) throw error

  for (const raw of data ?? []) {
    const row = raw as unknown as {
      source_order_item_id: string
      quantity: number
      returns: { id: string; status_flow: string } | null
    }
    const parent = row.returns
    if (!parent) continue
    if (parent.status_flow === 'cancelled') continue
    if (excludeReturnId && parent.id === excludeReturnId) continue
    const key = row.source_order_item_id
    out.set(key, (out.get(key) ?? 0) + Math.trunc(Number(row.quantity)))
  }
  return out
}

type PricedLine = {
  source_order_item_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
}

/**
 * Validates requested quantities against what is still returnable and prices them from the
 * source order. The confirm RPC re-checks the cap in-transaction; this is the friendly error.
 */
async function priceAndValidateLines(
  orderId: string,
  items: ReturnLineInput[],
  excludeReturnId?: string
): Promise<PricedLine[]> {
  if (items.length === 0) {
    throw new Error('Add at least one line to the return')
  }

  const returnable = await getReturnableLinesForOrder(orderId, {
    excludeReturnId,
  })
  const byLineId = new Map(returnable.map((l) => [l.source_order_item_id, l]))

  const merged = new Map<string, number>()
  for (const item of items) {
    const qty = Math.trunc(Number(item.quantity))
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error('Return quantity must be at least 1')
    }
    merged.set(
      item.source_order_item_id,
      (merged.get(item.source_order_item_id) ?? 0) + qty
    )
  }

  const out: PricedLine[] = []
  for (const [lineId, qty] of merged) {
    const src = byLineId.get(lineId)
    if (!src) {
      throw new Error('Line does not belong to the source order')
    }
    if (qty > src.returnable_quantity) {
      throw new Error(
        `Cannot return ${qty} of ${src.product.name}; only ${src.returnable_quantity} left to return`
      )
    }
    out.push({
      source_order_item_id: lineId,
      product_id: src.product_id,
      quantity: qty,
      unit_price: src.unit_price,
      total_price: roundMoney(src.unit_price * qty),
    })
  }
  return out
}

function linesTotal(lines: PricedLine[]): number {
  return roundMoney(lines.reduce((s, l) => s + l.total_price, 0))
}

async function insertReturnItems(
  returnId: string,
  lines: PricedLine[]
): Promise<void> {
  const payload = lines.map((l) => ({
    return_id: returnId,
    source_order_item_id: l.source_order_item_id,
    product_id: l.product_id,
    quantity: l.quantity,
    unit_price: l.unit_price,
    total_price: l.total_price,
  }))
  const { error } = await supabase.from(RETURN_ITEMS).insert(payload)
  if (error) throw error
}

export async function createReturn(data: {
  source_order_id: string
  items: ReturnLineInput[]
  note?: string
}): Promise<ReturnWithItems> {
  const order = await fetchSourceOrder(data.source_order_id)
  if (order.is_historical_snapshot) {
    throw new Error('Historical snapshot orders cannot be returned')
  }
  if (order.status_flow !== 'confirmed' && order.status_flow !== 'completed') {
    throw new Error('Only confirmed or completed orders can be returned')
  }

  const lines = await priceAndValidateLines(data.source_order_id, data.items)

  const whRaw = order.warehouse_id
  const warehouse_id =
    whRaw != null && Number.isFinite(Number(whRaw))
      ? Math.trunc(Number(whRaw))
      : DEFAULT_WAREHOUSE_ID

  const { data: inserted, error } = await supabase
    .from(RETURNS)
    .insert({
      source_order_id: data.source_order_id,
      person_id: order.person_id,
      warehouse_id,
      status_flow: 'draft' as ReturnStatusFlow,
      total_amount: linesTotal(lines),
      note: data.note?.trim() || null,
      is_historical_snapshot: false,
    })
    .select('id')
    .single()
  if (error) throw error

  const returnId = (inserted as { id: string }).id
  await insertReturnItems(returnId, lines)

  const created = await getReturnById(returnId)
  if (!created) throw new Error('Failed to fetch created return')
  return created
}

export async function updateReturnItems(
  id: string,
  items: ReturnLineInput[]
): Promise<ReturnWithItems> {
  const ret = await getReturnById(id)
  if (!ret) throw new Error('Return not found')
  assertReturnNotHistoricalSnapshot(ret, 'edit')
  if (ret.status_flow !== 'draft') {
    throw new Error('Only draft returns can be edited')
  }

  const lines = await priceAndValidateLines(ret.source_order_id, items, id)

  const { error: delErr } = await supabase
    .from(RETURN_ITEMS)
    .delete()
    .eq('return_id', id)
  if (delErr) throw delErr

  await insertReturnItems(id, lines)

  const { error: updErr } = await supabase
    .from(RETURNS)
    .update({
      total_amount: linesTotal(lines),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updErr) throw updErr

  const updated = await getReturnById(id)
  if (!updated) throw new Error('Return not found')
  return updated
}

export async function updateReturnNote(
  id: string,
  note: string
): Promise<ReturnWithItems> {
  const ret = await getReturnById(id)
  if (!ret) throw new Error('Return not found')
  assertReturnNotHistoricalSnapshot(ret, 'edit note')

  const { error } = await supabase
    .from(RETURNS)
    .update({
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error

  const updated = await getReturnById(id)
  if (!updated) throw new Error('Return not found')
  return updated
}

function parseOverReturnViolations(raw: unknown): OverReturnViolation[] {
  const out: OverReturnViolation[] = []
  if (!Array.isArray(raw)) return out
  for (const v of raw) {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      out.push({
        product_id: String(o.product_id ?? ''),
        product_name: String(o.product_name ?? ''),
        sold: Math.trunc(Number(o.sold ?? 0)),
        already_returned: Math.trunc(Number(o.already_returned ?? 0)),
        requested: Math.trunc(Number(o.requested ?? 0)),
      })
    }
  }
  return out
}

/**
 * Ledger for a confirmed return. The negative `order` row reverses the original sale
 * obligation; a `refund_to_register` return adds a `payment_out` row so the cash actually
 * leaves the drawer and the customer keeps no credit.
 */
async function insertConfirmReturnLedgerLines(
  ret: SalesReturn,
  registerWarehouseId: number
): Promise<void> {
  const total = roundMoney(ret.total_amount)
  if (total < 0.01) return

  const refNum = `R-${ret.return_number}`

  await insertBalanceTransactionRow({
    person_id: ret.person_id,
    type: 'order',
    amount: roundMoney(-total),
    reference_id: ret.id,
    reference_number: refNum,
    note: `Return #${ret.return_number}`,
    payment_method: null,
    payment_group_id: null,
    wallet_direction: null,
  })

  if (ret.settlement === 'refund_to_register') {
    await insertBalanceTransactionRow({
      person_id: ret.person_id,
      type: 'payment_out',
      amount: roundMoney(total),
      reference_id: ret.id,
      reference_number: refNum,
      note: `Refund for return #${ret.return_number}`,
      payment_method: ret.refund_method,
      payment_group_id: null,
      wallet_direction: null,
      register_warehouse_id: registerWarehouseId,
    })
  }
}

export async function confirmReturn(
  id: string,
  options: {
    settlement: ReturnSettlement
    refund_method?: PaymentMethod
  }
): Promise<ReturnWithItems> {
  const ret = await getReturnById(id)
  if (!ret) throw new Error('Return not found')
  assertReturnNotHistoricalSnapshot(ret, 'confirm')
  if (ret.status_flow !== 'draft') {
    throw new Error('Only draft returns can be confirmed')
  }
  if (ret.items.length === 0) {
    throw new Error('Add at least one line to the return')
  }

  const settlement = options.settlement
  if (settlement === 'credit_to_account' && !ret.person_id) {
    throw new Error(
      'Select a customer order to credit the refund to an account, or refund from the register'
    )
  }
  const refundMethod =
    settlement === 'refund_to_register'
      ? normalizePaymentMethod(options.refund_method)
      : null
  if (settlement === 'refund_to_register' && !refundMethod) {
    throw new Error('Choose how the refund leaves the register')
  }

  const registerWhId = await resolveRegisterWarehouseForOrderConfirm(
    ret.warehouse_id
  )

  const { error: settleErr } = await supabase
    .from(RETURNS)
    .update({
      settlement,
      refund_method: refundMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (settleErr) throw settleErr

  const { data: rpcRaw, error: rpcErr } = await supabase.rpc(
    'confirm_return_apply_stock',
    { p_return_id: id }
  )
  if (rpcErr) throw rpcErr

  const rpcData = typeof rpcRaw === 'string' ? JSON.parse(rpcRaw) : rpcRaw
  const result = rpcData as {
    ok?: boolean
    violations?: unknown
    error?: string
  } | null

  if (!result?.ok) {
    const violations = parseOverReturnViolations(result?.violations)
    if (violations.length > 0) {
      throw new OverReturnConfirmError(violations)
    }
    throw new Error(
      result?.error === 'not_draft'
        ? 'Only draft returns can be confirmed'
        : result?.error === 'return_not_found'
          ? 'Return not found'
          : result?.error === 'historical_snapshot'
            ? 'Historical snapshot returns cannot be confirmed'
            : result?.error === 'no_lines'
              ? 'Add at least one line to the return'
              : result?.error === 'source_line_not_found'
                ? 'A source order line for this return no longer exists'
                : 'Could not confirm return stock'
    )
  }

  const confirmed = await getReturnById(id)
  if (!confirmed) throw new Error('Return not found after confirm')

  await insertConfirmReturnLedgerLines(confirmed, registerWhId)
  await afterReturnStockMutation(confirmed.items.map((i) => i.product_id))

  return confirmed
}

async function afterReturnStockMutation(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds)].filter(Boolean)
  if (!ids.length) return
  try {
    await recalculateStockFromMovements(ids)
  } catch {
    /* RPC may be missing on unmigrated DB */
  }
}

export async function cancelReturn(id: string): Promise<void> {
  const ret = await getReturnById(id)
  if (!ret) throw new Error('Return not found')
  assertReturnNotHistoricalSnapshot(ret, 'cancel')
  if (ret.status_flow === 'cancelled') {
    throw new Error('Return is already cancelled')
  }

  const reverseStock = ret.status_flow === 'confirmed'

  if (reverseStock) {
    const note = `Reversed from cancelled return #${ret.return_number}`
    for (const item of ret.items) {
      await adjustStock(item.product_id, 'out', item.quantity, note, {
        warehouseId: ret.warehouse_id,
      })
    }
    await voidReturnCancelLedgerInPlace(
      ret.id,
      ret.return_number,
      ret.person_id
    )
  }

  const { error } = await supabase
    .from(RETURNS)
    .update({
      status_flow: 'cancelled' as ReturnStatusFlow,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error

  if (reverseStock) {
    await afterReturnStockMutation(ret.items.map((i) => i.product_id))
  }
}

/**
 * CSV backfill: a confirmed-looking return that must not drive stock, register, or ledger.
 * Mirrors `importHistoricalOrderSnapshot`.
 */
export async function importHistoricalReturnSnapshot(data: {
  source_order_id: string
  return_number?: number
  items: Array<{
    source_order_item_id: string
    product_id: string
    quantity: number
    unit_price: number
  }>
  note?: string
  created_at?: string
}): Promise<ReturnWithItems> {
  if (data.items.length === 0) {
    throw new Error('Historical return needs at least one line')
  }
  const order = await fetchSourceOrder(data.source_order_id)

  const lines: PricedLine[] = data.items.map((it) => {
    const qty = Math.trunc(Number(it.quantity))
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error('Return quantity must be at least 1')
    }
    const price = roundMoney(Number(it.unit_price))
    return {
      source_order_item_id: it.source_order_item_id,
      product_id: it.product_id,
      quantity: qty,
      unit_price: price,
      total_price: roundMoney(price * qty),
    }
  })

  const whRaw = order.warehouse_id
  const warehouse_id =
    whRaw != null && Number.isFinite(Number(whRaw))
      ? Math.trunc(Number(whRaw))
      : DEFAULT_WAREHOUSE_ID

  const createdAt = data.created_at?.trim()
  const payload: Record<string, unknown> = {
    source_order_id: data.source_order_id,
    person_id: order.person_id,
    warehouse_id,
    status_flow: 'confirmed' as ReturnStatusFlow,
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
    .from(RETURNS)
    .insert(payload)
    .select('id')
    .single()
  if (error) throwHistoricalSnapshotMigrationError(error)

  const returnId = (inserted as { id: string }).id
  try {
    await insertReturnItems(returnId, lines)
  } catch (e) {
    throwHistoricalSnapshotMigrationError(e)
  }

  const created = await getReturnById(returnId)
  if (!created) throw new Error('Failed to fetch historical return')
  return created
}
