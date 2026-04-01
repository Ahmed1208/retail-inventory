import type { PaymentMethod } from '@/types'

const KNOWN: readonly PaymentMethod[] = [
  'cash',
  'visa',
  'cheque',
  'instapay',
]

const LEGACY: Record<string, PaymentMethod> = {
  card: 'visa',
  transfer: 'instapay',
  other: 'cheque',
}

/** Map DB / API values to current PaymentMethod; legacy rows map to the new set. */
export function normalizePaymentMethod(pm: unknown): PaymentMethod | null {
  if (pm === null || pm === undefined || pm === '') return null
  const s = String(pm).trim().toLowerCase()
  if ((KNOWN as readonly string[]).includes(s)) return s as PaymentMethod
  return LEGACY[s] ?? null
}

/** Values allowed by `payment_installments` before migration 008 (005 check constraint). */
export type LegacyInstallmentMethod = 'cash' | 'card' | 'transfer' | 'other'

/** Write path for DBs that still use migration 005 method check (inverse of 008 data migration). */
export function legacyInstallmentMethodForDb(
  method: PaymentMethod
): LegacyInstallmentMethod {
  switch (method) {
    case 'cash':
      return 'cash'
    case 'visa':
      return 'card'
    case 'cheque':
      return 'other'
    case 'instapay':
      return 'transfer'
  }
}

function errorMessageString(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(e)
}

/** True when PostgREST reports violation of payment_installments method check. */
export function isPaymentInstallmentsMethodConstraintError(
  e: unknown
): boolean {
  const s = errorMessageString(e).toLowerCase()
  return (
    s.includes('payment_installments_method_check') ||
    (s.includes('payment_installments') &&
      s.includes('check constraint') &&
      s.includes('method'))
  )
}

/** True when PostgREST reports violation of order_payments payment_method check. */
export function isOrderPaymentsMethodConstraintError(e: unknown): boolean {
  const s = errorMessageString(e).toLowerCase()
  return (
    s.includes('order_payments_payment_method_check') ||
    (s.includes('order_payments') &&
      s.includes('check constraint') &&
      s.includes('payment_method'))
  )
}

export function isPurchaseOrderPaymentsMethodConstraintError(
  e: unknown
): boolean {
  const s = errorMessageString(e).toLowerCase()
  return (
    s.includes('purchase_order_payments_payment_method_check') ||
    (s.includes('purchase_order_payments') &&
      s.includes('check constraint') &&
      s.includes('payment_method'))
  )
}
