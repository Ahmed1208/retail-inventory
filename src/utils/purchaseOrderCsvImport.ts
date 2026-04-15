import { roundMoney } from '@/services/peopleService'
import type { Person, PurchaseOrderWithItems, Warehouse } from '@/types'

export type PurchaseOrderImportField =
  | 'import_group_id'
  | 'warehouse_code'
  | 'supplier_phone'
  | 'supplier_name'
  | 'po_note'
  | 'order_discount_rate'
  | 'po_date'
  | 'product_code'
  | 'product_name'
  | 'brand_name'
  | 'category_name'
  | 'quantity'
  | 'cost_price'
  | 'line_discount_rate'
  | 'update_default_cost_price'
  | 'catalog_customer_price'
  | 'catalog_business_price'

export const PO_IMPORT_FIELDS_REQUIRED: PurchaseOrderImportField[] = [
  'import_group_id',
  'warehouse_code',
  'supplier_phone',
  'quantity',
  'cost_price',
]

export const PO_IMPORT_FIELDS_ORDERED: PurchaseOrderImportField[] = [
  'import_group_id',
  'warehouse_code',
  'supplier_phone',
  'supplier_name',
  'po_note',
  'order_discount_rate',
  'po_date',
  'product_code',
  'product_name',
  'brand_name',
  'category_name',
  'quantity',
  'cost_price',
  'line_discount_rate',
  'update_default_cost_price',
  'catalog_customer_price',
  'catalog_business_price',
]

export type PurchaseOrderFieldToColumnMapping = Record<
  PurchaseOrderImportField,
  string | null
>

