import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import type { PaymentMethod, ReturnSettlement } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { paymentLabel, PAYMENT_METHODS } from '@/components/orders/ordersShared'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRTL: boolean
  formatCurrency: (n: number) => string
  total: number
  /** Null for a walk-in source order; account credit is then unavailable. */
  personName: string | null
  settlement: ReturnSettlement
  setSettlement: (v: ReturnSettlement) => void
  refundMethod: PaymentMethod
  setRefundMethod: (v: PaymentMethod) => void
  note: string
  setNote: (v: string) => void
  canConfirm: boolean
  confirming: boolean
  onConfirm: () => void
}

export function ReturnSettlementModal({
  open,
  onOpenChange,
  isRTL,
  formatCurrency,
  total,
  personName,
  settlement,
  setSettlement,
  refundMethod,
  setRefundMethod,
  note,
  setNote,
  canConfirm,
  confirming,
  onConfirm,
}: Props) {
  const { t } = useTranslation()
  const creditAvailable = Boolean(personName)

  const options: {
    value: ReturnSettlement
    title: string
    desc: string
    disabled: boolean
  }[] = [
    {
      value: 'refund_to_register',
      title: t('returns.refundToRegister'),
      desc: t('returns.refundToRegisterHint'),
      disabled: false,
    },
    {
      value: 'credit_to_account',
      title: t('returns.creditToAccount'),
      desc: creditAvailable
        ? t('returns.creditToAccountHint', { name: personName })
        : t('returns.creditToAccountUnavailable'),
      disabled: !creditAvailable,
    },
  ]

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
          <DialogTitle>{t('returns.confirmTitle')}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex items-baseline justify-between border-b pb-3 text-base font-semibold tabular-nums">
            <span>{t('returns.refundAmount')}</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              {t('returns.settlementLabel')}
            </p>
            <div className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
                    settlement === o.value && 'border-primary bg-muted/50',
                    o.disabled && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <input
                    type="radio"
                    name="return-settlement"
                    className="mt-1"
                    checked={settlement === o.value}
                    disabled={o.disabled}
                    onChange={() => setSettlement(o.value)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{o.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {o.desc}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {settlement === 'refund_to_register' && (
            <div>
              <p className="mb-2 text-sm font-medium">
                {t('returns.refundMethod')}
              </p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
                      refundMethod === m && 'border-primary bg-muted/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="return-refund-method"
                      checked={refundMethod === m}
                      onChange={() => setRefundMethod(m)}
                    />
                    <span>{paymentLabel(m, t)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="return-confirm-note">{t('returns.note')}</Label>
            <NoteMentionEditor
              id="return-confirm-note"
              value={note}
              onChange={setNote}
              rows={3}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('notes.mentionHint')}
            </p>
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
            {confirming && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('returns.confirmReturn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
