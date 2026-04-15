import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import { usernameToMemberEmail } from '@/lib/memberAuth'
import { fetchOperatorProfile } from '@/services/operatorProfileService'
import type { OperatorProfile } from '@/types/profile'

type AuthContextValue = {
  session: Session | null
  profile: OperatorProfile | null
  /** True only until the first `getSession()` resolves. */
  loading: boolean
  /**
   * True while we are fetching `profiles` for the current session user.
   * False when there is no session or after the fetch settles (even if profile is null).
   */
  profileLoading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** JWT `user_metadata.is_admin` (set in Dashboard / SQL) when `profiles` row is missing or not loaded yet. */
function metaAdminFromSession(session: Session | null): boolean {
  const v = session?.user?.user_metadata?.is_admin as unknown
  return v === true || v === 'true'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<OperatorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const runProfileFetch = useCallback(
    (userId: string | undefined, cancelled: () => boolean) => {
      if (!userId) {
        if (!cancelled()) {
          setProfile(null)
          setProfileLoading(false)
        }
        return
      }
      if (!cancelled()) setProfileLoading(true)
      void fetchOperatorProfile(userId)
        .then((p) => {
          if (!cancelled()) {
            setProfile(p)
            setProfileLoading(false)
          }
        })
        .catch((e) => {
          console.error('fetchOperatorProfile', e)
          if (!cancelled()) {
            setProfile(null)
            setProfileLoading(false)
          }
        })
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled

    void (async () => {
      try {
        const {
          data: { session: s },
          error,
        } = await supabase.auth.getSession()
        if (isCancelled()) return
        if (error) {
          console.error('getSession:', error.message)
        }
        setSession(s ?? null)
        runProfileFetch(s?.user?.id, isCancelled)
      } catch (e) {
        console.error('Auth bootstrap failed', e)
        if (!isCancelled()) {
          setSession(null)
          setProfile(null)
          setProfileLoading(false)
        }
      } finally {
        if (!isCancelled()) setLoading(false)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      runProfileFetch(s?.user?.id, isCancelled)
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [runProfileFetch])

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase.auth.getSession()).data.session?.user?.id
    if (!uid) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    try {
      setProfile(await fetchOperatorProfile(uid))
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const signIn = useCallback(
    async (username: string, password: string) => {
      try {
        const email = usernameToMemberEmail(username)
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) return { error: error.message }
        await refreshProfile()
        return { error: null }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { error: msg }
      }
    },
    [refreshProfile]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    setProfileLoading(false)
  }, [])

  const isAdmin = useMemo(() => {
    if (profile?.is_admin === true) return true
    if (profile != null && profile.is_admin === false) return false
    return metaAdminFromSession(session)
  }, [profile, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      profileLoading,
      signIn,
      signOut,
      refreshProfile,
      isAdmin,
    }),
    [
      session,
      profile,
      loading,
      profileLoading,
      signIn,
      signOut,
      refreshProfile,
      isAdmin,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
