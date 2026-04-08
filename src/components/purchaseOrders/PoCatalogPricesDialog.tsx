import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type PoCatalogPricesValues = {
  costPrice: number
  customerPrice: number
  businessPrice: number
}

export function PoCatalogPricesDialog({
  open,
  onOpenChange,
  initial,
  onConfirm,
  onBack,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: PoCatalogPricesValues
  onConfirm: (v: PoCatalogPricesValues) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [costPrice, setCostPrice] = useState(initial.costPrice)
  const [customerPrice, setCustomerPrice] = useState(initial.customerPrice)
  const [businessPrice, setBusinessPrice] = useState(initial.businessPrice)

  useEffect(() => {
    if (open) {
      setCostPrice(initial.costPrice)
      setCustomerPrice(initial.customerPrice)
      setBusinessPrice(initial.businessPrice)
    }
  }, [open, initial])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('purchaseOrders.catalogPricesTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('purchaseOrders.catalogPricesHint')}
        </p>
        <div className="space-y-3">
          <div>
            <Label>{t('products.costPrice')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-1"
              value={costPrice}
              onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>{t('products.businessPrice')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-1"
              value={businessPrice}
              onChange={(e) =>
                setBusinessPrice(parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label>{t('products.customerPrice')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-1"
              value={customerPrice}
              onChange={(e) =>
                setCustomerPrice(parseFloat(e.target.value) || 0)
              }
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onBack}>
            {t('purchaseOrders.catalogPricesBack')}
          </Button>
          <Button
            type="button"
            onClick={() =>
              onConfirm({
                costPrice,
                customerPrice,
                businessPrice,
              })
            }
          >
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
