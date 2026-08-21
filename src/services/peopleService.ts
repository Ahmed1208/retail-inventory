import { supabase } from '@/lib/supabase'
import { isRetainedFromCancelledDocumentNote } from '@/utils/ledgerLinks'
import { normalizePaymentMethod } from '@/utils/paymentMethod'
import type {
  BalanceTransaction,
  BalanceTransactionType,
  OrderStatusFlow,
  PaymentMethod,
  Person,
  PersonRole,
  PersonWithTransactions,
  PurchaseOrderStatus,
} from '@/types'

const PEOPLE = 'people'
const BALANCE_TX = 'balance_transactions'
const ORDERS = 'orders'
const PURCHASE_ORDERS = 'purchase_orders'
const PAYMENT_INSTALLMENTS = 'payment_installments'

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Thrown when phone matches another person (trimmed, case-insensitive). */
export const DUPLICATE_PHONE_ERROR = 'PHONE_DUPLICATE'

/** Thrown when create payload has no phone (app validation). Kept for older callers. */
export const PHONE_REQUIRED_ERROR = 'PHONE_REQUIRED'

/** Thrown when external_code matches another person. */
export const DUPLICATE_EXTERNAL_CODE_ERROR = 'EXTERNAL_CODE_DUPLICATE'

export class DuplicateExternalCodeError extends Error {
  otherPersonName: string

  constructor(otherPersonName: string) {
    super(DUPLICATE_EXTERNAL_CODE_ERROR)
    this.name = 'DuplicateExternalCodeError'
    this.otherPersonName = otherPersonName
  }
}

export class DuplicatePhoneError extends Error {
  otherPersonName: string

  constructor(otherPersonName: string) {
    super(DUPLICATE_PHONE_ERROR)
    this.name = 'DuplicatePhoneError'
    this.otherPersonName = otherPersonName
  }
}

/** Same rule as DB unique index on people.phone (trim + lowercase). */
export function normalizePhoneKey(s: string): string {
  return s.trim().toLowerCase()
}

/** Same rule as DB unique index on people.external_code (trim + lowercase). */
export function normalizeExternalCode(s: string): string {
  return s.trim().toLowerCase()
}

function isMissingPersonPhoneConflictRpcError(error: unknown): boolean {
  const m = supabaseErrorMessage(error).toLowerCase()
  const code =
    typeof error === 'object' && error !== null
      ? String((error as { code?: string }).code ?? '')
      : ''
  if (code === '42883') return true
  if (m.includes('person_phone_conflict')) {
    if (
      m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('unknown function')
    ) {
      return true
    }
  }
  return false
}

/**
 * Finds another person with the same normalized phone (matches DB unique index rule).
 * Uses RPC when available; otherwise scans `people` so duplicates are blocked even without migrations.
 */
export async function findConflictingPersonByPhone(
  phone: string,
  excludePersonId?: string
): Promise<{ id: string; name: string } | null> {
  const raw = phone.trim()
  if (!raw) return null
  const key = normalizePhoneKey(raw)

  const { data, error } = await supabase.rpc('person_phone_conflict', {
    p_phone: raw,
    p_exclude_person_id: excludePersonId ?? null,
  })

  if (!error && data != null) {
    const rows = Array.isArray(data) ? data : [data]
    const row = rows[0] as
      | { conflict_id?: string; conflict_name?: string }
      | undefined
    if (row?.conflict_id != null && String(row.conflict_id) !== '') {
      return {
        id: String(row.conflict_id),
        name: String(row.conflict_name ?? ''),
      }
    }
  }

  if (error && !isMissingPersonPhoneConflictRpcError(error)) throw error

  const { data: all, error: pe } = await supabase
    .from(PEOPLE)
    .select('id,name,phone')

  if (pe) throw pe
  for (const r of all ?? []) {
    const pr = r as { id: string; name: string; phone: string | null }
    if (!pr.phone?.trim()) continue
    if (normalizePhoneKey(pr.phone) !== key) continue
    if (excludePersonId && pr.id === excludePersonId) continue
    return { id: pr.id, name: pr.name }
  }
  return null
}

export async function findConflictingPersonByExternalCode(
  code: string,
  excludePersonId?: string
): Promise<{ id: string; name: string } | null> {
  const key = normalizeExternalCode(code)
  if (!key) return null

  const { data: all, error } = await supabase
    .from(PEOPLE)
    .select('id,name,external_code')

  if (error) {
    if (isMissingColumnError(error, 'external_code')) return null
    throw error
  }
  for (const r of all ?? []) {
    const pr = r as { id: string; name: string; external_code?: string | null }
    if (!pr.external_code?.trim()) continue
    if (normalizeExternalCode(pr.external_code) !== key) continue
    if (excludePersonId && pr.id === excludePersonId) continue
    return { id: pr.id, name: pr.name }
  }
  return null
}

async function assertExternalCodeNotDuplicate(
  code: string | null | undefined,
  excludePersonId?: string
): Promise<void> {
  const raw = code?.trim() ?? ''
  if (raw === '') return
  const conflict = await findConflictingPersonByExternalCode(raw, excludePersonId)
  if (conflict) {
    throw new DuplicateExternalCodeError(conflict.name)
  }
}

function isPostgresUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505'
}

/** Best-effort message from Supabase/PostgREST errors (message, details, hint). */
export function supabaseErrorMessage(e: unknown): string {
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

/**
 * Historical CSV import needs `is_historical_snapshot` on orders / purchase_orders.
 * PostgREST often surfaces a missing column as a "schema cache" error until NOTIFY reload.
 */
export function throwHistoricalSnapshotMigrationError(err: unknown): never {
  const raw = supabaseErrorMessage(err)
  const low = raw.toLowerCase()
  if (
    raw &&
    (low.includes('is_historical_snapshot') ||
      (low.includes('schema cache') &&
        (low.includes("'orders'") || low.includes("'purchase_orders'"))))
  ) {
    throw new Error(
      `${raw} Apply Supabase migrations in supabase/migrations (032–033), run \`npm run db:push:local\` or \`supabase db push\`, then reload the API schema (SQL: NOTIFY pgrst, 'reload schema'; or Dashboard → API → Reload schema).`
    )
  }
  throw err
}

function isPeoplePhoneUniqueViolation(e: unknown): boolean {
  const s = supabaseErrorMessage(e).toLowerCase()
  return s.includes('people_phone_lower_trim_unique')
}

function isPeopleExternalCodeUniqueViolation(e: unknown): boolean {
  const s = supabaseErrorMessage(e).toLowerCase()
  return s.includes('people_external_code_lower_trim_unique')
}

async function assertPhoneNotDuplicate(
  phone: string | null | undefined,
  excludePersonId?: string
): Promise<void> {
  const raw = phone?.trim() ?? ''
  if (raw === '') return
  const conflict = await findConflictingPersonByPhone(raw, excludePersonId)
  if (conflict) {
    throw new DuplicatePhoneError(conflict.name)
  }
}

/** True when PostgREST/Postgres reports this column is missing (migration not applied). */
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

const BALANCE_TX_OPTIONAL_COLS = [
  'payment_group_id',
  'wallet_direction',
  'payment_method',
  'register_warehouse_id',
] as const

/**
 * Inserts ledger rows; retries without optional columns when migrations 007–009
 * are not fully applied (PostgREST "schema cache" / column unknown errors).
 */
export async function insertBalanceTransactionRows(
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return
  let current = rows.map((r) => ({ ...r }))
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase.from(BALANCE_TX).insert(current)
    if (!error) return

    const col = BALANCE_TX_OPTIONAL_COLS.find((c) =>
      isMissingColumnError(error, c)
    )
    if (!col) throw error

    current = current.map((r) => {
      const n = { ...r }
      delete n[col]
      return n
    })
  }
  throw new Error('insertBalanceTransactionRows: exhausted column fallbacks')
}

export async function insertBalanceTransactionRow(
  row: Record<string, unknown>
): Promise<void> {
  return insertBalanceTransactionRows([row])
}

function mapRoles(raw: unknown): PersonRole[] {
  const arr = Array.isArray(raw) ? raw : []
  return arr.filter((r): r is PersonRole => r === 'customer' || r === 'supplier')
}

export function mapPersonRow(row: Record<string, unknown>): Person {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone != null ? String(row.phone) : null,
    external_code:
      row.external_code != null && String(row.external_code).trim() !== ''
        ? String(row.external_code).trim()
        : null,
    address: row.address != null ? String(row.address) : null,
    notes: row.notes != null ? String(row.notes) : null,
    roles: mapRoles(row.roles),
    balance: Number(row.balance ?? 0),
    discount_rate: Number(row.discount_rate ?? 0),
    credit_limit:
      row.credit_limit != null && row.credit_limit !== ''
        ? Number(row.credit_limit)
        : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export function mapTxRow(row: Record<string, unknown>): BalanceTransaction {
  const pg = row.payment_group_id
  const wd = row.wallet_direction
  const rev = row.reversed_at
  return {
    id: String(row.id),
    person_id:
      row.person_id != null && String(row.person_id) !== ''
        ? String(row.person_id)
        : null,
    type: row.type as BalanceTransaction['type'],
    amount: Number(row.amount),
    reference_id: row.reference_id != null ? String(row.reference_id) : null,
    reference_number:
      row.reference_number != null ? String(row.reference_number) : null,
    note: row.note != null ? String(row.note) : null,
    payment_method: normalizePaymentMethod(row.payment_method),
    payment_group_id:
      pg !== null && pg !== undefined && String(pg) !== ''
        ? String(pg)
        : null,
    wallet_direction:
      wd === 'in' || wd === 'out' ? wd : null,
    created_at: String(row.created_at),
    reversed_at:
      rev != null && String(rev) !== '' ? String(rev) : null,
    register_warehouse_id:
      row.register_warehouse_id != null && row.register_warehouse_id !== ''
        ? Number(row.register_warehouse_id)
        : null,
  }
}

export type PeopleFilters = {
  role?: PersonRole
  search?: string
  minBalance?: number
  maxBalance?: number
  minDiscount?: number
}

export async function getAllPeople(filters?: PeopleFilters): Promise<Person[]> {
  const { data, error } = await supabase
    .from(PEOPLE)
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error

  let rows = (data ?? []).map((r) => mapPersonRow(r as Record<string, unknown>))

  if (filters?.role) {
    rows = rows.filter((p) => p.roles.includes(filters.role!))
  }
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.external_code && p.external_code.toLowerCase().includes(q))
    )
  }
  if (filters?.minBalance !== undefined) {
    rows = rows.filter((p) => p.balance >= filters.minBalance!)
  }
  if (filters?.maxBalance !== undefined) {
    rows = rows.filter((p) => p.balance <= filters.maxBalance!)
  }
  if (filters?.minDiscount !== undefined) {
    rows = rows.filter((p) => p.discount_rate >= filters.minDiscount!)
  }

  return rows
}

