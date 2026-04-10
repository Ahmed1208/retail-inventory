import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabase } from '@/lib/supabase'
import { buttonVariants } from '@/components/ui/button'
import type { OperatorProfile } from '@/types/profile'

async function fetchProfiles(): Promise<OperatorProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, is_admin, feature_overrides, created_at')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    username: row.username,
    is_admin: row.is_admin,
    feature_overrides:
      row.feature_overrides &&
      typeof row.feature_overrides === 'object' &&
      !Array.isArray(row.feature_overrides)
        ? (row.feature_overrides as Record<string, boolean>)
        : {},
    created_at: row.created_at,
  }))
}

export function AdminMembersList() {
  const { t } = useTranslation()
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'profiles'],
    queryFn: fetchProfiles,
  })

  useEffect(() => {
    document.title = `${t('members.listTitle')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('members.listTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('members.listSubtitle')}
          </p>
        </div>
        <Link
          to="/admin/members/new"
          className={buttonVariants({ variant: 'default' })}
        >
          {t('members.addMember')}
        </Link>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {(error as Error).message || t('members.loadError')}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-start">
                <th className="px-4 py-3 font-medium">{t('members.colUsername')}</th>
                <th className="px-4 py-3 font-medium">{t('members.colAdmin')}</th>
                <th className="px-4 py-3 font-medium">{t('members.colCreated')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.is_admin ? t('common.yes') : t('common.no')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">
              {t('members.empty')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
