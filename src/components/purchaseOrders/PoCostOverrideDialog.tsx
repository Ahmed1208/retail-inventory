import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function PoCostOverrideDialog({
  open,
  onOpenChange,
  productName,
  listCostLabel,
  onAllowOnce,
  onUpdateCatalog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  listCostLabel: string
  onAllowOnce: () => void
  onUpdateCatalog: () => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('purchaseOrders.costOverrideTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('purchaseOrders.costOverrideBody', {
            name: productName,
            listCost: listCostLabel,
          })}
        </p>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onAllowOnce}>
            {t('purchaseOrders.costOverrideAllowOnce')}
          </Button>
          <Button type="button" onClick={onUpdateCatalog}>
            {t('purchaseOrders.costOverrideUpdateCatalog')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