export async function getPersonById(id: string): Promise<PersonWithTransactions> {
  const { data: personRow, error: pErr } = await supabase
    .from(PEOPLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (pErr) throw pErr
  if (!personRow) throw new Error('Person not found')

  const { data: txRows, error: tErr } = await supabase
    .from(BALANCE_TX)
    .select('*')
    .eq('person_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (tErr) throw tErr

  return {
    ...mapPersonRow(personRow as Record<string, unknown>),
    transactions: (txRows ?? []).map((r) =>
      mapTxRow(r as Record<string, unknown>)
    ),
  }
}

export async function createPerson(
  data: Omit<Person, 'id' | 'created_at' | 'updated_at' | 'balance' | 'external_code'> & {
    external_code?: string | null
  }
): Promise<Person> {
  if (!data.roles?.length) {
    throw new Error('At least one role is required')
  }

  const trimmedPhone = data.phone?.trim() ?? ''
  const trimmedCode = data.external_code?.trim() ?? ''

  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    phone: trimmedPhone || null,
    external_code: trimmedCode || null,
    address: data.address?.trim() || null,
    notes: data.notes?.trim() || null,
    roles: data.roles,
    discount_rate: data.discount_rate ?? 0,
    credit_limit: data.credit_limit,
  }

  await assertPhoneNotDuplicate(trimmedPhone || null)
  await assertExternalCodeNotDuplicate(trimmedCode || null)

  let insertPayload = { ...payload }
  const { data: inserted, error } = await supabase
    .from(PEOPLE)
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    if (isMissingColumnError(error, 'external_code')) {
      delete insertPayload.external_code
      const retry = await supabase.from(PEOPLE).insert(insertPayload).select().single()
      if (retry.error) throw retry.error
      return mapPersonRow(retry.data as Record<string, unknown>)
    }
    if (isPostgresUniqueViolation(error) && isPeoplePhoneUniqueViolation(error)) {
      const again = await findConflictingPersonByPhone(trimmedPhone)
      throw new DuplicatePhoneError(again?.name ?? '')
    }
    if (isPostgresUniqueViolation(error) && isPeopleExternalCodeUniqueViolation(error)) {
      const again = await findConflictingPersonByExternalCode(trimmedCode)
      throw new DuplicateExternalCodeError(again?.name ?? '')
    }
    throw error
  }
  return mapPersonRow(inserted as Record<string, unknown>)
}

async function getOrderNumbersForPerson(personId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from(ORDERS)
    .select('order_number')
    .eq('person_id', personId)

  if (error) throw error
  return (data ?? []).map((r) => Number((r as { order_number: number }).order_number))
}

async function getPONumbersForPerson(personId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from(PURCHASE_ORDERS)
    .select('order_number')
    .eq('person_id', personId)

  if (error) throw error
  return (data ?? []).map((r) => Number((r as { order_number: number }).order_number))
}

export async function updatePerson(
  id: string,
  data: Partial<Omit<Person, 'id' | 'created_at' | 'balance'>>
): Promise<Person> {
  const { data: existingRow, error: fetchErr } = await supabase
    .from(PEOPLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!existingRow) throw new Error('Person not found')

  const existing = mapPersonRow(existingRow as Record<string, unknown>)
  const newRoles = data.roles ?? existing.roles

  if (existing.roles.includes('customer') && !newRoles.includes('customer')) {
    const nums = await getOrderNumbersForPerson(id)
    if (nums.length) {
      throw new Error(
        `Cannot remove customer role; linked orders: ${nums.map((n) => `#${n}`).join(', ')}`
      )
    }
  }
  if (existing.roles.includes('supplier') && !newRoles.includes('supplier')) {
    const nums = await getPONumbersForPerson(id)
    if (nums.length) {
      throw new Error(
        `Cannot remove supplier role; linked purchase orders: ${nums.map((n) => `PO-${n}`).join(', ')}`
      )
    }
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (data.name !== undefined) patch.name = data.name.trim()
  if (data.phone !== undefined) patch.phone = data.phone?.trim() || null
  if (data.external_code !== undefined) {
    patch.external_code = data.external_code?.trim() || null
  }
  if (data.address !== undefined) patch.address = data.address?.trim() || null
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null
  if (data.roles !== undefined) patch.roles = data.roles
  if (data.discount_rate !== undefined) patch.discount_rate = data.discount_rate
  if (data.credit_limit !== undefined) patch.credit_limit = data.credit_limit
  if (data.updated_at !== undefined) patch.updated_at = data.updated_at

  if (data.phone !== undefined) {
    const nextPhone = data.phone?.trim() || null
    await assertPhoneNotDuplicate(nextPhone, id)
  }
  if (data.external_code !== undefined) {
    await assertExternalCodeNotDuplicate(data.external_code?.trim() || null, id)
  }

  const { data: updated, error } = await supabase
    .from(PEOPLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (isPostgresUniqueViolation(error) && isPeoplePhoneUniqueViolation(error)) {
      const phoneForCheck =
        data.phone !== undefined
          ? data.phone?.trim() || ''
          : existing.phone?.trim() || ''
      const again = await findConflictingPersonByPhone(phoneForCheck, id)
      throw new DuplicatePhoneError(again?.name ?? '')
    }
    if (isPostgresUniqueViolation(error) && isPeopleExternalCodeUniqueViolation(error)) {
      const codeForCheck =
        data.external_code !== undefined
          ? data.external_code?.trim() || ''
          : existing.external_code?.trim() || ''
      const again = await findConflictingPersonByExternalCode(codeForCheck, id)
      throw new DuplicateExternalCodeError(again?.name ?? '')
    }
    throw error
  }
  return mapPersonRow(updated as Record<string, unknown>)
}

/** Returns a user-facing message if delete is blocked, or null if allowed. */
export async function getPersonDeleteBlockMessage(id: string): Promise<string | null> {
  const orderNums = await getOrderNumbersForPerson(id)
  if (orderNums.length) {
    return `Cannot delete: linked orders ${orderNums.map((n) => `#${n}`).join(', ')}`
  }
  const poNums = await getPONumbersForPerson(id)
  if (poNums.length) {
    return `Cannot delete: linked purchase orders ${poNums.map((n) => `PO-${n}`).join(', ')}`
  }

  const { data: personRow, error: pErr } = await supabase
    .from(PEOPLE)
    .select('balance')
    .eq('id', id)
    .maybeSingle()

  if (pErr) throw pErr
  if (!personRow) return 'Person not found'

  const bal = Number((personRow as { balance: number }).balance)
  if (Math.abs(bal) > 0.001) {
    return `Person has unsettled balance of ${roundMoney(bal)} EGP`
  }
  return null
}

export async function deletePerson(id: string): Promise<void> {
  const orderNums = await getOrderNumbersForPerson(id)
  if (orderNums.length) {
    throw new Error(
      `Cannot delete: linked orders ${orderNums.map((n) => `#${n}`).join(', ')}`
    )
  }
  const poNums = await getPONumbersForPerson(id)
  if (poNums.length) {
    throw new Error(
      `Cannot delete: linked purchase orders ${poNums.map((n) => `PO-${n}`).join(', ')}`
    )
  }

  const { data: personRow, error: pErr } = await supabase
    .from(PEOPLE)
    .select('balance')
    .eq('id', id)
    .maybeSingle()

  if (pErr) throw pErr
  if (!personRow) throw new Error('Person not found')

  const bal = Number((personRow as { balance: number }).balance)
  if (Math.abs(bal) > 0.001) {
    throw new Error(
      `Person has unsettled balance of ${roundMoney(bal)} EGP`
    )
  }

  const { error: dErr } = await supabase.from(PEOPLE).delete().eq('id', id)
  if (dErr) throw dErr
}

/** Same numbering as Record payment (`PI-*` / `PY-*`); use for ledger rows that should match that UX. */
export async function getNextStandaloneLedgerRef(
  type: 'payment_in' | 'payment_out'
): Promise<string> {
  const { data: refRaw, error: refErr } = await supabase.rpc(
    'next_standalone_ledger_ref',
    { p_type: type }
  )
  if (refErr) {
    const msg = supabaseErrorMessage(refErr).toLowerCase()
    const rpcMissing =
      msg.includes('schema cache') ||
      msg.includes('could not find the function') ||
      msg.includes('pgrst202') ||
      msg.includes('42883') ||
      (msg.includes('function') && msg.includes('does not exist'))
    if (!rpcMissing) throw refErr
    const prefix = type === 'payment_in' ? 'PI' : 'PY'
    const suffix = crypto
      .randomUUID()
      .replace(/-/g, '')
      .slice(0, 10)
      .toUpperCase()
    return `${prefix}-${suffix}`
  }
  const refNumber =
    typeof refRaw === 'string' ? refRaw : String(refRaw ?? '')
  if (!refNumber) throw new Error('Failed to allocate payment reference')
  return refNumber
}

/** CSV export: standalone person payments (not tied to an order/PO). */
export type StandalonePaymentCsvExportRow = {
  created_at: string
  person_name: string
  person_phone: string
  payment_type: 'payment_in' | 'payment_out'
  payment_method: PaymentMethod
  amount: number
  note: string
  register_warehouse_code: string
  register_warehouse_name: string
}

export async function listStandalonePersonPaymentsForExport(): Promise<
  StandalonePaymentCsvExportRow[]
> {
  const { data, error } = await supabase
    .from(BALANCE_TX)
    .select(
      'created_at, type, amount, note, payment_method, register_warehouse_id, people(name, phone)'
    )
    .in('type', ['payment_in', 'payment_out'])
    .is('reference_id', null)
    .not('person_id', 'is', null)
    .is('reversed_at', null)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error) throw error

  /** DBs without migration 029 have no `warehouses.code`; PostgREST errors if we select it. */
  let whRows: Record<string, unknown>[] | null = null
  {
    let { data, error: whErr } = await supabase
      .from('warehouses')
      .select('id, code, name')
    if (whErr) {
      const msg = String(whErr.message ?? '').toLowerCase()
      const details = String(
        (whErr as { details?: string | null }).details ?? ''
      ).toLowerCase()
      const missingCode =
        whErr.code === '42703' ||
        (msg.includes('code') &&
          (msg.includes('does not exist') ||
            msg.includes('column') ||
            details.includes('does not exist')))
      if (missingCode) {
        ;({ data, error: whErr } = await supabase
          .from('warehouses')
          .select('id, name'))
      }
      if (whErr) throw whErr
    }
    whRows = (data ?? []) as Record<string, unknown>[]
  }

  const whMap = new Map<number, { code: string; name: string }>()
  for (const w of whRows ?? []) {
    const id = Math.trunc(Number(w.id))
    const codeRaw = w.code
    const code =
      codeRaw != null && String(codeRaw).trim() !== ''
        ? String(codeRaw).trim()
        : `WH-${String(id).padStart(4, '0')}`
    whMap.set(id, {
      code,
      name: w.name != null ? String(w.name) : '',
    })
  }

  const out: StandalonePaymentCsvExportRow[] = []
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>
    const people = row.people as { name?: string; phone?: string } | null
    const rid = row.register_warehouse_id
    const whId =
      rid != null && Number.isFinite(Number(rid))
        ? Math.trunc(Number(rid))
        : null
    const w = whId != null ? whMap.get(whId) : null
    const typ = String(row.type)
    const amtAbs = roundMoney(Math.abs(Number(row.amount)))
    const pm = normalizePaymentMethod(row.payment_method)
    out.push({
      created_at: String(row.created_at ?? ''),
      person_name: people?.name != null ? String(people.name) : '',
      person_phone: people?.phone != null ? String(people.phone) : '',
      payment_type: typ === 'payment_out' ? 'payment_out' : 'payment_in',
      payment_method: (pm ?? 'cash') as PaymentMethod,
      amount: amtAbs,
      note: row.note != null ? String(row.note) : '',
      register_warehouse_code: w?.code ?? '',
      register_warehouse_name: w?.name ?? '',
    })
  }
  return out
}

