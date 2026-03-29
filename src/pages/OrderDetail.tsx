import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import {
  addPaymentInstallment,
  cancelOrder,
  getOrderById,
  updateOrderNote,
} from '@/services/orderService'
import { getAllPeople, roundMoney } from '@/services/peopleService'
import type { OrderWithItemsAndPayments, PaymentMethod } from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { PrintInvoice } from '@/components/orders/PrintInvoice'
import { PosOrderForm } from '@/components/orders/PosOrderForm'
import { OrderDetailReadOnly } from '@/components/orders/OrderDetailReadOnly'
import {
  PAYMENT_METHODS,
  paymentLabel,
} from '@/components/orders/ordersShared'
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
  const [payOpen, setPayOpen] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')

  const canEditDraftPos = useFeatureEnabled('orders.editDraftPos')
  const canPrintInvoice = useFeatureEnabled('orders.printInvoice')
  const canCancelOrder = useFeatureEnabled('orders.cancelOrder')
  const canAddPaymentFc = useFeatureEnabled('orders.addPayment')
  const canEditNote = useFeatureEnabled('orders.editNote')

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
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
  }

  const noteMut = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateOrderNote(id, text),
    onSuccess: () => invalidateAll(),
  })

  const cancelMut = useMutation({
    mutationFn: (oid: string) => cancelOrder(oid),
    onSuccess: () => {
      invalidateAll()
      setCancelOpen(false)
      toast.success(t('orders.toastOrderCancelled'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const payMut = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('no order')
      const amt = roundMoney(parseFloat(payAmount) || 0)
      if (amt < 0.01) throw new Error(t('orders.paymentAmount'))
      return addPaymentInstallment({
        order_id: id,
        method: payMethod,
        amount: amt,
        note: payNote || undefined,
      })
    },
    onSuccess: () => {
      invalidateAll()
      setPayOpen(false)
      setPayAmount('')
      setPayNote('')
      toast.success(t('orders.addPayment'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
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
          canCancel={canCancelOrder}
          canAddPayment={canAddPaymentFc}
          canEditNote={canEditNote}
          onPrint={() => handlePrint(order)}
          onCancel={() => setCancelOpen(true)}
          onAddPayment={() => setPayOpen(true)}
          noteMut={{
            mutate: (p) => noteMut.mutate(p),
            isPending: noteMut.isPending,
          }}
        />
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('orders.cancelConfirmMessage', {
                number: order.order_number,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMut.mutate(order.id)}>
              {t('orders.cancelOrder')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('orders.addPayment')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>{t('orders.paymentMethod')}</Label>
              <Select
                value={payMethod}
                onValueChange={(v) => setPayMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {paymentLabel(m, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('orders.paymentAmount')}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('orders.noteOptional')}</Label>
              <Input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPayOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => payMut.mutate()}
              disabled={payMut.isPending}
            >
              {payMut.isPending && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {t('orders.addPayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
