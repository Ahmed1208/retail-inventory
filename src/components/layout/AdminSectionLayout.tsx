import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

export function AdminSectionLayout() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const showBack = pathname !== '/admin'

  return (
    <div className="space-y-4">
      {showBack && (
        <Link
          to="/admin"
          className="mb-1 -ms-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
          {t('nav.backToAdmin')}
        </Link>
      )}
      <Outlet />
    </div>
  )
}
