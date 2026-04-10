import { Navigate } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'

/** Only `profiles.is_admin`; use inside routes for /admin/* and /control. */
export function RequireAdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading, session } = useAuth()

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!profile?.is_admin) {
    return <Navigate to="/inventory" replace />
  }

  return <>{children}</>
}
