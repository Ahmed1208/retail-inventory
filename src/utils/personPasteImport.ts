import type { Person, PersonRole } from '@/types'
import {
  normalizeExternalCode,
  normalizePhoneKey,
  roundMoney,
} from '@/services/peopleService'
import { parseRolesCell } from '@/utils/personCsvImport'

export const PASTE_MAPPING_STORAGE_KEY = 'stockpilot_people_paste_mapping_v1'
export const IMPORT_OPENING_BALANCE_NOTE = 'Import opening balance'
export const MERGE_IMPORT_BALANCE_NOTE = 'Merge import opening balance'

export type PasteImportField =
  | 'external_code'
  | 'name'
  | 'phone'
  | 'roles'
  | 'address'
  | 'notes'
  | 'discount_rate'
  | 'credit_limit'
  | 'initial_balance'

export const PASTE_FIELDS_ORDERED: PasteImportField[] = [
  'external_code',
  'name',
  'phone',
  'roles',
  'address',
  'notes',
  'discount_rate',
  'credit_limit',
  'initial_balance',
]

export type PasteFieldMapping = Record<PasteImportField, string | null>

export function emptyPasteMapping(): PasteFieldMapping {
  return {
    external_code: null,
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

const FIELD_ALIASES: Record<PasteImportField, string[]> = {
  external_code: [
    'id',
    'code',
    'old id',
    'old code',
    'account',
    'account no',
    'account number',
    'customer id',
    'supplier id',
    'رقم',
    'كود',
    'معرف',
    'رقم الحساب',
  ],
  name: [
    'name',
    'full name',
    'customer name',
    'supplier name',
    'contact name',
    'display name',
    'اسم',
    'الاسم',
    'اسم العميل',
    'اسم المورد',
  ],
  phone: [
    'phone',
    'mobile',
    'tel',
    'telephone',
    'cell',
    'whatsapp',
    'موبايل',
    'هاتف',
    'تليفون',
    'جوال',
  ],
  roles: [
    'roles',
    'role',
    'type',
    'kind',
    'نوع',
    'الدور',
    'عميل او مورد',
  ],
  address: ['address', 'location', 'street', 'city', 'عنوان', 'العنوان'],
  notes: ['notes', 'note', 'comments', 'remark', 'ملاحظات', 'ملاحظة'],
  discount_rate: ['discount', 'discount rate', 'خصم', 'نسبة الخصم'],
  credit_limit: ['credit limit', 'credit line', 'حد ائتمان', 'الائتمان'],
  initial_balance: [
    'opening balance',
    'initial balance',
    'balance',
    'الرصيد',
    'رصيد افتتاحي',
    'المبلغ',
  ],
}

function scoreHeader(header: string, field: PasteImportField, sample?: string): number {
  const n = normHeader(header)
  let best = 0
  for (const a of FIELD_ALIASES[field]) {
    if (n === a) best = Math.max(best, 100)
    else if (n.startsWith(a + ' ') || n.endsWith(' ' + a)) best = Math.max(best, 80)
    else if (n.includes(a)) best = Math.max(best, 50)
  }
  if (field === 'phone' && sample) {
    const digits = sample.replace(/\D/g, '')
    if (digits.length >= 6) best += 15
  }
  if (field === 'initial_balance' && sample && !Number.isNaN(parseFloat(sample.replace(/,/g, '')))) {
    best += 10
  }
  return best
}

export function guessPasteFieldMapping(
  headers: string[],
  sampleRows?: Record<string, string>[]
): PasteFieldMapping {
  const out = emptyPasteMapping()
  const used = new Set<string>()
  const first = sampleRows?.[0]
  for (const field of PASTE_FIELDS_ORDERED) {
    let bestH: string | null = null
    let bestScore = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const sample = first?.[h]
      const sc = scoreHeader(h, field, sample)
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

export function loadSavedPasteMapping(): PasteFieldMapping | null {
  try {
    const raw = localStorage.getItem(PASTE_MAPPING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PasteFieldMapping
    return { ...emptyPasteMapping(), ...parsed }
  } catch {
    return null
  }
}

export function savePasteMapping(m: PasteFieldMapping): void {
  try {
    localStorage.setItem(PASTE_MAPPING_STORAGE_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

function cell(row: Record<string, string>, col: string | null): string {
  if (!col) return ''
  return String(row[col] ?? '').trim()
}

export type PersonPasteDraft = {
  rowId: string
  external_code: string
  name: string
  phone: string
  roles: PersonRole[]
  rolesRaw: string
  rolesUnrecognized: boolean
  address: string
  notes: string
  discount_rate: number
  credit_limit: number | null
  initial_balance: number | null
  discarded: boolean
}

export function buildPasteDraft(
  row: Record<string, string>,
  mapping: PasteFieldMapping,
  rowIndex: number
): PersonPasteDraft {
  const rolesRaw = cell(row, mapping.roles)
  const parsed = rolesRaw ? parseRolesCell(rolesRaw) : []
  const roles: PersonRole[] = parsed.length ? parsed : ['customer', 'supplier']
  const balRaw = cell(row, mapping.initial_balance)
  let initial_balance: number | null = null
  if (balRaw) {
    const n = parseFloat(balRaw.replace(/,/g, ''))
    if (!Number.isNaN(n)) initial_balance = roundMoney(n)
  }
  const drRaw = cell(row, mapping.discount_rate)
  const dr = drRaw ? parseFloat(drRaw.replace(/,/g, '')) : 0
  const crRaw = cell(row, mapping.credit_limit)
  const cr = crRaw ? parseFloat(crRaw.replace(/,/g, '')) : NaN

  return {
    rowId: `r-${rowIndex}`,
    external_code: cell(row, mapping.external_code),
    name: cell(row, mapping.name),
    phone: cell(row, mapping.phone),
    roles,
    rolesRaw,
    rolesUnrecognized: Boolean(rolesRaw) && parsed.length === 0,
    address: cell(row, mapping.address),
    notes: cell(row, mapping.notes),
    discount_rate: Number.isNaN(dr) ? 0 : roundMoney(Math.min(100, Math.max(0, dr))),
    credit_limit: Number.isNaN(cr) || crRaw === '' ? null : roundMoney(Math.max(0, cr)),
    initial_balance,
    discarded: false,
  }
}

export type MatchReason = 'external_code' | 'phone' | 'name'

export type RowMatch = {
  person: Person
  reasons: MatchReason[]
}

export function matchDraftToPeople(draft: PersonPasteDraft, people: Person[]): RowMatch | null {
  const code = draft.external_code ? normalizeExternalCode(draft.external_code) : ''
  const phone = draft.phone ? normalizePhoneKey(draft.phone) : ''
  const name = draft.name.trim().toLowerCase()

  if (code) {
    const byCode = people.find(
      (p) => p.external_code && normalizeExternalCode(p.external_code) === code
    )
    if (byCode) {
      const reasons: MatchReason[] = ['external_code']
      if (phone && byCode.phone && normalizePhoneKey(byCode.phone) === phone) {
        reasons.push('phone')
      }
      if (name && byCode.name.trim().toLowerCase() === name) reasons.push('name')
      return { person: byCode, reasons }
    }
  }
  if (phone) {
    const byPhone = people.find((p) => p.phone && normalizePhoneKey(p.phone) === phone)
    if (byPhone) {
      const reasons: MatchReason[] = ['phone']
      if (name && byPhone.name.trim().toLowerCase() === name) reasons.push('name')
      return { person: byPhone, reasons }
    }
  }
  if (name.length >= 2) {
    const byName = people.filter((p) => p.name.trim().toLowerCase() === name)
    if (byName.length === 1) {
      return { person: byName[0], reasons: ['name'] }
    }
    if (byName.length > 1) {
      return { person: byName[0], reasons: ['name'] }
    }
  }
  return null
}

export function findFileDuplicate(
  draft: PersonPasteDraft,
  others: PersonPasteDraft[]
): MatchReason | null {
  const code = draft.external_code ? normalizeExternalCode(draft.external_code) : ''
  const phone = draft.phone ? normalizePhoneKey(draft.phone) : ''
  const name = draft.name.trim().toLowerCase()
  for (const o of others) {
    if (o.rowId === draft.rowId || o.discarded) continue
    if (code && o.external_code && normalizeExternalCode(o.external_code) === code) {
      return 'external_code'
    }
    if (phone && o.phone && normalizePhoneKey(o.phone) === phone) return 'phone'
    if (name.length >= 2 && o.name.trim().toLowerCase() === name) return 'name'
  }
  return null
}

export type ConflictAction = 'skip' | 'update' | 'merge' | 'separate' | 'create'

/** Incoming opening signed for StockPilot (+ receivable, − payable). */
export function signedIncomingBalance(
  raw: number,
  roles: PersonRole[],
  sellerMeansPayable: boolean
): number {
  const amt = roundMoney(raw)
  const onlySupplier = roles.includes('supplier') && !roles.includes('customer')
  if (onlySupplier && sellerMeansPayable) return roundMoney(-Math.abs(amt))
  return amt
}

export function proposedMergeBalance(
  existingBalance: number,
  incomingRaw: number | null,
  incomingRoles: PersonRole[],
  sellerMeansPayable: boolean
): { final: number; delta: number } {
  if (incomingRaw == null) {
    return { final: roundMoney(existingBalance), delta: 0 }
  }
  const incoming = signedIncomingBalance(incomingRaw, incomingRoles, sellerMeansPayable)
  const final = roundMoney(existingBalance + incoming)
  return { final, delta: incoming }
}

export function unionRoles(a: PersonRole[], b: PersonRole[]): PersonRole[] {
  const s = new Set<PersonRole>([...a, ...b])
  return (['customer', 'supplier'] as PersonRole[]).filter((r) => s.has(r))
}

export function fillEmptyProfilePatch(
  existing: Person,
  draft: PersonPasteDraft,
  overwriteFilled: boolean
): Partial<Pick<Person, 'name' | 'phone' | 'external_code' | 'address' | 'notes' | 'roles' | 'discount_rate' | 'credit_limit'>> {
  const patch: ReturnType<typeof fillEmptyProfilePatch> = {}
  const take = (incoming: string, current: string | null) =>
    incoming && (overwriteFilled || !current?.trim())

  if (take(draft.name, existing.name)) patch.name = draft.name
  if (take(draft.phone, existing.phone)) patch.phone = draft.phone
  if (take(draft.external_code, existing.external_code)) {
    patch.external_code = draft.external_code
  }
  if (take(draft.address, existing.address)) patch.address = draft.address
  if (take(draft.notes, existing.notes)) patch.notes = draft.notes
  if (overwriteFilled || existing.roles.length === 0) {
    patch.roles = draft.roles
  }
  if (overwriteFilled || existing.discount_rate === 0) {
    patch.discount_rate = draft.discount_rate
  }
  if (take(draft.credit_limit != null ? String(draft.credit_limit) : '', existing.credit_limit != null ? String(existing.credit_limit) : null)) {
    patch.credit_limit = draft.credit_limit
  }
  return patch
}

export function draftHasName(d: PersonPasteDraft): boolean {
  return d.name.trim().length >= 2
}
