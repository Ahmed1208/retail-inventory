import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { cn } from '@/lib/utils'

type DocAreaKey =
  | 'nav'
  | 'header'
  | 'dashboard'
  | 'inventoryHub'
  | 'warehouses'
  | 'products'
  | 'categories'
  | 'brands'
  | 'movements'
  | 'inventoryTransfers'
  | 'purchaseOrders'
  | 'orders'
  | 'people'
  | 'payments'
  | 'register'
  | 'reports'
  | 'notes'
  | 'adminHub'
  | 'stockAlerts'
  | 'security'

const MAP_GROUPS: { id: string; titleKey: string; areaKeys: DocAreaKey[] }[] =
  [
    {
      id: 'platform',
      titleKey: 'documentation.mapGroups.platform',
      areaKeys: ['nav', 'header', 'dashboard'],
    },
    {
      id: 'catalog',
      titleKey: 'documentation.mapGroups.catalog',
      areaKeys: [
        'inventoryHub',
        'warehouses',
        'products',
        'categories',
        'brands',
        'movements',
        'inventoryTransfers',
      ],
    },
    {
      id: 'commerce',
      titleKey: 'documentation.mapGroups.commerce',
      areaKeys: ['purchaseOrders', 'orders'],
    },
    {
      id: 'money',
      titleKey: 'documentation.mapGroups.money',
      areaKeys: ['people', 'payments', 'register'],
    },
    {
      id: 'insights',
      titleKey: 'documentation.mapGroups.insights',
      areaKeys: ['reports', 'notes'],
    },
    {
      id: 'admin',
      titleKey: 'documentation.mapGroups.admin',
      areaKeys: ['adminHub', 'stockAlerts'],
    },
    {
      id: 'governance',
      titleKey: 'documentation.mapGroups.security',
      areaKeys: ['security'],
    },
  ]

const summaryClass =
  'flex cursor-pointer list-none items-center justify-between gap-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function Documentation() {
  const { t } = useTranslation()
  const canView = useFeatureEnabled('sidebar.documentation')
  const canAdmin = useFeatureEnabled('sidebar.admin')
  const showMigrationGuide = useFeatureEnabled('admin.migrationGuide')
  const showDataSync = useFeatureEnabled('admin.dataSync')

  useEffect(() => {
    document.title = t('documentation.pageTitle')
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  if (!canView) return <Navigate to="/admin/dashboard" replace />

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('documentation.title')}
      </h1>

      {canAdmin && showMigrationGuide && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed">
          <span className="text-muted-foreground">
            {t('migrationGuide.documentationCallout')}{' '}
          </span>
          <Link
            to="/admin/migration"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('migrationGuide.documentationLink')}
          </Link>
        </div>
      )}

      {canAdmin && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed space-y-3">
          <p className="text-muted-foreground">
            <span>{t('documentation.adminCalloutPrefix')}</span>{' '}
            {showMigrationGuide ? (
              <>
                <Link
                  to="/admin/migration"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('documentation.adminCalloutMigration')}
                </Link>
                {' · '}
              </>
            ) : null}
            <Link
              to="/control"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('documentation.adminCalloutControl')}
            </Link>
            {' · '}
            <Link
              to="/admin/members"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('documentation.adminCalloutMembers')}
            </Link>
            {showDataSync ? (
              <>
                {' · '}
                <Link
                  to="/sync"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('documentation.adminCalloutSync')}
                </Link>
              </>
            ) : null}
            {t('documentation.adminCalloutSuffix')}
          </p>
          <p>
            <span className="text-muted-foreground">
              {t('documentation.securityCallout')}{' '}
            </span>
            <span className="font-medium text-foreground">
              {t('documentation.securityCalloutHint')}
            </span>
          </p>
        </div>
      )}

      <section aria-labelledby="doc-map-heading">
        <h2 id="doc-map-heading" className="mb-1 text-lg font-medium">
          {t('documentation.mindmapTitle')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('documentation.mapHint')}
        </p>

        <div className="space-y-3">
          {MAP_GROUPS.map((group) => (
            <details
              key={group.id}
              className="group/card rounded-lg border border-border bg-card shadow-sm"
            >
              <summary
                className={cn(
                  summaryClass,
                  'px-4 py-3 text-base hover:bg-muted/40 [&::-webkit-details-marker]:hidden'
                )}
              >
                <span>{t(group.titleKey)}</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/card:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="space-y-2 border-t border-border px-3 py-3">
                {group.areaKeys.map((areaKey) => {
                  const items = t(`documentation.areas.${areaKey}.items`, {
                    returnObjects: true,
                  }) as unknown
                  if (!Array.isArray(items)) return null
                  return (
                    <details
                      key={areaKey}
                      className="group/sub rounded-md border border-border/80 bg-muted/20"
                    >
                      <summary
                        className={cn(
                          summaryClass,
                          'px-3 py-2 text-sm hover:bg-muted/50 [&::-webkit-details-marker]:hidden'
                        )}
                      >
                        <span>{t(`documentation.areas.${areaKey}.title`)}</span>
                        <ChevronDown
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/sub:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      <ul className="list-inside list-disc space-y-1 border-t border-border/60 px-3 py-2 pb-3 text-sm text-muted-foreground">
                        {items.map((line, i) => (
                          <li key={`${areaKey}-${i}`}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  )
                })}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
