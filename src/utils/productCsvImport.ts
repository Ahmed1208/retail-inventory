import { roundMoney } from '@/services/peopleService'

export type ProductImportField =
  | 'product_code'
  | 'name'
  | 'brand_name'
  | 'category_name'
  | 'customer_price'
  | 'business_price'
  | 'cost_price'
  | 'quantity'
  | 'low_stock_threshold'
  | 'unit'
  | 'description'

export const PRODUCT_IMPORT_FIELDS_REQUIRED: ProductImportField[] = ['name']

export const PRODUCT_IMPORT_FIELDS_ORDERED: ProductImportField[] = [
  'product_code',
  'name',
  'brand_name',
  'category_name',
  'customer_price',
  'business_price',
  'cost_price',
  'quantity',
  'low_stock_threshold',
  'unit',
  'description',
]

export type ProductFieldToColumnMapping = Record<
  ProductImportField,
  string | null
>

export function emptyProductFieldMapping(): ProductFieldToColumnMapping {
  return {
    product_code: null,
    name: null,
    brand_name: null,
    category_name: null,
    customer_price: null,
    business_price: null,
    cost_price: null,
    quantity: null,
    low_stock_threshold: null,
    unit: null,
    description: null,
  }
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

const PRODUCT_FIELD_ALIASES: Record<ProductImportField, string[]> = {
  product_code: [
    'product code',
    'code',
    'sku',
    'id',
    'product id',
    'item code',
  ],
  name: ['name', 'product name', 'title', 'item'],
  brand_name: ['brand', 'brand name', 'make', 'manufacturer'],
  category_name: ['category', 'category name', 'type', 'group'],
  customer_price: [
    'customer price',
    'retail price',
    'sell price',
    'price',
    'unit price retail',
  ],
  business_price: [
    'business price',
    'wholesale price',
    'b2b price',
    'trade price',
  ],
  cost_price: ['cost', 'cost price', 'unit cost', 'purchase cost'],
  quantity: ['quantity', 'qty', 'stock', 'on hand', 'inventory'],
  low_stock_threshold: [
    'low stock',
    'reorder',
    'minimum stock',
    'low stock threshold',
  ],
  unit: ['unit', 'uom', 'measure'],
  description: ['description', 'desc', 'details', 'notes'],
}

function scoreProductHeader(
  header: string,
  field: ProductImportField,
  sampleValue: string | undefined
): number {
  const n = normHeader(header)
  let best = 0
  for (const a of PRODUCT_FIELD_ALIASES[field]) {
    if (n === a) best = Math.max(best, 100)
    else if (n.startsWith(a + ' ') || n.endsWith(' ' + a))
      best = Math.max(best, 80)
    else if (n.includes(a)) best = Math.max(best, 50)
  }
  if (
    (field === 'customer_price' ||
      field === 'business_price' ||
      field === 'cost_price' ||
      field === 'quantity') &&
    sampleValue
  ) {
    const x = parseFloat(String(sampleValue).replace(/,/g, ''))
    if (!Number.isNaN(x)) best += 8
  }
  return best
}

export function guessProductFieldToColumnMapping(
  headers: string[],
  sampleRows?: Record<string, string>[]
): ProductFieldToColumnMapping {
  const out = emptyProductFieldMapping()
  const used = new Set<string>()
  const firstSample = sampleRows?.[0]

  for (const field of PRODUCT_IMPORT_FIELDS_ORDERED) {
    let bestH: string | null = null
    let bestScore = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const raw =
        firstSample && h in firstSample ? String(firstSample[h] ?? '') : undefined
      const sc = scoreProductHeader(h, field, raw)
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

function parseMoney(raw: string, defaultVal: number): { ok: boolean; value: number } {
  if (!raw.trim()) return { ok: true, value: defaultVal }
  const n = parseFloat(raw.replace(/,/g, ''))
  if (Number.isNaN(n) || n < 0) return { ok: false, value: defaultVal }
  return { ok: true, value: roundMoney(n) }
}

function parseIntNonNeg(raw: string, defaultVal: number): { ok: boolean; value: number } {
  if (!raw.trim()) return { ok: true, value: defaultVal }
  const n = parseInt(raw.replace(/,/g, ''), 10)
  if (Number.isNaN(n) || n < 0) return { ok: false, value: defaultVal }
  return { ok: true, value: n }
}

export type ProductImportDraft = {
  id: string
  product_code: string
  name: string
  brand_name: string
  category_name: string
  customer_price: number
  business_price: number
  cost_price: number
  quantity: number
  low_stock_threshold: number
  unit: string
  description: string
  discarded: boolean
  fieldErrors?: {
    customer_price?: boolean
    business_price?: boolean
    cost_price?: boolean
    quantity?: boolean
    low_stock?: boolean
  }
}

export function buildProductRowDraft(
  csvRow: Record<string, unknown>,
  fieldToColumn: ProductFieldToColumnMapping,
  rowIndex: number
): ProductImportDraft {
  const product_code = cellString(csvRow, fieldToColumn.product_code)
  const name = cellString(csvRow, fieldToColumn.name)
  const brand_name = cellString(csvRow, fieldToColumn.brand_name)
  const category_name = cellString(csvRow, fieldToColumn.category_name)
  const unitRaw = cellString(csvRow, fieldToColumn.unit)
  const description = cellString(csvRow, fieldToColumn.description)

  const cpR = cellString(csvRow, fieldToColumn.customer_price)
  const bpR = cellString(csvRow, fieldToColumn.business_price)
  const costR = cellString(csvRow, fieldToColumn.cost_price)
  const qR = cellString(csvRow, fieldToColumn.quantity)
  const lowR = cellString(csvRow, fieldToColumn.low_stock_threshold)

  const cpP = parseMoney(cpR, 0)
  const bpP = parseMoney(bpR, 0)
  const costP = parseMoney(costR, 0)
  const qP = parseIntNonNeg(qR, 0)
  const lowP = parseIntNonNeg(lowR, 0)

  const fe: ProductImportDraft['fieldErrors'] = {}
  if (!cpP.ok && cpR.trim()) fe.customer_price = true
  if (!bpP.ok && bpR.trim()) fe.business_price = true
  if (!costP.ok && costR.trim()) fe.cost_price = true
  if (!qP.ok && qR.trim()) fe.quantity = true
  if (!lowP.ok && lowR.trim()) fe.low_stock = true
  const fieldErrors = Object.keys(fe).length ? fe : undefined

  return {
    id: `p-${rowIndex}`,
    product_code,
    name,
    brand_name,
    category_name,
    customer_price: cpP.value,
    business_price: bpP.value,
    cost_price: costP.value,
    quantity: qP.value,
    low_stock_threshold: lowP.value,
    unit: unitRaw.trim() || 'pc',
    description,
    discarded: false,
    fieldErrors,
  }
}

export type ProductImportRowIssue =
  | 'missing_name'
  | 'name_too_short'
  | 'invalid_customer_price'
  | 'invalid_business_price'
  | 'invalid_cost_price'
  | 'invalid_quantity'
  | 'invalid_low_stock'
  | 'duplicate_code_in_file'
  | 'duplicate_code_in_db'
  | 'duplicate_name_in_file'
  | 'duplicate_name_in_db'

export function productMappingUsesColumn(
  mapping: ProductFieldToColumnMapping,
  header: string
): boolean {
  return (Object.values(mapping) as (string | null)[]).includes(header)
}

export function unusedProductCsvHeaders(
  headers: string[],
  mapping: ProductFieldToColumnMapping
): string[] {
  return headers.filter((h) => !productMappingUsesColumn(mapping, h))
}

function normKey(s: string): string {
  return s.trim().toLowerCase()
}

export function buildProductCodeKeyCounts(
  drafts: ProductImportDraft[]
): Map<string, number> {
  const m = new Map<string, number>()
  for (const d of drafts) {
    if (d.discarded) continue
    const k = normKey(d.product_code)
    if (!k) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function buildProductNameKeyCounts(
  drafts: ProductImportDraft[]
): Map<string, number> {
  const m = new Map<string, number>()
  for (const d of drafts) {
    if (d.discarded) continue
    const k = normKey(d.name)
    if (!k) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function existingProductCodesLower(
  products: { product_code: string }[]
): Set<string> {
  const s = new Set<string>()
  for (const p of products) {
    const k = normKey(p.product_code)
    if (k) s.add(k)
  }
  return s
}

export function existingProductNamesLower(
  products: { name: string }[]
): Set<string> {
  const s = new Set<string>()
  for (const p of products) {
    const k = normKey(p.name)
    if (k) s.add(k)
  }
  return s
}

export function computeProductIssuesForDraft(
  d: ProductImportDraft,
  ctx: {
    codeKeyCounts: Map<string, number>
    nameKeyCounts: Map<string, number>
    existingCodes: Set<string>
    existingNames: Set<string>
  }
): ProductImportRowIssue[] {
  if (d.discarded) return []
  const issues: ProductImportRowIssue[] = []
  if (!d.name.trim()) issues.push('missing_name')
  else if (d.name.trim().length < 2) issues.push('name_too_short')

  if (d.fieldErrors?.customer_price) issues.push('invalid_customer_price')
  if (d.fieldErrors?.business_price) issues.push('invalid_business_price')
  if (d.fieldErrors?.cost_price) issues.push('invalid_cost_price')
  if (d.fieldErrors?.quantity) issues.push('invalid_quantity')
  if (d.fieldErrors?.low_stock) issues.push('invalid_low_stock')

  const ck = normKey(d.product_code)
  if (ck) {
    if ((ctx.codeKeyCounts.get(ck) ?? 0) > 1) issues.push('duplicate_code_in_file')
    if (ctx.existingCodes.has(ck)) issues.push('duplicate_code_in_db')
  }
  const nk = normKey(d.name)
  if (nk) {
    if ((ctx.nameKeyCounts.get(nk) ?? 0) > 1) issues.push('duplicate_name_in_file')
    if (ctx.existingNames.has(nk)) issues.push('duplicate_name_in_db')
  }

  return issues
}
