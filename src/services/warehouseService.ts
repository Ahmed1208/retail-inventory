import { supabase } from '@/lib/supabase'
import { roundMoney } from '@/services/peopleService'
import { getRegisterBalances } from '@/services/registerService'
import type { PaymentMethod, Warehouse } from '@/types'
import { normalizePaymentMethod } from '@/utils/paymentMethod'

const TABLE = 'warehouses'

export const DEFAULT_WAREHOUSE_ID = 1

function supabaseErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message?.trim()) return e.message.trim()
  if (typeof e === 'object' && e !== null) {
    const o = e as Record<string, unknown>
    const parts = [o.message, o.details, o.hint].filter(
      (x): x is string => typeof x === 'string' && x.trim() !== ''
    )
    if (parts.length) return parts.join(' — ')
  }
  if (typeof e === 'string' && e.trim()) return e.trim()
  return ''
}

function isMissingColumnError(e: unknown, column: string): boolean {
  const col = column.toLowerCase()
  const s = supabaseErrorMessage(e).toLowerCase()
  const o = typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : null
  const details = String(o?.details ?? '').toLowerCase()
  if (!s.includes(col) && !details.includes(col)) return false
  if (details.includes('42703')) return true
  return (
    s.includes('does not exist') ||
    s.includes('could not find') ||
    s.includes('schema cache') ||
    s.includes('unknown column') ||
    s.includes('undefined column')
  )
}

/**
 * Platform invariant: warehouse 1 is the primary inventory location and must have a register.
 * Also enforce `has_register` on whichever row is marked default (matches DB constraint).
 */
async function patchPrimaryAndDefaultWarehouseRegister(): Promise<void> {
  const now = new Date().toISOString()
  const { error: e1 } = await supabase
    .from(TABLE)
    .update({ has_register: true, updated_at: now })
    .eq('id', DEFAULT_WAREHOUSE_ID)
  if (e1 && isMissingColumnError(e1, 'has_register')) return
  if (e1) throw e1

  const { data: defaultRows, error: e2 } = await supabase
    .from(TABLE)
    .select('id')
    .eq('is_default', true)
  if (e2 && isMissingColumnError(e2, 'has_register')) return
  if (e2) throw e2

  for (const r of defaultRows ?? []) {
    const wid = Number((r as { id: number }).id)
    if (wid === DEFAULT_WAREHOUSE_ID) continue
    const { error: e3 } = await supabase
      .from(TABLE)
      .update({ has_register: true, updated_at: now })
      .eq('id', wid)
    if (e3 && isMissingColumnError(e3, 'has_register')) return
    if (e3) throw e3
  }
}

function isRpcMissing(err: { message?: string; code?: string }): boolean {
  const m = (err.message ?? '').toLowerCase()
  return (
    err.code === '42883' ||
    err.code === 'PGRST202' ||
    (m.includes('function') && m.includes('not exist'))
  )
}

/**
 * Guarantees warehouse id 1 exists (name "default") and repairs common gaps:
 * no default flag, missing PWS rows for wh 1, orphan warehouse_id on documents.
 * Uses DB RPC when migration 024 is applied; if the RPC is missing, inserts row 1
 * only when the warehouses table is empty (fresh data wipe without re-migration).
 */
export async function ensureDefaultWarehouse(): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('ensure_default_warehouse')
  if (rpcErr && !isRpcMissing(rpcErr)) throw rpcErr

  if (rpcErr && isRpcMissing(rpcErr)) {
    const { count, error: cErr } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
    if (cErr) throw cErr

    if (count === 0) {
      const { error: insErr } = await supabase.from(TABLE).insert({
        id: 1,
        name: 'default',
        location: null,
        is_default: true,
        has_register: true,
        code: 'DEFAULT-01',
        updated_at: new Date().toISOString(),
      })
      if (insErr) throw insErr
    }
  }

  await patchPrimaryAndDefaultWarehouseRegister()

  const { error: seqErr } = await supabase.rpc('refresh_warehouse_id_sequence')
  if (seqErr && !isRpcMissing(seqErr)) {
    /* optional RPC from migration 023 */
  }
}

