import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import { adjustStock, getProductQuantityInWarehouse } from '@/services/productService'
import type { ProductWithRelations } from '@/types'
import type { StockMovementType } from '@/types'
import type { Warehouse } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'
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
  warehouses,
  initialWarehouseId,
  onSuccess,
  onError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithRelations
  warehouses: Warehouse[]
  initialWarehouseId: number
  onSuccess: () => void
  onError: () => void
}) {
  const { t } = useTranslation()
  const [type, setType] = useState<StockMovementType>('in')
  const [quantity, setQuantity] = useState<number>(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId)

  useEffect(() => {
    if (open) {
      setWarehouseId(initialWarehouseId)
      setType('in')
      setQuantity(0)
      setNote('')
      setError(null)
    }
  }, [open, initialWarehouseId, product.id])

  const { data: whQty = 0 } = useQuery({
    queryKey: ['productWhStock', product.id, warehouseId],
    queryFn: () => getProductQuantityInWarehouse(product.id, warehouseId),
    enabled: open,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (type === 'out' && quantity > whQty) {
      setError(
        t('products.validationStockOutExceeds', { current: whQty })
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
      const noteText = note.trim()
      await adjustStock(
        product.id,
        type,
        quantity,
        noteText || undefined,
        type === 'in'
          ? { inboundUnitCost: product.cost_price, warehouseId }
          : { warehouseId }
      )
      await createAdminMentionNotificationIfNeeded({
        noteText,
        title: t('notifications.mentionTitleStockAdjust', {
          name: product.name,
        }),
        redirectBasePath: `/products/${product.id}`,
        sourceType: 'stock_adjust_note',
        sourceEntityId: product.id,
      })
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
          {product.name} — {t('warehouses.quantityAtWarehouse')}:{' '}
          <strong className="text-foreground">{whQty}</strong> {product.unit}{' '}
          ({t('products.totalAcrossLocations')}: {product.quantity})
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('warehouses.title')}</Label>
            <Select
              value={String(warehouseId)}
              onValueChange={(v) => setWarehouseId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.id} · {w.name}
                    {w.is_default ? ` (${t('warehouses.defaultBadge')})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label htmlFor="stock-adjust-note">{t('products.noteOptional')}</Label>
            <NoteMentionEditor
              id="stock-adjust-note"
              value={note}
              onChange={setNote}
              rows={3}
              className="mt-1 [&_textarea]:min-h-[60px]"
              aria-label={t('products.noteOptional')}
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
