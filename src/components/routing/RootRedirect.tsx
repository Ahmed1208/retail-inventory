import { Navigate, useSearchParams } from 'react-router-dom'

/** Sends `/` to `/admin/dashboard`, preserving query except legacy `tab=reports` → `/admin/reports`. */
export function RootRedirect() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
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
