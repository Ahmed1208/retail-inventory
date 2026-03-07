import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <h2 className="text-xl font-semibold text-foreground">
        {t('notFound.title')}
      </h2>
      <p className="text-muted-foreground max-w-md">
        {t('notFound.message')}
      </p>
      <Link to="/" className={buttonVariants()}>
        <Home className="h-4 w-4 me-2" />
        {t('notFound.goToDashboard')}
      </Link>
    </div>
  )
}
