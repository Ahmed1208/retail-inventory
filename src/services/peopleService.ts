import { supabase } from '@/lib/supabase'
import type {
  BalanceTransaction,
  BalanceTransactionType,
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
  return {
    id: String(row.id),
    person_id: String(row.person_id),
    type: row.type as BalanceTransaction['type'],
    amount: Number(row.amount),
    reference_id: row.reference_id != null ? String(row.reference_id) : null,
    reference_number:
      row.reference_number != null ? String(row.reference_number) : null,
    note: row.note != null ? String(row.note) : null,
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
  amount: number
  note?: string
}): Promise<Person> {
  const amt = roundMoney(Math.abs(data.amount))
  if (amt < 0.01) throw new Error('Amount must be at least 0.01')

  const { data: personRow, error: pErr } = await supabase
    .from(PEOPLE)
    .select('*')
    .eq('id', data.person_id)
    .maybeSingle()

  if (pErr) throw pErr
  if (!personRow) throw new Error('Person not found')

  const person = mapPersonRow(personRow as Record<string, unknown>)
  const delta =
    data.type === 'payment_in' ? roundMoney(-amt) : roundMoney(amt)
  const newBalance = roundMoney(person.balance + delta)

  const { error: txErr } = await supabase.from(BALANCE_TX).insert({
    person_id: data.person_id,
    type: data.type,
    amount: delta,
    note: data.note?.trim() || null,
  })

  if (txErr) throw txErr

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

  const { error: txErr } = await supabase.from(BALANCE_TX).insert({
    person_id: data.person_id,
    type: 'adjustment',
    amount: delta,
    note,
  })

  if (txErr) throw txErr

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
