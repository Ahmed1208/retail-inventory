import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { PurchaseOrderForm } from '@/components/purchaseOrders/PurchaseOrderForm'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function NewPurchaseOrder() {
  const { t, i18n } = useTranslation()
  const isRTL = (i18n.language?.split('-')[0] ?? 'en') === 'ar'
  const canCreate = useFeatureEnabled('purchaseOrders.create')

  useEffect(() => {
    document.title = `${t('purchaseOrders.newPurchaseOrder')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

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
          to="/purchase-orders"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToPurchaseOrders')}
        </Link>
      </div>
      {canCreate ? (
        <PurchaseOrderForm />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          {t('control.disabled.newPurchaseOrder')}
        </div>
      )}
    </div>
  )
}
