import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { listSyncRuns } from '@/services/syncRunService'

export function DataSyncHistory() {
  const { t } = useTranslation()

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['sync_runs', 'local'],
    queryFn: () => listSyncRuns(supabase, 100),
  })

  useEffect(() => {
    document.title = `${t('adminSync.historyTitle')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          to="/sync"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mb-2 -ms-2' })}
        >
          {t('adminSync.backToSync')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t('adminSync.historyTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('adminSync.historySubtitle')}</p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {(error as Error).message || t('adminSync.historyLoadError')}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-start">
                <th className="px-3 py-2 font-medium">{t('adminSync.colStarted')}</th>
                <th className="px-3 py-2 font-medium">{t('adminSync.colStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('adminSync.colMode')}</th>
                <th className="px-3 py-2 font-medium">{t('adminSync.colSummary')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.status === 'success'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : r.status === 'error'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }
                    >
                      {r.status}
                    </span>
                    {r.error_message && (
                      <p className="mt-1 max-w-xs text-xs text-destructive">{r.error_message}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.mode}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {JSON.stringify(r.summary)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">{t('adminSync.historyEmpty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
