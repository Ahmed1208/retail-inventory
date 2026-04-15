import { roundMoney, normalizePhoneKey } from '@/services/peopleService'
import type { PaymentMethod, Person } from '@/types'
import { PAYMENT_METHODS_ORDERED } from '@/utils/paymentMethod'

export type PaymentImportField =
  | 'person_phone'
  | 'person_name'
  | 'payment_type'
  | 'payment_method'
  | 'amount'
  | 'note'
  | 'register_warehouse'

export const PAYMENT_IMPORT_FIELDS_ORDERED: PaymentImportField[] = [
  'person_phone',
  'person_name',
  'payment_type',
  'payment_method',
  'amount',
  'note',
  'register_warehouse',
]

export const PAYMENT_IMPORT_FIELDS_REQUIRED: PaymentImportField[] = [
  'payment_type',
  'payment_method',
  'amount',
]

export type PaymentFieldToColumnMapping = Record<
  PaymentImportField,
  string | null
>

export function emptyPaymentFieldMapping(): PaymentFieldToColumnMapping {
  return {
    person_phone: null,
    person_name: null,
    payment_type: null,
    payment_method: null,
    amount: null,
    note: null,
    register_warehouse: null,
  }
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

const ALIASES: Record<PaymentImportField, string[]> = {
  person_phone: ['phone', 'mobile', 'tel', 'person phone'],
  person_name: ['name', 'person', 'customer', 'supplier', 'contact name'],
  payment_type: [
    'type',
    'direction',
    'payment type',
    'in out',
    'collect',
    'pay',
  ],
  payment_method: ['method', 'payment method', 'tender', 'cash visa'],
  amount: ['amount', 'value', 'sum', 'total'],
  note: ['note', 'notes', 'memo', 'description'],
  register_warehouse: [
    'warehouse',
    'register',
    'register warehouse',
    'location',
    'warehouse code',
    'store',
  ],
}

function scoreHeader(header: string, field: PaymentImportField): number {
  const n = normHeader(header)
  let best = 0
  for (const a of ALIASES[field]) {
    if (n === a) best = Math.max(best, 100)
    else if (n.includes(a)) best = Math.max(best, 50)
  }
  return best
}

export function guessPaymentFieldToColumnMapping(
  headers: string[]
): PaymentFieldToColumnMapping {
  const out = emptyPaymentFieldMapping()
  const used = new Set<string>()
  for (const field of PAYMENT_IMPORT_FIELDS_ORDERED) {
    let bestH: string | null = null
    let bestScore = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const sc = scoreHeader(h, field)
      if (sc > bestScore) {
        bestScore = sc
        bestH = h
      }
    }
    if (bestH && bestScore >= 50) {
      out[field] = bestH
      used.add(bestH)
    }
  }
  return out
}

function cellString(
  row: Record<string, unknown>,
  col: string | null
): string {
  if (col == null) return ''
  const v = row[col]
  if (v == null) return ''
  return String(v).trim()
}

export function parsePaymentDirection(
  raw: string
): 'payment_in' | 'payment_out' | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (
    t === 'payment_in' ||
    t === 'in' ||
    t === 'receive' ||
    t === 'receipt' ||
    t === 'collect' ||
    t === 'collection' ||
    t === 'customer payment' ||
    t === 'pi'
  ) {
    return 'payment_in'
  }
  if (
    t === 'payment_out' ||
    t === 'out' ||
    t === 'pay' ||
    t === 'payment' ||
    t === 'supplier payment' ||
    t === 'py'
  ) {
    return 'payment_out'
  }
  return null
}

export function parsePaymentMethodCell(raw: string): PaymentMethod | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if ((PAYMENT_METHODS_ORDERED as readonly string[]).includes(t))
    return t as PaymentMethod
  if (t === 'card' || t === 'credit card') return 'visa'
  if (t === 'bank' || t === 'transfer') return 'instapay'
  return null
}

export type PaymentImportDraft = {
  id: string
  person_phone: string
  person_name: string
  payment_type_raw: string
  payment_type: 'payment_in' | 'payment_out' | null
  payment_method_raw: string
  payment_method: PaymentMethod | null
  amount: number
  note: string
  register_warehouse: string
  discarded: boolean
}

