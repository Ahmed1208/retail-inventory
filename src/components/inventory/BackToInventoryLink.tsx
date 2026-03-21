import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

export function BackToInventoryLink({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.dir() === 'rtl'

  return (
    <Link
      to="/inventory"
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors',
        className
      )}
    >
      <ArrowLeft
        className={cn('h-4 w-4 shrink-0', isRTL && 'rotate-180')}
        aria-hidden
      />
      {t('nav.backToInventory')}
    </Link>
  )
}
