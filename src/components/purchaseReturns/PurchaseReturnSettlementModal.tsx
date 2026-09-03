import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import type { PaymentMethod, PurchaseReturnSettlement } from '@/types'
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
import type { PurchaseReturnLineRow } from './purchaseReturnsShared'
import { effectiveRowQty, projectedOnHand } from './purchaseReturnsShared'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRTL: boolean
  formatCurrency: (n: number) => string
  total: number
  /** Null when the source PO has no linked supplier; account debit is then unavailable. */
  personName: string | null
  settlement: PurchaseReturnSettlement
  setSettlement: (v: PurchaseReturnSettlement) => void
  refundMethod: PaymentMethod
  setRefundMethod: (v: PaymentMethod) => void
  note: string
  setNote: (v: string) => void
  /** Lines that would leave stock below zero; shown up front, never blocking. */
  negativeRows: PurchaseReturnLineRow[]
  canConfirm: boolean
  confirming: boolean
  onConfirm: () => void
}

export function PurchaseReturnSettlementModal({
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
  negativeRows,
  canConfirm,
  confirming,
  onConfirm,
}: Props) {
  const { t } = useTranslation()
  const debitAvailable = Boolean(personName)

  const options: {
    value: PurchaseReturnSettlement
    title: string
    desc: string
    disabled: boolean
  }[] = [
    {
      value: 'refund_to_register',
      title: t('purchaseReturns.refundToRegister'),
      desc: t('purchaseReturns.refundToRegisterHint'),
      disabled: false,
    },
    {
      value: 'debit_from_account',
      title: t('purchaseReturns.debitFromAccount'),
      desc: debitAvailable
        ? t('purchaseReturns.debitFromAccountHint', { name: personName })
        : t('purchaseReturns.debitFromAccountUnavailable'),
      disabled: !debitAvailable,
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
          <DialogTitle>{t('purchaseReturns.confirmTitle')}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex items-baseline justify-between border-b pb-3 text-base font-semibold tabular-nums">
            <span>{t('purchaseReturns.refundAmount')}</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {negativeRows.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t('purchaseReturns.negativeStockWarning')}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                {negativeRows.map((r) => (
                  <li
                    key={r.source_purchase_order_item_id}
                    className="tabular-nums"
                  >
                    {t('purchaseReturns.negativeStockLine', {
                      name: r.name,
                      onHand: r.onHandQty,
                      quantity: effectiveRowQty(r),
                      after: projectedOnHand(r),
                    })}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-100/90">
                {t('purchaseReturns.negativeStockNotice')}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              {t('purchaseReturns.settlementLabel')}
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
                    name="purchase-return-settlement"
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
                {t('purchaseReturns.refundMethod')}
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
                      name="purchase-return-refund-method"
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
            <Label htmlFor="purchase-return-confirm-note">
              {t('purchaseReturns.note')}
            </Label>
            <NoteMentionEditor
              id="purchase-return-confirm-note"
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
            {t('purchaseReturns.confirmReturn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