export async function recordPayment(data: {
  person_id: string
  type: 'payment_in' | 'payment_out'
  /** One row per method; amounts must sum to the total payment. */
  payments: { payment_method: PaymentMethod; amount: number }[]
  note?: string
  /** Cash register warehouse (required for register-affecting standalone payments). */
  register_warehouse_id: number
}): Promise<Person> {
  const lines = (data.payments ?? []).filter((p) => p.amount > 0.01)
  const total = roundMoney(lines.reduce((s, p) => s + p.amount, 0))
  if (total < 0.01) throw new Error('Amount must be at least 0.01')

  const { data: personRow, error: pErr } = await supabase
    .from(PEOPLE)
    .select('*')
    .eq('id', data.person_id)
    .maybeSingle()

  if (pErr) throw pErr
  if (!personRow) throw new Error('Person not found')

  const noteBase = data.note?.trim() || null
  const paymentGroupId = lines.length > 1 ? crypto.randomUUID() : null

  const refNumber = await getNextStandaloneLedgerRef(data.type)

  const rows: {
    person_id: string
    type: 'payment_in' | 'payment_out'
    amount: number
    note: string | null
    payment_method: PaymentMethod
    payment_group_id: string | null
    wallet_direction: null
    reference_number: string
    register_warehouse_id: number
  }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const amt = roundMoney(line.amount)
    const delta =
      data.type === 'payment_in' ? roundMoney(-amt) : roundMoney(amt)
    const note =
      lines.length > 1
        ? noteBase
          ? `${noteBase} (${i + 1}/${lines.length})`
          : `${i + 1}/${lines.length}`
        : noteBase

    rows.push({
      person_id: data.person_id,
      type: data.type,
      amount: delta,
      note,
      payment_method: line.payment_method,
      payment_group_id: paymentGroupId,
      wallet_direction: null,
      reference_number: refNumber,
      register_warehouse_id: data.register_warehouse_id,
    })
  }

  await insertBalanceTransactionRows(rows as Record<string, unknown>[])

  const { data: updated, error: uErr } = await supabase
    .from(PEOPLE)
    .select('*')
    .eq('id', data.person_id)
    .single()

  if (uErr) throw uErr
  return mapPersonRow(updated as Record<string, unknown>)
}

export async function adjustBalance(data: {
  person_id: string
  amount: number
  note: string
}): Promise<Person> {
  const delta = roundMoney(data.amount)
  const note = data.note.trim()
  if (!note) throw new Error('Note is required for adjustment')

  const { data: personRow, error: pErr } = await supabase
    .from(PEOPLE)
    .select('*')
    .eq('id', data.person_id)
    .maybeSingle()

  if (pErr) throw pErr
  if (!personRow) throw new Error('Person not found')

  await insertBalanceTransactionRow({
    person_id: data.person_id,
    type: 'adjustment',
    amount: delta,
    note,
    payment_method: null,
    payment_group_id: null,
    wallet_direction: null,
  })

  const { data: updated, error: uErr } = await supabase
    .from(PEOPLE)
    .select('*')
    .eq('id', data.person_id)
    .single()

  if (uErr) throw uErr
  return mapPersonRow(updated as Record<string, unknown>)
}

/** Balance row with person summary (before grouping split payments). */
type BalanceTransactionListItem = BalanceTransaction & {
  person: Pick<Person, 'id' | 'name' | 'phone'>
}

/** Note on `adjustment` rows created by `reverseLedgerPaymentOperation` (transaction log filter). */
export const LEDGER_REVERSAL_ADJUSTMENT_NOTE = 'Reversal of recorded payment'

/** One logical payment for the All payments table (split tenders aggregated). */
export type PaymentGroupedListItem = {
  id: string
  created_at: string
  /** Ledger person; null for walk-in transactions. */
  person_id: string | null
  person: Pick<Person, 'id' | 'name' | 'phone'>
  type: BalanceTransactionType
  /** Signed ledger total for this payment. */
  amount: number
  reference_id: string | null
  reference_number: string | null
  note: string | null
  /**
   * UUID for `/payments/operations/:id` when type is payment_in / payment_out.
   * `payment_group_id` when set, else the single row id.
   */
  ledger_operation_route_id: string | null
  /** Tender lines (amounts are absolute, for display). */
  paymentLines: { payment_method: PaymentMethod | null; amount: number }[]
  /** True when every underlying ledger row has `reversed_at` set (split payments). */
  reversed: boolean
  /** Latest `reversed_at` among grouped rows, when `reversed`. */
  reversedAt: string | null
  /** Live PO status when `type === 'purchase_order'` (transaction log). */
  purchaseOrderStatus: PurchaseOrderStatus | null
  /** Live sales order `status_flow` when `type === 'order'` (transaction log). */
  orderStatus: OrderStatusFlow | null
  /** Checkout PI/PO rows nested under order/purchase_order when default log. */
  children?: PaymentGroupedListItem[]
  /** Set when this row is only shown under a document parent. */
  isCheckoutChild?: boolean
  /** Register warehouse for register-affecting payment lines (propagated to document parents when nested). */
  register_warehouse_id?: number | null
}

export type PaymentsHubTypeFilter =
  | 'payment_in'
  | 'payment_out'
  | 'payments_both'
  | 'all_types'

function absDisplayAmount(raw: number): number {
  return roundMoney(Math.abs(raw))
}

function ledgerOperationRouteIdFromRows(
  rows: BalanceTransactionListItem[]
): string | null {
  const t = rows[0]?.type
  if (t === 'register_deposit' || t === 'register_withdraw') {
    return rows[0].id
  }
  if (t !== 'payment_in' && t !== 'payment_out') return null
  return rows[0].payment_group_id ?? rows[0].id
}

function reversedStateFromRows(
  rows: BalanceTransactionListItem[]
): { reversed: boolean; reversedAt: string | null } {
  if (rows.length === 0) return { reversed: false, reversedAt: null }
  const stamps: string[] = []
  for (const r of rows) {
    const t = r.reversed_at
    if (t == null || String(t).trim() === '') {
      return { reversed: false, reversedAt: null }
    }
    stamps.push(String(t))
  }
  const reversedAt = stamps.reduce((a, b) => (a > b ? a : b))
  return { reversed: true, reversedAt }
}

function buildPaymentGroupFromRows(
  rows: BalanceTransactionListItem[],
  id: string
): PaymentGroupedListItem {
  const first = rows[0]
  const created_at = rows.reduce(
    (max, r) => (r.created_at > max ? r.created_at : max),
    rows[0].created_at
  )
  const totalAmount = roundMoney(rows.reduce((s, r) => s + r.amount, 0))
  const notes = rows.map((r) => r.note).filter((n): n is string => Boolean(n))
  const note =
    notes.length === 0
      ? null
      : notes.length === 1
        ? notes[0]
        : [...new Set(notes)].join(' | ')
  const paymentLines = rows.map((r) => ({
    payment_method: r.payment_method,
    amount: absDisplayAmount(r.amount),
  }))
  const { reversed, reversedAt } = reversedStateFromRows(rows)
  return {
    id,
    created_at,
    person_id: first.person_id,
    person: first.person,
    type: first.type,
    amount: totalAmount,
    reference_id: first.reference_id,
    reference_number: first.reference_number,
    note,
    ledger_operation_route_id: ledgerOperationRouteIdFromRows(rows),
    paymentLines,
    reversed,
    reversedAt,
    purchaseOrderStatus: null,
    orderStatus: null,
    register_warehouse_id: first.register_warehouse_id ?? null,
  }
}

