import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import {
  cancelPurchaseOrder,
  getPurchaseOrderById,
} from '@/services/purchaseOrderService'
import type { PurchaseOrderPayment } from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import {
  POStatusBadge,
  paymentLabelPO,
} from '@/components/purchaseOrders/purchaseOrderShared'

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const qc = useQueryClient()
  const fc = (n: number) => formatCurrency(n, lang)

  const canCancelPO = useFeatureEnabled('purchaseOrders.cancel')

  const [cancelOpen, setCancelOpen] = useState(false)

  const {
    data: po,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => getPurchaseOrderById(id!),
    enabled: !!id,
  })

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
    canCancelPO &&
    po.status === 'received'

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
          {canCancel && (
            <div className="ms-auto">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
              >
                {t('purchaseOrders.cancelPurchaseOrder')}
              </Button>
            </div>
          )}
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
            </p>
          )}
          {po.note && (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">
                {t('purchaseOrders.note')}:
              </span>{' '}
              {po.note}
            </p>
          )}
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

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('purchaseOrders.cancelConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(
                t as (key: string, opts?: Record<string, number>) => string
              )('purchaseOrders.cancelConfirmMessage', {
                number: po.order_number,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await cancelPurchaseOrder(po.id)
                  invalidatePO()
                  setCancelOpen(false)
                  toast.success(t('purchaseOrders.toastCancelled'))
                } catch {
                  toast.error(t('purchaseOrders.toastError'))
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('purchaseOrders.cancelPurchaseOrder')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
