import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bell, Check, CheckCheck } from 'lucide-react'

import {
  listStockAlerts,
  countUnreadStockAlerts,
  markStockAlertRead,
  markStockAlertResolved,
  type StockAlertRow,
} from '@/services/stockAlertsService'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

const QK_LIST = ['stockAlerts', 'list'] as const
const QK_UNREAD = ['stockAlerts', 'unread'] as const

function alertTypeLabel(t: (k: string) => string, type: StockAlertRow['alert_type']) {
  const key = `stockAlerts.type_${type}` as const
  const s = t(key)
  return s === key ? type : s
}

export function StockAlertsBell() {
  const { t } = useTranslation()
  const { isRTL } = useLanguage()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: QK_LIST,
    queryFn: () => listStockAlerts(80),
    staleTime: 15_000,
  })

  const { data: unread = 0 } = useQuery({
    queryKey: QK_UNREAD,
    queryFn: countUnreadStockAlerts,
    staleTime: 10_000,
  })

  const readMut = useMutation({
    mutationFn: markStockAlertRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK_LIST })
      void qc.invalidateQueries({ queryKey: QK_UNREAD })
    },
  })

  const resolveMut = useMutation({
    mutationFn: markStockAlertResolved,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK_LIST })
      void qc.invalidateQueries({ queryKey: QK_UNREAD })
    },
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="relative">
        <SheetTrigger asChild>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground inline-flex"
            aria-label={t('stockAlerts.ariaLabel')}
          >
            <Bell className="h-5 w-5" />
          </button>
        </SheetTrigger>
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white pointer-events-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>

      <SheetContent
        side={isRTL ? 'left' : 'right'}
        className="flex w-full max-w-md flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-border px-4 py-3 text-start">
          <SheetTitle>{t('stockAlerts.panelTitle')}</SheetTitle>
          <p className="text-sm text-muted-foreground font-normal">
            <Link
              to="/products?lowStock=1"
              className="underline-offset-2 hover:underline"
              onClick={() => setOpen(false)}
            >
              {t('common.lowStock')}
            </Link>
          </p>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-2 p-3">
            {isLoading && (
              <p className="text-sm text-muted-foreground px-1">{t('common.loading')}</p>
            )}
            {!isLoading && alerts.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">{t('stockAlerts.empty')}</p>
            )}
            {alerts.map((a) => (
              <article
                key={a.id}
                className={cn(
                  'rounded-lg border border-border p-3 text-sm space-y-2',
                  a.resolved_at && 'opacity-60'
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    {alertTypeLabel(t, a.alert_type)}
                  </span>
                  {a.read_at == null && (
                    <span className="text-xs text-amber-700">{t('stockAlerts.unread')}</span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground leading-snug">{a.title}</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{a.message}</p>
                {(a.product_name || a.product_id) && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t('stockAlerts.product')}: </span>
                    {a.product_name ?? a.product_id}
                  </p>
                )}
                {typeof a.meta?.person_id === 'string' && a.meta.person_id && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t('stockAlerts.personRecord')}: </span>
                    {String(a.meta.person_id)}
                  </p>
                )}
                {a.quantity_after != null && (
                  <p className="text-xs tabular-nums">
                    {t('stockAlerts.qtyAfter', { qty: a.quantity_after })}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={a.read_at != null || readMut.isPending}
                    onClick={() => readMut.mutate(a.id)}
                  >
                    <Check className="h-3.5 w-3.5 me-1" aria-hidden />
                    {t('stockAlerts.markRead')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={a.resolved_at != null || resolveMut.isPending}
                    onClick={() => resolveMut.mutate(a.id)}
                  >
                    <CheckCheck className="h-3.5 w-3.5 me-1" aria-hidden />
                    {t('stockAlerts.resolve')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
