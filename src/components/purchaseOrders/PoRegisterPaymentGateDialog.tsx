import { useTranslation } from 'react-i18next'

import type { Warehouse } from '@/types'
import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRTL: boolean
  registerWarehouses: Warehouse[]
  value: number
  onChange: (id: number) => void
  onContinue: () => void
}

export function PoRegisterPaymentGateDialog({
  open,
  onOpenChange,
  isRTL,
  registerWarehouses,
  value,
  onChange,
  onContinue,
}: Props) {
  const { t } = useTranslation()
  const canContinue =
    registerWarehouses.length > 0 &&
    registerWarehouses.some((w) => w.id === value)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{t('purchaseOrders.registerPaymentGateTitle')}</DialogTitle>
          <DialogDescription className="text-start">
            {t('purchaseOrders.registerPaymentGateDescription')}
          </DialogDescription>
        </DialogHeader>
        <WarehouseCombobox
          id="po-register-gate-wh"
          label={t('purchaseOrders.selectRegisterWarehouse')}
          warehouses={registerWarehouses}
          filterHasRegister
          value={value}
          onChange={onChange}
          disabled={registerWarehouses.length === 0}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              if (!canContinue) return
              onContinue()
            }}
          >
            {t('purchaseOrders.registerPaymentGateContinue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
