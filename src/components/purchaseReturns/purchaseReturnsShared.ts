import { roundMoney } from '@/services/peopleService'
import type { PurchaseReturnLineInput } from '@/services/purchaseReturnService'
import type {
  PurchaseReturnSettlement,
  PurchaseReturnStatusFlow,
  PurchaseReturnableLine,
} from '@/types'

export type TFn = (k: string, opts?: Record<string, unknown>) => string

/** One editable row in the purchase return form, bound to a source PO line. */
export type PurchaseReturnLineRow = {
  source_purchase_order_item_id: string
  product_id: string
  name: string
  costPrice: number
  receivedQty: number
  alreadyReturned: number
  returnableQty: number
  /** On-hand in the return's warehouse, to warn before stock goes negative. */
  onHandQty: number
  /** Unticked rows are dropped before saving. */
  selected: boolean
  qty: number
}

/** Quantity actually returned by a row, never above what is still returnable. */
export function effectiveRowQty(row: PurchaseReturnLineRow): number {
  if (!row.selected) return 0
  return Math.max(0, Math.min(row.qty, row.returnableQty))
}

export function purchaseReturnLineTotal(row: PurchaseReturnLineRow): number {
  return roundMoney(row.costPrice * effectiveRowQty(row))
}

export function purchaseReturnLinesTotal(
  rows: PurchaseReturnLineRow[]
): number {
  return roundMoney(rows.reduce((s, r) => s + purchaseReturnLineTotal(r), 0))
}

export function selectedPurchaseReturnLines(
  rows: PurchaseReturnLineRow[]
): PurchaseReturnLineInput[] {
  return rows
    .map((r) => ({
      source_purchase_order_item_id: r.source_purchase_order_item_id,
      quantity: effectiveRowQty(r),
    }))
    .filter((l) => l.quantity > 0)
}

/** On-hand left after this row is confirmed; negative means the goods were already sold. */
export function projectedOnHand(row: PurchaseReturnLineRow): number {
  return row.onHandQty - effectiveRowQty(row)
}

/** Rows that would leave stock below zero. Confirm still allows it; the admin is told. */
export function rowsGoingNegative(
  rows: PurchaseReturnLineRow[]
): PurchaseReturnLineRow[] {
  return rows.filter((r) => effectiveRowQty(r) > 0 && projectedOnHand(r) < 0)
}

/**
 * Builds form rows from the returnable lines of a source PO. `existing` (a draft being
 * edited) pre-ticks rows and restores their quantities.
 */
export function buildPurchaseReturnRows(
  returnable: PurchaseReturnableLine[],
  existing?: Map<string, number>
): PurchaseReturnLineRow[] {
  return returnable.map((l) => {
    const prior = existing?.get(l.source_purchase_order_item_id) ?? 0
    return {
      source_purchase_order_item_id: l.source_purchase_order_item_id,
      product_id: l.product_id,
      name: l.product.name,
      costPrice: l.cost_price,
      receivedQty: l.received_quantity,
      alreadyReturned: l.already_returned,
      returnableQty: l.returnable_quantity,
      onHandQty: l.on_hand_quantity,
      selected: prior > 0,
      qty: prior > 0 ? prior : Math.min(1, l.returnable_quantity),
    }
  })
}

export function statusFlowLabel(
  flow: PurchaseReturnStatusFlow,
  t: TFn
): string {
  const m: Record<PurchaseReturnStatusFlow, string> = {
    draft: 'purchaseReturns.draft',
    confirmed: 'purchaseReturns.confirmed',
    cancelled: 'purchaseReturns.cancelled',
  }
  return t(m[flow])
}

export function statusBadgeClass(flow: PurchaseReturnStatusFlow): string {
  const map: Record<PurchaseReturnStatusFlow, string> = {
    draft: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    confirmed:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    cancelled: 'bg-muted text-muted-foreground',
  }
  return map[flow]
}

export function settlementLabel(
  settlement: PurchaseReturnSettlement | null,
  t: TFn
): string {
  if (settlement === 'refund_to_register') {
    return t('purchaseReturns.refundToRegister')
  }
  if (settlement === 'debit_from_account') {
    return t('purchaseReturns.debitFromAccount')
  }
  return '—'
}