export function emptyPurchaseOrderFieldMapping(): PurchaseOrderFieldToColumnMapping {
  return {
    import_group_id: null,
    warehouse_code: null,
    supplier_phone: null,
    supplier_name: null,
    po_note: null,
    order_discount_rate: null,
    po_date: null,
    product_code: null,
    product_name: null,
    brand_name: null,
    category_name: null,
    quantity: null,
    cost_price: null,
    line_discount_rate: null,
    update_default_cost_price: null,
    catalog_customer_price: null,
    catalog_business_price: null,
  }
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

const PO_FIELD_ALIASES: Record<PurchaseOrderImportField, string[]> = {
  import_group_id: [
    'import group',
    'group id',
    'po group',
    'purchase order ref',
    'external ref',
    'batch',
    'document id',
  ],
  warehouse_code: [
    'warehouse',
    'warehouse code',
    'location code',
    'store code',
  ],
  supplier_phone: ['supplier phone', 'phone', 'mobile', 'vendor phone'],
  supplier_name: ['supplier name', 'supplier', 'vendor', 'vendor name'],
  po_note: ['po note', 'note', 'memo', 'header note'],
  order_discount_rate: [
    'order discount',
    'po discount',
    'header discount',
    'discount %',
  ],
  po_date: ['po date', 'date', 'receive date', 'document date', 'created date'],
  product_code: ['product code', 'sku', 'code', 'item code'],
  product_name: ['product name', 'item', 'product'],
  brand_name: ['brand', 'brand name'],
  category_name: ['category', 'category name'],
  quantity: ['quantity', 'qty', 'units'],
  cost_price: ['cost price', 'unit cost', 'purchase price', 'cost'],
  line_discount_rate: ['line discount', 'line discount %', 'item discount %'],
  update_default_cost_price: [
    'update cost',
    'update default cost',
    'sync cost',
    'cost catalog update',
  ],
  catalog_customer_price: ['catalog retail', 'retail price update'],
  catalog_business_price: ['catalog wholesale', 'wholesale price update'],
}

function scorePoHeader(
  header: string,
  field: PurchaseOrderImportField,
  sampleValue: string | undefined
): number {
  const n = normHeader(header)
  let best = 0
  for (const a of PO_FIELD_ALIASES[field]) {
    if (n === a) best = Math.max(best, 100)
    else if (n.startsWith(a + ' ') || n.endsWith(' ' + a))
      best = Math.max(best, 80)
    else if (n.includes(a)) best = Math.max(best, 50)
  }
  if (
    (field === 'quantity' ||
      field === 'cost_price' ||
      field === 'line_discount_rate' ||
      field === 'order_discount_rate' ||
      field === 'catalog_customer_price' ||
      field === 'catalog_business_price') &&
    sampleValue
  ) {
    const x = parseFloat(String(sampleValue).replace(/,/g, ''))
    if (!Number.isNaN(x)) best += 8
  }
  return best
}

export function guessPurchaseOrderFieldToColumnMapping(
  headers: string[],
  sampleRows?: Record<string, string>[]
): PurchaseOrderFieldToColumnMapping {
  const out = emptyPurchaseOrderFieldMapping()
  const used = new Set<string>()
  const firstSample = sampleRows?.[0]

  for (const field of PO_IMPORT_FIELDS_ORDERED) {
    let bestH: string | null = null
    let bestScore = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const raw =
        firstSample && h in firstSample ? String(firstSample[h] ?? '') : undefined
      const sc = scorePoHeader(h, field, raw)
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

function parseQty(raw: string, defaultVal: number): { ok: boolean; value: number } {
  if (!raw.trim()) return { ok: true, value: defaultVal }
  const n = parseFloat(raw.replace(/,/g, ''))
  if (Number.isNaN(n) || n <= 0) return { ok: false, value: defaultVal }
  return { ok: true, value: roundMoney(n) }
}

function parseRate(raw: string, defaultVal: number): { ok: boolean; value: number } {
  if (!raw.trim()) return { ok: true, value: defaultVal }
  const n = parseFloat(raw.replace(/,/g, ''))
  if (Number.isNaN(n) || n < 0 || n > 100) return { ok: false, value: defaultVal }
  return { ok: true, value: roundMoney(n) }
}

/** y/yes/true/1 → true */
export function parsePoBool(raw: string, defaultVal = false): boolean {
  const s = raw.trim().toLowerCase()
  if (!s) return defaultVal
  return (
    s === '1' ||
    s === 'y' ||
    s === 'yes' ||
    s === 'true' ||
    s === 'x'
  )
}

export type PurchaseOrderCsvLineDraft = {
  id: string
  import_group_id: string
  warehouse_code: string
  supplier_phone: string
  supplier_name: string
  po_note: string
  order_discount_rate: number
  po_date_iso: string
  product_code: string
  product_name: string
  brand_name: string
  category_name: string
  quantity: number
  cost_price: number
  line_discount_rate: number
  update_default_cost_price: boolean
  catalog_customer_price: number | null
  catalog_business_price: number | null
  discarded: boolean
}

export function buildPurchaseOrderLineDraft(
  csvRow: Record<string, unknown>,
  fieldToColumn: PurchaseOrderFieldToColumnMapping,
  rowIndex: number
): PurchaseOrderCsvLineDraft {
  const qR = cellString(csvRow, fieldToColumn.quantity)
  const cR = cellString(csvRow, fieldToColumn.cost_price)
  const ldR = cellString(csvRow, fieldToColumn.line_discount_rate)
  const odR = cellString(csvRow, fieldToColumn.order_discount_rate)
  const ccR = cellString(csvRow, fieldToColumn.catalog_customer_price)
  const cbR = cellString(csvRow, fieldToColumn.catalog_business_price)
  const updR = cellString(csvRow, fieldToColumn.update_default_cost_price)

  const qP = parseQty(qR, 0)
  const cP = parseMoney(cR, 0)
  const ldP = parseRate(ldR, 0)
  const odP = parseRate(odR, 0)
  const ccP = parseMoney(ccR, 0)
  const cbP = parseMoney(cbR, 0)

  return {
    id: `pol-${rowIndex}`,
    import_group_id: cellString(csvRow, fieldToColumn.import_group_id),
    warehouse_code: cellString(csvRow, fieldToColumn.warehouse_code),
    supplier_phone: cellString(csvRow, fieldToColumn.supplier_phone),
    supplier_name: cellString(csvRow, fieldToColumn.supplier_name),
    po_note: cellString(csvRow, fieldToColumn.po_note),
    order_discount_rate: odP.ok ? odP.value : 0,
    po_date_iso: cellString(csvRow, fieldToColumn.po_date),
    product_code: cellString(csvRow, fieldToColumn.product_code),
    product_name: cellString(csvRow, fieldToColumn.product_name),
    brand_name: cellString(csvRow, fieldToColumn.brand_name),
    category_name: cellString(csvRow, fieldToColumn.category_name),
    quantity: qP.ok ? qP.value : 0,
    cost_price: cP.ok ? cP.value : 0,
    line_discount_rate: ldP.ok ? ldP.value : 0,
    update_default_cost_price: parsePoBool(updR, false),
    catalog_customer_price: ccR.trim() ? ccP.value : null,
    catalog_business_price: cbR.trim() ? cbP.value : null,
    discarded: false,
  }
}

export type PurchaseOrderCsvLineIssue =
  | 'missing_group_id'
  | 'missing_warehouse_code'
  | 'missing_product_key'
  | 'invalid_quantity'
  | 'invalid_cost_price'
  | 'invalid_line_discount'
  | 'invalid_order_discount'
  | 'missing_supplier_phone'

export function computePurchaseOrderLineIssues(
  d: PurchaseOrderCsvLineDraft
): PurchaseOrderCsvLineIssue[] {
  const issues: PurchaseOrderCsvLineIssue[] = []
  if (!d.import_group_id.trim()) issues.push('missing_group_id')
  if (!d.warehouse_code.trim()) issues.push('missing_warehouse_code')
  if (!d.product_code.trim() && !d.product_name.trim()) {
    issues.push('missing_product_key')
  }
  if (d.quantity <= 0) issues.push('invalid_quantity')
  if (d.cost_price < 0) issues.push('invalid_cost_price')
  if (d.line_discount_rate < 0 || d.line_discount_rate > 100) {
    issues.push('invalid_line_discount')
  }
  if (d.order_discount_rate < 0 || d.order_discount_rate > 100) {
    issues.push('invalid_order_discount')
  }
  if (!d.supplier_phone.trim()) issues.push('missing_supplier_phone')
  return issues
}

export function groupPurchaseOrderLinesByImportId(
  drafts: PurchaseOrderCsvLineDraft[]
): Map<string, PurchaseOrderCsvLineDraft[]> {
  const m = new Map<string, PurchaseOrderCsvLineDraft[]>()
  for (const d of drafts) {
    if (d.discarded) continue
    const k = d.import_group_id.trim().toLowerCase()
    if (!k) continue
    const list = m.get(k) ?? []
    list.push(d)
    m.set(k, list)
  }
  return m
}

export type PurchaseOrderGroupIssue = 'inconsistent_headers_within_group'

export function computePurchaseOrderGroupIssues(
  lines: PurchaseOrderCsvLineDraft[]
): PurchaseOrderGroupIssue[] {
  if (lines.length <= 1) return []
  const f = lines[0]
  const same = lines.every(
    (l) =>
      l.warehouse_code === f.warehouse_code &&
      l.supplier_phone === f.supplier_phone &&
      l.supplier_name === f.supplier_name &&
      l.po_note === f.po_note &&
      l.order_discount_rate === f.order_discount_rate &&
      l.po_date_iso === f.po_date_iso
  )
  return same ? [] : ['inconsistent_headers_within_group']
}

export function purchaseOrderMappingUsesColumn(
  mapping: PurchaseOrderFieldToColumnMapping,
  header: string
): boolean {
  return (Object.values(mapping) as (string | null)[]).includes(header)
}

export function unusedPurchaseOrderCsvHeaders(
  headers: string[],
  mapping: PurchaseOrderFieldToColumnMapping
): string[] {
  return headers.filter((h) => !purchaseOrderMappingUsesColumn(mapping, h))
}

type ProductWithBrandCategory = {
  product_code: string
  name: string
  brand?: { name?: string } | null
  category?: { name?: string } | null
}

export type PurchaseOrderExportContext = {
  warehouseById: Map<number, Warehouse>
  personById: Map<string, Person>
}

export function flattenPurchaseOrdersForCsvExport(
  orders: PurchaseOrderWithItems[],
  ctx: PurchaseOrderExportContext
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const o of orders) {
    const wh = ctx.warehouseById.get(o.warehouse_id)
    const person = o.person_id ? ctx.personById.get(o.person_id) : null
    const groupId = `PO-${o.order_number}`
    for (const item of o.items) {
      const p = item.product as unknown as ProductWithBrandCategory
      rows.push({
        import_group_id: groupId,
        purchase_order_number: o.order_number,
        is_historical_snapshot: o.is_historical_snapshot,
        warehouse_code: wh?.code ?? o.warehouse_id,
        supplier_phone: person?.phone ?? '',
        supplier_name: person?.name ?? o.supplier_name ?? '',
        po_note: o.note ?? '',
        order_discount_rate: o.discount_rate,
        po_date: o.created_at,
        product_code: p.product_code,
        product_name: p.name,
        brand_name: p.brand?.name ?? '',
        category_name: p.category?.name ?? '',
        quantity: item.quantity,
        cost_price: item.cost_price,
        line_discount_rate: item.line_discount_rate,
        update_default_cost_price: item.cost_price_updated ? 'yes' : 'no',
        catalog_customer_price: item.catalog_customer_price ?? '',
        catalog_business_price: item.catalog_business_price ?? '',
        subtotal: o.subtotal,
        total_amount: o.total_amount,
      })
    }
  }
  return rows
}
