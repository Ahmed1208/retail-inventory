import { useCallback, useEffect, useMemo, useState } from 'react'

import { isSyncCloudConfigured } from '@/lib/supabaseCloud'
import { isLocalSupabaseUrl } from '@/services/dataSyncService'

export type SyncReadiness = {
  browserOnline: boolean
  envConfigured: boolean
  localSupabaseOk: boolean
  cloudReachable: boolean | null
  checkingCloud: boolean
  recheck: () => void
}

function cloudHealthUrl(cloudBaseUrl: string): string {
  const u = cloudBaseUrl.replace(/\/$/, '')
  return `${u}/auth/v1/health`
}

/**
 * Browser online + env + optional reachability to hosted Supabase auth health endpoint.
 * Hosted `/auth/v1/health` returns 401 without `apikey` (anon), so we send the sync anon key.
 */
export function useSyncReadiness(localSupabaseUrl: string | undefined): SyncReadiness {
  const [browserOnline, setBrowserOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine
  )
  const envConfigured = isSyncCloudConfigured()
  const localOk = isLocalSupabaseUrl(localSupabaseUrl)

  const [cloudReachable, setCloudReachable] = useState<boolean | null>(null)
  const [checkingCloud, setCheckingCloud] = useState(false)

  const cloudUrl = useMemo(() => {
    const v = import.meta.env.VITE_SYNC_CLOUD_URL as string | undefined
    const t = v?.trim()
    return t && t.startsWith('http') ? t : ''
  }, [])

  const cloudAnonKey = useMemo(() => {
    const v = import.meta.env.VITE_SYNC_CLOUD_ANON_KEY as string | undefined
    const t = v?.trim()
    return t || ''
  }, [])

  const probe = useCallback(async () => {
    if (!cloudUrl || !cloudAnonKey) {
      setCloudReachable(null)
      return
    }
    setCheckingCloud(true)
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 8000)
      const res = await fetch(cloudHealthUrl(cloudUrl), {
        method: 'GET',
        headers: {
          apikey: cloudAnonKey,
          Authorization: `Bearer ${cloudAnonKey}`,
        },
        signal: ac.signal,
      })
      clearTimeout(t)
      setCloudReachable(res.ok)
    } catch {
      setCloudReachable(false)
    } finally {
      setCheckingCloud(false)
    }
  }, [cloudUrl, cloudAnonKey])

  useEffect(() => {
    void probe()
  }, [probe])

  useEffect(() => {
    const up = () => setBrowserOnline(true)
    const down = () => setBrowserOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return {
    browserOnline: browserOnline,
    envConfigured,
    localSupabaseOk: localOk,
    cloudReachable,
    checkingCloud,
    recheck: probe,
  }
}
