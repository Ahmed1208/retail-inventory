import type { PurchaseOrderWithItems, PurchaseOrderStatus } from '@/types'
import { cn } from '@/lib/utils'

export function paymentLabelPO(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    cash: 'orders.paymentCash',
    visa: 'orders.paymentVisa',
    cheque: 'orders.paymentCheque',
    instapay: 'orders.paymentInstapay',
    card: 'orders.paymentVisa',
    transfer: 'orders.paymentInstapay',
    other: 'orders.paymentCheque',
  }
  return t(map[key] ?? 'orders.paymentNone')
}

export function formatPOPaymentSummary(
  po: PurchaseOrderWithItems,
  t: (k: string) => string,
  formatCurrencyFn: (n: number) => string
): string {
  if (po.payments && po.payments.length > 0) {
    return po.payments
      .map(
        (p) =>
          `${paymentLabelPO(p.payment_method, t)} ${formatCurrencyFn(p.amount)}`
      )
      .join(', ')
  }
  return '—'
}

export function POStatusBadge({
  status,
  t,
}: {
  status: PurchaseOrderStatus
  t: (k: string) => string
}) {
  const styles = {
    draft:
      'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
    received:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const keys = {
    draft: 'purchaseOrders.statusDraft',
    received: 'purchaseOrders.statusReceived',
    cancelled: 'purchaseOrders.statusCancelled',
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        styles[status]
      )}
    >
      {t(keys[status])}
    </span>
  )
}
