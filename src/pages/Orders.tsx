import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { getAllOrders } from '@/services/orderService'
import { getAllPeople } from '@/services/peopleService'
import type { OrderStatusFlow } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import {
  statusBadgeClass,
  statusFlowLabel,
} from '@/components/orders/ordersShared'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

type StatusTab = 'all' | OrderStatusFlow

export function Orders() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const fc = (n: number) => formatCurrency(n, lang)
  const hubList = useFeatureEnabled('orders.hubList')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [statusTab, setStatusTab] = useState<StatusTab>('all')

  useEffect(() => {
    document.title = `${t('orders.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const { data: ordersRaw = [], isLoading: listLoading } = useQuery({
    queryKey: ['orders', 'pos-list', debouncedSearch],
    queryFn: () =>
      getAllOrders(
        debouncedSearch.trim()
          ? { search: debouncedSearch.trim() }
          : undefined
      ),
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const filteredList = useMemo(() => {
    if (statusTab === 'all') return ordersRaw
    return ordersRaw.filter((o) => o.status_flow === statusTab)
  }, [ordersRaw, statusTab])

  const counts = useMemo(() => {
    const c = {
      all: ordersRaw.length,
      draft: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    }
    for (const o of ordersRaw) {
      c[o.status_flow]++
    }
    return c
  }, [ordersRaw])

  if (!hubList) {
    return (
      <div
        className={cn('flex min-h-0 flex-1 flex-col p-6', isRTL && 'rtl')}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <Link
          to="/orders"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2 w-fit')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('orders.backToOrders')}
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          {t('control.disabled.ordersList')}
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
          to="/orders"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('orders.backToOrders')}
        </Link>
      </div>

      <div className="border-b p-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('orders.searchPlaceholder')}
          aria-label={t('common.search')}
        />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b px-2 py-2">
        {(
          [
            ['all', counts.all, 'orders.filterStatusAll'],
            ['draft', counts.draft, 'orders.draft'],
            ['confirmed', counts.confirmed, 'orders.confirmed'],
            ['completed', counts.completed, 'orders.completed'],
            ['cancelled', counts.cancelled, 'orders.cancelled'],
          ] as const
        ).map(([key, count, labelKey]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusTab(key)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusTab === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {t(labelKey)}{' '}
            <span className="tabular-nums opacity-80">({count})</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {listLoading ? (
          <LoadingSkeleton rows={6} columns={1} />
        ) : filteredList.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t('orders.emptyOrders')}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
            {filteredList.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/orders/${o.id}`}
                  className="block w-full rounded-xl border bg-card p-3 text-start text-sm shadow-sm transition-all hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold tabular-nums">
                      #{o.order_number}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        statusBadgeClass(o.status_flow)
                      )}
                    >
                      {statusFlowLabel(o.status_flow, t)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(
                      lang === 'ar' ? 'ar-EG' : 'en-US',
                      { dateStyle: 'medium', timeStyle: 'short' }
                    ).format(new Date(o.created_at))}
                  </p>
                  <p className="mt-1 font-medium">
                    {o.person_id
                      ? people.find((p) => p.id === o.person_id)?.name ??
                        t('orders.customer')
                      : t('orders.walkIn')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5',
                        o.type === 'retail'
                          ? 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100'
                          : 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100'
                      )}
                    >
                      {o.type === 'retail'
                        ? t('orders.typeRetail')
                        : t('orders.typeWholesale')}
                    </span>
                    <span className="text-muted-foreground">
                      {o.items.length === 1
                        ? t('orders.itemCount')
                        : t('orders.itemsCount', { count: o.items.length })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-0.5 border-t pt-2 text-xs tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('orders.subtotal')}
                      </span>
                      <span>{fc(o.subtotal)}</span>
                    </div>
                    {o.discount_amount > 0.005 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>
                          {t('orders.discount')} ({o.discount_rate}%)
                        </span>
                        <span>−{fc(o.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <span>{t('orders.totalAmount')}</span>
                      <span>{fc(o.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>{t('orders.paid')}</span>
                      <span>{fc(o.paid_amount)}</span>
                    </div>
                    <div
                      className={cn(
                        'flex justify-between',
                        o.remaining_amount > 0.01 &&
                          'font-medium text-destructive'
                      )}
                    >
                      <span>{t('orders.remaining')}</span>
                      <span>{fc(o.remaining_amount)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
