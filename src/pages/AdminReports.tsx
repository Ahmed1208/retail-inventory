import { Navigate } from 'react-router-dom'

import { Reports } from '@/pages/Reports'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function AdminReports() {
  const canView = useFeatureEnabled('dashboard.reportsTab')

  if (!canView) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
      <Reports embedded />
    </div>
  )
}
