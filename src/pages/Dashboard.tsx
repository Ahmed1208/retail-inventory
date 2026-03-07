import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Package,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Truck,
} from 'lucide-react'

import {
  getDashboardStats,
  getRecentMovements,
  getLowStockProducts,
} from '@/services/productService'
import type { StockMovementType } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const REFETCH_INTERVAL_MS = 60_000

function formatRelativeTime(isoString: string, locale: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHours = Math.round(diffMin / 60)
  const diffDays = Math.round(diffHours / 24)

  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    numeric: 'auto',
    style: 'long',
  })

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second')
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day')
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : 'en')
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accent: string
  loading: boolean
}) {
  if (loading) return <StatCardSkeleton />
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn('rounded-lg p-2', accent)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function MovementTypeBadge({
  type,
  label,
}: {
  type: StockMovementType
  label: string
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
      {label}
    </span>
  )
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'

  useEffect(() => {
    document.title = 'Dashboard | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getDashboardStats,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const { data: recentMovements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['recentMovements'],
    queryFn: () => getRecentMovements(10),
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const { data: lowStockProducts = [], isLoading: lowStockLoading } = useQuery({
    queryKey: ['lowStockProducts'],
    queryFn: getLowStockProducts,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const formatCurrencyDisplay = (n: number) => formatCurrency(n, lang)

  const movementTypeKey = (type: StockMovementType) =>
    `stockMovements.${type}` as const

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t('dashboard.totalProducts')}
          value={stats?.totalProducts ?? 0}
          icon={Package}
          accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={statsLoading}
        />
        <StatCard
          label={t('dashboard.totalInventoryValue')}
          value={formatCurrencyDisplay(stats?.totalValue ?? 0)}
          icon={DollarSign}
          accent="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={statsLoading}
        />
        <StatCard
          label={t('dashboard.lowStockAlerts')}
          value={stats?.lowStockCount ?? 0}
          icon={AlertTriangle}
          accent={
            (stats?.lowStockCount ?? 0) > 0
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }
          loading={statsLoading}
        />
        <StatCard
          label={t('dashboard.stockMovementsToday')}
          value={stats?.todayMovements ?? 0}
          icon={TrendingUp}
          accent="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          loading={statsLoading}
        />
        <StatCard
          label={t('dashboard.totalPurchasesToday')}
          value={stats?.totalPurchasesToday ?? 0}
          icon={Truck}
          accent="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={statsLoading}
        />
      </div>

      {/* Two columns: 60% Recent Movements (left), 40% Low Stock (right) */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Left 60%: Recent Movements */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {t('dashboard.recentMovements')}
          </h2>
          {movementsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : recentMovements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('dashboard.emptyMovements')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 text-start font-medium">
                      {t('dashboard.productName')}
                    </th>
                    <th className="pb-3 text-start font-medium">
                      {t('dashboard.type')}
                    </th>
                    <th className="pb-3 text-end font-medium">
                      {t('common.quantity')}
                    </th>
                    <th className="pb-3 text-end font-medium">
                      {t('dashboard.time')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 font-medium text-foreground">
                        {m.product.name}
                      </td>
                      <td className="py-3">
                        <MovementTypeBadge
                          type={m.type}
                          label={t(movementTypeKey(m.type))}
                        />
                      </td>
                      <td className="py-3 text-end tabular-nums">
                        {m.type === 'in' && '+'}
                        {m.type === 'out' && '-'}
                        {m.quantity}
                      </td>
                      <td className="py-3 text-end text-muted-foreground">
                        {formatRelativeTime(m.created_at, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 40%: Low Stock Alerts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {t('dashboard.lowStockAlertsList')}
          </h2>
          {lowStockLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : lowStockProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('dashboard.emptyLowStock')}
            </p>
          ) : (
            <ul className="space-y-4">
              {lowStockProducts.map((p) => {
                const pct = Math.min(
                  100,
                  (p.quantity / p.low_stock_threshold) * 100
                )
                return (
                  <li
                    key={p.id}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {p.name}
                        </p>
                        {p.brand && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {p.brand.name}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        {t('dashboard.currentThreshold', {
                          current: p.quantity,
                          threshold: p.low_stock_threshold,
                        })}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
