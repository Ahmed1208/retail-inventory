import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, BookOpen, LayoutDashboard, LineChart } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

const sections = [
  {
    to: '/admin/dashboard',
    icon: LayoutDashboard,
    key: 'nav.dashboard',
    feature: 'sidebar.dashboard' as const,
  },
  {
    to: '/admin/documentation',
    icon: BookOpen,
    key: 'nav.documentation',
    feature: 'sidebar.documentation' as const,
  },
  {
    to: '/admin/reports',
    icon: LineChart,
    key: 'nav.reports',
    feature: 'sidebar.reports' as const,
  },
  {
    to: '/admin/movements',
    icon: ArrowLeftRight,
    key: 'nav.stockMovements',
    feature: 'inventory.hubMovements' as const,
  },
] as const

export function AdminHub() {
  const { t } = useTranslation()
  const canAdmin = useFeatureEnabled('sidebar.admin')
  const showDashboard = useFeatureEnabled('sidebar.dashboard')
  const showDocs = useFeatureEnabled('sidebar.documentation')
  const showReports = useFeatureEnabled('sidebar.reports')

  const showMovements = useFeatureEnabled('inventory.hubMovements')

  const flags = {
    'sidebar.dashboard': showDashboard,
    'sidebar.documentation': showDocs,
    'sidebar.reports': showReports,
    'inventory.hubMovements': showMovements,
  } as const

  const visibleSections = sections.filter((s) => flags[s.feature])

  useEffect(() => {
    document.title = `${t('nav.admin')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  if (!canAdmin) return <Navigate to="/admin/dashboard" replace />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('nav.admin')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('nav.adminHubDescription')}
        </p>
      </div>

      {visibleSections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.adminHubAllOff')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSections.map(({ to, icon: Icon, key }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  'flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm',
                  'transition-colors hover:border-primary/20 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="text-base font-medium">{t(key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
