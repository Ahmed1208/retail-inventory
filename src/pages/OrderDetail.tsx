import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import {
  cancelOrder,
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

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
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
  const canEditDraftPos = useFeatureEnabled('orders.editDraftPos')
  const canPrintInvoice = useFeatureEnabled('orders.printInvoice')
  const canCancelOrder = useFeatureEnabled('orders.cancelOrder')
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
  const showCancelSettlementChoice =
    !!order?.person_id && paidAtOrder > 0.01

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
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateOrderNote(id, text),
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

  const handlePrint = (o: OrderWithItemsAndPayments) => {
    setPrintOrder(o)
    setPrintTrigger((n) => n + 1)
  }

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

      <div className="flex items-center gap-2 border-b bg-background px-2 py-2">
        <Link
          to="/orders"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('orders.backToOrders')}
        </Link>
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
                {showCancelSettlementChoice && (
                  <fieldset className="space-y-3 rounded-md border border-border p-3">
                    <legend className="px-1 text-sm font-medium text-foreground">
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
