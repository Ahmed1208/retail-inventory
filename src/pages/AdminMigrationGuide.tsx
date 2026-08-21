import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { FeatureControlId } from '@/config/featureControls'
import { MIGRATION_IMPORT_PARAM } from '@/hooks/useMigrationImportDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import {
  clearMigrationChecklist,
  readMigrationChecklist,
  writeMigrationChecklist,
} from '@/utils/migrationChecklistStorage'

export const MIGRATION_STEP_IDS = [
  'people_wizard',
  'plan_exports',
  'env_schema',
  'operators_members',
  'warehouses',
  'categories_brands',
  'people',
  'products',
  'inventory_transfers_guide',
  'data_sync_environments',
  'payments_optional',
  'po_csv',
  'orders_csv',
  'register',
  'smoke_test',
  'control_review',
  'documentation_review',
] as const

export type MigrationStepId = (typeof MIGRATION_STEP_IDS)[number]

type StepLink = {
  to: string
  labelKey: string
  gatedBy?: FeatureControlId
  /** When set, both flags must be enabled (e.g. list page + import permission). */
  gatedByBoth?: readonly [FeatureControlId, FeatureControlId]
}

function qsImport(): string {
  return `${MIGRATION_IMPORT_PARAM}=1`
}

function MigrationOutlineLink({ to, labelKey }: { to: string; labelKey: string }) {
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      {t(labelKey)}
    </Link>
  )
}

function MigrationGatedOutlineLink({
  to,
  labelKey,
  gatedBy,
}: {
  to: string
  labelKey: string
  gatedBy: FeatureControlId
}) {
  const { t } = useTranslation()
  const ok = useFeatureEnabled(gatedBy)
  if (!ok) return null
  return (
    <Link
      to={to}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      {t(labelKey)}
    </Link>
  )
}

function MigrationDoubleGatedOutlineLink({
  to,
  labelKey,
  a,
  b,
}: {
  to: string
  labelKey: string
  a: FeatureControlId
  b: FeatureControlId
}) {
  const { t } = useTranslation()
  const okA = useFeatureEnabled(a)
  const okB = useFeatureEnabled(b)
  if (!okA || !okB) return null
  return (
    <Link
      to={to}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      {t(labelKey)}
    </Link>
  )
}

type StepConfig = {
  id: MigrationStepId
  linkKeys?: StepLink[]
}

type PhaseConfig = {
  id: string
  steps: StepConfig[]
}