export function buildPaymentRowDraft(
  csvRow: Record<string, unknown>,
  fieldToColumn: PaymentFieldToColumnMapping,
  rowIndex: number
): PaymentImportDraft {
  const person_phone = cellString(csvRow, fieldToColumn.person_phone)
  const person_name = cellString(csvRow, fieldToColumn.person_name)
  const payment_type_raw = cellString(csvRow, fieldToColumn.payment_type)
  const payment_method_raw = cellString(csvRow, fieldToColumn.payment_method)
  const amountRaw = cellString(csvRow, fieldToColumn.amount)
  const note = cellString(csvRow, fieldToColumn.note)
  const register_warehouse = cellString(csvRow, fieldToColumn.register_warehouse)

  const payment_type = parsePaymentDirection(payment_type_raw)
  const payment_method = parsePaymentMethodCell(payment_method_raw)
  let amount = 0
  if (amountRaw.trim()) {
    const n = parseFloat(amountRaw.replace(/,/g, ''))
    amount = Number.isNaN(n) ? 0 : roundMoney(Math.abs(n))
  }

  return {
    id: `pay-${rowIndex}`,
    person_phone,
    person_name,
    payment_type_raw,
    payment_type,
    payment_method_raw,
    payment_method,
    amount,
    note,
    register_warehouse,
    discarded: false,
  }
}

export type PaymentImportRowIssue =
  | 'missing_person'
  | 'ambiguous_name'
  | 'person_not_found'
  | 'invalid_type'
  | 'invalid_method'
  | 'invalid_amount'
  | 'warehouse_missing'
  | 'warehouse_not_found'

export function paymentMappingHasPersonId(
  m: PaymentFieldToColumnMapping
): boolean {
  return Boolean(
    (m.person_phone != null && m.person_phone !== '') ||
    (m.person_name != null && m.person_name !== '')
  )
}

export function unusedPaymentCsvHeaders(
  headers: string[],
  mapping: PaymentFieldToColumnMapping
): string[] {
  return headers.filter(
    (h) => !(Object.values(mapping) as (string | null)[]).includes(h)
  )
}

function normName(s: string): string {
  return s.trim().toLowerCase()
}

export function resolvePersonIdFromDraft(
  d: PaymentImportDraft,
  people: Person[]
): { person_id: string } | { error: PaymentImportRowIssue } {
  const phone = d.person_phone.trim()
  const name = d.person_name.trim()
  if (!phone && !name) return { error: 'missing_person' }

  if (phone) {
    const key = normalizePhoneKey(phone)
    const hits = people.filter(
      (p) => p.phone && normalizePhoneKey(p.phone) === key
    )
    if (hits.length === 1) return { person_id: hits[0].id }
    if (hits.length > 1) return { error: 'ambiguous_name' }
  }

  if (name) {
    const nk = normName(name)
    const hits = people.filter((p) => normName(p.name) === nk)
    if (hits.length === 1) return { person_id: hits[0].id }
    if (hits.length > 1) return { error: 'ambiguous_name' }
  }

  return { error: 'person_not_found' }
}

export function resolveRegisterWarehouseId(
  token: string,
  warehouses: { id: number; code: string; name: string; has_register: boolean }[]
): { id: number } | { error: PaymentImportRowIssue } {
  const t = token.trim()
  if (!t) return { error: 'warehouse_missing' }
  const tl = t.toLowerCase()
  const withReg = warehouses.filter((w) => w.has_register)
  const byCode = withReg.find((w) => w.code.trim().toLowerCase() === tl)
  if (byCode) return { id: byCode.id }
  const byName = withReg.filter((w) => w.name.trim().toLowerCase() === tl)
  if (byName.length === 1) return { id: byName[0].id }
  if (byName.length > 1) return { error: 'warehouse_not_found' }
  const partial = withReg.find(
    (w) =>
      w.name.toLowerCase().includes(tl) || w.code.toLowerCase().includes(tl)
  )
  if (partial) return { id: partial.id }
  return { error: 'warehouse_not_found' }
}

export function computePaymentIssuesForDraft(
  d: PaymentImportDraft,
  ctx: {
    people: Person[]
    warehouses: {
      id: number
      code: string
      name: string
      has_register: boolean
    }[]
    defaultRegisterWarehouseId: number | null
  }
): PaymentImportRowIssue[] {
  if (d.discarded) return []
  const issues: PaymentImportRowIssue[] = []

  const pr = resolvePersonIdFromDraft(d, ctx.people)
  if ('error' in pr) issues.push(pr.error)

  if (!d.payment_type) issues.push('invalid_type')
  if (!d.payment_method) issues.push('invalid_method')
  if (d.amount < 0.01) issues.push('invalid_amount')

  const whToken = d.register_warehouse.trim()
  if (whToken) {
    const wr = resolveRegisterWarehouseId(whToken, ctx.warehouses)
    if ('error' in wr) issues.push(wr.error)
  } else if (ctx.defaultRegisterWarehouseId == null) {
    issues.push('warehouse_missing')
  }

  return issues
}
