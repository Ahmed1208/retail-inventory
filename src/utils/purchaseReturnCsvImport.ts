import type { Person, PurchaseReturnWithItems, Warehouse } from '@/types'

/**
 * Purchase returns are always raised against an existing PO line, so the CSV only
 * identifies the document and the quantity. Costs come from the source PO, which keeps
 * refund totals consistent with what was actually paid.
 */
export type PurchaseReturnImportField =
  | 'import_group_id'
  | 'order_number'
  | 'product_code'
  | 'quantity'
  | 'return_note'
  | 'return_date'

export const PURCHASE_RETURN_IMPORT_FIELDS_ORDERED: PurchaseReturnImportField[] =
  [
    'import_group_id',
    'order_number',
    'product_code',
    'quantity',
    'return_note',
    'return_date',
  ]

export const PURCHASE_RETURN_IMPORT_FIELDS_REQUIRED: PurchaseReturnImportField[] =
  ['import_group_id', 'order_number', 'product_code', 'quantity']

export type PurchaseReturnFieldToColumnMapping = Record<
  PurchaseReturnImportField,
  string | null
>

export function emptyPurchaseReturnFieldMapping(): PurchaseReturnFieldToColumnMapping {
  return {
    import_group_id: null,
    order_number: null,
    product_code: null,
    quantity: null,
    return_note: null,
    return_date: null,
  }
}

const HEADER_HINTS: Record<PurchaseReturnImportField, string[]> = {
  import_group_id: ['import_group_id', 'group', 'return_id', 'return_ref'],
  order_number: [
    'order_number',
    'purchase_order',
    'po_number',
    'order',
    'order_no',
    'order_id',
  ],
  product_code: ['product_code', 'product', 'sku', 'code', 'item'],
  quantity: ['quantity', 'qty', 'count', 'returned'],
  return_note: ['return_note', 'note', 'notes', 'reason', 'comment'],
  return_date: ['return_date', 'date', 'created_at', 'datetime'],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function guessPurchaseReturnFieldToColumnMapping(
  headers: string[]
): PurchaseReturnFieldToColumnMapping {
  const out = emptyPurchaseReturnFieldMapping()
  const used = new Set<string>()

  for (const field of PURCHASE_RETURN_IMPORT_FIELDS_ORDERED) {
    const hints = HEADER_HINTS[field]
    let best: string | null = null
    let bestScore = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const n = normalizeHeader(h)
      for (const hint of hints) {
        const score = n === hint ? 3 : n.includes(hint) ? 2 : 0
        if (score > bestScore) {
          bestScore = score
          best = h
        }
      }
    }
    if (best) {
      out[field] = best
      used.add(best)
    }
  }
  return out
}

export function purchaseReturnMappingUsesColumn(
  mapping: PurchaseReturnFieldToColumnMapping,
  header: string
): boolean {
  return (Object.values(mapping) as (string | null)[]).includes(header)
}

export function unusedPurchaseReturnCsvHeaders(
  headers: string[],
  mapping: PurchaseReturnFieldToColumnMapping
): string[] {
  return headers.filter((h) => !purchaseReturnMappingUsesColumn(mapping, h))
}

function cellString(
  row: Record<string, unknown>,
  column: string | null
): string {
  if (!column) return ''
  const v = row[column]
  return v == null ? '' : String(v).trim()
}

function parseQty(raw: string): number {
  const n = parseInt(raw.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

export type PurchaseReturnCsvLineDraft = {
  id: string
  import_group_id: string
  order_number: number
  product_code: string
  quantity: number
  return_note: string
  return_date_iso: string
  discarded: boolean
}

export function buildPurchaseReturnLineDraft(
  csvRow: Record<string, unknown>,
  fieldToColumn: PurchaseReturnFieldToColumnMapping,
  rowIndex: number
): PurchaseReturnCsvLineDraft {
  const orderNumRaw = cellString(csvRow, fieldToColumn.order_number)
  const dateRaw = cellString(csvRow, fieldToColumn.return_date)
  const parsedDate = dateRaw ? Date.parse(dateRaw) : NaN

  return {
    id: `row-${rowIndex}`,
    import_group_id: cellString(csvRow, fieldToColumn.import_group_id),
    order_number: parseQty(orderNumRaw),
    product_code: cellString(csvRow, fieldToColumn.product_code),
    quantity: parseQty(cellString(csvRow, fieldToColumn.quantity)),
    return_note: cellString(csvRow, fieldToColumn.return_note),
    return_date_iso: Number.isNaN(parsedDate)
      ? ''
      : new Date(parsedDate).toISOString(),
    discarded: false,
  }
}

export type PurchaseReturnCsvLineIssue =
  | 'missing_group_id'
  | 'missing_order_number'
  | 'missing_product_code'
  | 'invalid_quantity'

export function computePurchaseReturnLineIssues(
  d: PurchaseReturnCsvLineDraft
): PurchaseReturnCsvLineIssue[] {
  const issues: PurchaseReturnCsvLineIssue[] = []
  if (!d.import_group_id.trim()) issues.push('missing_group_id')
  if (d.order_number <= 0) issues.push('missing_order_number')
  if (!d.product_code.trim()) issues.push('missing_product_code')
  if (d.quantity <= 0) issues.push('invalid_quantity')
  return issues
}

export function groupPurchaseReturnLinesByImportId(
  drafts: PurchaseReturnCsvLineDraft[]
): Map<string, PurchaseReturnCsvLineDraft[]> {
  const m = new Map<string, PurchaseReturnCsvLineDraft[]>()
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

export type PurchaseReturnGroupIssue = 'mixed_orders_within_group'

/** All lines of one return document must come from the same source PO. */
export function computePurchaseReturnGroupIssues(
  lines: PurchaseReturnCsvLineDraft[]
): PurchaseReturnGroupIssue[] {
  if (lines.length <= 1) return []
  const first = lines[0].order_number
  return lines.every((l) => l.order_number === first)
    ? []
    : ['mixed_orders_within_group']
}

export type PurchaseReturnExportContext = {
  warehouseById: Map<number, Warehouse>
  personById: Map<string, Person>
  orderNumberById: Map<string, number>
}

type ProductWithCode = { product_code?: string; name?: string }

/** One CSV row per return line (same field names the importer maps). */
export function flattenPurchaseReturnsForCsvExport(
  returns: PurchaseReturnWithItems[],
  ctx: PurchaseReturnExportContext
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const r of returns) {
    const wh = ctx.warehouseById.get(r.warehouse_id)
    const person = r.person_id ? ctx.personById.get(r.person_id) : null
    const orderNumber =
      ctx.orderNumberById.get(r.source_purchase_order_id) ?? ''
    for (const item of r.items) {
      const p = item.product as unknown as ProductWithCode
      rows.push({
        import_group_id: `PRET-${r.return_number}`,
        return_number: r.return_number,
        order_number: orderNumber,
        status_flow: r.status_flow,
        settlement: r.settlement ?? '',
        refund_method: r.refund_method ?? '',
        is_historical_snapshot: r.is_historical_snapshot,
        warehouse_code: wh?.code ?? '',
        supplier_name: person?.name ?? '',
        supplier_phone: person?.phone ?? '',
        product_code: p.product_code ?? '',
        product_name: p.name ?? '',
        quantity: item.quantity,
        unit_cost: item.cost_price,
        line_total: item.total_price,
        return_total: r.total_amount,
        return_note: r.note ?? '',
        return_date: r.created_at,
      })
    }
  }
  return rows
}
