import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import {
  cancelOrder,
  cloneOrderAsReplacementDraft,
  type CancelOrderSettlement,
  getOrderById,
  updateOrderNote,
} from '@/services/orderService'
import {
  getAllPeople,
  getLedgerPaymentOperationRouteIdForOrder,
  roundMoney,
} from '@/services/peopleService'
import { listWarehouses } from '@/services/warehouseService'
import { fetchRegisterIdsForOrderPayments } from '@/services/paymentRegisterDisplayService'
import type { OrderWithItemsAndPayments } from '@/types'
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
import { PrintInvoice } from '@/components/orders/PrintInvoice'
import { PosOrderForm } from '@/components/orders/PosOrderForm'
import { OrderDetailReadOnly } from '@/components/orders/OrderDetailReadOnly'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { useNoteFocusFromSearchParams } from '@/hooks/useNoteFocusFromSearchParams'

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const qc = useQueryClient()
  const fc = (n: number) => formatCurrency(n, lang)

  const [printTrigger, setPrintTrigger] = useState(0)
  const [printOrder, setPrintOrder] =
    useState<OrderWithItemsAndPayments | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelSettlement, setCancelSettlement] =
    useState<CancelOrderSettlement>('reverse_payments')
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneSettlement, setCloneSettlement] =
    useState<CancelOrderSettlement>('reverse_payments')
  const canEditDraftPos = useFeatureEnabled('orders.editDraftPos')
  const canPrintInvoice = useFeatureEnabled('orders.printInvoice')
  const canCancelOrder = useFeatureEnabled('orders.cancelOrder')
  const canCloneOrder = useFeatureEnabled('orders.cloneAsReplacementDraft')
  const canEditNote = useFeatureEnabled('orders.editNote')
  const canListPayments = useFeatureEnabled('payments.list')

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrderById(id!),
    enabled: !!id,
  })

  const showOrderPaymentOpLink =
    !!order &&
    (order.status_flow === 'confirmed' ||
      order.status_flow === 'completed') &&
    !!order.person_id &&
    order.payment_installments.length > 0 &&
    canListPayments

  const { data: orderPaymentOpRouteId, isFetching: orderPayOpFetching } =
    useQuery({
      queryKey: ['orderLedgerPaymentOpRoute', order?.id],
      queryFn: () => getLedgerPaymentOperationRouteIdForOrder(order!.id),
      enabled: showOrderPaymentOpLink,
    })

  const paidAtOrder = order ? roundMoney(order.paid_amount) : 0
  const hasRecordedOrderPayments =
    !!order &&
    (paidAtOrder > 0.01 ||
      (order.payment_installments ?? []).some(
        (i) => roundMoney(i.amount) > 0.01
      ) ||
      (order.payments ?? []).some((p) => roundMoney(p.amount) > 0.01))
  const showCancelSettlementChoice =
    !!order?.person_id &&
    hasRecordedOrderPayments &&
    (order.status_flow === 'confirmed' || order.status_flow === 'completed')
  const showWalkInPaymentCancelHint =
    !!order &&
    !order.person_id &&
    hasRecordedOrderPayments &&
    (order.status_flow === 'confirmed' || order.status_flow === 'completed')

  const { data: orderPaymentRegisterIds, isFetching: orderPayRegFetching } =
    useQuery({
      queryKey: [
        'orderPaymentRegisters',
        order?.id,
        order?.payment_installments?.length ?? 0,
      ],
      queryFn: () =>
        fetchRegisterIdsForOrderPayments(
          order!.id,
          order!.payment_installments,
        ),
      enabled:
        !!order && (order.payment_installments?.length ?? 0) > 0,
    })

  const showCloneOrderButton = Boolean(
    order &&
      canCloneOrder &&
      !order.is_historical_snapshot &&
      order.status_flow !== 'cancelled' &&
      order.items.length > 0
  )

  useEffect(() => {
    if (order) {
      document.title = `${t('orders.orderDetailTitle', { number: order.order_number })} | StockPilot`
    } else {
      document.title = `${t('orders.title')} | StockPilot`
    }
    return () => {
      document.title = 'StockPilot'
    }
  }, [order, t])

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['order'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
  }

  const noteMut = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      await updateOrderNote(id, text)
      const num = order?.order_number
      await createAdminMentionNotificationIfNeeded({
        noteText: text,
        title: t('notifications.mentionTitleOrderNote', {
          number: num != null ? String(num) : id.slice(0, 8),
        }),
        redirectBasePath: `/orders/${id}`,
        sourceType: 'order_note',
        sourceEntityId: id,
      })
    },
    onSuccess: () => invalidateAll(),
  })

  const cancelMut = useMutation({
    mutationFn: (p: {
      oid: string
      settlement?: CancelOrderSettlement
    }) =>
      cancelOrder(
        p.oid,
        p.settlement ? { settlement: p.settlement } : undefined
      ),
    onSuccess: () => {
      invalidateAll()
      setCancelOpen(false)
      toast.success(t('orders.toastOrderCancelled'))
    },
    onError: (e: Error) =>
      toast.error(e.message || t('orders.toastError')),
  })

  const cloneMut = useMutation({
    mutationFn: (p: {
      oid: string
      settlement?: CancelOrderSettlement
    }) =>
      cloneOrderAsReplacementDraft(
        p.oid,
        p.settlement ? { settlement: p.settlement } : undefined
      ),
    onSuccess: (newOrder) => {
      invalidateAll()
      setCloneOpen(false)
      toast.success(t('orders.toastClonedAsDraft'))
      navigate(`/orders/${newOrder.id}`)
    },
    onError: (e: Error) =>
      toast.error(e.message || t('orders.cloneError')),
  })

  const handlePrint = (o: OrderWithItemsAndPayments) => {
    setPrintOrder(o)
    setPrintTrigger((n) => n + 1)
  }

  useNoteFocusFromSearchParams(
    order && order.status_flow !== 'draft'
      ? `order-note-${order.id}`
      : null
  )

  if (!id) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <Link
          to="/orders/list"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('orders.backToOrders')}
        </Link>
        <p className="mt-4 text-muted-foreground">{t('common.noResults')}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-10rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <PrintInvoice
        order={printOrder}
        printTrigger={printTrigger}
        personName={
          printOrder?.person_id
            ? people.find((c) => c.id === printOrder.person_id)?.name ?? null
            : null
        }
        personPhone={
          printOrder?.person_id
            ? people.find((c) => c.id === printOrder.person_id)?.phone ?? null
            : null
        }
        lang={lang}
        isRTL={isRTL}
        onPrinted={() => {}}
      />

      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-2 py-2">
        <Link
          to="/orders"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('orders.backToOrders')}
        </Link>
        {showCloneOrderButton ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCloneSettlement('reverse_payments')
              setCloneOpen(true)
            }}
          >
            {t('orders.editAsReplacement')}
          </Button>
        ) : null}
      </div>

      {order.status_flow === 'draft' ? (
        canEditDraftPos ? (
          <PosOrderForm
            key={order.id}
            draftOrderId={order.id}
            initialDraft={order}
            isLoadingDraft={false}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {t('control.disabled.editDraft')}
          </div>
        )
      ) : (
        <OrderDetailReadOnly
          order={order}
          t={t}
          lang={lang}
          fc={fc}
          people={people}
          canPrint={canPrintInvoice}
          canCancel={canCancelOrder && !order.is_historical_snapshot}
          canEditNote={canEditNote && !order.is_historical_snapshot}
          paymentOperationLinkSlot={
            showOrderPaymentOpLink ? (
              orderPayOpFetching ? (
                <Loader2 className="inline h-4 w-4 animate-spin align-middle" />
              ) : orderPaymentOpRouteId ? (
                <Link
                  to={`/payments/operations/${orderPaymentOpRouteId}`}
                  className={cn(
                    buttonVariants({ variant: 'link' }),
                    'h-auto p-0 align-baseline font-medium text-primary'
                  )}
                >
                  {t('orders.openPaymentOperation')}
                </Link>
              ) : (
                '—'
              )
            ) : undefined
          }
          onPrint={() => handlePrint(order)}
          onCancel={() => {
            setCancelSettlement('reverse_payments')
            setCancelOpen(true)
          }}
          noteMut={{
            mutateAsync: (p) => noteMut.mutateAsync(p),
            isPending: noteMut.isPending,
          }}
          warehouses={warehouses}
          paymentRegisterIds={orderPaymentRegisterIds}
          paymentRegistersLoading={orderPayRegFetching}
        />
      )}

      <AlertDialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.cloneConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-start text-muted-foreground">
                <p>
                  {t('orders.cloneConfirmIntro', {
                    number: order.order_number,
                  })}
                </p>
                {showWalkInPaymentCancelHint && (
                  <p className="text-sm text-foreground">
                    {t('orders.cancelWalkInPaymentsHint')}
                  </p>
                )}
                {showCancelSettlementChoice && (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <p className="text-sm text-foreground">
                      {t('orders.cancelSettlementIntro')}
                    </p>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-foreground">
                        {t('orders.cancelSettlementLegend')}
                      </legend>
                      <div className="flex items-start gap-2">
                        <input
                          id="order-clone-reverse"
                          type="radio"
                          name="order-clone-settlement"
                          className="mt-1"
                          checked={cloneSettlement === 'reverse_payments'}
                          onChange={() =>
                            setCloneSettlement('reverse_payments')
                          }
                        />
                        <Label
                          htmlFor="order-clone-reverse"
                          className="cursor-pointer font-normal leading-snug"
                        >
                          {t('orders.cancelSettlementReverse')}
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <input
                          id="order-clone-retain"
                          type="radio"
                          name="order-clone-settlement"
                          className="mt-1"
                          checked={
                            cloneSettlement === 'retain_paid_as_wallet_credit'
                          }
                          onChange={() =>
                            setCloneSettlement('retain_paid_as_wallet_credit')
                          }
                        />
                        <Label
                          htmlFor="order-clone-retain"
                          className="cursor-pointer font-normal leading-snug"
                        >
                          {t('orders.cancelSettlementRetain')}
                        </Label>
                      </div>
                    </fieldset>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cloneMut.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={cloneMut.isPending}
              onClick={() =>
                cloneMut.mutate({
                  oid: order.id,
                  settlement: showCancelSettlementChoice
                    ? cloneSettlement
                    : undefined,
                })
              }
            >
              {cloneMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('orders.cloneConfirmAction')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-start text-muted-foreground">
                <p>
                  {t('orders.cancelConfirmMessage', {
                    number: order.order_number,
                  })}
                </p>
                {order.status_flow === 'completed' && (
                  <p>{t('orders.cancelCompletedOrderHint')}</p>
                )}
                {showWalkInPaymentCancelHint && (
                  <p className="text-sm text-foreground">{t('orders.cancelWalkInPaymentsHint')}</p>
                )}
                {showCancelSettlementChoice && (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <p className="text-sm text-foreground">
                      {t('orders.cancelSettlementIntro')}
                    </p>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-foreground">
                        {t('orders.cancelSettlementLegend')}
                      </legend>
                    <div className="flex items-start gap-2">
                      <input
                        id="order-cancel-reverse"
                        type="radio"
                        name="order-cancel-settlement"
                        className="mt-1"
                        checked={cancelSettlement === 'reverse_payments'}
                        onChange={() =>
                          setCancelSettlement('reverse_payments')
                        }
                      />
                      <Label
                        htmlFor="order-cancel-reverse"
                        className="cursor-pointer font-normal leading-snug"
                      >
                        {t('orders.cancelSettlementReverse')}
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <input
                        id="order-cancel-retain"
                        type="radio"
                        name="order-cancel-settlement"
                        className="mt-1"
                        checked={
                          cancelSettlement === 'retain_paid_as_wallet_credit'
                        }
                        onChange={() =>
                          setCancelSettlement('retain_paid_as_wallet_credit')
                        }
                      />
                      <Label
                        htmlFor="order-cancel-retain"
                        className="cursor-pointer font-normal leading-snug"
                      >
                        {t('orders.cancelSettlementRetain')}
                      </Label>
                    </div>
                    </fieldset>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMut.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelMut.isPending}
              onClick={() =>
                cancelMut.mutate({
                  oid: order.id,
                  settlement: showCancelSettlementChoice
                    ? cancelSettlement
                    : undefined,
                })
              }
            >
              {cancelMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('orders.cancelOrder')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
