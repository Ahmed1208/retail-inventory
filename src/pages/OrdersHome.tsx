import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { List, Plus, RotateCcw, Undo2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function OrdersHome() {
  const { t } = useTranslation()
  const hubList = useFeatureEnabled('orders.hubList')
  const hubNew = useFeatureEnabled('orders.hubNew')
  const returnsHubList = useFeatureEnabled('orders.returnsHubList')
  const returnsHubNew = useFeatureEnabled('orders.returnsHubNew')

  const cards = useMemo(
    () =>
      [
        hubList
          ? {
              to: '/orders/list' as const,
              icon: List,
              titleKey: 'orders.allOrders' as const,
              subtitleKey: 'orders.allOrdersSubtitle' as const,
            }
          : null,
        hubNew
          ? {
              to: '/orders/new' as const,
              icon: Plus,
              titleKey: 'orders.newOrder' as const,
              subtitleKey: 'orders.newOrderSubtitle' as const,
            }
          : null,
        returnsHubList
          ? {
              to: '/orders/returns' as const,
              icon: RotateCcw,
              titleKey: 'returns.allReturns' as const,
              subtitleKey: 'returns.allReturnsSubtitle' as const,
            }
          : null,
        returnsHubNew
          ? {
              to: '/orders/returns/new' as const,
              icon: Undo2,
              titleKey: 'returns.newReturn' as const,
              subtitleKey: 'returns.newReturnSubtitle' as const,
            }
          : null,
      ].filter(Boolean) as {
        to: string
        icon: typeof List
        titleKey: string
        subtitleKey: string
      }[],
    [hubList, hubNew, returnsHubList, returnsHubNew]
  )

  useEffect(() => {
    document.title = `${t('orders.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('orders.title')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('orders.subtitle')}
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.noOrderShortcuts')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ to, icon: Icon, titleKey, subtitleKey }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  'flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm',
                  'transition-colors hover:bg-muted/50 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-medium">
                    {t(titleKey)}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm">
                    {t(subtitleKey)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
