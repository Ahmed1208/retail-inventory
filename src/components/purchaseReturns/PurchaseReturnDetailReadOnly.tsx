import { Link } from 'react-router-dom'
import { Printer } from 'lucide-react'

import type { Person, PurchaseReturnWithItems, Warehouse } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { paymentLabel } from '@/components/orders/ordersShared'
import {
  settlementLabel,
  statusBadgeClass,
  statusFlowLabel,
  type TFn,
} from '@/components/purchaseReturns/purchaseReturnsShared'
import { EditableNoteCard } from '@/components/common/EditableNoteCard'

export function PurchaseReturnDetailReadOnly({
  purchaseReturn,
  sourceOrderNumber,
  t,
  lang,
  fc,
  people,
  warehouses = [],
  canPrint = true,
  canCancel = true,
  canEditNote = true,
  onPrint,
  onCancel,
  noteMut,
}: {
  purchaseReturn: PurchaseReturnWithItems
  sourceOrderNumber: number | null
  t: TFn
  lang: 'en' | 'ar'
  fc: (n: number) => string
  people: Person[]
  warehouses?: Warehouse[]
  canPrint?: boolean
  canCancel?: boolean
  canEditNote?: boolean
  onPrint: () => void
  onCancel: () => void
  noteMut: {
    mutateAsync: (p: { id: string; text: string }) => Promise<unknown>
    isPending: boolean
  }
}) {
  const person = purchaseReturn.person_id
    ? people.find((p) => p.id === purchaseReturn.person_id)
    : null
  const warehouse =
    warehouses.find((w) => w.id === purchaseReturn.warehouse_id) ?? null
  const statusAllowsCancel = purchaseReturn.status_flow !== 'cancelled'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="flex flex-wrap items-start gap-3 border-b bg-background p-4">
        <div>
          <h1 className="text-2xl font-bold tabular-nums">
            PR-{purchaseReturn.return_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
              dateStyle: 'full',
              timeStyle: 'short',
            }).format(new Date(purchaseReturn.created_at))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {purchaseReturn.is_historical_snapshot ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
              {t('orders.historicalImportBadge')}
            </span>
          ) : null}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              statusBadgeClass(purchaseReturn.status_flow)
            )}
          >
            {statusFlowLabel(purchaseReturn.status_flow, t)}
          </span>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          {canPrint && (
            <Button type="button" variant="outline" onClick={onPrint}>
              <Printer className="me-2 h-4 w-4" />
              {t('purchaseReturns.printReceipt')}
            </Button>
          )}
          {canCancel && statusAllowsCancel && (
            <Button type="button" variant="destructive" onClick={onCancel}>
              {t('purchaseReturns.cancelReturn')}
            </Button>
          )}
        </div>
      </header>

      <div className="border-b p-4">
        <p className="font-medium">
          {person ? person.name : t('purchaseOrders.noLinkedSupplier')}
        </p>
        {person && (
          <p className="text-sm text-muted-foreground">
            {t('orders.personBalance')}: {fc(person.balance)}
          </p>
        )}
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">
            {t('purchaseReturns.againstOrder')}:
          </span>{' '}
          <Link
            to={`/purchase-orders/${purchaseReturn.source_purchase_order_id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {sourceOrderNumber != null
              ? `#${sourceOrderNumber}`
              : t('purchaseReturns.viewSourceOrder')}
          </Link>
        </p>
      </div>

      <div className="border-b p-4">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t('purchaseReturns.shipFrom')}:
          </span>{' '}
          {warehouse
            ? `#${warehouse.id} · ${warehouse.name}`
            : `#${purchaseReturn.warehouse_id}`}
        </p>
      </div>

      <div className="p-4">
        <h2 className="mb-2 text-sm font-semibold">{t('orders.products')}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start">{t('products.title')}</th>
                <th className="px-3 py-2 text-end">
                  {t('purchaseReturns.returnQty')}
                </th>
                <th className="px-3 py-2 text-end">
                  {t('purchaseOrders.costPrice')}
                </th>
                <th className="px-3 py-2 text-end">{t('orders.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {purchaseReturn.items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">{it.product.name}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {it.quantity}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {fc(it.cost_price)}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {fc(it.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <div className="space-y-1 text-sm tabular-nums">
          <div className="flex justify-between text-base font-bold">
            <span>{t('purchaseReturns.refundAmount')}</span>
            <span>{fc(purchaseReturn.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t('purchaseReturns.settlementLabel')}
            </span>
            <span>{settlementLabel(purchaseReturn.settlement, t)}</span>
          </div>
          {purchaseReturn.refund_method && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('purchaseReturns.refundMethod')}
              </span>
              <span>{paymentLabel(purchaseReturn.refund_method, t)}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <EditableNoteCard
            label={t('purchaseReturns.note')}
            value={purchaseReturn.note ?? ''}
            canEdit={canEditNote}
            isPending={noteMut.isPending}
            fieldId={`purchase-return-note-${purchaseReturn.id}`}
            onSave={async (text) => {
              await noteMut.mutateAsync({ id: purchaseReturn.id, text })
            }}
          />
        </div>
      </div>
    </div>
  )
}
