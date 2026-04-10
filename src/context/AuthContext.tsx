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
  /** True until first session + profile resolution completes. */
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<OperatorProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback(async (s: Session | null) => {
    setSession(s)
    if (s?.user?.id) {
      setProfile(await fetchOperatorProfile(s.user.id))
    } else {
      setProfile(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase.auth.getSession()).data.session?.user?.id
    if (!uid) {
      setProfile(null)
      return
    }
    setProfile(await fetchOperatorProfile(uid))
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (cancelled) return
      await applySession(s)
      if (!cancelled) setLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      await applySession(s)
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = useCallback(
    async (username: string, password: string) => {
      const email = usernameToMemberEmail(username)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) return { error: error.message }
      await refreshProfile()
      return { error: null }
    },
    [refreshProfile]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signIn,
      signOut,
      refreshProfile,
      isAdmin: profile?.is_admin === true,
    }),
    [session, profile, loading, signIn, signOut, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
