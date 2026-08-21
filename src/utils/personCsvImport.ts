import type { PersonRole } from '@/types'
import { normalizePhoneKey, roundMoney } from '@/services/peopleService'

export const CSV_IMPORT_OPENING_BALANCE_NOTE = 'CSV import opening balance'

export type ImportField =
  | 'name'
  | 'phone'
  | 'roles'
  | 'address'
  | 'notes'
  | 'discount_rate'
  | 'credit_limit'
  | 'initial_balance'

export const IMPORT_FIELDS_REQUIRED: ImportField[] = ['name', 'phone', 'roles']

export const IMPORT_FIELDS_ORDERED: ImportField[] = [
  'name',
  'phone',
  'roles',
  'address',
  'notes',
  'discount_rate',
  'credit_limit',
  'initial_balance',
]

export type FieldToColumnMapping = Record<ImportField, string | null>

export function emptyFieldMapping(): FieldToColumnMapping {
  return {
    name: null,
    phone: null,
    roles: null,
    address: null,
    notes: null,
    discount_rate: null,
    credit_limit: null,
    initial_balance: null,
  }
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True if string looks phone-like (mostly digits, reasonable length). */
function looksLikePhoneSample(s: string): boolean {
  const t = s.trim()
  if (t.length < 6) return false
  const digits = t.replace(/\D/g, '')
  return digits.length >= 6 && digits.length / t.length > 0.5
}

const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: [
    'name',
    'full name',
    'customer name',
    'contact name',
    'display name',
    'contact',
  ],
  phone: ['phone', 'mobile', 'tel', 'telephone', 'cell', 'cellphone', 'whatsapp'],
  roles: ['roles', 'role', 'type', 'kind', 'person type', 'customer type'],
  address: ['address', 'location', 'street', 'city'],
  notes: ['notes', 'note', 'comments', 'remark', 'description'],
  discount_rate: ['discount', 'discount rate', 'disc'],
  credit_limit: ['credit limit', 'credit line', 'credit max', 'max credit'],
  initial_balance: [
    'opening balance',
    'initial balance',
    'balance',
    'ar',
    'ap',
    'amount due',
    'current balance',
  ],
}

function scoreHeaderForField(
  header: string,
  field: ImportField,
  sampleValue: string | undefined
): number {
  const n = normHeader(header)
  let best = 0
  for (const a of FIELD_ALIASES[field]) {
    if (n === a) best = Math.max(best, 100)
    else if (n.startsWith(a + ' ') || n.endsWith(' ' + a)) best = Math.max(best, 80)
    else if (n.includes(a)) best = Math.max(best, 50)
  }
  if (field === 'phone' && sampleValue && looksLikePhoneSample(sampleValue)) {
    best += 15
  }
  if (field === 'initial_balance' && sampleValue) {
    const x = parseFloat(String(sampleValue).replace(/,/g, ''))
    if (!Number.isNaN(x)) best += 10
  }
  return best
}

