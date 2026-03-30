import { useEffect } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import {
  type POLineRow,
  PO_TABLE_GRID,
  poLineTotal,
  costDiffersFromList,
} from '@/components/purchaseOrders/poLineShared'
import type { TFn } from '@/components/orders/ordersShared'

const focusRing = (active: boolean) =>
  cn(
    'h-8 rounded-md border text-xs outline-none transition-shadow',
    active && 'ring-2 ring-blue-500 ring-offset-1 border-blue-500'
  )

type Props = {
  line: POLineRow
  rowIndex: number
  t: TFn
  fc: (n: number) => string
  duplicateProductIds: Set<string>
  isRowFocused: boolean
  focusedCol: number
  setCellRef: (lineKey: string, col: number, el: HTMLElement | null) => void
  onGridKeyDown: (
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number,
    lineKey: string
  ) => void
  onChange: (p: Partial<POLineRow>) => void
  onDebouncedLookup: (lineKey: string, raw: string) => void
  onRemove: () => void
  onOpenBrowser: () => void
  onBackspaceEmpty: () => void
  onFocusCell: (col: number) => void
}

export function PoLineRow({
  line,
  rowIndex,
  t,
  fc,
  duplicateProductIds,
  isRowFocused,
  focusedCol,
  setCellRef,
  onGridKeyDown,
  onChange,
  onDebouncedLookup,
  onRemove,
  onOpenBrowser,
  onBackspaceEmpty,
  onFocusCell,
}: Props) {
  const debouncedInput = useDebouncedValue(line.productIdInput, 300)

  useEffect(() => {
    onDebouncedLookup(line.key, debouncedInput)
  }, [debouncedInput, line.key, onDebouncedLookup])

  const lt = poLineTotal(line)
  const dup =
    line.product_id && duplicateProductIds.has(line.product_id)
  const idInvalid = Boolean(line.lookupInvalid && line.productIdInput.trim())

  const rowBg = cn(
    'grid items-center gap-1 border-b border-border/50 px-2 py-0.5 sm:py-1',
    PO_TABLE_GRID,
    dup && 'bg-amber-50/80 dark:bg-amber-950/20',
    isRowFocused && 'bg-sky-50/60 dark:bg-sky-950/20'
  )

  return (
    <>
      <div className={rowBg}>
        <span className="text-center text-xs text-muted-foreground">
          {rowIndex + 1}
        </span>
        <div className="relative">
          <Input
            ref={(el) => setCellRef(line.key, 0, el)}
            title={idInvalid ? t('orders.productNotFound') : undefined}
            className={cn(
              focusRing(focusedCol === 0),
              'px-1 font-mono',
              idInvalid && 'border-destructive ring-destructive/30'
            )}
            value={line.productIdInput}
            onChange={(e) =>
              onChange({
                productIdInput: e.target.value,
                product_id: '',
                name: '',
                costPrice: 0,
                listCostPrice: 0,
                costOverridden: false,
                stock: 0,
                lookupInvalid: false,
                updateDefaultCostPrice: false,
              })
            }
            onFocus={() => onFocusCell(0)}
            onKeyDown={(e) => {
              if (e.key === 'F1') {
                e.preventDefault()
                onOpenBrowser()
                return
              }
              if (
                e.key === 'Backspace' &&
                !line.productIdInput &&
                !line.product_id
              ) {
                e.preventDefault()
                onBackspaceEmpty()
                return
              }
              onGridKeyDown(e, rowIndex, 0, line.key)
            }}
          />
          {dup && (
            <AlertTriangle
              className="absolute -end-1 top-1/2 h-3 w-3 -translate-y-1/2 text-amber-600"
              aria-label={t('orders.duplicateProduct')}
            />
          )}
        </div>
        <Input
          ref={(el) => setCellRef(line.key, 1, el)}
          readOnly
          tabIndex={0}
          title={line.name || undefined}
          className={cn(focusRing(focusedCol === 1), 'bg-muted/50 px-1')}
          value={line.name}
          placeholder="—"
          onFocus={() => onFocusCell(1)}
          onKeyDown={(e) => onGridKeyDown(e, rowIndex, 1, line.key)}
        />
        <div
          ref={(el) => setCellRef(line.key, 2, el)}
          tabIndex={0}
          className={cn(
            focusRing(focusedCol === 2),
            'flex h-8 items-center justify-center bg-muted/40 px-0.5 text-[11px] tabular-nums sm:text-xs'
          )}
          onFocus={() => onFocusCell(2)}
          onKeyDown={(e) => onGridKeyDown(e, rowIndex, 2, line.key)}
        >
          {line.product_id ? line.stock : '—'}
        </div>
        <Input
          ref={(el) => setCellRef(line.key, 3, el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={cn(focusRing(focusedCol === 3), 'px-1 tabular-nums')}
          value={line.qty}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            if (raw === '') {
              onChange({ qty: 1 })
              return
            }
            onChange({ qty: Math.max(1, parseInt(raw, 10) || 1) })
          }}
          onFocus={() => onFocusCell(3)}
          onKeyDown={(e) => onGridKeyDown(e, rowIndex, 3, line.key)}
        />
        <div className="flex min-w-0 items-center gap-0.5">
          <Input
            ref={(el) => setCellRef(line.key, 4, el)}
            type="number"
            min={0}
            step="0.01"
            title={
              costDiffersFromList(line)
                ? t('orders.priceModifiedWarning')
                : undefined
            }
            className={cn(
              focusRing(focusedCol === 4),
              'min-w-0 flex-1 px-1',
              costDiffersFromList(line) &&
                'border-amber-500/80 ring-1 ring-amber-500/40'
            )}
            value={line.costPrice}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0
              const list = line.listCostPrice
              const overridden =
                Boolean(line.product_id) && Math.abs(v - list) > 0.005
              onChange({
                costPrice: v,
                costOverridden: overridden,
                updateDefaultCostPrice: overridden
                  ? line.updateDefaultCostPrice
                  : false,
              })
            }}
            onFocus={() => onFocusCell(4)}
            onKeyDown={(e) => onGridKeyDown(e, rowIndex, 4, line.key)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            className="h-7 shrink-0 px-1 py-0 text-[10px] font-normal leading-tight"
            disabled={!line.product_id || !costDiffersFromList(line)}
            title={t('orders.restoreCatalogPrice')}
            onClick={() =>
              onChange({
                costPrice: line.listCostPrice,
                costOverridden: false,
                updateDefaultCostPrice: false,
              })
            }
          >
            {t('orders.originalPrice')}
          </Button>
        </div>
        <div
          ref={(el) => setCellRef(line.key, 5, el)}
          tabIndex={0}
          className={cn(
            focusRing(focusedCol === 5),
            'flex h-8 items-center justify-end bg-muted/50 px-1 tabular-nums'
          )}
          onFocus={() => onFocusCell(5)}
          onKeyDown={(e) => onGridKeyDown(e, rowIndex, 5, line.key)}
        >
          {line.product_id ? fc(lt) : '—'}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label={t('orders.remove')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {costDiffersFromList(line) && (
        <div
          className={cn(
            'grid border-b border-border/50 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200 sm:px-3',
            PO_TABLE_GRID
          )}
        >
          <div className="col-span-full flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t('purchaseOrders.costPriceDiffWarning', {
                default: fc(line.listCostPrice),
              })}
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={line.updateDefaultCostPrice}
                onChange={(e) =>
                  onChange({ updateDefaultCostPrice: e.target.checked })
                }
              />
              {t('purchaseOrders.updateDefaultCostPrice')}
            </label>
          </div>
        </div>
      )}
    </>
  )
}
