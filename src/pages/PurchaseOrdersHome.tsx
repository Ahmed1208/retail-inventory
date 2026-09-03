import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { List, Plus, RotateCcw, Undo2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'

export function PurchaseOrdersHome() {
  const { t } = useTranslation()
  const hubList = useFeatureEnabled('purchaseOrders.hubList')
  const canCreate = useFeatureEnabled('purchaseOrders.create')
  const returnsHubList = useFeatureEnabled('purchaseOrders.returnsHubList')
  const returnsHubNew = useFeatureEnabled('purchaseOrders.returnsHubNew')

  const cards = useMemo(
    () =>
      [
        hubList
          ? {
              to: '/purchase-orders/list' as const,
              icon: List,
              titleKey: 'purchaseOrders.allPurchaseOrders' as const,
              subtitleKey: 'purchaseOrders.allPurchaseOrdersSubtitle' as const,
            }
          : null,
        canCreate
          ? {
              to: '/purchase-orders/new' as const,
              icon: Plus,
              titleKey: 'purchaseOrders.newPurchaseOrder' as const,
              subtitleKey: 'purchaseOrders.newPurchaseOrderSubtitle' as const,
            }
          : null,
        returnsHubList
          ? {
              to: '/purchase-orders/returns' as const,
              icon: RotateCcw,
              titleKey: 'purchaseReturns.allReturns' as const,
              subtitleKey: 'purchaseReturns.allReturnsSubtitle' as const,
            }
          : null,
        returnsHubNew
          ? {
              to: '/purchase-orders/returns/new' as const,
              icon: Undo2,
              titleKey: 'purchaseReturns.newReturn' as const,
              subtitleKey: 'purchaseReturns.newReturnSubtitle' as const,
            }
          : null,
      ].filter(Boolean) as {
        to: string
        icon: typeof List
        titleKey: string
        subtitleKey: string
      }[],
    [hubList, canCreate, returnsHubList, returnsHubNew]
  )

  useEffect(() => {
    document.title = `${t('purchaseOrders.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <BackToInventoryLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('purchaseOrders.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('purchaseOrders.subtitle')}
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.noPurchaseOrderShortcuts')}
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
                  <span className="mt-1 block text-sm text-muted-foreground">
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
