import { supabase } from '@/lib/supabase'
import type { PaymentMethod } from '@/types'
import {
  isOrderPaymentsMethodConstraintError,
  isPaymentInstallmentsMethodConstraintError,
  isPurchaseOrderPaymentsMethodConstraintError,
  legacyInstallmentMethodForDb,
} from '@/utils/paymentMethod'

const INSTALLMENTS = 'payment_installments'
const ORDER_PAYMENTS = 'order_payments'
const PO_PAYMENTS = 'purchase_order_payments'

export type OrderInstallmentInsert = {
  order_id: string
  method: PaymentMethod
  amount: number
  note: string | null
}

/**
 * Inserts order payment_installments using current PaymentMethod strings (008+).
 * Retries with legacy method values (005) if the DB check constraint still expects card/transfer/other.
 */
export async function insertOrderPaymentInstallments(
  rows: OrderInstallmentInsert[]
): Promise<void> {
  if (rows.length === 0) return

  const { error } = await supabase.from(INSTALLMENTS).insert(
    rows.map((r) => ({
      order_id: r.order_id,
      method: r.method,
      amount: r.amount,
      note: r.note,
    }))
  )
  if (!error) return

  if (!isPaymentInstallmentsMethodConstraintError(error)) throw error

  const { error: e2 } = await supabase.from(INSTALLMENTS).insert(
    rows.map((r) => ({
      order_id: r.order_id,
      method: legacyInstallmentMethodForDb(r.method),
      amount: r.amount,
      note: r.note,
    }))
  )
  if (e2) throw e2
}

export type OrderPaymentRowInsert = {
  order_id: string
  payment_method: PaymentMethod
  amount: number
}

/** Same 005 vs 008 mismatch as installments, for `order_payments.payment_method`. */
export async function insertOrderPaymentsRows(
  rows: OrderPaymentRowInsert[]
): Promise<void> {
  if (rows.length === 0) return

  const { error } = await supabase.from(ORDER_PAYMENTS).insert(
    rows.map((r) => ({
      order_id: r.order_id,
      payment_method: r.payment_method,
      amount: r.amount,
    }))
  )
  if (!error) return

  if (!isOrderPaymentsMethodConstraintError(error)) throw error

  const { error: e2 } = await supabase.from(ORDER_PAYMENTS).insert(
    rows.map((r) => ({
      order_id: r.order_id,
      payment_method: legacyInstallmentMethodForDb(r.payment_method),
      amount: r.amount,
    }))
  )
  if (e2) throw e2
}

export type PurchaseOrderPaymentRowInsert = {
  purchase_order_id: string
  payment_method: PaymentMethod
  amount: number
}

export async function insertPurchaseOrderPaymentsRows(
  rows: PurchaseOrderPaymentRowInsert[]
): Promise<void> {
  if (rows.length === 0) return

  const { error } = await supabase.from(PO_PAYMENTS).insert(
    rows.map((r) => ({
      purchase_order_id: r.purchase_order_id,
      payment_method: r.payment_method,
      amount: r.amount,
    }))
  )
  if (!error) return

  if (!isPurchaseOrderPaymentsMethodConstraintError(error)) throw error

  const { error: e2 } = await supabase.from(PO_PAYMENTS).insert(
    rows.map((r) => ({
      purchase_order_id: r.purchase_order_id,
      payment_method: legacyInstallmentMethodForDb(r.payment_method),
      amount: r.amount,
    }))
  )
  if (e2) throw e2
}
