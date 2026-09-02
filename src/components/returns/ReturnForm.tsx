import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'

import type { Person, Warehouse } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/utils'
import { useQtyInputDraft } from '@/hooks/useQtyInputDraft'
import {
  effectiveRowQty,
  returnLineTotal,
  returnLinesTotal,
  type ReturnLineRow,
} from '@/components/returns/returnsShared'

type SourceOrderSummary = {
  id: string
  order_number: number
  person_id: string | null
  warehouse_id: number
  created_at: string
}

type Props = {
  sourceOrder: SourceOrderSummary | null
  rows: ReturnLineRow[]
  onRowsChange: (rows: ReturnLineRow[]) => void
  people: Person[]
  warehouses: Warehouse[]
  lang: 'en' | 'ar'
  isRTL: boolean
  formatCurrency: (n: number) => string
  linesLoading?: boolean
  /** Hidden when editing an existing draft, whose source order is fixed. */
  canPickSourceOrder?: boolean
  onRequestPickSourceOrder?: () => void
  canSave: boolean
  saving: boolean
  onSaveDraft?: () => void
  onConfirm: () => void
  confirmLabel: string
}

function QtyCell({
  row,
  onQty,
}: {
  row: ReturnLineRow
  onQty: (qty: number) => void
}) {
  const { displayValue, onQtyFocus, onQtyChange, onQtyBlur } = useQtyInputDraft(
    row.source_order_item_id,
    row.product_id,
    row.qty,
    ({ qty }) => onQty(Math.min(qty, Math.max(1, row.returnableQty)))
  )

  return (
    <Input
      type="text"
      inputMode="numeric"
      className="ms-auto h-8 w-20 text-end tabular-nums"
      value={displayValue}
      disabled={!row.selected || row.returnableQty === 0}
      onFocus={onQtyFocus}
      onChange={onQtyChange}
      onBlur={onQtyBlur}
      aria-label={row.name}
    />
  )
}

export function ReturnForm({
  sourceOrder,
  rows,
  onRowsChange,
  people,
  warehouses,
  lang,
  isRTL,
  formatCurrency,
  linesLoading = false,
  canPickSourceOrder = false,
  onRequestPickSourceOrder,
  canSave,
  saving,
  onSaveDraft,
  onConfirm,
  confirmLabel,
}: Props) {
  const { t } = useTranslation()

  const person = sourceOrder?.person_id
    ? (people.find((p) => p.id === sourceOrder.person_id) ?? null)
    : null
  const warehouse = sourceOrder
    ? (warehouses.find((w) => w.id === sourceOrder.warehouse_id) ?? null)
    : null

  const total = returnLinesTotal(rows)
  const selectedCount = rows.filter((r) => effectiveRowQty(r) > 0).length

  const patchRow = (id: string, patch: Partial<ReturnLineRow>) => {
    onRowsChange(
      rows.map((r) =>
        r.source_order_item_id === id ? { ...r, ...patch } : r
      )
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', isRTL && 'rtl')}>
      <header className="flex flex-wrap items-start gap-3 border-b bg-background p-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{t('returns.newReturn')}</h1>
          {sourceOrder ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('returns.againstOrder')}{' '}
              <span className="font-medium tabular-nums text-foreground">
                #{sourceOrder.order_number}
              </span>
              {' · '}
              {person ? person.name : t('orders.walkIn')}
              {' · '}
              {new Intl.DateTimeFormat(
                lang === 'ar' ? 'ar-EG' : 'en-US',
                { dateStyle: 'medium' }
              ).format(new Date(sourceOrder.created_at))}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('returns.pickSourceOrderHint')}
            </p>
          )}
        </div>
        {canPickSourceOrder && onRequestPickSourceOrder && (
          <Button
            type="button"
            variant="outline"
            className="ms-auto"
            onClick={onRequestPickSourceOrder}
          >
            <Search className="me-2 h-4 w-4" />
            {sourceOrder
              ? t('returns.changeSourceOrder')
              : t('returns.pickSourceOrder')}
          </Button>
        )}
      </header>

      {sourceOrder && (
        <div className="border-b px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            {t('returns.restockTo')}:
          </span>{' '}
          {warehouse
            ? `#${warehouse.id} · ${warehouse.name}`
            : `#${sourceOrder.warehouse_id}`}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!sourceOrder ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('returns.pickSourceOrderHint')}
          </p>
        ) : linesLoading ? (
          <LoadingSkeleton />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('returns.nothingLeftToReturn')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-start">
                    {t('products.title')}
                  </th>
                  <th className="px-3 py-2 text-end">{t('returns.sold')}</th>
                  <th className="px-3 py-2 text-end">
                    {t('returns.alreadyReturned')}
                  </th>
                  <th className="px-3 py-2 text-end">
                    {t('returns.returnable')}
                  </th>
                  <th className="px-3 py-2 text-end">
                    {t('returns.returnQty')}
                  </th>
                  <th className="px-3 py-2 text-end">{t('orders.unitPrice')}</th>
                  <th className="px-3 py-2 text-end">{t('orders.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const exhausted = row.returnableQty === 0
                  return (
                    <tr
                      key={row.source_order_item_id}
                      className={cn('border-t', exhausted && 'opacity-50')}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={exhausted}
                          aria-label={row.name}
                          onChange={(e) =>
                            patchRow(row.source_order_item_id, {
                              selected: e.target.checked,
                              qty:
                                e.target.checked && row.qty < 1
                                  ? 1
                                  : row.qty,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {row.soldQty}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {row.alreadyReturned}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {row.returnableQty}
                      </td>
                      <td className="px-3 py-2">
                        <QtyCell
                          row={row}
                          onQty={(qty) =>
                            patchRow(row.source_order_item_id, { qty })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {formatCurrency(row.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {formatCurrency(returnLineTotal(row))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t bg-background p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">
            {t('returns.linesSelected', { count: selectedCount })}
          </span>
          <div className="text-lg font-semibold tabular-nums">
            {t('returns.refundAmount')}: {formatCurrency(total)}
          </div>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          {onSaveDraft && (
            <Button
              type="button"
              variant="outline"
              disabled={!canSave || saving}
              onClick={onSaveDraft}
            >
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('returns.saveDraft')}
            </Button>
          )}
          <Button
            type="button"
            disabled={!canSave || saving}
            onClick={onConfirm}
          >
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </footer>
    </div>
  )
}