const PHASES: PhaseConfig[] = [
  {
    id: 'phaseStart',
    steps: [
      {
        id: 'people_wizard',
        linkKeys: [
          {
            to: `/people?${qsImport()}`,
            labelKey: 'migrationGuide.importShortcut.peoplePaste',
            gatedBy: 'people.addPerson',
          },
          { to: '/people', labelKey: 'migrationGuide.link.people' },
        ],
      },
    ],
  },
  {
    id: 'phasePrepare',
    steps: [
      { id: 'plan_exports' },
      { id: 'env_schema' },
    ],
  },
  {
    id: 'phaseTeam',
    steps: [
      {
        id: 'operators_members',
        linkKeys: [
          { to: '/admin/members', labelKey: 'migrationGuide.link.members' },
          {
            to: '/admin/members/new',
            labelKey: 'migrationGuide.link.addMember',
          },
        ],
      },
    ],
  },
  {
    id: 'phaseFoundation',
    steps: [{ id: 'warehouses', linkKeys: [{ to: '/warehouses', labelKey: 'migrationGuide.link.warehouses' }] }],
  },
  {
    id: 'phaseMaster',
    steps: [
      {
        id: 'categories_brands',
        linkKeys: [
          { to: '/categories', labelKey: 'migrationGuide.link.categories' },
          { to: '/brands', labelKey: 'migrationGuide.link.brands' },
        ],
      },
      {
        id: 'people',
        linkKeys: [
          { to: '/people', labelKey: 'migrationGuide.link.people' },
          {
            to: `/people?${qsImport()}`,
            labelKey: 'migrationGuide.importShortcut.people',
            gatedBy: 'people.addPerson',
          },
        ],
      },
      {
        id: 'products',
        linkKeys: [
          { to: '/products', labelKey: 'migrationGuide.link.products' },
          {
            to: `/products?${qsImport()}`,
            labelKey: 'migrationGuide.importShortcut.products',
            gatedBy: 'products.addProduct',
          },
        ],
      },
      {
        id: 'inventory_transfers_guide',
        linkKeys: [
          {
            to: '/inventory-transfers',
            labelKey: 'migrationGuide.link.inventoryTransfersHome',
          },
          {
            to: '/inventory-transfers/new',
            labelKey: 'migrationGuide.link.newInventoryTransfer',
            gatedBy: 'inventoryTransfers.create',
          },
          {
            to: '/inventory-transfers/list',
            labelKey: 'migrationGuide.link.inventoryTransfersList',
            gatedBy: 'inventoryTransfers.list',
          },
        ],
      },
    ],
  },
  {
    id: 'phaseSync',
    steps: [
      {
        id: 'data_sync_environments',
        linkKeys: [
          {
            to: '/sync',
            labelKey: 'migrationGuide.link.dataSync',
            gatedBy: 'admin.dataSync',
          },
          {
            to: '/sync/history',
            labelKey: 'migrationGuide.link.dataSyncHistory',
            gatedBy: 'admin.dataSync',
          },
        ],
      },
    ],
  },
  {
    id: 'phaseOptional',
    steps: [
      {
        id: 'payments_optional',
        linkKeys: [
          { to: '/payments', labelKey: 'migrationGuide.link.payments' },
          {
            to: `/payments/list?${qsImport()}`,
            labelKey: 'migrationGuide.importShortcut.payments',
            gatedByBoth: ['payments.list', 'people.recordPayment'] as const,
          },
        ],
      },
    ],
  },
  {
    id: 'phaseTransactions',
    steps: [
      {
        id: 'po_csv',
        linkKeys: [
          {
            to: '/purchase-orders/list',
            labelKey: 'migrationGuide.link.purchaseOrdersList',
          },
          {
            to: `/purchase-orders/list?${qsImport()}`,
            labelKey: 'migrationGuide.importShortcut.purchaseOrders',
            gatedByBoth: [
              'purchaseOrders.hubList',
              'purchaseOrders.importCsv',
            ] as const,
          },
        ],
      },
      {
        id: 'orders_csv',
        linkKeys: [
          { to: '/orders/list', labelKey: 'migrationGuide.link.ordersList' },
          {
            to: `/orders/list?${qsImport()}`,
            labelKey: 'migrationGuide.importShortcut.orders',
            gatedByBoth: ['orders.hubList', 'orders.importCsv'] as const,
          },
        ],
      },
    ],
  },
  {
    id: 'phaseMoney',
    steps: [
      {
        id: 'register',
        linkKeys: [
          { to: '/register', labelKey: 'migrationGuide.link.register' },
          {
            to: `/register?${qsImport()}`,
            labelKey: 'migrationGuide.importShortcut.register',
            gatedBy: 'sidebar.register',
          },
        ],
      },
    ],
  },
  {
    id: 'phaseCutover',
    steps: [
      {
        id: 'smoke_test',
        linkKeys: [
          { to: '/orders/new', labelKey: 'migrationGuide.link.newOrder' },
          {
            to: '/purchase-orders/new',
            labelKey: 'migrationGuide.link.newPo',
          },
        ],
      },
      {
        id: 'control_review',
        linkKeys: [{ to: '/control', labelKey: 'migrationGuide.link.control' }],
      },
      {
        id: 'documentation_review',
        linkKeys: [
          {
            to: '/admin/documentation',
            labelKey: 'migrationGuide.link.documentation',
            gatedBy: 'sidebar.documentation',
          },
        ],
      },
    ],
  },
]

function emptyChecked(): Record<MigrationStepId, boolean> {
  const o = {} as Record<MigrationStepId, boolean>
  for (const id of MIGRATION_STEP_IDS) o[id] = false
  return o
}

function mergeWithPersisted(
  persisted: Record<string, boolean> | undefined
): Record<MigrationStepId, boolean> {
  const base = emptyChecked()
  if (!persisted) return base
  for (const id of MIGRATION_STEP_IDS) {
    if (persisted[id] === true) base[id] = true
  }
  return base
}

