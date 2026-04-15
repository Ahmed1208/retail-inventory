import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, CloudCog, ListChecks, Users } from 'lucide-react'

import { ControlPanel } from '@/components/control/ControlPanel'
import { buttonVariants } from '@/components/ui/button'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { cn } from '@/lib/utils'

export function Control() {
  const { t } = useTranslation()
  const showDocs = useFeatureEnabled('sidebar.documentation')
  const showMigration = useFeatureEnabled('admin.migrationGuide')
  const showDataSync = useFeatureEnabled('admin.dataSync')

  useEffect(() => {
    document.title = t('control.pageTitle')
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/25 p-4 md:p-5">
        <h2 className="text-base font-semibold text-foreground">
          {t('control.guideCardTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {t('control.guideCardBody')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {showDocs && (
            <Link
              to="/admin/documentation"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'inline-flex items-center gap-2'
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
              {t('control.linkDocumentation')}
            </Link>
          )}
          {showMigration && (
            <Link
              to="/admin/migration"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'inline-flex items-center gap-2'
              )}
            >
              <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
              {t('control.linkMigration')}
            </Link>
          )}
          <Link
            to="/admin/members"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'inline-flex items-center gap-2'
            )}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            {t('control.linkMembers')}
          </Link>
          {showDataSync && (
            <Link
              to="/sync"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'inline-flex items-center gap-2'
              )}
            >
              <CloudCog className="h-4 w-4 shrink-0" aria-hidden />
              {t('control.linkDataSync')}
            </Link>
          )}
        </div>
        {(!showDocs || !showMigration || !showDataSync) && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('control.guideCardFootnote')}
          </p>
        )}
      </div>

      <ControlPanel />
    </div>
  )
}
