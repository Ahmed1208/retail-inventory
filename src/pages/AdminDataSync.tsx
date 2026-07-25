import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeftRight, CloudDownload, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  createCloudSupabaseClient,
  isSyncCloudConfigured,
} from '@/lib/supabaseCloud'
import { useSyncReadiness } from '@/hooks/useSyncReadiness'
import {
  isLocalSupabaseUrl,
  runCloudMasterSync,
  runResetLocalFromCloud,
  type SyncProgress,
} from '@/services/dataSyncService'
import { recordSyncRuns } from '@/services/syncRunService'

export function AdminDataSync() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const headingId = useId()
  const localUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const { pathname } = useLocation()
  const standalone = pathname.startsWith('/sync')

  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [cloudConnected, setCloudConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    phase: 'idle',
    currentTable: null,
    tableIndex: 0,
    tableTotal: 0,
    rowsPushedToCloud: 0,
    rowsPulledToLocal: 0,
    conflictsResolved: 0,
  })
  const [syncRunning, setSyncRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const cloudClientRef = useRef(createCloudSupabaseClient())
  const readiness = useSyncReadiness(localUrl)

  useEffect(() => {
    document.title = `${t('adminSync.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const isLocal = isLocalSupabaseUrl(localUrl)
  const envOk = isSyncCloudConfigured()
  const canAttemptSync =
    readiness.browserOnline &&
    readiness.envConfigured &&
    readiness.localSupabaseOk &&
    readiness.cloudReachable === true

  const connectCloud = async () => {
    if (!envOk) {
      toast.error(t('adminSync.missingEnv'))
      return
    }
    const client = createCloudSupabaseClient()
    cloudClientRef.current = client
    setConnecting(true)
    const { data, error } = await client.auth.signInWithPassword({
      email: cloudEmail.trim(),
      password: cloudPassword,
    })
    setConnecting(false)
    if (error || !data.session) {
      const raw = error?.message ?? ''
      const lower = raw.toLowerCase()
      const msg =
        lower.includes('invalid login') || lower.includes('invalid credentials')
          ? t('adminSync.invalidHostedCredentials')
          : raw || t('adminSync.connectFailed')
      toast.error(msg)
      setCloudConnected(false)
      return
    }
    setCloudConnected(true)
    setCloudPassword('')
    toast.success(t('adminSync.connected'))
  }

  const disconnectCloud = async () => {
    await cloudClientRef.current.auth.signOut()
    setCloudConnected(false)
  }

  const startSync = async () => {
    if (!isLocal) {
      toast.error(t('adminSync.needLocalApp'))
      return
    }
    if (!cloudConnected) {
      toast.error(t('adminSync.connectFirst'))
      return
    }
    if (!canAttemptSync) {
      toast.error(t('adminSync.readinessBlocked'))
      return
    }

    const startedAt = new Date().toISOString()
    const ac = new AbortController()
    abortRef.current = ac
    setSyncRunning(true)
    setSyncProgress({
      phase: 'running',
      currentTable: null,
      tableIndex: 0,
      tableTotal: 0,
      rowsPushedToCloud: 0,
      rowsPulledToLocal: 0,
      conflictsResolved: 0,
    })

    const result = await runCloudMasterSync({
      localClient: supabase,
      cloudClient: cloudClientRef.current,
      onProgress: setSyncProgress,
      signal: ac.signal,
    })

    setSyncRunning(false)
    abortRef.current = null

    const {
      data: { user: localUser },
    } = await supabase.auth.getUser()
    const {
      data: { user: cloudUser },
    } = await cloudClientRef.current.auth.getUser()

    try {
      await recordSyncRuns({
        localClient: supabase,
        cloudClient: cloudClientRef.current,
        localUserId: localUser?.id ?? null,
        cloudUserId: cloudUser?.id ?? null,
        startedAt,
        status: result.error ? 'error' : 'success',
        mode: 'cloud_master',
        summary: {
          rowsPushedToCloud: result.rowsPushedToCloud,
          rowsPulledToLocal: result.rowsPulledToLocal,
          ordersRenumbered: result.ordersRenumbered ?? 0,
          purchaseOrdersRenumbered: result.purchaseOrdersRenumbered ?? 0,
          profilesSkippedMissingAuth: result.profilesSkippedMissingAuth ?? 0,
          recoveredFromLocalFailure: result.recoveredFromLocalFailure ?? false,
          cloudWritesMayBePartial: result.cloudWritesMayBePartial ?? false,
          failurePhase: result.failurePhase ?? null,
        },
        errorMessage: result.error ?? null,
      })
    } catch {
      /* audit insert is best-effort */
    }

    if (result.error) {
      toast.error(result.error)
      if (result.cloudWritesMayBePartial) {
        toast.warning(t('adminSync.cloudPartialWarning'), { duration: 12_000 })
      }
    } else if (result.recoveredFromLocalFailure) {
      toast.warning(
        t('adminSync.syncRecoveredWarning', {
          detail: result.originalErrorBeforeRecovery ?? '',
        }),
        { duration: 12_000 }
      )
      toast.success(
        t('adminSync.doneCloudToast', {
          pushed: result.rowsPushedToCloud,
          pulled: result.rowsPulledToLocal,
          ordersFixed: result.ordersRenumbered ?? 0,
          poFixed: result.purchaseOrdersRenumbered ?? 0,
        })
      )
      const skippedProfiles = result.profilesSkippedMissingAuth ?? 0
      if (skippedProfiles > 0) {
        toast.info(t('adminSync.profilesSkippedToastTitle', { count: skippedProfiles }), {
          description: t('adminSync.profilesSkippedToastDesc'),
          duration: 16_000,
        })
      }
      void queryClient.invalidateQueries({ predicate: () => true })
    } else {
      toast.success(
        t('adminSync.doneCloudToast', {
          pushed: result.rowsPushedToCloud,
          pulled: result.rowsPulledToLocal,
          ordersFixed: result.ordersRenumbered ?? 0,
          poFixed: result.purchaseOrdersRenumbered ?? 0,
        })
      )
      const skippedProfiles = result.profilesSkippedMissingAuth ?? 0
      if (skippedProfiles > 0) {
        toast.info(t('adminSync.profilesSkippedToastTitle', { count: skippedProfiles }), {
          description: t('adminSync.profilesSkippedToastDesc'),
          duration: 16_000,
        })
      }
      void queryClient.invalidateQueries({ predicate: () => true })
    }
  }

  const startResetLocalFromCloud = async () => {
    if (!isLocal) {
      toast.error(t('adminSync.needLocalApp'))
      return
    }
    if (!cloudConnected) {
      toast.error(t('adminSync.connectFirst'))
      return
    }
    if (!canAttemptSync) {
      toast.error(t('adminSync.readinessBlocked'))
      return
    }
    if (!window.confirm(t('adminSync.resetLocalConfirm'))) return

    const startedAt = new Date().toISOString()
    const ac = new AbortController()
    abortRef.current = ac
    setSyncRunning(true)
    setSyncProgress({
      phase: 'running',
      currentTable: null,
      tableIndex: 0,
      tableTotal: 0,
      rowsPushedToCloud: 0,
      rowsPulledToLocal: 0,
      conflictsResolved: 0,
    })

    const result = await runResetLocalFromCloud({
      localClient: supabase,
      cloudClient: cloudClientRef.current,
      onProgress: setSyncProgress,
      signal: ac.signal,
    })

    setSyncRunning(false)
    abortRef.current = null

    const {
      data: { user: localUser },
    } = await supabase.auth.getUser()
    const {
      data: { user: cloudUser },
    } = await cloudClientRef.current.auth.getUser()

    try {
      await recordSyncRuns({
        localClient: supabase,
        cloudClient: cloudClientRef.current,
        localUserId: localUser?.id ?? null,
        cloudUserId: cloudUser?.id ?? null,
        startedAt,
        status: result.error ? 'error' : 'success',
        mode: 'reset_local_from_cloud',
        summary: {
          rowsPushedToCloud: result.rowsPushedToCloud,
          rowsPulledToLocal: result.rowsPulledToLocal,
          ordersRenumbered: result.ordersRenumbered ?? 0,
          purchaseOrdersRenumbered: result.purchaseOrdersRenumbered ?? 0,
          profilesSkippedMissingAuth: result.profilesSkippedMissingAuth ?? 0,
        },
        errorMessage: result.error ?? null,
      })
    } catch {
      /* audit insert is best-effort */
    }

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(
        t('adminSync.doneResetLocalToast', {
          pulled: result.rowsPulledToLocal,
          ordersFixed: result.ordersRenumbered ?? 0,
          poFixed: result.purchaseOrdersRenumbered ?? 0,
        })
      )
      const skippedProfiles = result.profilesSkippedMissingAuth ?? 0
      if (skippedProfiles > 0) {
        toast.info(t('adminSync.profilesSkippedToastTitle', { count: skippedProfiles }), {
          description: t('adminSync.profilesSkippedToastDesc'),
          duration: 16_000,
        })
      }
      void queryClient.invalidateQueries({ predicate: () => true })
    }
  }

  const cancelSync = () => {
    abortRef.current?.abort()
  }

  const lastRun =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('stockpilot.sync.lastRunAt')
      : null

  const backHref = standalone ? '/inventory' : '/admin'
  const backLabel = standalone ? t('nav.inventory') : t('nav.backToAdmin')

  return (
    <div className="space-y-8">
      <div>
        <Link
          to={backHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {backLabel}
        </Link>
        <h1 id={headingId} className="mt-2 text-2xl font-semibold tracking-tight">
          {t('adminSync.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('adminSync.subtitle')}</p>
      </div>

      {!isLocal && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          {t('adminSync.needLocalApp')}
        </div>
      )}

      <section className="space-y-2 rounded-xl border border-border p-4">
        <h2 className="text-base font-semibold">{t('adminSync.readinessSection')}</h2>
        <ul className="flex flex-wrap gap-2 text-xs">
          <li
            className={
              readiness.browserOnline
                ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-800 dark:text-emerald-200'
                : 'rounded-full bg-destructive/15 px-2 py-1 text-destructive'
            }
          >
            {readiness.browserOnline ? t('adminSync.online') : t('adminSync.offline')}
          </li>
          <li
            className={
              readiness.envConfigured
                ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-800 dark:text-emerald-200'
                : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'
            }
          >
            {readiness.envConfigured ? t('adminSync.envBadgeOk') : t('adminSync.envBadgeMissing')}
          </li>
          <li
            className={
              readiness.localSupabaseOk
                ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-800 dark:text-emerald-200'
                : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'
            }
          >
            {readiness.localSupabaseOk
              ? t('adminSync.localSupabaseOk')
              : t('adminSync.localSupabaseBad')}
          </li>
          <li
            className={
              readiness.checkingCloud
                ? 'rounded-full bg-muted px-2 py-1 text-muted-foreground'
                : readiness.cloudReachable === true
                  ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-800 dark:text-emerald-200'
                  : readiness.cloudReachable === false
                    ? 'rounded-full bg-destructive/15 px-2 py-1 text-destructive'
                    : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'
            }
          >
            {readiness.checkingCloud
              ? t('adminSync.cloudChecking')
              : readiness.cloudReachable === true
                ? t('adminSync.cloudReachable')
                : readiness.cloudReachable === false
                  ? t('adminSync.cloudUnreachable')
                  : t('adminSync.cloudSkipped')}
          </li>
          <li
            className={
              cloudConnected
                ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-800 dark:text-emerald-200'
                : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'
            }
          >
            {cloudConnected ? t('adminSync.signedInCloud') : t('adminSync.notSignedInCloud')}
          </li>
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => void readiness.recheck()}>
          {t('adminSync.recheckNetwork')}
        </Button>
      </section>

      <div
        className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground"
        role="note"
      >
        <p>{t('adminSync.profilesNote')}</p>
        <p className="mt-2">{t('adminSync.rlsNote')}</p>
      </div>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-base font-semibold">{t('adminSync.envSection')}</h2>
        <p className="text-sm text-muted-foreground">
          {envOk ? t('adminSync.envOk') : t('adminSync.envMissing')}
        </p>
        {lastRun && (
          <p className="text-xs text-muted-foreground">
            {t('adminSync.lastRun', { at: lastRun })}
          </p>
        )}
        <Link
          to="/sync/history"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          {t('adminSync.openHistory')}
        </Link>
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h2 className="text-base font-semibold">{t('adminSync.cloudSection')}</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          {t('adminSync.cloudCredentialsHint')}
        </p>
        {!cloudConnected ? (
          <div className="grid max-w-md gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t('adminSync.cloudEmail')}</span>
              <input
                type="email"
                autoComplete="username"
                value={cloudEmail}
                onChange={(e) => setCloudEmail(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t('adminSync.cloudPassword')}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={cloudPassword}
                onChange={(e) => setCloudPassword(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <Button
              type="button"
              onClick={connectCloud}
              disabled={connecting || !envOk}
            >
              {connecting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('adminSync.connect')
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{t('adminSync.connectedAs')}</p>
            <Button type="button" variant="outline" size="sm" onClick={disconnectCloud}>
              {t('adminSync.disconnect')}
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={startSync}
          disabled={!isLocal || !cloudConnected || syncRunning || !canAttemptSync}
        >
          <ArrowLeftRight className="me-2 h-4 w-4" aria-hidden />
          {t('adminSync.syncCloudMaster')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void startResetLocalFromCloud()}
          disabled={!isLocal || !cloudConnected || syncRunning || !canAttemptSync}
        >
          <CloudDownload className="me-2 h-4 w-4" aria-hidden />
          {t('adminSync.resetLocalFromCloud')}
        </Button>
      </section>

      {syncRunning && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center"
          role="alertdialog"
          aria-busy="true"
          aria-labelledby="sync-overlay-title"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <h2 id="sync-overlay-title" className="text-lg font-semibold">
            {t('adminSync.syncing')}
          </h2>
          {syncProgress.currentTable && (
            <p className="text-sm text-muted-foreground">
              {t('adminSync.progressTable', {
                name: syncProgress.currentTable,
                index: syncProgress.tableIndex + 1,
                total: syncProgress.tableTotal,
              })}
            </p>
          )}
          <p className="text-sm">
            {t('adminSync.progressCounts', {
              pushed: syncProgress.rowsPushedToCloud,
              pulled: syncProgress.rowsPulledToLocal,
            })}
          </p>
          <Button type="button" variant="secondary" onClick={cancelSync}>
            {t('adminSync.cancel')}
          </Button>
        </div>
      )}
    </div>
  )
}
