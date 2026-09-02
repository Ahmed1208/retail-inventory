import { roundMoney } from '@/services/peopleService'
import type { ReturnLineInput } from '@/services/returnService'
import type { ReturnableLine, ReturnSettlement, ReturnStatusFlow } from '@/types'

export type TFn = (k: string, opts?: Record<string, unknown>) => string

/** One editable row in the return form, bound to a source order line. */
export type ReturnLineRow = {
  source_order_item_id: string
  product_id: string
  name: string
  unitPrice: number
  soldQty: number
  alreadyReturned: number
  returnableQty: number
  /** Unticked rows are dropped before saving. */
  selected: boolean
  qty: number
}

/** Quantity actually returned by a row, never above what is still returnable. */
export function effectiveRowQty(row: ReturnLineRow): number {
  if (!row.selected) return 0
  return Math.max(0, Math.min(row.qty, row.returnableQty))
}

export function returnLineTotal(row: ReturnLineRow): number {
  return roundMoney(row.unitPrice * effectiveRowQty(row))
}

export function returnLinesTotal(rows: ReturnLineRow[]): number {
  return roundMoney(rows.reduce((s, r) => s + returnLineTotal(r), 0))
}

export function selectedReturnLines(rows: ReturnLineRow[]): ReturnLineInput[] {
  return rows
    .map((r) => ({
      source_order_item_id: r.source_order_item_id,
      quantity: effectiveRowQty(r),
    }))
    .filter((l) => l.quantity > 0)
}

/**
 * Builds form rows from the returnable lines of a source order. `existing` (a draft being
 * edited) pre-ticks rows and restores their quantities.
 */
export function buildReturnRows(
  returnable: ReturnableLine[],
  existing?: Map<string, number>
): ReturnLineRow[] {
  return returnable.map((l) => {
    const prior = existing?.get(l.source_order_item_id) ?? 0
    return {
      source_order_item_id: l.source_order_item_id,
      product_id: l.product_id,
      name: l.product.name,
      unitPrice: l.unit_price,
      soldQty: l.sold_quantity,
      alreadyReturned: l.already_returned,
      returnableQty: l.returnable_quantity,
      selected: prior > 0,
      qty: prior > 0 ? prior : Math.min(1, l.returnable_quantity),
    }
  })
}

export function statusFlowLabel(flow: ReturnStatusFlow, t: TFn): string {
  const m: Record<ReturnStatusFlow, string> = {
    draft: 'returns.draft',
    confirmed: 'returns.confirmed',
    cancelled: 'returns.cancelled',
  }
  return t(m[flow])
}

export function statusBadgeClass(flow: ReturnStatusFlow): string {
  const map: Record<ReturnStatusFlow, string> = {
    draft: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    confirmed:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    cancelled: 'bg-muted text-muted-foreground',
  }
  return map[flow]
}

export function settlementLabel(
  settlement: ReturnSettlement | null,
  t: TFn
): string {
  if (settlement === 'refund_to_register') return t('returns.refundToRegister')
  if (settlement === 'credit_to_account') return t('returns.creditToAccount')
  return '—'
}