function mergePaymentGroup(
  rows: BalanceTransactionListItem[]
): PaymentGroupedListItem {
  return buildPaymentGroupFromRows(rows, rows[0].payment_group_id!)
}

function singleRowToPaymentGroup(
  row: BalanceTransactionListItem
): PaymentGroupedListItem {
  const { reversed, reversedAt } = reversedStateFromRows([row])
  return {
    id: row.id,
    created_at: row.created_at,
    person_id: row.person_id,
    person: row.person,
    type: row.type,
    amount: row.amount,
    reference_id: row.reference_id,
    reference_number: row.reference_number,
    note: row.note,
    ledger_operation_route_id: ledgerOperationRouteIdFromRows([row]),
    paymentLines: [
      {
        payment_method: row.payment_method,
        amount: absDisplayAmount(row.amount),
      },
    ],
    reversed,
    reversedAt,
    purchaseOrderStatus: null,
    orderStatus: null,
    register_warehouse_id: row.register_warehouse_id ?? null,
  }
}

/** Ungrouped split tenders (missing `payment_group_id`) with same ref + second bucket. */
function ungroupedSplitClusterKey(
  row: BalanceTransactionListItem
): string | null {
  if (row.type !== 'payment_in' && row.type !== 'payment_out') return null
  if (!row.reference_id) return null
  const sec = row.created_at.slice(0, 19)
  return `${row.person.id}|${row.reference_id}|${row.reference_number ?? ''}|${sec}|${row.type}`
}

function groupPaymentLedgerRows(
  items: BalanceTransactionListItem[]
): PaymentGroupedListItem[] {
  const withGroup: BalanceTransactionListItem[] = []
  const withoutGroup: BalanceTransactionListItem[] = []
  for (const row of items) {
    if (row.payment_group_id) withGroup.push(row)
    else withoutGroup.push(row)
  }

  const byGid = new Map<string, BalanceTransactionListItem[]>()
  for (const row of withGroup) {
    const gid = row.payment_group_id!
    const arr = byGid.get(gid) ?? []
    arr.push(row)
    byGid.set(gid, arr)
  }

  const out: PaymentGroupedListItem[] = []

  for (const rows of byGid.values()) {
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at))
    const types = new Set(rows.map((r) => r.type))
    if (types.size === 1) {
      out.push(
        rows.length === 1
          ? singleRowToPaymentGroup(rows[0])
          : mergePaymentGroup(rows)
      )
    } else {
      const byType = new Map<
        BalanceTransactionType,
        BalanceTransactionListItem[]
      >()
      for (const r of rows) {
        const arr = byType.get(r.type) ?? []
        arr.push(r)
        byType.set(r.type, arr)
      }
      const gidStr = rows[0].payment_group_id!
      for (const bucket of byType.values()) {
        bucket.sort((a, b) => a.created_at.localeCompare(b.created_at))
        if (bucket.length === 1) {
          out.push(singleRowToPaymentGroup(bucket[0]))
        } else {
          const id = `${gidStr}:${bucket[0].type}`
          out.push(buildPaymentGroupFromRows(bucket, id))
        }
      }
    }
  }

  const ungroupedByKey = new Map<string, BalanceTransactionListItem[]>()
  for (const row of withoutGroup) {
    const k = ungroupedSplitClusterKey(row)
    if (!k) {
      out.push(singleRowToPaymentGroup(row))
      continue
    }
    const arr = ungroupedByKey.get(k) ?? []
    arr.push(row)
    ungroupedByKey.set(k, arr)
  }
  for (const arr of ungroupedByKey.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (arr.length === 1) {
      out.push(singleRowToPaymentGroup(arr[0]))
    } else {
      const id = `ungrouped-split:${arr
        .map((r) => r.id)
        .sort()
        .join(':')}`
      out.push(buildPaymentGroupFromRows(arr, id))
    }
  }

  out.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return out
}

function groupMatchesMethodFilter(
  group: PaymentGroupedListItem,
  mf: 'all' | PaymentMethod | 'unspecified'
): boolean {
  if (mf === 'all') return true
  const selfMatch =
    mf === 'unspecified'
      ? group.paymentLines.every((l) => l.payment_method == null)
      : group.paymentLines.some((l) => l.payment_method === mf)
  if (selfMatch) return true
  return (group.children ?? []).some((c) => groupMatchesMethodFilter(c, mf))
}

/** Checkout tender within this window of the document line nests under order/PO (default log). */
const CHECKOUT_COLLAPSE_WINDOW_MS = 30_000

