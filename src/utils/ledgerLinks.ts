import type { BalanceTransactionType } from '@/types'

import { retainedNoteDocumentRoute } from '@/utils/ledgerDocSuffix'

export type LedgerLinkRow = {
  type: BalanceTransactionType
  reference_id: string | null
  reference_number: string | null
  /** From grouped list or `payment_group_id ?? id` for payment rows. */
  ledger_operation_route_id?: string | null
  /** Used to link retained-cancel payments to their source order/PO instead of payment op. */
  note?: string | null
}

/** Matches notes written by `applyPersonOrderCancelLedger` / PO retain flow. */
export function isRetainedFromCancelledDocumentNote(
  note: string | null | undefined
): boolean {
  const n = note?.trim() ?? ''
  if (n.startsWith('Retained · ') || n.startsWith('Overpayment retained · ')) {
    return true
  }
  return n.split(' | ').some(
    (part) =>
      part.startsWith('Retained · ') || part.startsWith('Overpayment retained · ')
  )
}

/**
 * Route path for reference column: payment operations, orders, or purchase orders.
 */
export function ledgerReferenceHref(row: LedgerLinkRow): string | null {
  if (row.type === 'register_deposit' || row.type === 'register_withdraw') {
    const op = row.ledger_operation_route_id
    if (op) return `/payments/operations/${op}`
    return null
  }
  if (row.type === 'payment_in' || row.type === 'payment_out') {
    const op = row.ledger_operation_route_id
    if (op) return `/payments/operations/${op}`
    if (isRetainedFromCancelledDocumentNote(row.note)) {
      const fromSuffix = retainedNoteDocumentRoute(row.note)
      if (fromSuffix) {
        return `${fromSuffix.basePath}${fromSuffix.documentId}`
      }
      if (row.reference_id && row.reference_number) {
        const refNum = row.reference_number
        if (/^O-/.test(refNum)) return `/orders/${row.reference_id}`
        if (/^PO-/.test(refNum)) return `/purchase-orders/${row.reference_id}`
      }
    }
    return null
  }

  if (row.type === 'wallet') {
    if (isRetainedFromCancelledDocumentNote(row.note)) {
      const fromSuffix = retainedNoteDocumentRoute(row.note)
      if (fromSuffix) {
        return `${fromSuffix.basePath}${fromSuffix.documentId}`
      }
    }
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

/** Order or PO linked to a payment_in / payment_out row, or from retained note ` · doc:{uuid}` suffix. */
export function ledgerPaymentRelatedDocumentHref(row: {
  type:
    | 'payment_in'
    | 'payment_out'
    | 'register_deposit'
    | 'register_withdraw'
  reference_id: string | null
  note?: string | null
}): string | null {
  if (row.type === 'register_deposit' || row.type === 'register_withdraw') {
    return null
  }
  if (row.reference_id) {
    if (row.type === 'payment_out') return `/purchase-orders/${row.reference_id}`
    return `/orders/${row.reference_id}`
  }
  const fromNote = retainedNoteDocumentRoute(row.note)
  if (fromNote) return `${fromNote.basePath}${fromNote.documentId}`
  return null
}
