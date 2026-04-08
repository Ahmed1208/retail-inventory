import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { getAllPurchaseOrders } from '@/services/purchaseOrderService'
import { getAllPeople } from '@/services/peopleService'
import type { PurchaseOrderStatus } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import {
  POStatusBadge,
  formatPOPaymentSummary,
} from '@/components/purchaseOrders/purchaseOrderShared'

const DEBOUNCE_MS = 300

type StatusFilter = 'all' | PurchaseOrderStatus

export function PurchaseOrdersList() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const fc = (n: number) => formatCurrency(n, lang)

  const hubList = useFeatureEnabled('purchaseOrders.hubList')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  useEffect(() => {
    document.title = `${t('purchaseOrders.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    [debouncedSearch, statusFilter, dateFrom, dateTo]
  )

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchaseOrders', filters],
    queryFn: () => getAllPurchaseOrders(filters),
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  if (!hubList) {
    return (
      <div
        className={cn('flex min-h-0 flex-1 flex-col p-6', isRTL && 'rtl')}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <Link
          to="/purchase-orders"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2 w-fit'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToPurchaseOrders')}
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          {t('control.disabled.purchaseOrdersList')}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', isRTL && 'rtl')}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-background p-3">
        <Link
          to="/purchase-orders"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToPurchaseOrders')}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Input
          placeholder={t('purchaseOrders.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div
          className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
          role="tablist"
        >
          {(
            [
              ['all', 'purchaseOrders.filterStatusAll'],
              ['draft', 'purchaseOrders.filterStatusDraft'],
              ['received', 'purchaseOrders.filterStatusReceived'],
              ['cancelled', 'purchaseOrders.filterStatusCancelled'],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              role="tab"
              onClick={() => setStatusFilter(value as StatusFilter)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === value
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[140px]"
          aria-label={t('purchaseOrders.dateFrom')}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[140px]"
          aria-label={t('purchaseOrders.dateTo')}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={6} columns={1} />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t('purchaseOrders.emptyOrders')}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
            {purchaseOrders.map((po) => {
              const linked: (typeof people)[number] | undefined = po.person_id
                ? people.find((p) => p.id === po.person_id)
                : undefined
              const supplierLabel =
                linked?.name ??
                po.supplier_name ??
                t('purchaseOrders.noLinkedSupplier')
              return (
                <li key={po.id} className="relative">
                  <Link
                    to={`/purchase-orders/${po.id}`}
                    className="block w-full rounded-xl border bg-card p-3 text-start text-sm shadow-sm transition-all hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold tabular-nums">
                        #{t('purchaseOrders.poPrefix')}-{po.order_number}
                      </span>
                      <POStatusBadge status={po.status} t={t} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(po.created_at)}
                    </p>
                    <p className="mt-1 font-medium">{supplierLabel}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        {po.items.length === 1
                          ? t('purchaseOrders.itemCount')
                          : t('purchaseOrders.itemsCount', {
                              count: po.items.length,
                            })}
                      </span>
                      <span>·</span>
                      <span>{formatPOPaymentSummary(po, t, fc)}</span>
                    </div>
                    <div className="mt-2 border-t pt-2 text-xs tabular-nums">
                      <div className="flex justify-between font-semibold">
                        <span>{t('purchaseOrders.totalAmount')}</span>
                        <span>{fc(po.total_amount)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
