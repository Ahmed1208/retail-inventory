import { Navigate } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

/** Admin always; others need `admin.dataSync` in profile overrides (Control) / defaults. */
export function RequireDataSyncRoute({ children }: { children: React.ReactNode }) {
  const { loading, profileLoading, session, isAdmin } = useAuth()
  const canSync = useFeatureEnabled('admin.dataSync')
  const allowed = isAdmin || canSync

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

  if (!allowed) {
    return <Navigate to="/inventory" replace />
  }

  return <>{children}</>
}
