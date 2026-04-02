import type { BalanceTransactionType } from '@/types'

export type LedgerLinkRow = {
  type: BalanceTransactionType
  reference_id: string | null
  reference_number: string | null
  /** From grouped list or `payment_group_id ?? id` for payment rows. */
  ledger_operation_route_id?: string | null
}

/**
 * Route path for reference column: payment operations, orders, or purchase orders.
 */
export function ledgerReferenceHref(row: LedgerLinkRow): string | null {
  if (row.type === 'payment_in' || row.type === 'payment_out') {
    const op = row.ledger_operation_route_id
    if (op) return `/payments/operations/${op}`
    return null
  }

  if (!row.reference_id) return null
  const id = row.reference_id
  const refNum = row.reference_number ?? ''

  if (row.type === 'order') {
    return `/orders/${id}`
  }
  if (row.type === 'purchase_order') {
    return `/purchase-orders/${id}`
  }
  if (row.type === 'wallet') {
    if (/^PO-/.test(refNum)) return `/purchase-orders/${id}`
    return `/orders/${id}`
  }
  if (row.type === 'adjustment') {
    if (/^PI-|^PY-/.test(refNum)) {
      return `/payments/operations/${id}`
    }
    if (/^PO-/.test(refNum)) {
      return `/purchase-orders/${id}`
    }
    if (/^O-/.test(refNum)) {
      return `/orders/${id}`
    }
    return `/orders/${id}`
  }
  return null
}

/** Order or PO linked to a payment_in / payment_out row, when `reference_id` is set. */
export function ledgerPaymentRelatedDocumentHref(row: {
  type: 'payment_in' | 'payment_out'
  reference_id: string | null
}): string | null {
  if (!row.reference_id) return null
  if (row.type === 'payment_out') return `/purchase-orders/${row.reference_id}`
  return `/orders/${row.reference_id}`
}