export function AdminMigrationGuide() {
  const { t } = useTranslation()
  const canAdmin = useFeatureEnabled('sidebar.admin')
  const showMigration = useFeatureEnabled('admin.migrationGuide')

  const [checked, setChecked] = useState<Record<MigrationStepId, boolean>>(
    () => mergeWithPersisted(readMigrationChecklist()?.checked)
  )
  const [resetOpen, setResetOpen] = useState(false)
  const [markAllOpen, setMarkAllOpen] = useState(false)

  useEffect(() => {
    document.title = t('migrationGuide.browserTitle')
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  useEffect(() => {
    writeMigrationChecklist(checked as unknown as Record<string, boolean>)
  }, [checked])

  const total = MIGRATION_STEP_IDS.length
  const done = useMemo(
    () => MIGRATION_STEP_IDS.filter((id) => checked[id]).length,
    [checked]
  )

  const toggle = useCallback((id: MigrationStepId) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const confirmReset = useCallback(() => {
    clearMigrationChecklist()
    setChecked(emptyChecked())
    setResetOpen(false)
  }, [])

  const confirmMarkAll = useCallback(() => {
    const all = emptyChecked()
    for (const id of MIGRATION_STEP_IDS) all[id] = true
    setChecked(all)
    setMarkAllOpen(false)
  }, [])

  if (!canAdmin) return <Navigate to="/admin/dashboard" replace />
  if (!showMigration) return <Navigate to="/admin" replace />

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('migrationGuide.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('migrationGuide.subtitle')}
        </p>
        <p className="mt-3 text-sm leading-relaxed">{t('migrationGuide.intro')}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('migrationGuide.savedLocallyHint')}
        </p>
        <p
          className="mt-3 text-sm font-medium tabular-nums"
          aria-live="polite"
        >
          {t('migrationGuide.progressLabel', { done, total })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMarkAllOpen(true)}
        >
          {t('migrationGuide.markAllComplete')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setResetOpen(true)}
        >
          {t('migrationGuide.resetProgress')}
        </Button>
      </div>

      <div className="space-y-10">
        {PHASES.map((phase) => (
          <section
            key={phase.id}
            aria-labelledby={`migration-phase-${phase.id}`}
          >
            <h2
              id={`migration-phase-${phase.id}`}
              className="mb-4 border-b border-border pb-2 text-lg font-medium"
            >
              {t(`migrationGuide.${phase.id}.title`)}
            </h2>
            <ul className="space-y-6">
              {phase.steps.map((step) => (
                <li
                  key={step.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <input
                      id={`migration-step-${step.id}`}
                      type="checkbox"
                      checked={checked[step.id]}
                      onChange={() => toggle(step.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-primary"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label
                        htmlFor={`migration-step-${step.id}`}
                        className="cursor-pointer text-base font-medium leading-snug"
                      >
                        {t(`migrationGuide.steps.${step.id}.title`)}
                      </Label>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t(`migrationGuide.steps.${step.id}.body`)}
                      </p>
                      {step.linkKeys && step.linkKeys.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {step.linkKeys.map((lk) =>
                            lk.gatedByBoth ? (
                              <MigrationDoubleGatedOutlineLink
                                key={`${lk.to}-${lk.labelKey}`}
                                to={lk.to}
                                labelKey={lk.labelKey}
                                a={lk.gatedByBoth[0]}
                                b={lk.gatedByBoth[1]}
                              />
                            ) : lk.gatedBy ? (
                              <MigrationGatedOutlineLink
                                key={`${lk.to}-${lk.labelKey}`}
                                to={lk.to}
                                labelKey={lk.labelKey}
                                gatedBy={lk.gatedBy}
                              />
                            ) : (
                              <MigrationOutlineLink
                                key={lk.to}
                                to={lk.to}
                                labelKey={lk.labelKey}
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className={cn('max-w-md')}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('migrationGuide.resetConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('migrationGuide.resetConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('migrationGuide.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>
              {t('migrationGuide.resetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={markAllOpen} onOpenChange={setMarkAllOpen}>
        <AlertDialogContent className={cn('max-w-md')}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('migrationGuide.markAllConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('migrationGuide.markAllConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('migrationGuide.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkAll}>
              {t('migrationGuide.markAllConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
