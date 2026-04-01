import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import type { PaymentMethod } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { paymentLabel, PAYMENT_METHODS } from '@/components/orders/ordersShared'
import { cn } from '@/lib/utils'
import { roundMoney } from '@/services/peopleService'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRTL: boolean
  formatCurrency: (n: number) => string
  preview: { subtotal: number; discountAmount: number; total: number }
  discountRate: number
  paidPreview: number
  /** Customer name when linked; used for overpayment wallet copy */
  personName: string | null
  payUse: Record<PaymentMethod, boolean>
  setPayUse: React.Dispatch<
    React.SetStateAction<Record<PaymentMethod, boolean>>
  >
  payAmounts: Record<PaymentMethod, string>
  setPayAmounts: React.Dispatch<
    React.SetStateAction<Record<PaymentMethod, string>>
  >
  allowRemaining: boolean
  setAllowRemaining: (v: boolean) => void
  personId: string | null
  note: string
  setNote: (v: string) => void
  canConfirm: boolean
  confirming: boolean
  onConfirm: () => void
}

export function OrderCheckoutModal({
  open,
  onOpenChange,
  isRTL,
  formatCurrency,
  preview,
  discountRate,
  paidPreview,
  personName,
  payUse,
  setPayUse,
  payAmounts,
  setPayAmounts,
  allowRemaining,
  setAllowRemaining,
  personId,
  note,
  setNote,
  canConfirm,
  confirming,
  onConfirm,
}: Props) {
  const { t } = useTranslation()

  const overExcess =
    paidPreview > preview.total + 0.01
      ? roundMoney(paidPreview - preview.total)
      : 0
  const remainingDisplay = roundMoney(
    Math.max(0, preview.total - paidPreview)
  )
  const showOverWarning = overExcess > 0.01 && Boolean(personId)
  const showOverError = overExcess > 0.01 && !personId
  const confirmLabel =
    showOverWarning
      ? (t as (k: string, o: { amount: string }) => string)(
          'payments.confirmAndAddToWallet',
          { amount: formatCurrency(overExcess) }
        )
      : t('orders.confirmOrder')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg',
          isRTL && 'rtl'
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-start">
          <DialogTitle>{t('orders.checkoutTitle')}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-1.5 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('orders.subtotal')}</span>
              <span>{formatCurrency(preview.subtotal)}</span>
            </div>
            {preview.discountAmount > 0.005 && (
              <div className="flex justify-between text-emerald-600">
                <span>
                  {t('orders.discount')} ({discountRate}%)
                </span>
                <span>−{formatCurrency(preview.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
              <span>{t('orders.totalAmount')}</span>
              <span>{formatCurrency(preview.total)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>{t('orders.paid')}</span>
              <span>{formatCurrency(paidPreview)}</span>
            </div>
            <div
              className={cn(
                'flex justify-between',
                remainingDisplay > 0.01 && 'font-medium text-destructive'
              )}
            >
              <span>{t('orders.remaining')}</span>
              <span>{formatCurrency(remainingDisplay)}</span>
            </div>
          </div>

          {showOverWarning && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
              role="status"
            >
              <span className="me-1" aria-hidden>
                ⚠️
              </span>
              {t('payments.overpaymentWarning')} ({formatCurrency(overExcess)}
              ). {formatCurrency(overExcess)}{' '}
              {t('payments.overpaymentWillBeAddedToWallet')} ({personName}
              ).
            </div>
          )}
          {showOverError && (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {t('payments.selectPersonForOverpayment')}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              {t('orders.paymentBreakdown')}
            </p>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={payUse[m]}
                    onChange={(e) =>
                      setPayUse((p) => ({ ...p, [m]: e.target.checked }))
                    }
                    aria-label={paymentLabel(m, t)}
                  />
                  <span className="w-24 text-sm">{paymentLabel(m, t)}</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="max-w-[140px]"
                    disabled={!payUse[m]}
                    value={payAmounts[m]}
                    onChange={(e) =>
                      setPayAmounts((p) => ({ ...p, [m]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowRemaining}
                onChange={(e) => setAllowRemaining(e.target.checked)}
                disabled={!personId}
              />
              <span>{t('orders.addToBalance')}</span>
            </label>
            {!personId && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('orders.addToBalanceHint')}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="checkout-note">{t('orders.note')}</Label>
            <Textarea
              id="checkout-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canConfirm || confirming}
            onClick={onConfirm}
          >
            {confirming && (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
