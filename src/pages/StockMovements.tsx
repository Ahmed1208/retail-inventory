import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Minus, ArrowLeftRight, List } from 'lucide-react'

import {
  getStockMovements,
  type StockMovementFilters,
} from '@/services/productService'
import type { StockMovementType } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const PER_PAGE = 25
const DEBOUNCE_MS = 300

type TypeFilter = 'all' | StockMovementType

export function StockMovements() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as string
  const hideInventoryBack = pathname.startsWith('/admin/movements')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  useEffect(() => {
    document.title = 'Stock Movements | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  const filters = useMemo((): StockMovementFilters | undefined => {
    const hasFilter =
      debouncedSearch.trim() ||
      typeFilter !== 'all' ||
      dateFrom ||
      dateTo
    if (!hasFilter) return undefined
    return {
      search: debouncedSearch.trim() || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }
  }, [debouncedSearch, typeFilter, dateFrom, dateTo])

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stockMovements', filters],
    queryFn: () => getStockMovements(filters),
  })

  const totalIn = useMemo(
    () =>
      movements
        .filter((m) => m.type === 'in')
        .reduce((sum, m) => sum + m.quantity, 0),
    [movements]
  )
  const totalOut = useMemo(
    () =>
      movements
        .filter((m) => m.type === 'out')
        .reduce((sum, m) => sum + m.quantity, 0),
    [movements]
  )
  const netChange = totalIn - totalOut

  const paginated = useMemo(() => {
    const start = page * PER_PAGE
    return movements.slice(start, start + PER_PAGE)
  }, [movements, page])

  const totalPages = Math.ceil(movements.length / PER_PAGE)
  const from = movements.length === 0 ? 0 : page * PER_PAGE + 1
  const to = Math.min((page + 1) * PER_PAGE, movements.length)
  const hasActiveFilters =
    search.trim() || typeFilter !== 'all' || dateFrom || dateTo

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  }

  return (
    <div className="space-y-4">
      {!hideInventoryBack ? <BackToInventoryLink /> : null}
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('stockMovements.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div
          className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
          role="tablist"
          aria-label={t('stockMovements.type')}
        >
          {(
            [
              ['all', 'stockMovements.filterTypeAll'],
              ['in', 'stockMovements.filterTypeIn'],
              ['out', 'stockMovements.filterTypeOut'],
              ['adjustment', 'stockMovements.filterTypeAdjustment'],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              role="tab"
              onClick={() => {
                setTypeFilter(value as TypeFilter)
                setPage(0)
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                typeFilter === value
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
          onChange={(e) => {
            setDateFrom(e.target.value)
            setPage(0)
          }}
          className="w-[140px]"
          aria-label={t('stockMovements.dateFrom')}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value)
            setPage(0)
          }}
          className="w-[140px]"
          aria-label={t('stockMovements.dateTo')}
        />
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            {t('stockMovements.clearFilters')}
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('stockMovements.totalIn')}
          value={`+${totalIn}`}
          icon={Plus}
          accent="text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          label={t('stockMovements.totalOut')}
          value={`-${totalOut}`}
          icon={Minus}
          accent="text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          label={t('stockMovements.netChange')}
          value={netChange >= 0 ? `+${netChange}` : String(netChange)}
          icon={ArrowLeftRight}
          accent={
            netChange >= 0
              ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
              : 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
          }
        />
        <StatCard
          label={t('stockMovements.totalMovements')}
          value={String(movements.length)}
          icon={List}
          accent="text-muted-foreground bg-muted"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {t('stockMovements.emptyMovementsFiltered')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('stockMovements.dateTime')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('stockMovements.productName')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('stockMovements.brand')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('stockMovements.type')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('stockMovements.quantity')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground max-w-[200px]">
                      {t('stockMovements.note')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('stockMovements.source')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border/50 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(m.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {m.product.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.product.brand?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={m.type} t={t} />
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums font-medium">
                        {m.type === 'in' && '+'}
                        {m.type === 'out' && '-'}
                        {m.type === 'adjustment' && '~'}
                        {m.quantity}
                      </td>
                      <td
                        className="px-4 py-3 text-muted-foreground max-w-[200px] truncate"
                        title={m.note ?? undefined}
                      >
                        {m.note ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t('stockMovements.sourceManual')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {t('stockMovements.pageInfo', {
                    from,
                    to,
                    total: movements.length,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    {t('stockMovements.pagePrev')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                  >
                    {t('stockMovements.pageNext')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className={cn('rounded p-1', accent)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function TypeBadge({
  type,
  t,
}: {
  type: StockMovementType
  t: (key: string) => string
}) {
  const styles = {
    in: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    out: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    adjustment:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        styles[type]
      )}
    >
      {t(`stockMovements.${type}`)}
    </span>
  )
}
