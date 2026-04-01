import { supabase } from '@/lib/supabase'
import { normalizePaymentMethod } from '@/utils/paymentMethod'
import type {
  BalanceTransaction,
  BalanceTransactionType,
  PaymentMethod,
  Person,
  PersonRole,
  PersonWithTransactions,
} from '@/types'

const PEOPLE = 'people'
const BALANCE_TX = 'balance_transactions'
const ORDERS = 'orders'
const PURCHASE_ORDERS = 'purchase_orders'

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
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

function mapTxRow(row: Record<string, unknown>): BalanceTransaction {
  const pg = row.payment_group_id
  const wd = row.wallet_direction
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
        (p.phone && p.phone.toLowerCase().includes(q))
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
  data: Omit<Person, 'id' | 'created_at' | 'updated_at' | 'balance'>
): Promise<Person> {
  if (!data.roles?.length) {
    throw new Error('At least one role is required')
  }

  const payload = {
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
    notes: data.notes?.trim() || null,
    roles: data.roles,
    discount_rate: data.discount_rate ?? 0,
    credit_limit: data.credit_limit,
  }

  const { data: inserted, error } = await supabase
    .from(PEOPLE)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
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
  if (data.address !== undefined) patch.address = data.address?.trim() || null
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null
  if (data.roles !== undefined) patch.roles = data.roles
  if (data.discount_rate !== undefined) patch.discount_rate = data.discount_rate
  if (data.credit_limit !== undefined) patch.credit_limit = data.credit_limit
  if (data.updated_at !== undefined) patch.updated_at = data.updated_at

  const { data: updated, error } = await supabase
    .from(PEOPLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
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

export async function recordPayment(data: {
  person_id: string
  type: 'payment_in' | 'payment_out'
  /** One row per method; amounts must sum to the total payment. */
  payments: { payment_method: PaymentMethod; amount: number }[]
  note?: string
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

  const person = mapPersonRow(personRow as Record<string, unknown>)
  const noteBase = data.note?.trim() || null
  const paymentGroupId = lines.length > 1 ? crypto.randomUUID() : null

  let running = person.balance
  const rows: {
    person_id: string
    type: 'payment_in' | 'payment_out'
    amount: number
    note: string | null
    payment_method: PaymentMethod
    payment_group_id: string | null
    wallet_direction: null
  }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const amt = roundMoney(line.amount)
    const delta =
      data.type === 'payment_in' ? roundMoney(-amt) : roundMoney(amt)
    running = roundMoney(running + delta)
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
    })
  }

  await insertBalanceTransactionRows(rows as Record<string, unknown>[])

  const { data: updated, error: uErr } = await supabase
    .from(PEOPLE)
    .update({
      balance: running,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.person_id)
    .select()
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

  const person = mapPersonRow(personRow as Record<string, unknown>)
  const newBalance = roundMoney(person.balance + delta)

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
    .update({
      balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.person_id)
    .select()
    .single()

  if (uErr) throw uErr
  return mapPersonRow(updated as Record<string, unknown>)
}

/** Balance row with person summary (before grouping split payments). */
type BalanceTransactionListItem = BalanceTransaction & {
  person: Pick<Person, 'id' | 'name' | 'phone'>
}

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
  /** Tender lines (amounts are absolute, for display). */
  paymentLines: { payment_method: PaymentMethod | null; amount: number }[]
}

export type PaymentsHubTypeFilter =
  | 'payment_in'
  | 'payment_out'
  | 'payments_both'
  | 'all_types'

function absDisplayAmount(raw: number): number {
  return roundMoney(Math.abs(raw))
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
    paymentLines,
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
    paymentLines: [
      {
        payment_method: row.payment_method,
        amount: absDisplayAmount(row.amount),
      },
    ],
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
  if (mf === 'unspecified') {
    return group.paymentLines.every((l) => l.payment_method == null)
  }
  return group.paymentLines.some((l) => l.payment_method === mf)
}

/** Hide ledger payment lines that duplicate checkout tender already shown on the order/PO row. */
const CHECKOUT_COLLAPSE_WINDOW_MS = 30_000

function collapseRedundantCheckoutPayments(
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

  return groups.filter((g) => {
    if (g.type === 'payment_in' && g.reference_id) {
      const anchor = orderAnchor.get(g.reference_id)
      if (
        anchor &&
        anchor.personId === g.person_id &&
        Date.parse(g.created_at) >= anchor.at &&
        Date.parse(g.created_at) - anchor.at <= CHECKOUT_COLLAPSE_WINDOW_MS
      ) {
        return false
      }
    }
    if (g.type === 'payment_out' && g.reference_id) {
      const anchor = poAnchor.get(g.reference_id)
      if (
        anchor &&
        anchor.personId === g.person_id &&
        Date.parse(g.created_at) >= anchor.at &&
        Date.parse(g.created_at) - anchor.at <= CHECKOUT_COLLAPSE_WINDOW_MS
      ) {
        return false
      }
    }
    return true
  })
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
    q = q.in('type', ['payment_in', 'payment_out', 'wallet'])
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
  groups = collapseRedundantCheckoutPayments(groups, fullLedger)
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
