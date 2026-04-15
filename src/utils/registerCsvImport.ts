import { roundMoney } from '@/services/peopleService'
import type { PaymentMethod } from '@/types'
import { PAYMENT_METHODS_ORDERED } from '@/utils/paymentMethod'

export type RegisterImportField =
  | 'action'
  | 'warehouse'
  | 'payment_method'
  | 'amount'
  | 'note'

export const REGISTER_IMPORT_FIELDS_ORDERED: RegisterImportField[] = [
  'action',
  'warehouse',
  'payment_method',
  'amount',
  'note',
]

export const REGISTER_IMPORT_FIELDS_REQUIRED: RegisterImportField[] = [
  'action',
  'warehouse',
  'payment_method',
  'amount',
]

export type RegisterFieldToColumnMapping = Record<
  RegisterImportField,
  string | null
>

export function emptyRegisterFieldMapping(): RegisterFieldToColumnMapping {
  return {
    action: null,
    warehouse: null,
    payment_method: null,
    amount: null,
    note: null,
  }
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

const ALIASES: Record<RegisterImportField, string[]> = {
  action: ['action', 'type', 'operation', 'deposit withdraw', 'kind'],
  warehouse: [
    'warehouse',
    'register',
    'location',
    'warehouse code',
    'store',
    'branch',
  ],
  payment_method: ['method', 'payment method', 'tender'],
  amount: ['amount', 'value', 'sum'],
  note: ['note', 'notes', 'memo', 'description'],
}

function scoreHeader(header: string, field: RegisterImportField): number {
  const n = normHeader(header)
  let best = 0
  for (const a of ALIASES[field]) {
    if (n === a) best = Math.max(best, 100)
    else if (n.includes(a)) best = Math.max(best, 50)
  }
  return best
}

export function guessRegisterFieldToColumnMapping(
  headers: string[]
): RegisterFieldToColumnMapping {
  const out = emptyRegisterFieldMapping()
  const used = new Set<string>()
  for (const field of REGISTER_IMPORT_FIELDS_ORDERED) {
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

export type RegisterCsvAction = 'deposit' | 'withdraw'

export function parseRegisterAction(raw: string): RegisterCsvAction | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (
    t === 'deposit' ||
    t === 'in' ||
    t === '+' ||
    t === 'add' ||
    t === 'register_deposit'
  ) {
    return 'deposit'
  }
  if (
    t === 'withdraw' ||
    t === 'withdrawal' ||
    t === 'out' ||
    t === '-' ||
    t === 'remove' ||
    t === 'register_withdraw'
  ) {
    return 'withdraw'
  }
  return null
}

export function parseRegisterMethod(raw: string): PaymentMethod | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if ((PAYMENT_METHODS_ORDERED as readonly string[]).includes(t))
    return t as PaymentMethod
  if (t === 'card' || t === 'credit card') return 'visa'
  if (t === 'bank' || t === 'transfer') return 'instapay'
  return null
}

export type RegisterImportDraft = {
  id: string
  action_raw: string
  action: RegisterCsvAction | null
  warehouse: string
  payment_method_raw: string
  payment_method: PaymentMethod | null
  amount: number
  note: string
  discarded: boolean
}

export function buildRegisterRowDraft(
  csvRow: Record<string, unknown>,
  fieldToColumn: RegisterFieldToColumnMapping,
  rowIndex: number
): RegisterImportDraft {
  const action_raw = cellString(csvRow, fieldToColumn.action)
  const warehouse = cellString(csvRow, fieldToColumn.warehouse)
  const payment_method_raw = cellString(csvRow, fieldToColumn.payment_method)
  const amountRaw = cellString(csvRow, fieldToColumn.amount)
  const note = cellString(csvRow, fieldToColumn.note)

  const action = parseRegisterAction(action_raw)
  const payment_method = parseRegisterMethod(payment_method_raw)
  let amount = 0
  if (amountRaw.trim()) {
    const n = parseFloat(amountRaw.replace(/,/g, ''))
    amount = Number.isNaN(n) ? 0 : roundMoney(Math.abs(n))
  }

  return {
    id: `reg-${rowIndex}`,
    action_raw,
    action,
    warehouse,
    payment_method_raw,
    payment_method,
    amount,
    note,
    discarded: false,
  }
}

export type RegisterImportRowIssue =
  | 'invalid_action'
  | 'invalid_method'
  | 'invalid_amount'
  | 'warehouse_missing'
  | 'warehouse_not_found'
  | 'deposit_forbidden'
  | 'withdraw_forbidden'

export function resolveRegisterCsvWarehouseId(
  token: string,
  warehouses: { id: number; code: string; name: string; has_register: boolean }[]
): { id: number } | { error: RegisterImportRowIssue } {
  const t = token.trim()
  if (!t) return { error: 'warehouse_missing' }
  const tl = t.toLowerCase()
  const withReg = warehouses.filter((w) => w.has_register)
  const byCode = withReg.find((w) => w.code.trim().toLowerCase() === tl)
  if (byCode) return { id: byCode.id }
  const byName = withReg.filter((w) => w.name.trim().toLowerCase() === tl)
  if (byName.length === 1) return { id: byName[0].id }
  const partial = withReg.find(
    (w) =>
      w.name.toLowerCase().includes(tl) || w.code.toLowerCase().includes(tl)
  )
  if (partial) return { id: partial.id }
  return { error: 'warehouse_not_found' }
}

export function computeRegisterIssuesForDraft(
  d: RegisterImportDraft,
  warehouses: { id: number; code: string; name: string; has_register: boolean }[],
  opts?: { canDeposit: boolean; canWithdraw: boolean }
): RegisterImportRowIssue[] {
  if (d.discarded) return []
  const issues: RegisterImportRowIssue[] = []
  if (!d.action) issues.push('invalid_action')
  if (!d.payment_method) issues.push('invalid_method')
  if (d.amount < 0.01) issues.push('invalid_amount')
  const wr = resolveRegisterCsvWarehouseId(d.warehouse, warehouses)
  if ('error' in wr) issues.push(wr.error)
  if (opts && d.action === 'deposit' && !opts.canDeposit) {
    issues.push('deposit_forbidden')
  }
  if (opts && d.action === 'withdraw' && !opts.canWithdraw) {
    issues.push('withdraw_forbidden')
  }
  return issues
}

export function unusedRegisterCsvHeaders(
  headers: string[],
  mapping: RegisterFieldToColumnMapping
): string[] {
  return headers.filter(
    (h) => !(Object.values(mapping) as (string | null)[]).includes(h)
  )
}