export function guessFieldToColumnMapping(
  headers: string[],
  sampleRows?: Record<string, string>[]
): FieldToColumnMapping {
  const out = emptyFieldMapping()
  const used = new Set<string>()
  const firstSample = sampleRows?.[0]

  for (const field of IMPORT_FIELDS_ORDERED) {
    let bestH: string | null = null
    let bestScore = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const raw =
        firstSample && h in firstSample ? String(firstSample[h] ?? '') : undefined
      const sc = scoreHeaderForField(h, field, raw)
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

export function parseRolesCell(raw: string): PersonRole[] {
  const parts = raw
    .split(/[,;|/+]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const roles: PersonRole[] = []
  const add = (r: PersonRole) => {
    if (!roles.includes(r)) roles.push(r)
  }
  for (const p of parts) {
    if (
      p === 'customer' ||
      p === 'client' ||
      p === 'buyer' ||
      p === 'c' ||
      p === 'cust' ||
      p === 'عميل' ||
      p === 'زبون' ||
      p === 'مشتري'
    ) {
      add('customer')
    } else if (
      p === 'supplier' ||
      p === 'vendor' ||
      p === 'seller' ||
      p === 's' ||
      p === 'supp' ||
      p === 'vend' ||
      p === 'مورد' ||
      p === 'بائع' ||
      p === 'موردين'
    ) {
      add('supplier')
    } else if (
      p === 'both' ||
      p === 'customer supplier' ||
      p === 'supplier customer' ||
      p === 'الاثنين' ||
      p === 'كلاهما' ||
      p === 'عميل ومورد'
    ) {
      add('customer')
      add('supplier')
    }
  }
  return roles
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

function parseOptionalNumber(raw: string): { ok: true; value: number } | { ok: false } {
  if (!raw.trim()) return { ok: true, value: 0 }
  const n = parseFloat(raw.replace(/,/g, ''))
  if (Number.isNaN(n)) return { ok: false }
  return { ok: true, value: n }
}

function parseOptionalCredit(raw: string): { ok: true; value: number | null } | { ok: false } {
  if (!raw.trim()) return { ok: true, value: null }
  const n = parseFloat(raw.replace(/,/g, ''))
  if (Number.isNaN(n) || n < 0) return { ok: false }
  return { ok: true, value: roundMoney(n) }
}

export type PersonImportDraft = {
  id: string
  name: string
  phone: string
  roles: PersonRole[]
  address: string
  notes: string
  discount_rate: number
  credit_limit: number | null
  initial_balance: number
  discarded: boolean
  /** Raw roles cell before parse — for invalid detection */
  rolesRaw: string
  /** Set when CSV cell was non-empty but not a valid number; cleared when user fixes the cell */
  fieldErrors?: {
    discount?: boolean
    credit?: boolean
    initialBalance?: boolean
  }
}

export function buildRowDraft(
  csvRow: Record<string, unknown>,
  fieldToColumn: FieldToColumnMapping,
  rowIndex: number
): PersonImportDraft {
  const name = cellString(csvRow, fieldToColumn.name)
  const phone = cellString(csvRow, fieldToColumn.phone)
  const rolesRaw = cellString(csvRow, fieldToColumn.roles)
  const roles = parseRolesCell(rolesRaw)
  const address = cellString(csvRow, fieldToColumn.address)
  const notes = cellString(csvRow, fieldToColumn.notes)

  const drRaw = cellString(csvRow, fieldToColumn.discount_rate)
  const drParsed = parseOptionalNumber(drRaw)
  const discountBad = Boolean(drRaw.trim() && !drParsed.ok)
  const discount_rate = drParsed.ok
    ? roundMoney(Math.min(100, Math.max(0, drParsed.value)))
    : 0

  const crRaw = cellString(csvRow, fieldToColumn.credit_limit)
  const crParsed = parseOptionalCredit(crRaw)
  const creditBad = Boolean(crRaw.trim() && !crParsed.ok)
  const credit_limit = crParsed.ok ? crParsed.value : null

  const balRaw = cellString(csvRow, fieldToColumn.initial_balance)
  const balParsed = parseOptionalNumber(balRaw)
  const balanceBad = Boolean(balRaw.trim() && !balParsed.ok)
  const initial_balance = balParsed.ok ? roundMoney(balParsed.value) : 0

  const fieldErrors =
    discountBad || creditBad || balanceBad
      ? {
          discount: discountBad || undefined,
          credit: creditBad || undefined,
          initialBalance: balanceBad || undefined,
        }
      : undefined

  return {
    id: `r-${rowIndex}`,
    name,
    phone,
    roles,
    address,
    notes,
    discount_rate,
    credit_limit,
    initial_balance,
    discarded: false,
    rolesRaw,
    fieldErrors,
  }
}

export type ImportRowIssue =
  | 'missing_name'
  | 'name_too_short'
  | 'missing_phone'
  | 'missing_roles'
  | 'invalid_roles'
  | 'invalid_discount'
  | 'invalid_credit'
  | 'invalid_initial_balance'
  | 'duplicate_in_file'
  | 'duplicate_in_db'

export function getFirstSampleForColumn(
  rows: Record<string, unknown>[],
  header: string | null
): string {
  if (header == null) return ''
  for (const row of rows) {
    const v = row[header]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function validateBase(d: PersonImportDraft): ImportRowIssue[] {
  const issues: ImportRowIssue[] = []
  if (!d.name.trim()) issues.push('missing_name')
  else if (d.name.trim().length < 2) issues.push('name_too_short')
  if (!d.phone.trim()) issues.push('missing_phone')
  if (d.roles.length === 0) {
    if (d.rolesRaw.trim()) issues.push('invalid_roles')
    else issues.push('missing_roles')
  }
  return issues
}

/** Re-parse numeric fields after user edits in grid; clears resolved fieldErrors. */
export function normalizeDraftNumbers(d: PersonImportDraft): PersonImportDraft {
  const discount_rate = roundMoney(
    Math.min(100, Math.max(0, Number(d.discount_rate) || 0))
  )
  let credit_limit: number | null = null
  if (d.credit_limit != null) {
    const c = Number(d.credit_limit)
    if (!Number.isNaN(c)) credit_limit = roundMoney(Math.max(0, c))
  }
  const initial_balance = roundMoney(Number(d.initial_balance) || 0)
  const roles = d.roles.length ? d.roles : parseRolesCell(d.rolesRaw)

  const fe: PersonImportDraft['fieldErrors'] = { ...d.fieldErrors }
  if (discount_rate >= 0 && discount_rate <= 100) delete fe?.discount
  if (credit_limit == null || credit_limit >= 0) delete fe?.credit
  if (!Number.isNaN(initial_balance)) delete fe?.initialBalance

  const fieldErrors =
    fe && (fe.discount || fe.credit || fe.initialBalance) ? fe : undefined

  return {
    ...d,
    discount_rate,
    credit_limit,
    initial_balance,
    roles,
    fieldErrors,
  }
}

export function computeIssuesForDraft(
  d: PersonImportDraft,
  ctx: {
    phoneKeyCounts: Map<string, number>
    existingPhoneKeys: Set<string>
  }
): ImportRowIssue[] {
  if (d.discarded) return []
  const issues = validateBase(d)

  const key = d.phone.trim() ? normalizePhoneKey(d.phone) : ''
  if (key) {
    if (ctx.existingPhoneKeys.has(key)) issues.push('duplicate_in_db')
    const c = ctx.phoneKeyCounts.get(key) ?? 0
    if (c > 1) issues.push('duplicate_in_file')
  }

  if (d.fieldErrors?.discount) issues.push('invalid_discount')
  else {
    const n = Number(d.discount_rate)
    if (Number.isNaN(n) || n < 0 || n > 100) issues.push('invalid_discount')
  }

  if (d.fieldErrors?.credit) issues.push('invalid_credit')
  else if (d.credit_limit != null) {
    const c = Number(d.credit_limit)
    if (Number.isNaN(c) || c < 0) issues.push('invalid_credit')
  }

  if (d.fieldErrors?.initialBalance) issues.push('invalid_initial_balance')
  else if (Number.isNaN(Number(d.initial_balance))) {
    issues.push('invalid_initial_balance')
  }

  return issues
}

export function buildPhoneKeyCounts(drafts: PersonImportDraft[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const d of drafts) {
    if (d.discarded) continue
    const k = d.phone.trim() ? normalizePhoneKey(d.phone) : ''
    if (!k) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function existingPeoplePhoneKeys(
  people: { phone: string | null }[]
): Set<string> {
  const s = new Set<string>()
  for (const p of people) {
    if (p.phone?.trim()) s.add(normalizePhoneKey(p.phone))
  }
  return s
}

export function mappingUsesColumn(
  mapping: FieldToColumnMapping,
  header: string
): boolean {
  return (Object.values(mapping) as (string | null)[]).includes(header)
}

export function unusedCsvHeaders(
  headers: string[],
  mapping: FieldToColumnMapping
): string[] {
  return headers.filter((h) => !mappingUsesColumn(mapping, h))
}
