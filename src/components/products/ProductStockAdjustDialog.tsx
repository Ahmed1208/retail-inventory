import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { adjustStock } from '@/services/productService'
import type { ProductWithRelations } from '@/types'
import type { StockMovementType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ProductStockAdjustDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
  onError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithRelations
  onSuccess: () => void
  onError: () => void
}) {
  const { t } = useTranslation()
  const [type, setType] = useState<StockMovementType>('in')
  const [quantity, setQuantity] = useState<number>(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (type === 'out' && quantity > product.quantity) {
      setError(
        t('products.validationStockOutExceeds', { current: product.quantity })
      )
      return
    }
    if ((type === 'in' || type === 'out') && quantity < 1) {
      setError(t('products.validationMinOne'))
      return
    }
    if (type === 'adjustment' && quantity < 0) {
      setError(t('products.validationMinZero'))
      return
    }
    try {
      await adjustStock(product.id, type, quantity, note || undefined)
      onSuccess()
    } catch {
      onError()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('products.stockAdjustTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {product.name} — {t('products.currentStock')}:{' '}
          <strong className="text-foreground">{product.quantity}</strong>{' '}
          {product.unit}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('dashboard.type')}</Label>
            <div className="flex gap-4">
              {(['in', 'out', 'adjustment'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    checked={type === opt}
                    onChange={() => setType(opt)}
                    className="rounded-full"
                  />
                  <span>{t(`stockMovements.${opt}`)}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>{t('common.quantity')}</Label>
            <Input
              type="number"
              min={type === 'adjustment' ? 0 : 1}
              value={quantity === 0 ? '' : quantity}
              onChange={(e) =>
                setQuantity(e.target.value === '' ? 0 : Number(e.target.value))
              }
              className="mt-1"
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>
          <div>
            <Label>{t('products.noteOptional')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
