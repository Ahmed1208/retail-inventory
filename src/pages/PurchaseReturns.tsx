import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileDown, FileUp } from 'lucide-react'

import { getAllPeople } from '@/services/peopleService'
import {
  getAllPurchaseReturns,
  getSourcePurchaseOrderNumbers,
} from '@/services/purchaseReturnService'
import { listWarehouses } from '@/services/warehouseService'
import type { PurchaseReturnStatusFlow } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useMigrationImportDialog } from '@/hooks/useMigrationImportDialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import {
  settlementLabel,
  statusBadgeClass,
  statusFlowLabel,
} from '@/components/purchaseReturns/purchaseReturnsShared'
import { PurchaseReturnCsvImportDialog } from '@/components/purchaseReturns/PurchaseReturnCsvImportDialog'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { downloadCsv } from '@/utils/csvDownload'
import { flattenPurchaseReturnsForCsvExport } from '@/utils/purchaseReturnCsvImport'

type StatusTab = 'all' | PurchaseReturnStatusFlow

export function PurchaseReturns() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const fc = (n: number) => formatCurrency(n, lang)

  const hubList = useFeatureEnabled('purchaseOrders.returnsHubList')
  const canImportCsv = useFeatureEnabled('purchaseOrders.returnImportCsv')
  const canExportCsv = useFeatureEnabled('purchaseOrders.returnExportCsv')

  const [importCsvOpen, setImportCsvOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [statusTab, setStatusTab] = useState<StatusTab>('all')

  useMigrationImportDialog(setImportCsvOpen, true, hubList && canImportCsv)

  useEffect(() => {
    document.title = `${t('purchaseReturns.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const { data: returnsRaw = [], isLoading: listLoading } = useQuery({
    queryKey: ['purchaseReturns', 'list', debouncedSearch],
    queryFn: () =>
      getAllPurchaseReturns({ search: debouncedSearch.trim() || undefined }),
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => listWarehouses(),
  })

  const sourceOrderIds = useMemo(
    () => returnsRaw.map((r) => r.source_purchase_order_id),
    [returnsRaw]
  )

  const { data: sourceNumbers } = useQuery({
    queryKey: ['purchaseReturnSourceOrderNumbers', sourceOrderIds],
    queryFn: () => getSourcePurchaseOrderNumbers(sourceOrderIds),
    enabled: sourceOrderIds.length > 0,
  })

  const filteredList = useMemo(() => {
    if (statusTab === 'all') return returnsRaw
    return returnsRaw.filter((r) => r.status_flow === statusTab)
  }, [returnsRaw, statusTab])

  const counts = useMemo(() => {
    const c = {
      all: returnsRaw.length,
      draft: 0,
      confirmed: 0,
      cancelled: 0,
    }
    for (const r of returnsRaw) c[r.status_flow]++
    return c
  }, [returnsRaw])

  const exportReturnsCsv = useCallback(() => {
    const rows = flattenPurchaseReturnsForCsvExport(filteredList, {
      warehouseById: new Map(warehouses.map((w) => [w.id, w])),
      personById: new Map(people.map((p) => [p.id, p])),
      orderNumberById: sourceNumbers ?? new Map(),
    })
    downloadCsv(
      `purchase-returns-export-${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    )
  }, [filteredList, people, warehouses, sourceNumbers])

  const onCsvImportComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['purchaseReturns'] })
    void queryClient.invalidateQueries({
      queryKey: ['returnablePurchaseLines'],
    })
  }, [queryClient])

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
            'w-fit gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToPurchaseOrders')}
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          {t('control.disabled.purchaseReturnsList')}
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

      <div className="border-b p-3">
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('common.search')}
          </Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('purchaseReturns.searchPlaceholder')}
            aria-label={t('common.search')}
          />
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
              onClick={exportReturnsCsv}
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
              {t('purchaseReturns.importCsv.button')}
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b px-2 py-2">
        {(
          [
            ['all', counts.all, 'orders.filterStatusAll'],
            ['draft', counts.draft, 'purchaseReturns.draft'],
            ['confirmed', counts.confirmed, 'purchaseReturns.confirmed'],
            ['cancelled', counts.cancelled, 'purchaseReturns.cancelled'],
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
            {t('purchaseReturns.emptyReturns')}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
            {filteredList.map((r) => {
              const orderNumber = sourceNumbers?.get(
                r.source_purchase_order_id
              )
              return (
                <li key={r.id}>
                  <Link
                    to={`/purchase-orders/returns/${r.id}`}
                    className="block w-full rounded-xl border bg-card p-3 text-start text-sm shadow-sm transition-all hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold tabular-nums">
                        PR-{r.return_number}
                      </span>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {r.is_historical_snapshot ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                            {t('orders.historicalImportBadge')}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            statusBadgeClass(r.status_flow)
                          )}
                        >
                          {statusFlowLabel(r.status_flow, t)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(
                        lang === 'ar' ? 'ar-EG' : 'en-US',
                        { dateStyle: 'medium', timeStyle: 'short' }
                      ).format(new Date(r.created_at))}
                    </p>
                    <p className="mt-1 font-medium">
                      {r.person_id
                        ? (people.find((p) => p.id === r.person_id)?.name ??
                          t('purchaseOrders.noLinkedSupplier'))
                        : t('purchaseOrders.noLinkedSupplier')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {orderNumber != null && (
                        <span>
                          {t('purchaseReturns.againstOrder')} #{orderNumber}
                        </span>
                      )}
                      <span>
                        {r.items.length === 1
                          ? t('orders.itemCount')
                          : t('orders.itemsCount', { count: r.items.length })}
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5 border-t pt-2 text-xs tabular-nums">
                      <div className="flex justify-between font-semibold">
                        <span>{t('purchaseReturns.refundAmount')}</span>
                        <span>{fc(r.total_amount)}</span>
                      </div>
                      {r.settlement && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t('purchaseReturns.settlementLabel')}</span>
                          <span>{settlementLabel(r.settlement, t)}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {canImportCsv && (
        <PurchaseReturnCsvImportDialog
          open={importCsvOpen}
          onOpenChange={setImportCsvOpen}
          isRTL={isRTL}
          onImported={onCsvImportComplete}
        />
      )}
    </div>
  )
}
