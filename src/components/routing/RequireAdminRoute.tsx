import { Navigate } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'

/** Uses `profiles.is_admin` and falls back to JWT `user_metadata.is_admin` when profile is missing. */
export function RequireAdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, profileLoading, session, isAdmin } = useAuth()

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/inventory" replace />
  }

  return <>{children}</>
}
