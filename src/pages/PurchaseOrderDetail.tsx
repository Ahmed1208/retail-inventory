import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  type CancelPurchaseOrderSettlement,
  getPurchaseOrderById,
  updatePurchaseOrderNote,
} from '@/services/purchaseOrderService'
import {
  getLedgerPaymentOperationRouteIdForPo,
  roundMoney,
  supabaseErrorMessage,
} from '@/services/peopleService'
import type { PaymentMethod, PurchaseOrderPayment } from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import {
  POStatusBadge,
  paymentLabelPO,
} from '@/components/purchaseOrders/purchaseOrderShared'
import { EditableNoteCard } from '@/components/common/EditableNoteCard'
import { PAYMENT_METHODS } from '@/components/orders/ordersShared'
import { PurchaseOrderCheckoutModal } from '@/components/purchaseOrders/PurchaseOrderCheckoutModal'

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const qc = useQueryClient()
  const fc = (n: number) => formatCurrency(n, lang)

  const canCancelPO = useFeatureEnabled('purchaseOrders.cancel')
  const canCreatePo = useFeatureEnabled('purchaseOrders.create')
  const canConfirmReceive = useFeatureEnabled('purchaseOrders.confirmReceive')
  const canEditPoNote = useFeatureEnabled('purchaseOrders.editNote')
  const canListPayments = useFeatureEnabled('payments.list')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [payUse, setPayUse] = useState<Record<PaymentMethod, boolean>>({
    cash: false,
    visa: false,
    cheque: false,
    instapay: false,
  })
  const [payAmounts, setPayAmounts] = useState<Record<PaymentMethod, string>>({
    cash: '',
    visa: '',
    cheque: '',
    instapay: '',
  })
  const [allowRemaining, setAllowRemaining] = useState(false)
  const [confirmNote, setConfirmNote] = useState('')

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelSettlement, setCancelSettlement] =
    useState<CancelPurchaseOrderSettlement>('reverse_payments')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const {
    data: po,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => getPurchaseOrderById(id!),
    enabled: !!id,
  })

  const showPoPaymentOpLink =
    !!po &&
    po.status === 'received' &&
    !!po.person_id &&
    (po.payments?.length ?? 0) > 0 &&
    canListPayments

  const { data: poPaymentOpRouteId, isFetching: poPaymentOpFetching } =
    useQuery({
      queryKey: ['poLedgerPaymentOpRoute', po?.id],
      queryFn: () => getLedgerPaymentOperationRouteIdForPo(po!.id),
      enabled: showPoPaymentOpLink,
    })

  useEffect(() => {
    if (po) setConfirmNote(po.note ?? '')
  }, [po?.id, po?.note])

  const paidPreview = useMemo(() => {
    let s = 0
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = parseFloat(payAmounts[m]) || 0
      if (v > 0) s += v
    }
    return roundMoney(s)
  }, [payUse, payAmounts])

  const canConfirmDraft = useMemo(() => {
    if (!po || po.status !== 'draft') return false
    if (!po.person_id) return false
    const total = roundMoney(po.total_amount)
    const rem = roundMoney(total - paidPreview)
    if (rem > 0.01 && !allowRemaining) return false
    return true
  }, [po, paidPreview, allowRemaining])

  useEffect(() => {
    if (po) {
      document.title = `${(t as (key: string, opts?: Record<string, number>) => string)('purchaseOrders.detailTitle', { number: po.order_number })} | StockPilot`
    } else {
      document.title = `${t('purchaseOrders.title')} | StockPilot`
    }
    return () => {
      document.title = 'StockPilot'
    }
  }, [po, t])

  const invalidatePO = () => {
    qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
    qc.invalidateQueries({ queryKey: ['purchaseOrder'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['dashboardStats'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
  }

  const noteMut = useMutation({
    mutationFn: (text: string) => updatePurchaseOrderNote(id!, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchaseOrder', id] })
      invalidatePO()
    },
    onError: (e: unknown) =>
      toast.error(supabaseErrorMessage(e) || t('purchaseOrders.toastError')),
  })

  const openConfirmDraft = () => {
    if (!po || po.status !== 'draft') return
    setPayUse({
      cash: false,
      visa: false,
      cheque: false,
      instapay: false,
    })
    setPayAmounts({
      cash: '',
      visa: '',
      cheque: '',
      instapay: '',
    })
    setAllowRemaining(false)
    setConfirmNote(po.note ?? '')
    setConfirmOpen(true)
  }

  const buildPaymentsFromState = () => {
    const out: { payment_method: PaymentMethod; amount: number }[] = []
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = roundMoney(parseFloat(payAmounts[m]) || 0)
      if (v > 0.001) out.push({ payment_method: m, amount: v })
    }
    return out
  }

  const handleConfirmDraftSubmit = async () => {
    if (!po || po.status !== 'draft' || !canConfirmDraft) return
    setConfirming(true)
    try {
      await confirmPurchaseOrder(po.id, {
        payments: buildPaymentsFromState(),
        allow_remaining_on_account: allowRemaining,
        note: confirmNote,
      })
      invalidatePO()
      setConfirmOpen(false)
      toast.success(t('purchaseOrders.toastCreated'))
    } catch {
      toast.error(t('purchaseOrders.toastError'))
    } finally {
      setConfirming(false)
    }
  }

  if (!id) return null

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !po) {
    return (
      <div className="p-6">
        <Link
          to="/purchase-orders/list"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToList')}
        </Link>
        <p className="mt-4 text-muted-foreground">{t('common.noResults')}</p>
      </div>
    )
  }

  const canCancel =
    canCancelPO && (po.status === 'received' || po.status === 'draft')

  const paidAtPo = (po.payments ?? []).reduce((s, p) => s + p.amount, 0)
  const showCancelSettlementChoice =
    po.status === 'received' && !!po.person_id && paidAtPo > 0.01

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-10rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-2 py-2">
        <Link
          to="/purchase-orders/list"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToList')}
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
        <header className="mb-4 flex flex-wrap items-start gap-3 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tabular-nums">
              #{t('purchaseOrders.poPrefix')}-{po.order_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
              }).format(new Date(po.created_at))}
            </p>
          </div>
          <POStatusBadge status={po.status} t={t} />
          <div className="ms-auto flex flex-wrap gap-2">
            {po.status === 'draft' && canCreatePo && canConfirmReceive && (
              <Button type="button" onClick={openConfirmDraft}>
                {t('purchaseOrders.confirmReceiveDraft')}
              </Button>
            )}
            {canCancel && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setCancelSettlement('reverse_payments')
                  setCancelOpen(true)
                }}
              >
                {t('purchaseOrders.cancelPurchaseOrder')}
              </Button>
            )}
          </div>
        </header>

        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">
              {t('purchaseOrders.supplierName')}:
            </span>{' '}
            {po.supplier_name ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">
              {t('purchaseOrders.date')}:
            </span>{' '}
            {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
              dateStyle: 'medium',
            }).format(new Date(po.created_at))}
          </p>
          {po.payments && po.payments.length > 0 && (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">
                {t('orders.paymentMethod')}:
              </span>
              <span className="mt-1 block">
                {po.payments.map((p: PurchaseOrderPayment) => (
                  <span key={p.id ?? p.payment_method} className="block">
                    {paymentLabelPO(p.payment_method, t)}: {fc(p.amount)}
                  </span>
                ))}
              </span>
              {showPoPaymentOpLink && (
                <span className="mt-2 block text-muted-foreground">
                  {poPaymentOpFetching ? (
                    <Loader2 className="inline h-4 w-4 animate-spin align-middle" />
                  ) : poPaymentOpRouteId ? (
                    <Link
                      to={`/payments/operations/${poPaymentOpRouteId}`}
                      className={cn(
                        buttonVariants({ variant: 'link' }),
                        'h-auto p-0 align-baseline font-medium text-primary'
                      )}
                    >
                      {t('purchaseOrders.openPaymentOperation')}
                    </Link>
                  ) : (
                    '—'
                  )}
                </span>
              )}
            </p>
          )}
          <div className="sm:col-span-2">
            <EditableNoteCard
              label={t('purchaseOrders.note')}
              value={po.note ?? ''}
              canEdit={canEditPoNote}
              isPending={noteMut.isPending}
              fieldId={`po-note-${po.id}`}
              onSave={async (text) => {
                await noteMut.mutateAsync(text)
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-start font-medium">
                  {t('common.name')}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t('common.quantity')}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t('purchaseOrders.costPricePaid')}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t('purchaseOrders.previousCostPrice')}
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  {t('purchaseOrders.costPriceUpdated')}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t('purchaseOrders.lineTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-3 py-2 font-medium">
                    {item.product.name}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {fc(item.cost_price)}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">
                    {item.previous_cost_price != null
                      ? fc(item.previous_cost_price)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {item.cost_price_updated ? t('common.yes') : t('common.no')}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {fc(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm font-semibold">
          {t('purchaseOrders.totalAmount')}: {fc(po.total_amount)}
        </p>
      </div>

      <PurchaseOrderCheckoutModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        isRTL={isRTL}
        formatCurrency={fc}
        total={po.total_amount}
        paidPreview={paidPreview}
        supplierName={po.supplier_name ?? null}
        payUse={payUse}
        setPayUse={setPayUse}
        payAmounts={payAmounts}
        setPayAmounts={setPayAmounts}
        allowRemaining={allowRemaining}
        setAllowRemaining={setAllowRemaining}
        supplierPersonId={po.person_id}
        note={confirmNote}
        setNote={setConfirmNote}
        canConfirm={canConfirmDraft}
        confirming={confirming}
        onConfirm={handleConfirmDraftSubmit}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('purchaseOrders.cancelConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-start text-muted-foreground">
                <p>
                  {(
                    t as (key: string, opts?: Record<string, number>) => string
                  )(
                    po.status === 'draft'
                      ? 'purchaseOrders.cancelConfirmMessageDraft'
                      : 'purchaseOrders.cancelConfirmMessage',
                    {
                      number: po.order_number,
                    }
                  )}
                </p>
                {showCancelSettlementChoice && (
                  <fieldset className="space-y-3 rounded-md border border-border p-3">
                    <legend className="px-1 text-sm font-medium text-foreground">
                      {t('purchaseOrders.cancelSettlementLegend')}
                    </legend>
                    <div className="flex items-start gap-2">
                      <input
                        id="po-cancel-reverse"
                        type="radio"
                        name="po-cancel-settlement"
                        className="mt-1"
                        checked={cancelSettlement === 'reverse_payments'}
                        onChange={() =>
                          setCancelSettlement('reverse_payments')
                        }
                      />
                      <Label
                        htmlFor="po-cancel-reverse"
                        className="cursor-pointer font-normal leading-snug"
                      >
                        {t('purchaseOrders.cancelSettlementReverse')}
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <input
                        id="po-cancel-retain"
                        type="radio"
                        name="po-cancel-settlement"
                        className="mt-1"
                        checked={
                          cancelSettlement === 'retain_paid_as_wallet_credit'
                        }
                        onChange={() =>
                          setCancelSettlement('retain_paid_as_wallet_credit')
                        }
                      />
                      <Label
                        htmlFor="po-cancel-retain"
                        className="cursor-pointer font-normal leading-snug"
                      >
                        {t('purchaseOrders.cancelSettlementRetain')}
                      </Label>
                    </div>
                  </fieldset>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelSubmitting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelSubmitting}
              onClick={async () => {
                setCancelSubmitting(true)
                try {
                  await cancelPurchaseOrder(
                    po.id,
                    showCancelSettlementChoice
                      ? { settlement: cancelSettlement }
                      : undefined
                  )
                  invalidatePO()
                  setCancelOpen(false)
                  toast.success(t('purchaseOrders.toastCancelled'))
                } catch {
                  toast.error(t('purchaseOrders.toastError'))
                } finally {
                  setCancelSubmitting(false)
                }
              }}
            >
              {cancelSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('purchaseOrders.cancelPurchaseOrder')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
