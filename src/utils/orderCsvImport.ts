import { roundMoney } from '@/services/peopleService'
import type {
  OrderType,
  OrderWithItemsAndPayments,
  Person,
  Warehouse,
} from '@/types'

export type OrderImportField =
  | 'import_group_id'
  | 'order_type'
  | 'warehouse_code'
  | 'customer_phone'
  | 'customer_name'
  | 'order_note'
  | 'order_discount_rate'
  | 'order_date'
  | 'product_code'
  | 'product_name'
  | 'brand_name'
  | 'category_name'
  | 'quantity'
  | 'unit_price'
  | 'line_discount_rate'
  | 'product_customer_price'
  | 'product_business_price'
  | 'product_cost_price'

export const ORDER_IMPORT_FIELDS_REQUIRED: OrderImportField[] = [
  'import_group_id',
  'order_type',
  'warehouse_code',
  'quantity',
  'unit_price',
]

export const ORDER_IMPORT_FIELDS_ORDERED: OrderImportField[] = [
  'import_group_id',
  'order_type',
  'warehouse_code',
  'customer_phone',
  'customer_name',
  'order_note',
  'order_discount_rate',
  'order_date',
  'product_code',
  'product_name',
  'brand_name',
  'category_name',
  'quantity',
  'unit_price',
  'line_discount_rate',
  'product_customer_price',
  'product_business_price',
  'product_cost_price',
]

export type OrderFieldToColumnMapping = Record<OrderImportField, string | null>

