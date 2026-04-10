import { Navigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'

/** Sends `/` to admin dashboard or inventory home; preserves query except legacy tab routes. */
export function RootRedirect() {
  const [searchParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const tab = searchParams.get('tab')

  if (!isAdmin) {
    if (tab === 'control' || tab === 'reports') {
      return <Navigate to="/inventory" replace />
    }
    const rest = searchParams.toString()
    if (rest) {
      return <Navigate to={`/inventory?${rest}`} replace />
    }
    return <Navigate to="/inventory" replace />
  }

  if (tab === 'control') {
    return <Navigate to="/control" replace />
  }
  if (tab === 'reports') {
    return <Navigate to="/admin/reports" replace />
  }
  const rest = searchParams.toString()
  if (rest) {
    return <Navigate to={`/admin/dashboard?${rest}`} replace />
  }
  return <Navigate to="/admin/dashboard" replace />
}
