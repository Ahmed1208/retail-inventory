import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMigrationImportDialog } from '@/hooks/useMigrationImportDialog'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileDown, FileUp } from 'lucide-react'

import { getAllBrands } from '@/services/brandService'
import { getAllCategories } from '@/services/categoryService'
import { getAllOrders } from '@/services/orderService'
import { getAllPeople } from '@/services/peopleService'
import { getAllProducts } from '@/services/productService'
import { listWarehouses } from '@/services/warehouseService'
import type { OrderStatusFlow } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import {
  statusBadgeClass,
  statusFlowLabel,
} from '@/components/orders/ordersShared'
import { OrderCsvImportDialog } from '@/components/orders/OrderCsvImportDialog'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { downloadCsv } from '@/utils/csvDownload'
import { flattenOrdersForCsvExport } from '@/utils/orderCsvImport'

type StatusTab = 'all' | OrderStatusFlow

type HistoricalListFilter = 'all' | 'only' | 'exclude'

export function Orders() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const fc = (n: number) => formatCurrency(n, lang)
  const hubList = useFeatureEnabled('orders.hubList')
  const canImportCsv = useFeatureEnabled('orders.importCsv')
  const canExportCsv = useFeatureEnabled('orders.exportCsv')
  const [importCsvOpen, setImportCsvOpen] = useState(false)

  useMigrationImportDialog(
    setImportCsvOpen,
    true,
    hubList && canImportCsv
  )

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [historicalListFilter, setHistoricalListFilter] =
    useState<HistoricalListFilter>('all')

  useEffect(() => {
    document.title = `${t('orders.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  /** Historical imports are always completed; other status tabs would show an empty list. */
  useEffect(() => {
    if (
      historicalListFilter === 'only' &&
      statusTab !== 'all' &&
      statusTab !== 'completed'
    ) {
      setStatusTab('all')
    }
  }, [historicalListFilter, statusTab])

  const onStatusTabClick = useCallback(
    (tab: StatusTab) => {
      if (
        tab !== 'all' &&
        historicalListFilter === 'only' &&
        tab !== 'completed'
      ) {
        setHistoricalListFilter('all')
      }
      setStatusTab(tab)
    },
    [historicalListFilter]
  )

  const { data: ordersRaw = [], isLoading: listLoading } = useQuery({
    queryKey: ['orders', 'pos-list', debouncedSearch, historicalListFilter],
    queryFn: () =>
      getAllOrders({
        search: debouncedSearch.trim() || undefined,
        historical_snapshot:
          historicalListFilter === 'all' ? undefined : historicalListFilter,
      }),
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => listWarehouses(),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => getAllProducts(),
  })

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => getAllBrands(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getAllCategories(),
  })

  const onCsvImportComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: ['people'] })
    void queryClient.invalidateQueries({ queryKey: ['brands'] })
    void queryClient.invalidateQueries({ queryKey: ['categories'] })
  }, [queryClient])

  const filteredList = useMemo(() => {
    if (statusTab === 'all') return ordersRaw
    return ordersRaw.filter((o) => o.status_flow === statusTab)
  }, [ordersRaw, statusTab])

  const exportOrdersCsv = useCallback(() => {
    const whMap = new Map(warehouses.map((w) => [w.id, w]))
    const personMap = new Map(people.map((p) => [p.id, p]))
    const rows = flattenOrdersForCsvExport(filteredList, {
      warehouseById: whMap,
      personById: personMap,
    })
    downloadCsv(`orders-export-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }, [filteredList, people, warehouses])

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
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('common.search')}
          </Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}
            aria-label={t('common.search')}
          />
        </div>
      </div>

      <div
        className="border-b px-3 py-2"
        role="group"
        aria-label={t('orders.historicalFilterLabel')}
      >
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t('orders.historicalFilterLabel')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'orders.historicalFilterAll'],
              ['exclude', 'orders.historicalFilterExclude'],
              ['only', 'orders.historicalFilterOnly'],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setHistoricalListFilter(value as HistoricalListFilter)
              }
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                historicalListFilter === value
                  ? value === 'only'
                    ? 'bg-amber-500 text-white dark:bg-amber-600'
                    : 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {(canImportCsv || canExportCsv) && (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          {canExportCsv && filteredList.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              title={t('orders.exportCsvHint')}
              onClick={exportOrdersCsv}
            >
              <FileDown className="h-4 w-4 shrink-0" aria-hidden />
              {t('common.exportCsv')}
            </Button>
          )}
          {canImportCsv && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setImportCsvOpen(true)}
            >
              <FileUp className="h-4 w-4 shrink-0" aria-hidden />
              {t('orders.importCsv.button')}
            </Button>
          )}
        </div>
      )}

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
            onClick={() => onStatusTabClick(key)}
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
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {o.is_historical_snapshot ? (
                        <span
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-950 dark:bg-amber-900/50 dark:text-amber-100"
                          title={t('orders.historicalImportBadge')}
                        >
                          {t('orders.historicalImportBadge')}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          statusBadgeClass(o.status_flow)
                        )}
                      >
                        {statusFlowLabel(o.status_flow, t)}
                      </span>
                    </div>
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

      {canImportCsv && (
        <OrderCsvImportDialog
          open={importCsvOpen}
          onOpenChange={setImportCsvOpen}
          warehouses={warehouses}
          people={people}
          products={products}
          initialBrands={brands}
          initialCategories={categories}
          onComplete={onCsvImportComplete}
          isRTL={isRTL}
        />
      )}
    </div>
  )
}