export async function listWarehouses(): Promise<Warehouse[]> {
  await ensureDefaultWarehouse()

  let { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error

  if (!data?.length) {
    await ensureDefaultWarehouse()
    ;({ data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('id', { ascending: true }))
    if (error) throw error
  }

  return (data ?? []).map(mapRow)
}

export async function getWarehouseById(id: number): Promise<Warehouse | null> {
  await ensureDefaultWarehouse()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

/** Confirmed sales / register payments require a warehouse that hosts a register. */
export async function assertWarehouseHasRegister(warehouseId: number): Promise<void> {
  const w = await getWarehouseById(warehouseId)
  if (!w?.has_register) {
    throw new Error(
      'This inventory location does not have a cash register. Choose a location with a register or enable one in Warehouses.'
    )
  }
}

/**
 * Orders can ship from inventory-only locations. Confirmation still books tender lines on a
 * register: use the order warehouse if it has one; otherwise the first register warehouse the
 * session may access (default warehouse first, then lowest id).
 */
export async function resolveRegisterWarehouseForOrderConfirm(
  orderWarehouseId: number
): Promise<number> {
  const orderWh = await getWarehouseById(orderWarehouseId)
  if (!orderWh) throw new Error('Warehouse not found')
  if (orderWh.has_register) return orderWh.id

  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('has_register', true)
    .order('is_default', { ascending: false })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const wid = data != null ? Math.trunc(Number((data as { id: unknown }).id)) : NaN
  if (!Number.isFinite(wid) || wid <= 0) {
    throw new Error(
      'This inventory location has no cash register, and no register warehouse is available in your access scope. Ask an admin to enable “Has register” on this location or assign you to a warehouse that has one.'
    )
  }
  return wid
}

/**
 * PO payments are booked to the PO warehouse register when it has one; otherwise the user must pick
 * another register warehouse (inventory-only receiving location).
 */
export async function resolveRegisterWarehouseForPoPayment(
  poWarehouseId: number,
  chosenRegisterWarehouseId?: number | null
): Promise<number> {
  const poWh = await getWarehouseById(poWarehouseId)
  if (!poWh) throw new Error('Warehouse not found')
  if (poWh.has_register) return poWh.id
  const chosen = chosenRegisterWarehouseId
  if (chosen == null || !Number.isFinite(Number(chosen))) {
    throw new Error(
      'This PO warehouse has no register. Choose which register records these supplier payments.'
    )
  }
  const regWh = await getWarehouseById(Math.trunc(Number(chosen)))
  if (!regWh?.has_register) {
    throw new Error('Selected location does not have a register')
  }
  return regWh.id
}

/** After voiding checkout lines, re-book retained tenders using the original register when known. */
export async function resolveRegisterWarehouseForRetainedPayment(
  documentWarehouseId: number,
  priorRegisterWarehouseId: number | null
): Promise<number> {
  if (priorRegisterWarehouseId != null) return priorRegisterWarehouseId
  const w = await getWarehouseById(documentWarehouseId)
  if (w?.has_register) return documentWarehouseId
  return DEFAULT_WAREHOUSE_ID
}

/** Ledger tender row with a register (excludes legacy null-register rows). */
export type DocumentTenderRegisterSnapshot = {
  payment_method: PaymentMethod
  absAmount: number
  register_warehouse_id: number
}

/**
 * Active checkout tenders for a document that already have `register_warehouse_id`.
 * Call **before** voiding those rows so retained payments can re-use the same register(s).
 */
export async function fetchActiveTenderRegistersForDocument(
  referenceId: string,
  tenderType: 'payment_in' | 'payment_out'
): Promise<DocumentTenderRegisterSnapshot[]> {
  const { data, error } = await supabase
    .from('balance_transactions')
    .select('payment_method, amount, register_warehouse_id')
    .eq('reference_id', referenceId)
    .eq('type', tenderType)
    .is('reversed_at', null)
    .not('register_warehouse_id', 'is', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  const out: DocumentTenderRegisterSnapshot[] = []
  for (const raw of data ?? []) {
    const row = raw as {
      payment_method?: unknown
      amount?: unknown
      register_warehouse_id?: unknown
    }
    const pm = normalizePaymentMethod(row.payment_method) ?? 'cash'
    const abs = roundMoney(Math.abs(Number(row.amount ?? 0)))
    const rw = Number(row.register_warehouse_id)
    if (!Number.isFinite(rw)) continue
    out.push({
      payment_method: pm,
      absAmount: abs,
      register_warehouse_id: Math.trunc(rw),
    })
  }
  return out
}

/**
 * Pops the first pool entry matching method and absolute tender amount (±0.02).
 * Mutates `pool`.
 */
export function takeRegisterFromTenderPool(
  pool: DocumentTenderRegisterSnapshot[],
  method: PaymentMethod,
  amount: number
): number | undefined {
  const want = roundMoney(amount)
  const idx = pool.findIndex(
    (r) =>
      r.payment_method === method &&
      Math.abs(r.absAmount - want) < 0.02
  )
  if (idx < 0) return undefined
  const [row] = pool.splice(idx, 1)
  return row.register_warehouse_id
}

function mapRow(row: Record<string, unknown>): Warehouse {
  const id = Number(row.id)
  const codeRaw = row.code
  const code =
    codeRaw != null && String(codeRaw).trim() !== ''
      ? String(codeRaw).trim()
      : `WH-${String(id).padStart(4, '0')}`
  return {
    id,
    code,
    name: String(row.name),
    location: row.location != null ? String(row.location) : null,
    is_default: Boolean(row.is_default),
    has_register: Boolean(row.has_register),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

/** Uppercase slug from location for warehouse codes (e.g. "Nasr City" → "NASR-CITY"). */
export function slugifyWarehouseLocation(location: string): string {
  const s = location
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!s) {
    throw new Error('Location is required to generate a warehouse code.')
  }
  return s
}

export function nextWarehouseCodeFromPrefix(
  prefix: string,
  existingCodes: string[]
): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped}-(\\d+)$`)
  let max = 0
  for (const c of existingCodes) {
    const m = c.match(re)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const next = max + 1
  const width = next < 100 ? 2 : String(next).length
  return `${prefix}-${String(next).padStart(Math.max(2, width), '0')}`
}

export async function getDefaultWarehouseId(): Promise<number | null> {
  await ensureDefaultWarehouse()
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return Number((data as { id: number }).id)
}

export async function createWarehouse(input: {
  name: string
  /** Required; used to auto-generate a unique `code` (e.g. NASR-CITY-01). */
  location: string
  has_register?: boolean
}): Promise<Warehouse> {
  await ensureDefaultWarehouse()
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const loc = input.location.trim()
  if (!loc) throw new Error('Location is required')

  const existing = await listWarehouses()
  const codes = existing.map((w) => w.code)
  const prefix = slugifyWarehouseLocation(loc)
  const code = nextWarehouseCodeFromPrefix(prefix, codes)

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name,
      location: loc,
      code,
      is_default: false,
      has_register: input.has_register ?? false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error
  const { error: seqErr } = await supabase.rpc('refresh_warehouse_id_sequence')
  if (seqErr) throw seqErr
  return mapRow(data as Record<string, unknown>)
}

export async function countRegisterLedgerReferences(
  warehouseId: number
): Promise<number> {
  const { count, error } = await supabase
    .from('balance_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('register_warehouse_id', warehouseId)
  if (error) throw error
  return count ?? 0
}

export async function totalStockUnitsInWarehouse(
  warehouseId: number
): Promise<number> {
  const { data, error } = await supabase
    .from('product_warehouse_stock')
    .select('quantity')
    .eq('warehouse_id', warehouseId)
  if (error) throw error
  let s = 0
  for (const r of data ?? []) {
    s += Math.max(0, Math.trunc(Number((r as { quantity: number }).quantity)))
  }
  return s
}

export async function getWarehouseDeleteBlockers(warehouseId: number): Promise<{
  stockUnits: number
  registerLedgerRows: number
}> {
  const [stockUnits, registerLedgerRows] = await Promise.all([
    totalStockUnitsInWarehouse(warehouseId),
    countRegisterLedgerReferences(warehouseId),
  ])
  return { stockUnits, registerLedgerRows }
}

export async function deleteWarehouse(id: number): Promise<void> {
  if (id === DEFAULT_WAREHOUSE_ID) {
    throw new Error('Cannot delete the primary warehouse.')
  }
  await ensureDefaultWarehouse()
  const w = await getWarehouseById(id)
  if (!w) throw new Error('Warehouse not found.')
  if (w.is_default) {
    throw new Error('Choose another default warehouse before deleting this one.')
  }
  const stock = await totalStockUnitsInWarehouse(id)
  if (stock > 0) {
    throw new Error(
      'Stock is still on hand at this location. Transfer it out first.'
    )
  }
  const regRefs = await countRegisterLedgerReferences(id)
  if (regRefs > 0) {
    throw new Error(
      'Payments are still recorded against this register. This location cannot be removed.'
    )
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function updateWarehouse(
  id: number,
  input: {
    name: string
    location?: string | null
    has_register?: boolean
  }
): Promise<Warehouse> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const current = await getWarehouseById(id)
  if (!current) throw new Error('Warehouse not found')

  let has_register = current.has_register
  if (input.has_register !== undefined) {
    if (id === DEFAULT_WAREHOUSE_ID && !input.has_register) {
      throw new Error(
        'The primary inventory warehouse (ID 1) must always have a cash register.'
      )
    }
    if (current.is_default && !input.has_register) {
      throw new Error('The default location must keep a cash register.')
    }
    if (!input.has_register && input.has_register !== current.has_register) {
      const bal = await getRegisterBalances(id)
      if (bal.total > 0.01) {
        throw new Error(
          'Clear the register first: withdraw or move all cash and card balances to zero before turning off the register.'
        )
      }
    }
    has_register = input.has_register
  }
  if (id === DEFAULT_WAREHOUSE_ID) {
    has_register = true
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name,
      location: input.location?.trim() || null,
      has_register,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

/** At most one warehouse may be default. Pass `null` to clear default on all. */
export async function setDefaultWarehouse(id: number | null): Promise<void> {
  await ensureDefaultWarehouse()
  const now = new Date().toISOString()
  const { error: clearErr } = await supabase
    .from(TABLE)
    .update({ is_default: false, updated_at: now })
    .gte('id', 1)
  if (clearErr) throw clearErr
  if (id == null) return
  const { error } = await supabase
    .from(TABLE)
    .update({ is_default: true, has_register: true, updated_at: now })
    .eq('id', id)
  if (error) throw error
}
