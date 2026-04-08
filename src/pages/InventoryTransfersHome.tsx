import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { List, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'

export function InventoryTransfersHome() {
  const { t } = useTranslation()
  const hubList = useFeatureEnabled('inventoryTransfers.list')
  const canCreate = useFeatureEnabled('inventoryTransfers.create')

  const cards = useMemo(
    () =>
      [
        hubList
          ? {
              to: '/inventory-transfers/list' as const,
              icon: List,
              titleKey: 'inventoryTransfers.allTransfers' as const,
              subtitleKey: 'inventoryTransfers.allTransfersSubtitle' as const,
            }
          : null,
        canCreate
          ? {
              to: '/inventory-transfers/new' as const,
              icon: Plus,
              titleKey: 'inventoryTransfers.newTransfer' as const,
              subtitleKey: 'inventoryTransfers.newTransferSubtitle' as const,
            }
          : null,
      ].filter(Boolean) as {
        to: '/inventory-transfers/list' | '/inventory-transfers/new'
        icon: typeof List
        titleKey: string
        subtitleKey: string
      }[],
    [hubList, canCreate]
  )

  useEffect(() => {
    document.title = `${t('inventoryTransfers.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <BackToInventoryLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('inventoryTransfers.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inventoryTransfers.subtitle')}
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.noInventoryTransferShortcuts')}
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
                  <span className="block font-medium">{t(titleKey)}</span>
                  <span className="text-muted-foreground mt-0.5 block text-sm">
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
