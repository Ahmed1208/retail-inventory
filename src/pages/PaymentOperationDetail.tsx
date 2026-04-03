import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import {
  getLedgerPaymentOperation,
  reverseLedgerPaymentOperation,
  roundMoney,
  supabaseErrorMessage,
  updateLedgerPaymentOperationNote,
} from '@/services/peopleService'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { paymentLabel, PAYMENT_METHODS } from '@/components/orders/ordersShared'
import type { PaymentMethod } from '@/types'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { useLanguage } from '@/hooks/useLanguage'
import { ledgerPaymentRelatedDocumentHref } from '@/utils/ledgerLinks'
import { NoteWithDocLinks } from '@/components/common/NoteWithDocLinks'

function isPaymentMethod(m: unknown): m is PaymentMethod {
  return typeof m === 'string' && PAYMENT_METHODS.includes(m as PaymentMethod)
}

export function PaymentOperationDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const qc = useQueryClient()
  const fc = (n: number) => formatCurrency(n, lang)

  const canList = useFeatureEnabled('payments.list')
  const canEditNote = useFeatureEnabled('payments.editLedgerNote')
  const canReverse = useFeatureEnabled('payments.reverseLedgerOperation')

  const [noteDraft, setNoteDraft] = useState('')
  const [reverseOpen, setReverseOpen] = useState(false)

  const {
    data: op,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ledgerPaymentOperation', id],
    queryFn: () => getLedgerPaymentOperation(id!),
    enabled: !!id && canList,
  })

  useEffect(() => {
    if (op?.note != null) setNoteDraft(op.note)
    else setNoteDraft('')
  }, [op?.note, op?.operation_route_id])

  useEffect(() => {
    if (op?.reference_number) {
      document.title = `${op.reference_number} | StockPilot`
    } else {
      document.title = `${t('payments.paymentOperationTitle')} | StockPilot`
    }
    return () => {
      document.title = 'StockPilot'
    }
  }, [op?.reference_number, t])

  const noteMut = useMutation({
    mutationFn: (text: string) =>
      updateLedgerPaymentOperationNote(id!, text || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledgerPaymentOperation', id] })
      qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
      qc.invalidateQueries({ queryKey: ['personTxs'] })
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['registerBalances'] })
      qc.invalidateQueries({ queryKey: ['registerActivity'] })
      toast.success(t('payments.toastOperationNoteSaved'))
    },
    onError: (e: unknown) =>
      toast.error(supabaseErrorMessage(e) || t('people.toastError')),
  })

  const reverseMut = useMutation({
    mutationFn: () => reverseLedgerPaymentOperation(id!),
    onSuccess: () => {
      setReverseOpen(false)
      qc.invalidateQueries({ queryKey: ['ledgerPaymentOperation', id] })
      qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
      qc.invalidateQueries({ queryKey: ['personTxs'] })
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order'] })
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
      qc.invalidateQueries({ queryKey: ['purchaseOrder'] })
      qc.invalidateQueries({ queryKey: ['registerBalances'] })
      qc.invalidateQueries({ queryKey: ['registerActivity'] })
      toast.success(t('payments.toastOperationReversed'))
    },
    onError: (e: unknown) =>
      toast.error(supabaseErrorMessage(e) || t('people.toastError')),
  })

  if (!canList) {
    return <Navigate to="/payments" replace />
  }

  if (!id) return null

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !op) {
    return (
      <div className="space-y-4 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <Link
          to="/payments/list"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('payments.backToTransactionLog')}
        </Link>
        <p className="text-muted-foreground">
          {t('payments.paymentOperationNotFound')}
        </p>
      </div>
    )
  }

  const totalTendered = roundMoney(
    op.lines.reduce((s, l) => s + Math.abs(l.amount), 0)
  )
  const walletTotal = roundMoney(
    op.walletLines.reduce((s, l) => s + Math.abs(l.amount), 0)
  )
  const relatedHref = ledgerPaymentRelatedDocumentHref(op)
  const relatedIsPo = op.type === 'payment_out' && relatedHref
  const noteLocked = op.reversed || !canEditNote
  const isRegisterOp =
    op.type === 'register_deposit' || op.type === 'register_withdraw'
  const opTypeLabel =
    op.type === 'register_deposit'
      ? t('people.txRegisterDeposit')
      : op.type === 'register_withdraw'
        ? t('people.txRegisterWithdraw')
        : op.type === 'payment_in'
          ? t('people.txPaymentIn')
          : t('people.txPaymentOut')

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-10rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <AlertDialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('payments.reverseOperationConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('payments.reverseOperationConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={reverseMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                reverseMut.mutate()
              }}
            >
              {reverseMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('payments.reverseOperation')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-2 py-2">
        {isRegisterOp && (
          <Link
            to="/register"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'gap-2'
            )}
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t('register.backToRegister')}
          </Link>
        )}
        <Link
          to="/payments/list"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('payments.backToTransactionLog')}
        </Link>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-4 sm:p-6">
        {op.reversed && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            {t('payments.operationReversedBanner')}
          </p>
        )}

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {op.reference_number ?? t('payments.paymentOperationUntitled')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {opTypeLabel}
            {' · '}
            {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(op.created_at))}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('payments.person')}
          </h2>
          {isRegisterOp ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('register.ledgerPartyName')}
            </p>
          ) : op.person ? (
            <div className="mt-2">
              <p className="font-medium">{op.person.name}</p>
              {op.person.phone && (
                <p className="text-sm text-muted-foreground font-mono">
                  {op.person.phone}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('payments.walkInCustomer')}
            </p>
          )}
        </div>

        {relatedHref && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('payments.relatedDocument')}
            </h2>
            <Link
              to={relatedHref}
              className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
            >
              {relatedIsPo
                ? t('payments.relatedPurchaseOrder')
                : t('payments.relatedSalesOrder')}
            </Link>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">
            {t('payments.operationTenderLines')}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {op.lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-2">
                    {line.payment_method && isPaymentMethod(line.payment_method)
                      ? paymentLabel(line.payment_method, t)
                      : t('payments.methodUnspecified')}
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums font-medium">
                    {fc(Math.abs(line.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-medium">
                <td className="px-4 py-2">{t('payments.totalTendered')}</td>
                <td className="px-4 py-2 text-end tabular-nums">
                  {fc(totalTendered)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {op.walletLines.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">
              {t('payments.operationWalletLines')}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {op.walletLines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-4 py-2 text-muted-foreground">
                      {t('people.txWallet')}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums font-medium">
                      {fc(Math.abs(line.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-medium">
                  <td className="px-4 py-2">{t('payments.totalTendered')}</td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {fc(walletTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {canReverse && !op.reversed && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={reverseMut.isPending}
              onClick={() => setReverseOpen(true)}
            >
              {t('payments.reverseOperation')}
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Label htmlFor="op-note">{t('payments.operationNote')}</Label>
          {noteLocked || op.reversed ? (
            <div
              id="op-note"
              className="min-h-[4rem] rounded-md border border-input bg-muted/30 px-3 py-2"
            >
              <NoteWithDocLinks note={noteDraft} />
            </div>
          ) : (
            <Textarea
              id="op-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              readOnly={false}
              disabled={noteMut.isPending}
              rows={3}
              placeholder={t('payments.operationNotePlaceholder')}
              className="resize-y min-h-[4rem]"
            />
          )}
          {!noteLocked && !op.reversed && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t('payments.notePreview')}
              </p>
              <div className="rounded-md border border-border/60 bg-muted/15 px-2 py-1.5">
                <NoteWithDocLinks note={noteDraft} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('payments.operationNoteLinkHint')}
              </p>
            </div>
          )}
          {!noteLocked ? (
            <Button
              type="button"
              disabled={
                noteMut.isPending ||
                op.reversed ||
                noteDraft.trim() === (op.note ?? '').trim()
              }
              onClick={() => noteMut.mutate(noteDraft)}
            >
              {noteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('payments.saveOperationNote')
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {op.reversed
                ? t('payments.operationNoteNoEditReversed')
                : t('payments.operationNoteReadOnly')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