export function emptyOrderFieldMapping(): OrderFieldToColumnMapping {
  return {
    import_group_id: null,
    order_type: null,
    warehouse_code: null,
    customer_phone: null,
    customer_name: null,
    order_note: null,
    order_discount_rate: null,
    order_date: null,
    product_code: null,
    product_name: null,
    brand_name: null,
    category_name: null,
    quantity: null,
    unit_price: null,
    line_discount_rate: null,
    product_customer_price: null,
    product_business_price: null,
    product_cost_price: null,
  }
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

const ORDER_FIELD_ALIASES: Record<OrderImportField, string[]> = {
  import_group_id: [
    'import group',
    'group id',
    'order group',
    'order ref',
    'external ref',
    'invoice group',
    'batch',
    'document id',
  ],
  order_type: ['order type', 'type', 'retail wholesale', 'channel', 'sale type'],
  warehouse_code: [
    'warehouse',
    'warehouse code',
    'location code',
    'store code',
    'wh',
  ],
  customer_phone: ['customer phone', 'phone', 'mobile', 'tel', 'buyer phone'],
  customer_name: ['customer name', 'customer', 'buyer', 'client name', 'client'],
  order_note: ['order note', 'note', 'memo', 'header note'],
  order_discount_rate: [
    'order discount',
    'order discount %',
    'header discount',
    'discount %',
  ],
  order_date: ['order date', 'date', 'sale date', 'document date', 'created date'],
  product_code: ['product code', 'sku', 'code', 'item code', 'product id'],
  product_name: ['product name', 'item', 'product', 'description line'],
  brand_name: ['brand', 'brand name'],
  category_name: ['category', 'category name'],
  quantity: ['quantity', 'qty', 'units'],
  unit_price: ['unit price', 'price', 'sell price', 'line price'],
  line_discount_rate: [
    'line discount',
    'line discount %',
    'item discount %',
  ],
  product_customer_price: ['catalog retail', 'retail price new', 'new retail'],
  product_business_price: ['catalog wholesale', 'wholesale price new'],
  product_cost_price: ['catalog cost', 'cost new product', 'default cost'],
}

function scoreOrderHeader(
  header: string,
  field: OrderImportField,
  sampleValue: string | undefined
): number {
  const n = normHeader(header)
  let best = 0
  for (const a of ORDER_FIELD_ALIASES[field]) {
    if (n === a) best = Math.max(best, 100)
    else if (n.startsWith(a + ' ') || n.endsWith(' ' + a))
      best = Math.max(best, 80)
    else if (n.includes(a)) best = Math.max(best, 50)
  }
  if (
    (field === 'quantity' ||
      field === 'unit_price' ||
      field === 'line_discount_rate' ||
      field === 'order_discount_rate' ||
      field === 'product_customer_price' ||
      field === 'product_business_price' ||
      field === 'product_cost_price') &&
    sampleValue
  ) {
    const x = parseFloat(String(sampleValue).replace(/,/g, ''))
    if (!Number.isNaN(x)) best += 8
  }
  return best
}

export function guessOrderFieldToColumnMapping(
  headers: string[],
  sampleRows?: Record<string, string>[]
): OrderFieldToColumnMapping {
  const out = emptyOrderFieldMapping()
  const used = new Set<string>()
  const firstSample = sampleRows?.[0]

  for (const field of ORDER_IMPORT_FIELDS_ORDERED) {
    let bestH: string | null = null
    let bestScore = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const raw =
        firstSample && h in firstSample ? String(firstSample[h] ?? '') : undefined
      const sc = scoreOrderHeader(h, field, raw)
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

export type OrderCsvLineDraft = {
  id: string
  import_group_id: string
  order_type: string
  warehouse_code: string
  customer_phone: string
  customer_name: string
  order_note: string
  order_discount_rate: number
  order_date_iso: string
  product_code: string
  product_name: string
  brand_name: string
  category_name: string
  quantity: number
  unit_price: number
  line_discount_rate: number
  product_customer_price: number
  product_business_price: number
  product_cost_price: number
  discarded: boolean
}

export function buildOrderLineDraft(
  csvRow: Record<string, unknown>,
  fieldToColumn: OrderFieldToColumnMapping,
  rowIndex: number
): OrderCsvLineDraft {
  const qR = cellString(csvRow, fieldToColumn.quantity)
  const upR = cellString(csvRow, fieldToColumn.unit_price)
  const ldR = cellString(csvRow, fieldToColumn.line_discount_rate)
  const odR = cellString(csvRow, fieldToColumn.order_discount_rate)
  const pcpR = cellString(csvRow, fieldToColumn.product_customer_price)
  const pbpR = cellString(csvRow, fieldToColumn.product_business_price)
  const pcostR = cellString(csvRow, fieldToColumn.product_cost_price)

  const qP = parseQty(qR, 0)
  const upP = parseMoney(upR, 0)
  const ldP = parseRate(ldR, 0)
  const odP = parseRate(odR, 0)
  const pcpP = parseMoney(pcpR, 0)
  const pbpP = parseMoney(pbpR, 0)
  const pcostP = parseMoney(pcostR, 0)

  return {
    id: `ol-${rowIndex}`,
    import_group_id: cellString(csvRow, fieldToColumn.import_group_id),
    order_type: cellString(csvRow, fieldToColumn.order_type).toLowerCase(),
    warehouse_code: cellString(csvRow, fieldToColumn.warehouse_code),
    customer_phone: cellString(csvRow, fieldToColumn.customer_phone),
    customer_name: cellString(csvRow, fieldToColumn.customer_name),
    order_note: cellString(csvRow, fieldToColumn.order_note),
    order_discount_rate: odP.ok ? odP.value : 0,
    order_date_iso: cellString(csvRow, fieldToColumn.order_date),
    product_code: cellString(csvRow, fieldToColumn.product_code),
    product_name: cellString(csvRow, fieldToColumn.product_name),
    brand_name: cellString(csvRow, fieldToColumn.brand_name),
    category_name: cellString(csvRow, fieldToColumn.category_name),
    quantity: qP.ok ? qP.value : 0,
    unit_price: upP.ok ? upP.value : 0,
    line_discount_rate: ldP.ok ? ldP.value : 0,
    product_customer_price: pcpP.ok ? pcpP.value : 0,
    product_business_price: pbpP.ok ? pbpP.value : 0,
    product_cost_price: pcostP.ok ? pcostP.value : 0,
    discarded: false,
  }
}

export type OrderCsvLineIssue =
  | 'missing_group_id'
  | 'missing_order_type'
  | 'invalid_order_type'
  | 'missing_warehouse_code'
  | 'missing_product_key'
  | 'invalid_quantity'
  | 'invalid_unit_price'
  | 'invalid_line_discount'
  | 'invalid_order_discount'

export function computeOrderLineIssues(d: OrderCsvLineDraft): OrderCsvLineIssue[] {
  const issues: OrderCsvLineIssue[] = []
  if (!d.import_group_id.trim()) issues.push('missing_group_id')
  if (!d.order_type.trim()) issues.push('missing_order_type')
  else if (d.order_type !== 'retail' && d.order_type !== 'wholesale') {
    issues.push('invalid_order_type')
  }
  if (!d.warehouse_code.trim()) issues.push('missing_warehouse_code')
  if (!d.product_code.trim() && !d.product_name.trim()) {
    issues.push('missing_product_key')
  }
  const qR = d.quantity
  if (qR <= 0) issues.push('invalid_quantity')
  if (d.unit_price < 0) issues.push('invalid_unit_price')
  if (d.line_discount_rate < 0 || d.line_discount_rate > 100) {
    issues.push('invalid_line_discount')
  }
  if (
    d.order_discount_rate < 0 ||
    d.order_discount_rate > 100
  ) {
    issues.push('invalid_order_discount')
  }
  return issues
}

export function groupOrderLinesByImportId(
  drafts: OrderCsvLineDraft[]
): Map<string, OrderCsvLineDraft[]> {
  const m = new Map<string, OrderCsvLineDraft[]>()
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

export type OrderGroupIssue = 'inconsistent_headers_within_group'

export function computeOrderGroupIssues(
  lines: OrderCsvLineDraft[]
): OrderGroupIssue[] {
  if (lines.length <= 1) return []
  const f = lines[0]
  const same =
    lines.every(
      (l) =>
        l.order_type === f.order_type &&
        l.warehouse_code === f.warehouse_code &&
        l.customer_phone === f.customer_phone &&
        l.customer_name === f.customer_name &&
        l.order_note === f.order_note &&
        l.order_discount_rate === f.order_discount_rate &&
        l.order_date_iso === f.order_date_iso
    )
  return same ? [] : ['inconsistent_headers_within_group']
}

export function orderMappingUsesColumn(
  mapping: OrderFieldToColumnMapping,
  header: string
): boolean {
  return (Object.values(mapping) as (string | null)[]).includes(header)
}

export function unusedOrderCsvHeaders(
  headers: string[],
  mapping: OrderFieldToColumnMapping
): string[] {
  return headers.filter((h) => !orderMappingUsesColumn(mapping, h))
}

export function parseOrderType(raw: string): OrderType | null {
  const t = raw.trim().toLowerCase()
  if (t === 'retail' || t === 'r' || t === 'b2c') return 'retail'
  if (t === 'wholesale' || t === 'w' || t === 'b2b') return 'wholesale'
  return null
}

type ProductWithBrandCategory = {
  product_code: string
  name: string
  brand?: { name?: string } | null
  category?: { name?: string } | null
}

export type OrderExportContext = {
  warehouseById: Map<number, Warehouse>
  personById: Map<string, Person>
}

/** One CSV row per order line (same shape as import). */
export function flattenOrdersForCsvExport(
  orders: OrderWithItemsAndPayments[],
  ctx: OrderExportContext
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const o of orders) {
    const wh = ctx.warehouseById.get(o.warehouse_id)
    const person = o.person_id ? ctx.personById.get(o.person_id) : null
    const groupId = `ORD-${o.order_number}`
    for (const item of o.items) {
      const p = item.product as unknown as ProductWithBrandCategory
      rows.push({
        import_group_id: groupId,
        order_number: o.order_number,
        is_historical_snapshot: o.is_historical_snapshot,
        order_type: o.type,
        warehouse_code: wh?.code ?? o.warehouse_id,
        customer_phone: person?.phone ?? '',
        customer_name: person?.name ?? '',
        order_note: o.note ?? '',
        order_discount_rate: o.discount_rate,
        order_date: o.created_at,
        product_code: p.product_code,
        product_name: p.name,
        brand_name: p.brand?.name ?? '',
        category_name: p.category?.name ?? '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_discount_rate: item.line_discount_rate,
        subtotal: o.subtotal,
        total_amount: o.total_amount,
      })
    }
  }
  return rows
}
