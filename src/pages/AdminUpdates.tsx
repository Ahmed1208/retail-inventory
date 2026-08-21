import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'

import { ShopUpdateNotice } from '@/components/admin/ShopUpdateNotice'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  SHOP_VERSION_QUERY_KEY,
  fetchRemoteShopVersion,
  probeShopConnectivity,
  readDismissedWhatsNewVersion,
  resolveLocalShopVersion,
  setLocalShopVersion,
  shortSha,
  type ShopVersionInfo,
} from '@/services/shopVersionService'

type NetState = 'checking' | 'online' | 'offline'

export function AdminUpdates() {
  const { t } = useTranslation()
  const headingId = useId()

  const [net, setNet] = useState<NetState>('checking')
  const [local, setLocal] = useState<ShopVersionInfo | null>(null)
  const [remote, setRemote] = useState<ShopVersionInfo | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [checking, setChecking] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [whatsNewOpen, setWhatsNewOpen] = useState(true)
  const queryClient = useQueryClient()

  const checkForUpdates = useCallback(async () => {
    setChecking(true)
    setErrorKey(null)
    setNet('checking')

    const connectivity = await probeShopConnectivity()

    if (!connectivity.browserOnline) {
      setNet('offline')
      setLocal(await resolveLocalShopVersion())
      setRemote(null)
      setUpdateAvailable(false)
      setErrorKey('adminUpdates.errorOffline')
      setChecking(false)
      return
    }

    setNet('online')

    const result = await fetchRemoteShopVersion()
    setLocal(result.local)
    if (!result.ok) {
      setRemote(null)
      setUpdateAvailable(false)
      setErrorKey(
        result.error === 'offline'
          ? 'adminUpdates.errorOffline'
          : result.error === 'invalid'
            ? 'adminUpdates.errorInvalid'
            : 'adminUpdates.errorFetch'
      )
      if (result.error === 'offline') setNet('offline')
      setChecking(false)
      return
    }

    setRemote(result.remote)
    setUpdateAvailable(result.updateAvailable)
    setWhatsNewOpen(
      readDismissedWhatsNewVersion() !== result.remote.version
    )
    setChecking(false)
    void queryClient.invalidateQueries({ queryKey: SHOP_VERSION_QUERY_KEY })
  }, [queryClient])

  useEffect(() => {
    document.title = `${t('adminUpdates.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  useEffect(() => {
    void checkForUpdates()
  }, [checkForUpdates])

  useEffect(() => {
    const up = () => {
      void checkForUpdates()
    }
    const down = () => {
      setNet('offline')
      setRemote(null)
      setUpdateAvailable(false)
      setErrorKey('adminUpdates.errorOffline')
    }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [checkForUpdates])

  const markApplied = () => {
    if (!remote) return
    setLocalShopVersion(remote)
    setLocal(remote)
    setUpdateAvailable(false)
    void queryClient.invalidateQueries({ queryKey: SHOP_VERSION_QUERY_KEY })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6" aria-labelledby={headingId}>
      <div>
        <h1 id={headingId} className="text-2xl font-semibold tracking-tight">
          {t('adminUpdates.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('adminUpdates.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium',
            net === 'online' &&
              'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
            net === 'offline' &&
              'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100',
            net === 'checking' && 'border-border bg-muted text-muted-foreground'
          )}
        >
          {net === 'checking'
            ? t('adminUpdates.netChecking')
            : net === 'online'
              ? t('adminUpdates.netOnline')
              : t('adminUpdates.netOffline')}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={() => void checkForUpdates()}
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          {t('adminUpdates.checkAgain')}
        </Button>
      </div>

      {net === 'offline' || errorKey === 'adminUpdates.errorOffline' ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50"
        >
          {t('adminUpdates.offlineWarning')}
        </div>
      ) : null}

      {errorKey && errorKey !== 'adminUpdates.errorOffline' ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          {t(errorKey)}
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">{t('adminUpdates.localTitle')}</h2>
        {local ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t('adminUpdates.version')}</dt>
              <dd className="font-mono tabular-nums">{local.version}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('adminUpdates.commit')}</dt>
              <dd className="font-mono">{shortSha(local.sha)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('adminUpdates.loadingLocal')}
          </p>
        )}
      </section>

      {net === 'online' && remote ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">{t('adminUpdates.remoteTitle')}</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t('adminUpdates.version')}</dt>
              <dd className="font-mono tabular-nums">{remote.version}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('adminUpdates.commit')}</dt>
              <dd className="font-mono">{shortSha(remote.sha)}</dd>
            </div>
          </dl>

          {updateAvailable ? (
            <div className="space-y-4 border-t border-border pt-4">
              <ShopUpdateNotice remote={remote} updateAvailable />
              <p className="text-sm text-muted-foreground">
                {t('adminUpdates.updateHow')}
              </p>
              <Button type="button" variant="outline" onClick={markApplied}>
                {t('adminUpdates.markApplied')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {t('adminUpdates.upToDate', {
                  version: local?.version ?? remote.version,
                })}
              </p>
              {whatsNewOpen && remote.notes ? (
                <ShopUpdateNotice
                  remote={remote}
                  updateAvailable={false}
                  onDismissWhatsNew={() => setWhatsNewOpen(false)}
                />
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