function nestCheckoutPaymentsUnderDocuments(
  groups: PaymentGroupedListItem[],
  fullLedger: boolean
): PaymentGroupedListItem[] {
  if (fullLedger) return groups

  const orderAnchor = new Map<string, { at: number; personId: string | null }>()
  for (const g of groups) {
    if (g.type !== 'order' || !g.reference_id) continue
    const t = Date.parse(g.created_at)
    const prev = orderAnchor.get(g.reference_id)
    if (!prev || t < prev.at) {
      orderAnchor.set(g.reference_id, { at: t, personId: g.person_id })
    }
  }

  const poAnchor = new Map<string, { at: number; personId: string | null }>()
  for (const g of groups) {
    if (g.type !== 'purchase_order' || !g.reference_id) continue
    const t = Date.parse(g.created_at)
    const prev = poAnchor.get(g.reference_id)
    if (!prev || t < prev.at) {
      poAnchor.set(g.reference_id, { at: t, personId: g.person_id })
    }
  }

  const orderRefHasParent = new Set(
    groups
      .filter((g) => g.type === 'order' && g.reference_id)
      .map((g) => g.reference_id as string)
  )
  const poRefHasParent = new Set(
    groups
      .filter((g) => g.type === 'purchase_order' && g.reference_id)
      .map((g) => g.reference_id as string)
  )

  const orderChildren = new Map<string, PaymentGroupedListItem[]>()
  const poChildren = new Map<string, PaymentGroupedListItem[]>()
  const nestableIds = new Set<string>()

  for (const g of groups) {
    if (g.type === 'payment_in' && g.reference_id) {
      const anchor = orderAnchor.get(g.reference_id)
      if (
        !isRetainedFromCancelledDocumentNote(g.note) &&
        orderRefHasParent.has(g.reference_id) &&
        anchor &&
        anchor.personId === g.person_id &&
        Date.parse(g.created_at) >= anchor.at &&
        Date.parse(g.created_at) - anchor.at <= CHECKOUT_COLLAPSE_WINDOW_MS
      ) {
        nestableIds.add(g.id)
        const arr = orderChildren.get(g.reference_id) ?? []
        arr.push({
          ...g,
          children: undefined,
          isCheckoutChild: true,
        })
        orderChildren.set(g.reference_id, arr)
      }
    }
    if (g.type === 'payment_out' && g.reference_id) {
      const anchor = poAnchor.get(g.reference_id)
      if (
        !isRetainedFromCancelledDocumentNote(g.note) &&
        poRefHasParent.has(g.reference_id) &&
        anchor &&
        anchor.personId === g.person_id &&
        Date.parse(g.created_at) >= anchor.at &&
        Date.parse(g.created_at) - anchor.at <= CHECKOUT_COLLAPSE_WINDOW_MS
      ) {
        nestableIds.add(g.id)
        const arr = poChildren.get(g.reference_id) ?? []
        arr.push({
          ...g,
          children: undefined,
          isCheckoutChild: true,
        })
        poChildren.set(g.reference_id, arr)
      }
    }
  }

  for (const arr of orderChildren.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  for (const arr of poChildren.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  const out: PaymentGroupedListItem[] = []
  for (const g of groups) {
    if (nestableIds.has(g.id)) continue
    if (g.type === 'order' && g.reference_id && orderChildren.has(g.reference_id)) {
      out.push({
        ...g,
        children: orderChildren.get(g.reference_id),
      })
      continue
    }
    if (
      g.type === 'purchase_order' &&
      g.reference_id &&
      poChildren.has(g.reference_id)
    ) {
      out.push({
        ...g,
        children: poChildren.get(g.reference_id),
      })
      continue
    }
    out.push({ ...g, children: undefined })
  }
  return out
}

function propagateRegisterWarehouseToDocumentParents(
  groups: PaymentGroupedListItem[]
): PaymentGroupedListItem[] {
  return groups.map((g) => {
    if (
      (g.type === 'order' || g.type === 'purchase_order') &&
      g.children?.length
    ) {
      const fromChild = g.children
        .map((c) => c.register_warehouse_id)
        .find((x) => x != null)
      const rw = g.register_warehouse_id ?? fromChild
      if (rw != null) {
        return { ...g, register_warehouse_id: rw }
      }
    }
    return g
  })
}

function filterReversalMirrorAdjustments(
  groups: PaymentGroupedListItem[],
  fullLedger: boolean
): PaymentGroupedListItem[] {
  if (fullLedger) return groups
  return groups.filter(
    (g) =>
      !(
        g.type === 'adjustment' &&
        g.note?.trim() === LEDGER_REVERSAL_ADJUSTMENT_NOTE
      )
  )
}

const ORDER_PAYMENTS_TABLE = 'order_payments'
const PO_PAYMENTS_TABLE = 'purchase_order_payments'

/**
 * Replace order/PO ledger placeholder lines with tender rows from payment tables.
 * When `attachToParent` is false (full ledger mode), keep parent rows as plain ledger lines
 * so tender appears only on `payment_in` / `payment_out` rows.
 */
async function enrichOrderPoPaymentLines(
  groups: PaymentGroupedListItem[],
  attachToParent: boolean
): Promise<PaymentGroupedListItem[]> {
  if (!attachToParent) return groups

  const orderIds = [
    ...new Set(
      groups
        .filter((g) => g.type === 'order' && g.reference_id)
        .map((g) => g.reference_id as string)
    ),
  ]
  const poIds = [
    ...new Set(
      groups
        .filter((g) => g.type === 'purchase_order' && g.reference_id)
        .map((g) => g.reference_id as string)
    ),
  ]

  const orderPayByOrder = new Map<
    string,
    { payment_method: PaymentMethod | null; amount: number }[]
  >()

  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from(ORDER_PAYMENTS_TABLE)
      .select('order_id, payment_method, amount')
      .in('order_id', orderIds)

    if (!error && data) {
      for (const row of data as Array<{
        order_id: string
        payment_method: unknown
        amount: number
      }>) {
        const list = orderPayByOrder.get(row.order_id) ?? []
        list.push({
          payment_method: normalizePaymentMethod(row.payment_method),
          amount: absDisplayAmount(row.amount),
        })
        orderPayByOrder.set(row.order_id, list)
      }
    }
  }

  const poPayByPo = new Map<
    string,
    { payment_method: PaymentMethod | null; amount: number }[]
  >()

  if (poIds.length > 0) {
    const { data, error } = await supabase
      .from(PO_PAYMENTS_TABLE)
      .select('purchase_order_id, payment_method, amount')
      .in('purchase_order_id', poIds)

    if (!error && data) {
      for (const row of data as Array<{
        purchase_order_id: string
        payment_method: unknown
        amount: number
      }>) {
        const list = poPayByPo.get(row.purchase_order_id) ?? []
        list.push({
          payment_method: normalizePaymentMethod(row.payment_method),
          amount: absDisplayAmount(row.amount),
        })
        poPayByPo.set(row.purchase_order_id, list)
      }
    }
  }

  return groups.map((g) => {
    if (g.type === 'order' && g.reference_id) {
      const lines = orderPayByOrder.get(g.reference_id)
      if (lines && lines.length > 0) {
        return { ...g, paymentLines: lines }
      }
    }
    if (g.type === 'purchase_order' && g.reference_id) {
      const lines = poPayByPo.get(g.reference_id)
      if (lines && lines.length > 0) {
        return { ...g, paymentLines: lines }
      }
    }
    return g
  })
}

/** First active (non-reversed) PO payment_out cluster route id for `/payments/operations/:id`. */
export async function getLedgerPaymentOperationRouteIdForPo(
  purchaseOrderId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(BALANCE_TX)
    .select('id, payment_group_id')
    .eq('reference_id', purchaseOrderId)
    .eq('type', 'payment_out')
    .is('reversed_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  const row = data?.[0] as
    | { id: string; payment_group_id: string | null }
    | undefined
  if (!row) return null
  const pg = row.payment_group_id
  return pg != null && String(pg).trim() !== '' ? String(pg) : String(row.id)
}

/** First active (non-reversed) order payment_in cluster route id for `/payments/operations/:id`. */
export async function getLedgerPaymentOperationRouteIdForOrder(
  orderId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(BALANCE_TX)
    .select('id, payment_group_id')
    .eq('reference_id', orderId)
    .eq('type', 'payment_in')
    .is('reversed_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  const row = data?.[0] as
    | { id: string; payment_group_id: string | null }
    | undefined
  if (!row) return null
  const pg = row.payment_group_id
  return pg != null && String(pg).trim() !== '' ? String(pg) : String(row.id)
}

async function attachPurchaseOrderStatusToGroups(
  groups: PaymentGroupedListItem[]
): Promise<PaymentGroupedListItem[]> {
  const poIds = [
    ...new Set(
      groups
        .filter((g) => g.type === 'purchase_order' && g.reference_id)
        .map((g) => g.reference_id as string)
    ),
  ]
  if (poIds.length === 0) return groups

  const { data, error } = await supabase
    .from(PURCHASE_ORDERS)
    .select('id, status')
    .in('id', poIds)
  if (error) throw error

  const statusById = new Map<string, PurchaseOrderStatus>()
  for (const r of data ?? []) {
    const row = r as { id: string; status: string }
    if (
      row.status === 'draft' ||
      row.status === 'received' ||
      row.status === 'cancelled'
    ) {
      statusById.set(String(row.id), row.status)
    }
  }

  return groups.map((g) => {
    if (g.type !== 'purchase_order' || !g.reference_id) return g
    const st = statusById.get(g.reference_id) ?? null
    return { ...g, purchaseOrderStatus: st }
  })
}

const ORDER_STATUS_FLOWS: OrderStatusFlow[] = [
  'draft',
  'confirmed',
  'completed',
  'cancelled',
]

function parseOrderStatusFlow(raw: string): OrderStatusFlow | null {
  return ORDER_STATUS_FLOWS.includes(raw as OrderStatusFlow)
    ? (raw as OrderStatusFlow)
    : null
}

async function attachOrderStatusToGroups(
  groups: PaymentGroupedListItem[]
): Promise<PaymentGroupedListItem[]> {
  const orderIds = [
    ...new Set(
      groups
        .filter((g) => g.type === 'order' && g.reference_id)
        .map((g) => g.reference_id as string)
    ),
  ]
  if (orderIds.length === 0) return groups

  const { data, error } = await supabase
    .from(ORDERS)
    .select('id, status_flow')
    .in('id', orderIds)
  if (error) throw error

  const flowById = new Map<string, OrderStatusFlow>()
  for (const r of data ?? []) {
    const row = r as { id: string; status_flow: string }
    const f = parseOrderStatusFlow(String(row.status_flow))
    if (f) flowById.set(String(row.id), f)
  }

  return groups.map((g) => {
    if (g.type !== 'order' || !g.reference_id) return g
    const st = flowById.get(g.reference_id) ?? null
    return { ...g, orderStatus: st }
  })
}

/**
 * Lists balance ledger rows for the transaction log (orders, POs, payments, wallet, adjustments).
 * When `typeFilter` is `all_types` (default in UI), every transaction type is included.
 */
export async function listBalanceTransactionsWithPeople(filters: {
  from?: string | null
  to?: string | null
  personId?: string
  /** `all_types` = full ledger; `payments_both` = payment_in, payment_out, wallet; or one tender type. */
  typeFilter?: PaymentsHubTypeFilter
  /** Filter: group is included if any tender line matches. */
  paymentMethodFilter?: 'all' | PaymentMethod | 'unspecified'
  /**
   * When false (default), checkout `payment_in` / `payment_out` rows that mirror tender on an
   * order/PO line in the same result are hidden for a simpler log.
   */
  fullLedger?: boolean
}): Promise<PaymentGroupedListItem[]> {
  const tf = filters.typeFilter ?? 'all_types'
  const mf = filters.paymentMethodFilter ?? 'all'
  const fullLedger = filters.fullLedger ?? false

  let q = supabase
    .from(BALANCE_TX)
    .select(
      `
      *,
      people (
        id,
        name,
        phone
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(10000)

  if (filters.from) {
    q = q.gte('created_at', filters.from)
  }
  if (filters.to) {
    const end = new Date(filters.to)
    q = q.lte('created_at', end.toISOString())
  }
  if (filters.personId) {
    q = q.eq('person_id', filters.personId)
  }
  if (tf === 'payment_in') {
    q = q.eq('type', 'payment_in')
  } else if (tf === 'payment_out') {
    q = q.eq('type', 'payment_out')
  } else if (tf === 'payments_both') {
    q = q.in('type', [
      'payment_in',
      'payment_out',
      'wallet',
      'register_deposit',
      'register_withdraw',
    ])
  }

  const { data, error } = await q
  if (error) throw error

  const mapRows = (rows: unknown[] | null): BalanceTransactionListItem[] =>
    (rows ?? []).map((raw) => {
      const r = raw as Record<string, unknown>
      const nested = r.people as Record<string, unknown> | null | undefined
      const { people: _p, ...rest } = r
      const tx = mapTxRow(rest as Record<string, unknown>)
      const pid = tx.person_id
      return {
        ...tx,
        person: {
          id: pid ?? '',
          name:
            nested?.name != null
              ? String(nested.name)
              : pid
                ? '—'
                : '',
          phone: nested?.phone != null ? String(nested.phone) : null,
        },
      }
    })

  let groups = groupPaymentLedgerRows(mapRows(data))
  groups = await enrichOrderPoPaymentLines(groups, !fullLedger)
  groups = await attachPurchaseOrderStatusToGroups(groups)
  groups = await attachOrderStatusToGroups(groups)
  groups = nestCheckoutPaymentsUnderDocuments(groups, fullLedger)
  groups = propagateRegisterWarehouseToDocumentParents(groups)
  groups = filterReversalMirrorAdjustments(groups, fullLedger)
  if (mf !== 'all') {
    groups = groups.filter((g) => groupMatchesMethodFilter(g, mf))
  }
  return groups
}

export async function getPersonTransactions(
  person_id: string,
  filters?: { type?: BalanceTransactionType; from?: string; to?: string }
): Promise<BalanceTransaction[]> {
  let q = supabase
    .from(BALANCE_TX)
    .select('*')
    .eq('person_id', person_id)
    .order('created_at', { ascending: false })

  if (filters?.type) {
    q = q.eq('type', filters.type)
  }
  if (filters?.from) {
    q = q.gte('created_at', filters.from)
  }
  if (filters?.to) {
    const end = new Date(filters.to)
    end.setHours(23, 59, 59, 999)
    q = q.lte('created_at', end.toISOString())
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => mapTxRow(r as Record<string, unknown>))
}

/** Sum of positive balances (customers owe you) and sum of abs(negative) (you owe suppliers). */
export async function getPeopleBalanceAggregates(): Promise<{
  totalReceivables: number
  totalPayables: number
}> {
  const { data, error } = await supabase.from(PEOPLE).select('balance')
  if (error) throw error

  let totalReceivables = 0
  let totalPayables = 0
  for (const row of data ?? []) {
    const b = Number((row as { balance: number }).balance)
    if (b > 0) totalReceivables += b
    if (b < 0) totalPayables += -b
  }

  return {
    totalReceivables: roundMoney(totalReceivables),
    totalPayables: roundMoney(totalPayables),
  }
}

export async function countCustomerOrdersForPerson(personId: string): Promise<number> {
  const nums = await getOrderNumbersForPerson(personId)
  return nums.length
}

export async function countSupplierPOsForPerson(personId: string): Promise<number> {
  const nums = await getPONumbersForPerson(personId)
  return nums.length
}

/** Same bucket as ungroupedSplitClusterKey for payment_in / payment_out (person id may be empty). */
function ungroupedPaymentClusterKey(
  personId: string,
  tx: Pick<BalanceTransaction, 'reference_id' | 'reference_number' | 'created_at' | 'type'>
): string | null {
  if (tx.type !== 'payment_in' && tx.type !== 'payment_out') return null
  if (!tx.reference_id) return null
  const sec = tx.created_at.slice(0, 19)
  return `${personId}|${tx.reference_id}|${tx.reference_number ?? ''}|${sec}|${tx.type}`
}

export type LedgerPaymentOperationLine = {
  id: string
  payment_method: PaymentMethod | null
  amount: number
  note: string | null
}

export type LedgerPaymentOperation = {
  operation_route_id: string
  type: 'payment_in' | 'payment_out' | 'register_deposit' | 'register_withdraw'
  reference_number: string | null
  reference_id: string | null
  person_id: string | null
  person: Pick<Person, 'id' | 'name' | 'phone'> | null
  created_at: string
  /** Register / drawer warehouse for this operation (from tender rows). */
  register_warehouse_id: number | null
  lines: LedgerPaymentOperationLine[]
  /** Wallet lines from the same payment group / time cluster (overpayment). */
  walletLines: LedgerPaymentOperationLine[]
  /** True if any row in this operation was reversed. */
  reversed: boolean
  /** Combined note for display/edit (lines are updated together). */
  note: string | null
}

const LEDGER_PAY_TYPES = ['payment_in', 'payment_out'] as const

function operationRegisterWarehouseId(rows: BalanceTransaction[]): number | null {
  const v = rows.map((r) => r.register_warehouse_id).find((x) => x != null)
  return v ?? null
}

const WALLET_TIME_WINDOW_MS = 8000
const INSTALLMENT_CLUSTER_GAP_MS = 3500
const INSTALLMENT_ANCHOR_WINDOW_MS = 6000

async function loadWalletLinesForOperation(
  anchor: BalanceTransaction,
  paymentRows: BalanceTransaction[]
): Promise<BalanceTransaction[]> {
  if (!anchor.reference_id) return []

  let q = supabase
    .from(BALANCE_TX)
    .select('*')
    .eq('reference_id', anchor.reference_id)
    .eq('type', 'wallet')
  if (anchor.person_id) {
    q = q.eq('person_id', anchor.person_id)
  } else {
    q = q.is('person_id', null)
  }
  if (anchor.reference_number != null && anchor.reference_number !== '') {
    q = q.eq('reference_number', anchor.reference_number)
  }
  const { data, error } = await q.order('created_at', { ascending: true })
  if (error) throw error
  const mapped = (data ?? []).map((r) => mapTxRow(r as Record<string, unknown>))

  if (anchor.payment_group_id) {
    return mapped.filter((w) => w.payment_group_id === anchor.payment_group_id)
  }

  if (paymentRows.length === 0) return []
  const tMin = Math.min(
    ...paymentRows.map((r) => new Date(r.created_at).getTime())
  )
  return mapped.filter((w) => {
    const tw = new Date(w.created_at).getTime()
    return Math.abs(tw - tMin) <= WALLET_TIME_WINDOW_MS
  })
}

type AmountRow = { id: string; amount: number | string; created_at: string }

function clusterRowsByAdjacentTime(rows: AmountRow[], gapMs: number): AmountRow[][] {
  const sorted = [...rows].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
  )
  const clusters: AmountRow[][] = []
  for (const row of sorted) {
    const last = clusters[clusters.length - 1]
    if (!last) {
      clusters.push([row])
      continue
    }
    const prevT = +new Date(last[last.length - 1].created_at)
    const t = +new Date(row.created_at)
    if (t - prevT <= gapMs) last.push(row)
    else clusters.push([row])
  }
  return clusters
}

function clusterTouchesAnchor(
  cl: AmountRow[],
  anchorMs: number,
  windowMs: number
): boolean {
  const min = Math.min(...cl.map((c) => +new Date(c.created_at)))
  const max = Math.max(...cl.map((c) => +new Date(c.created_at)))
  return max >= anchorMs - windowMs && min <= anchorMs + windowMs
}

/**
 * Load one logical payment_in / payment_out operation for `/payments/operations/:id`,
 * or a single register_deposit / register_withdraw row (operation id = row id).
 * `operationId` is a balance_transactions.id or a shared payment_group_id.
 */
export async function getLedgerPaymentOperation(
  operationId: string
): Promise<LedgerPaymentOperation | null> {
  let anchor: BalanceTransaction | null = null

  const { data: byId, error: e1 } = await supabase
    .from(BALANCE_TX)
    .select('*')
    .eq('id', operationId)
    .maybeSingle()
  if (e1) throw e1
  if (byId) {
    const direct = mapTxRow(byId as Record<string, unknown>)
    if (
      direct.type === 'register_deposit' ||
      direct.type === 'register_withdraw'
    ) {
      const rev =
        direct.reversed_at != null && String(direct.reversed_at).trim() !== ''
      return {
        operation_route_id: direct.id,
        type: direct.type,
        reference_number: direct.reference_number,
        reference_id: direct.reference_id,
        person_id: null,
        person: null,
        created_at: direct.created_at,
        register_warehouse_id: direct.register_warehouse_id,
        lines: [
          {
            id: direct.id,
            payment_method: direct.payment_method,
            amount: direct.amount,
            note: direct.note,
          },
        ],
        walletLines: [],
        reversed: rev,
        note: direct.note,
      }
    }
  }
  const byIdType = byId ? String((byId as { type: string }).type) : ''
  if (byId && (byIdType === 'payment_in' || byIdType === 'payment_out')) {
    anchor = mapTxRow(byId as Record<string, unknown>)
  }

  if (!anchor) {
    const { data: byG, error: e2 } = await supabase
      .from(BALANCE_TX)
      .select('*')
      .eq('payment_group_id', operationId)
      .in('type', [...LEDGER_PAY_TYPES])
      .order('created_at', { ascending: true })
    if (e2) throw e2
    if (byG && byG.length > 0) {
      anchor = mapTxRow(byG[0] as Record<string, unknown>)
    }
  }

  if (!anchor) return null

  let rows: BalanceTransaction[] = []

  if (anchor.payment_group_id) {
    const { data, error } = await supabase
      .from(BALANCE_TX)
      .select('*')
      .eq('payment_group_id', anchor.payment_group_id)
      .eq('type', anchor.type)
      .order('created_at', { ascending: true })
    if (error) throw error
    rows = (data ?? []).map((r) => mapTxRow(r as Record<string, unknown>))
  } else if (anchor.reference_id) {
    let q = supabase
      .from(BALANCE_TX)
      .select('*')
      .eq('reference_id', anchor.reference_id)
      .eq('type', anchor.type)
    if (anchor.reference_number != null && anchor.reference_number !== '') {
      q = q.eq('reference_number', anchor.reference_number)
    }
    if (anchor.person_id) {
      q = q.eq('person_id', anchor.person_id)
    }
    const { data, error } = await q.order('created_at', { ascending: true })
    if (error) throw error
    const want = ungroupedPaymentClusterKey(anchor.person_id ?? '', anchor)
    rows = (data ?? [])
      .map((r) => mapTxRow(r as Record<string, unknown>))
      .filter(
        (r) => ungroupedPaymentClusterKey(r.person_id ?? '', r) === want
      )
    if (rows.length === 0) rows = [anchor]
  } else {
    rows = [anchor]
  }

  const walletRows = await loadWalletLinesForOperation(anchor, rows)
  const reversed = [...rows, ...walletRows].some(
    (r) => r.reversed_at != null && String(r.reversed_at).trim() !== ''
  )

  const operation_route_id = anchor.payment_group_id ?? anchor.id

  let person: Pick<Person, 'id' | 'name' | 'phone'> | null = null
  if (anchor.person_id) {
    const { data: p, error: pe } = await supabase
      .from(PEOPLE)
      .select('id, name, phone')
      .eq('id', anchor.person_id)
      .maybeSingle()
    if (pe) throw pe
    if (p) {
      const pr = p as { id: string; name: string; phone: string | null }
      person = {
        id: String(pr.id),
        name: String(pr.name),
        phone: pr.phone != null ? String(pr.phone) : null,
      }
    }
  }

  const lines: LedgerPaymentOperationLine[] = rows.map((r) => ({
    id: r.id,
    payment_method: r.payment_method,
    amount: r.amount,
    note: r.note,
  }))

  const walletLines: LedgerPaymentOperationLine[] = walletRows.map((r) => ({
    id: r.id,
    payment_method: r.payment_method,
    amount: r.amount,
    note: r.note,
  }))

  const nonEmpty = [...rows, ...walletRows]
    .map((r) => (r.note ?? '').trim())
    .filter(Boolean)
  const unique = [...new Set(nonEmpty)]
  const note =
    unique.length === 1
      ? unique[0]
      : unique.length > 1
        ? unique.join(' | ')
        : null

  return {
    operation_route_id,
    type: anchor.type as LedgerPaymentOperation['type'],
    reference_number: anchor.reference_number,
    reference_id: anchor.reference_id,
    person_id: anchor.person_id,
    person,
    created_at: rows.reduce(
      (max, r) => (r.created_at > max ? r.created_at : max),
      rows[0].created_at
    ),
    register_warehouse_id:
      operationRegisterWarehouseId(rows) ?? anchor.register_warehouse_id,
    lines,
    walletLines,
    reversed,
    note,
  }
}

/** Set the same note on every balance row in this payment operation. */
export async function updateLedgerPaymentOperationNote(
  operationId: string,
  note: string | null
): Promise<void> {
  const op = await getLedgerPaymentOperation(operationId)
  if (!op) throw new Error('Payment operation not found')
  if (op.reversed) {
    throw new Error('Cannot edit note on a reversed payment operation')
  }
  const trimmed = note?.trim() ? note.trim() : null
  for (const line of [...op.lines, ...op.walletLines]) {
    const { error } = await supabase
      .from(BALANCE_TX)
      .update({ note: trimmed })
      .eq('id', line.id)
    if (error) throw error
  }
}

async function findSingleInstallmentCluster(
  orderId: string,
  targetSum: number,
  anchorMs: number
): Promise<AmountRow[]> {
  const { data: inst, error: ie } = await supabase
    .from(PAYMENT_INSTALLMENTS)
    .select('id, amount, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (ie) throw ie
  const rows = (inst ?? []) as AmountRow[]
  const clusters = clusterRowsByAdjacentTime(rows, INSTALLMENT_CLUSTER_GAP_MS)
  const matches = clusters.filter(
    (cl) =>
      clusterTouchesAnchor(cl, anchorMs, INSTALLMENT_ANCHOR_WINDOW_MS) &&
      Math.abs(
        roundMoney(cl.reduce((s, r) => s + Number(r.amount), 0)) - targetSum
      ) < 0.02
  )
  if (matches.length === 0) {
    throw new Error(
      'Could not match this payment to order installment rows (time/sum).'
    )
  }
  if (matches.length > 1) {
    throw new Error(
      'More than one installment group matches; cannot reverse safely.'
    )
  }
  return matches[0]
}

async function findOrderPaymentsForInstallmentCluster(
  orderId: string,
  cluster: AmountRow[]
): Promise<AmountRow[]> {
  const { data: opays, error } = await supabase
    .from(ORDER_PAYMENTS_TABLE)
    .select('id, amount, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const t0 =
    Math.min(...cluster.map((c) => +new Date(c.created_at))) - 2500
  const t1 =
    Math.max(...cluster.map((c) => +new Date(c.created_at))) + 2500
  const windowRows = ((opays ?? []) as AmountRow[]).filter((o) => {
    const t = +new Date(o.created_at)
    return t >= t0 && t <= t1
  })
  const instSum = roundMoney(
    cluster.reduce((s, r) => s + Number(r.amount), 0)
  )
  const winSum = roundMoney(
    windowRows.reduce((s, r) => s + Number(r.amount), 0)
  )
  if (Math.abs(winSum - instSum) < 0.02) return windowRows
  throw new Error('Order payment rows do not match installments for reversal.')
}

async function findSinglePoPaymentCluster(
  purchaseOrderId: string,
  targetSum: number,
  anchorMs: number
): Promise<AmountRow[]> {
  const { data: pops, error } = await supabase
    .from(PO_PAYMENTS_TABLE)
    .select('id, amount, created_at')
    .eq('purchase_order_id', purchaseOrderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (pops ?? []) as AmountRow[]
  const clusters = clusterRowsByAdjacentTime(rows, INSTALLMENT_CLUSTER_GAP_MS)
  const matches = clusters.filter(
    (cl) =>
      clusterTouchesAnchor(cl, anchorMs, INSTALLMENT_ANCHOR_WINDOW_MS) &&
      Math.abs(
        roundMoney(cl.reduce((s, r) => s + Number(r.amount), 0)) - targetSum
      ) < 0.02
  )
  if (matches.length === 0) {
    throw new Error(
      'Could not match this payment to purchase order payment rows (time/sum).'
    )
  }
  if (matches.length > 1) {
    throw new Error(
      'More than one PO payment group matches; cannot reverse safely.'
    )
  }
  return matches[0]
}

/**
 * `reference_id` on reversal adjustments: keep order/PO document id for O-/PO- rows; for standalone
 * PI-/PY- payments use the ledger row id so the log can link to `/payments/operations/:id`.
 */
function reversalAdjustmentReferenceId(tx: BalanceTransaction): string | null {
  const refNum = tx.reference_number ?? ''
  if (refNum.startsWith('O-') || refNum.startsWith('PO-')) {
    return tx.reference_id
  }
  return tx.reference_id ?? tx.id
}

/**
 * Sets `reversed_at` on ledger rows. Tries a REST update first; falls back to RPC when PostgREST’s
 * schema cache does not list `reversed_at` yet (migration 014).
 */
async function markBalanceTransactionsReversed(
  ids: string[],
  at: string
): Promise<void> {
  if (ids.length === 0) return

  const { error: restErr } = await supabase
    .from(BALANCE_TX)
    .update({ reversed_at: at })
    .in('id', ids)

  if (!restErr) return

  if (!isMissingColumnError(restErr, 'reversed_at')) {
    throw restErr
  }

  const { error: rpcErr } = await supabase.rpc(
    'set_balance_transactions_reversed_at',
    { p_ids: ids, p_at: at }
  )

  if (!rpcErr) return

  const hint =
    'In Supabase: SQL Editor → run the full script in `supabase/ledger_reversal_setup.sql` (adds reversed_at + RPCs + NOTIFY). ' +
    'If errors persist, restart your Supabase project from the dashboard so PostgREST reloads the schema cache.'
  throw new Error(
    `${supabaseErrorMessage(restErr)} | ${supabaseErrorMessage(rpcErr)}. ${hint}`
  )
}

/** Cluster key for document-linked payment rows (aligns with ungrouped split tender grouping). */
function ungroupedDocPaymentClusterKey(row: {
  person_id: string | null
  reference_id: string | null
  reference_number: string | null
  created_at: string
  type: string
}): string | null {
  if (row.type !== 'payment_in' && row.type !== 'payment_out') return null
  if (!row.reference_id) return null
  const sec = row.created_at.slice(0, 19)
  return `${row.person_id ?? ''}|${row.reference_id}|${row.reference_number ?? ''}|${sec}|${row.type}`
}

/**
 * Distinct payment operation route ids (`payment_group_id` or single row `id`) for active ledger
 * payments on a document, used when cancelling an order/PO to void checkout rows in place.
 */
export async function listActiveLedgerPaymentOperationRouteIdsForDocument(
  referenceId: string,
  referenceNumber: string,
  paymentType: 'payment_in' | 'payment_out',
  personId: string | null
): Promise<string[]> {
  let q = supabase
    .from(BALANCE_TX)
    .select('id, payment_group_id, person_id, reference_id, reference_number, created_at, type')
    .eq('reference_id', referenceId)
    .eq('reference_number', referenceNumber)
    .eq('type', paymentType)
    .is('reversed_at', null)
    .order('created_at', { ascending: true })
  if (personId) {
    q = q.eq('person_id', personId)
  } else {
    q = q.is('person_id', null)
  }
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as Array<{
    id: string
    payment_group_id: string | null
    person_id: string | null
    reference_id: string | null
    reference_number: string | null
    created_at: string
    type: string
  }>
  if (rows.length === 0) return []

  const routeIds: string[] = []
  const seenGid = new Set<string>()
  const withoutGid: typeof rows = []
  for (const r of rows) {
    const gid = r.payment_group_id
    if (gid != null && String(gid).trim() !== '') {
      const g = String(gid)
      if (!seenGid.has(g)) {
        seenGid.add(g)
        routeIds.push(g)
      }
    } else {
      withoutGid.push(r)
    }
  }

  const byCluster = new Map<string, typeof rows>()
  for (const r of withoutGid) {
    const k = ungroupedDocPaymentClusterKey(r)
    if (!k) continue
    const arr = byCluster.get(k) ?? []
    arr.push(r)
    byCluster.set(k, arr)
  }
  for (const cl of byCluster.values()) {
    cl.sort((a, b) => a.created_at.localeCompare(b.created_at))
    routeIds.push(cl[0].id)
  }

  routeIds.sort((a, b) => {
    const ta = rows.find((r) => r.id === a || r.payment_group_id === a)?.created_at ?? ''
    const tb = rows.find((r) => r.id === b || r.payment_group_id === b)?.created_at ?? ''
    return ta.localeCompare(tb)
  })
  return routeIds
}

/**
 * Walk-in cancel: void checkout `payment_in` and the original `order` ledger line in place
 * (same pattern as person orders — no mirror `adjustment` rows with cancel notes in the log).
 */
export async function voidWalkInOrderCancelLedgerInPlace(
  orderId: string,
  orderNumber: number
): Promise<void> {
  const ref = `O-${orderNumber}`
  const routes = await listActiveLedgerPaymentOperationRouteIdsForDocument(
    orderId,
    ref,
    'payment_in',
    null
  )
  await voidLedgerPaymentOperationsForDocumentCancel(routes)

  const { data, error } = await supabase
    .from(BALANCE_TX)
    .select('*')
    .eq('reference_id', orderId)
    .eq('reference_number', ref)
    .eq('type', 'order')
    .is('person_id', null)
    .is('reversed_at', null)
  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return
  const txs = rows.map((r) => mapTxRow(r as Record<string, unknown>))
  await applyReversalAdjustmentsMarkAndBalance(txs)
}

/** Earliest active ledger row time for a document line (confirm-time), for retained-payment copies. */
export async function getLedgerDocumentLineCreatedAt(
  referenceId: string,
  referenceNumber: string,
  docType: 'order' | 'purchase_order',
  personId: string | null
): Promise<string | null> {
  let q = supabase
    .from(BALANCE_TX)
    .select('created_at')
    .eq('reference_id', referenceId)
    .eq('reference_number', referenceNumber)
    .eq('type', docType)
    .is('reversed_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (personId) {
    q = q.eq('person_id', personId)
  } else {
    q = q.is('person_id', null)
  }
  const { data, error } = await q
  if (error) throw error
  const row = data?.[0] as { created_at: string } | undefined
  return row?.created_at ?? null
}

/**
 * Person order cancel: void the original `order` receivable line in place (no second offsetting row).
 */
export async function voidLedgerOrderDocumentRowForCancel(
  orderId: string,
  orderNumber: number,
  personId: string
): Promise<void> {
  const ref = `O-${orderNumber}`
  const { data, error } = await supabase
    .from(BALANCE_TX)
    .select('*')
    .eq('reference_id', orderId)
    .eq('reference_number', ref)
    .eq('type', 'order')
    .eq('person_id', personId)
    .is('reversed_at', null)
  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return
  const txs = rows.map((r) => mapTxRow(r as Record<string, unknown>))
  await applyReversalAdjustmentsMarkAndBalance(txs)
}

/**
 * PO cancel: void the original `purchase_order` liability line in place instead of inserting a
 * second offsetting `purchase_order` row.
 */
export async function voidLedgerPurchaseOrderDocumentRowForCancel(
  purchaseOrderId: string,
  orderNumber: number,
  personId: string
): Promise<void> {
  const ref = `PO-${orderNumber}`
  const { data, error } = await supabase
    .from(BALANCE_TX)
    .select('*')
    .eq('reference_id', purchaseOrderId)
    .eq('reference_number', ref)
    .eq('type', 'purchase_order')
    .eq('person_id', personId)
    .is('reversed_at', null)
  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return
  const txs = rows.map((r) => mapTxRow(r as Record<string, unknown>))
  await applyReversalAdjustmentsMarkAndBalance(txs)
}

/**
 * Insert reversal adjustments, mark rows reversed. `people.balance` is updated by DB replay trigger.
 * Does not touch `order_payments` / installments / PO payment tables (used from document cancel after those deletes).
 */
async function applyReversalAdjustmentsMarkAndBalance(
  txs: BalanceTransaction[]
): Promise<void> {
  if (txs.length === 0) return
  const ids = txs.map((t) => t.id)

  const { data: anyReversed, error: revCheckErr } = await supabase.rpc(
    'balance_tx_any_reversed',
    { p_ids: ids }
  )
  if (!revCheckErr && anyReversed === true) {
    throw new Error('This payment operation was already reversed')
  }

  for (const r of txs) {
    if (r.reversed_at != null && String(r.reversed_at).trim() !== '') {
      throw new Error('This payment operation was already reversed')
    }
  }

  for (const r of txs) {
    await insertBalanceTransactionRow({
      person_id: r.person_id,
      type: 'adjustment',
      amount: roundMoney(-r.amount),
      reference_id: reversalAdjustmentReferenceId(r),
      reference_number: r.reference_number,
      note: LEDGER_REVERSAL_ADJUSTMENT_NOTE,
      payment_method: null,
      payment_group_id: null,
      wallet_direction: null,
    })
  }

  const nowIso = new Date().toISOString()
  await markBalanceTransactionsReversed(ids, nowIso)
}

/**
 * Void all listed payment operations (in-place reversal). Used when cancelling an order/PO with
 * reverse payments so the log does not gain mirror `payment_in` / `payment_out` rows.
 */
export async function voidLedgerPaymentOperationsForDocumentCancel(
  operationRouteIds: string[]
): Promise<void> {
  const allLineIds = new Set<string>()
  for (const rid of operationRouteIds) {
    const op = await getLedgerPaymentOperation(rid)
    if (!op || op.reversed) continue
    for (const l of op.lines) allLineIds.add(l.id)
    for (const l of op.walletLines) allLineIds.add(l.id)
  }
  if (allLineIds.size === 0) return

  const ids = [...allLineIds]
  const { data: rawList, error: le } = await supabase
    .from(BALANCE_TX)
    .select('*')
    .in('id', ids)
  if (le) throw le
  const txs = (rawList ?? []).map((r) => mapTxRow(r as Record<string, unknown>))
  if (txs.length !== ids.length) {
    throw new Error('Some ledger rows are missing; cannot reverse.')
  }

  await applyReversalAdjustmentsMarkAndBalance(txs)
}

/**
 * Undo a recorded payment_in / payment_out operation (and linked wallet lines).
 * Sets `reversed_at` on originals, inserts balancing `adjustment` rows; `people.balance` is replayed in the DB.
 * Best-effort restores order / PO payment tables when reference is O-* / PO-*.
 */
export async function reverseLedgerPaymentOperation(
  operationId: string
): Promise<void> {
  const op = await getLedgerPaymentOperation(operationId)
  if (!op) throw new Error('Payment operation not found')
  if (op.reversed) throw new Error('This payment operation was already reversed')

  const ids = [...op.lines.map((l) => l.id), ...op.walletLines.map((l) => l.id)]

  const { data: anyReversed, error: revCheckErr } = await supabase.rpc(
    'balance_tx_any_reversed',
    { p_ids: ids }
  )
  if (!revCheckErr && anyReversed === true) {
    throw new Error('This payment operation was already reversed')
  }

  const { data: rawList, error: le } = await supabase
    .from(BALANCE_TX)
    .select('*')
    .in('id', ids)
  if (le) throw le
  const txs = (rawList ?? []).map((r) => mapTxRow(r as Record<string, unknown>))
  if (txs.length !== ids.length) {
    throw new Error('Some ledger rows are missing; cannot reverse.')
  }
  for (const r of txs) {
    if (r.reversed_at != null && String(r.reversed_at).trim() !== '') {
      throw new Error('This payment operation was already reversed')
    }
  }

  const anchorMs = Math.min(
    ...txs.map((r) => new Date(r.created_at).getTime())
  )
  const refNum = op.reference_number ?? ''
  const refId = op.reference_id

  if (op.type === 'payment_in' && refId && refNum.startsWith('O-')) {
    const towardOrder = roundMoney(
      txs
        .filter((t) => t.type === 'payment_in')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
    )
    const tenderTotal = roundMoney(
      txs.reduce((s, t) => s + Math.abs(t.amount), 0)
    )

    const { data: ord, error: oe } = await supabase
      .from(ORDERS)
      .select(
        'id, status_flow, paid_amount, remaining_amount, total_amount, order_number'
      )
      .eq('id', refId)
      .maybeSingle()
    if (oe) throw oe
    if (!ord) throw new Error('Linked order not found')
    const flow = String((ord as { status_flow: string }).status_flow)
    if (flow === 'cancelled') {
      throw new Error('Cannot reverse payment on a cancelled order')
    }
    if (towardOrder > 0.01) {
      const cluster = await findSingleInstallmentCluster(
        refId,
        tenderTotal,
        anchorMs
      )
      const opPayCluster = await findOrderPaymentsForInstallmentCluster(
        refId,
        cluster
      )
      for (const row of cluster) {
        const { error: de } = await supabase
          .from(PAYMENT_INSTALLMENTS)
          .delete()
          .eq('id', row.id)
        if (de) throw de
      }
      for (const row of opPayCluster) {
        const { error: de } = await supabase
          .from(ORDER_PAYMENTS_TABLE)
          .delete()
          .eq('id', row.id)
        if (de) throw de
      }
    }

    const paid = roundMoney(Number((ord as { paid_amount: number }).paid_amount))
    const totalAmt = roundMoney(
      Number((ord as { total_amount: number }).total_amount)
    )
    const newPaid = roundMoney(Math.max(0, paid - towardOrder))
    const newRem = roundMoney(Math.max(0, totalAmt - newPaid))
    if (paid - towardOrder < -0.01) {
      throw new Error('Reversal would make order paid amount invalid')
    }

    let status_flow = flow
    let status: string | undefined
    if (flow === 'completed' && newRem > 0.01) {
      status_flow = 'confirmed'
      status = 'pending'
    }

    const orderUp: Record<string, unknown> = {
      paid_amount: newPaid,
      remaining_amount: newRem,
      updated_at: new Date().toISOString(),
    }
    if (status !== undefined) {
      orderUp.status_flow = status_flow
      orderUp.status = status
    }

    const { error: ue } = await supabase
      .from(ORDERS)
      .update(orderUp)
      .eq('id', refId)
    if (ue) throw ue
  }

  if (op.type === 'payment_out' && refId && refNum.startsWith('PO-')) {
    const towardPo = roundMoney(
      txs
        .filter((t) => t.type === 'payment_out')
        .reduce((s, t) => s + t.amount, 0)
    )
    const tenderTotal = roundMoney(
      txs.reduce((s, t) => s + Math.abs(t.amount), 0)
    )

    const { data: po, error: pe } = await supabase
      .from(PURCHASE_ORDERS)
      .select('id, status, paid_amount, remaining_amount, total_amount')
      .eq('id', refId)
      .maybeSingle()
    if (pe) throw pe
    if (!po) throw new Error('Linked purchase order not found')

    const poCancelled = String((po as { status: string }).status) === 'cancelled'
    if (poCancelled) {
      const { error: wipePoPay } = await supabase
        .from(PO_PAYMENTS_TABLE)
        .delete()
        .eq('purchase_order_id', refId)
      if (wipePoPay) throw wipePoPay
    } else {
      if (tenderTotal > 0.01) {
        const cluster = await findSinglePoPaymentCluster(
          refId,
          tenderTotal,
          anchorMs
        )
        for (const row of cluster) {
          const { error: de } = await supabase
            .from(PO_PAYMENTS_TABLE)
            .delete()
            .eq('id', row.id)
          if (de) throw de
        }
      }

      const paid = roundMoney(Number((po as { paid_amount: number }).paid_amount))
      const totalPo = roundMoney(
        Number((po as { total_amount: number }).total_amount)
      )
      const newPaid = roundMoney(Math.max(0, paid - towardPo))
      const newRem = roundMoney(Math.max(0, totalPo - newPaid))
      if (paid - towardPo < -0.01) {
        throw new Error('Reversal would make purchase order paid amount invalid')
      }

      const { error: poe } = await supabase
        .from(PURCHASE_ORDERS)
        .update({
          paid_amount: newPaid,
          remaining_amount: newRem,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refId)
      if (poe) throw poe
    }
  }

  await applyReversalAdjustmentsMarkAndBalance(txs)
}
