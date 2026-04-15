import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { InventoryTransferForm } from '@/components/inventoryTransfers/InventoryTransferForm'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function NewInventoryTransfer() {
  const { t, i18n } = useTranslation()
  const isRTL = (i18n.language?.split('-')[0] ?? 'en') === 'ar'
  const canCreate = useFeatureEnabled('inventoryTransfers.create')

  useEffect(() => {
    document.title = `${t('inventoryTransfers.newTransfer')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  if (!canCreate) {
    return (
      <div className={cn('space-y-4 p-4', isRTL && 'rtl')} dir={isRTL ? 'rtl' : 'ltr'}>
        <Link
          to="/inventory-transfers"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2 w-fit'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('inventoryTransfers.backToTransfers')}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.newInventoryTransfer')}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-10rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center gap-2 border-b bg-background px-2 py-2">
        <Link
          to="/inventory-transfers"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('inventoryTransfers.backToTransfers')}
        </Link>
      </div>
      <InventoryTransferForm />
    </div>
  )
}
