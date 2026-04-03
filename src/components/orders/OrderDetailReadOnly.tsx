import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'

import type { OrderWithItemsAndPayments, Person } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  paymentLabel,
  statusBadgeClass,
  statusFlowLabel,
  type TFn,
} from '@/components/orders/ordersShared'
import { EditableNoteCard } from '@/components/common/EditableNoteCard'

export function OrderDetailReadOnly({
  order,
  t,
  lang,
  fc,
  people,
  canPrint = true,
  canCancel = true,
  canEditNote = true,
  paymentOperationLinkSlot,
  onPrint,
  onCancel,
  noteMut,
}: {
  order: OrderWithItemsAndPayments
  t: TFn
  lang: 'en' | 'ar'
  fc: (n: number) => string
  people: Person[]
  canPrint?: boolean
  canCancel?: boolean
  canEditNote?: boolean
  /** Optional link row under payment lines (e.g. open ledger operation). */
  paymentOperationLinkSlot?: ReactNode
  onPrint: () => void
  onCancel: () => void
  noteMut: {
    mutateAsync: (p: { id: string; text: string }) => Promise<unknown>
    isPending: boolean
  }
}) {
  const person = order.person_id
    ? people.find((p) => p.id === order.person_id)
    : null
  const paidRatio =
    order.total_amount > 0
      ? Math.min(100, (order.paid_amount / order.total_amount) * 100)
      : 0

  const statusAllowsCancel = order.status_flow !== 'cancelled'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="flex flex-wrap items-start gap-3 border-b bg-background p-4">
        <div>
          <h1 className="text-2xl font-bold tabular-nums">
            #{order.order_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
              dateStyle: 'full',
              timeStyle: 'short',
            }).format(new Date(order.created_at))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              statusBadgeClass(order.status_flow)
            )}
          >
            {statusFlowLabel(order.status_flow, t)}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              order.type === 'retail'
                ? 'bg-violet-100 text-violet-900'
                : 'bg-orange-100 text-orange-900'
            )}
          >
            {order.type === 'retail'
              ? t('orders.typeRetail')
              : t('orders.typeWholesale')}
          </span>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          {canPrint && (
            <Button type="button" variant="outline" onClick={onPrint}>
              <Printer className="me-2 h-4 w-4" />
              {t('orders.printInvoice')}
            </Button>
          )}
          {canCancel && statusAllowsCancel && (
            <Button type="button" variant="destructive" onClick={onCancel}>
              {t('orders.cancelOrder')}
            </Button>
          )}
        </div>
      </header>

      <div className="border-b p-4">
        <p className="font-medium">
          {person ? person.name : t('orders.walkIn')}
        </p>
        {person && (
          <p className="text-sm text-muted-foreground">
            {t('orders.personBalance')}: {fc(person.balance)}
          </p>
        )}
      </div>

      <div className="p-4">
        <h2 className="mb-2 text-sm font-semibold">{t('orders.products')}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start">{t('products.title')}</th>
                <th className="px-3 py-2 text-end">{t('common.quantity')}</th>
                <th className="px-3 py-2 text-end">{t('orders.unitPrice')}</th>
                <th className="px-3 py-2 text-end">{t('orders.discount')}</th>
                <th className="px-3 py-2 text-end">{t('orders.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">{it.product.name}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {it.quantity}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {fc(it.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {it.line_discount_rate > 0
                      ? `${it.line_discount_rate}%`
                      : '—'}
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

      <div className="border-b p-4">
        <h2 className="mb-2 text-sm font-semibold">
          {t('orders.paymentBreakdown')}
        </h2>
        {order.payment_installments.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {order.payment_installments.map((p) => (
              <li key={p.id} className="flex justify-between tabular-nums">
                <span>{paymentLabel(p.method, t)}</span>
                <span>{fc(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {paymentOperationLinkSlot != null && paymentOperationLinkSlot !== false && (
          <div className="mt-2 text-sm text-muted-foreground">
            {paymentOperationLinkSlot}
          </div>
        )}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${paidRatio}%` }}
          />
        </div>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <div className="space-y-1 text-sm tabular-nums">
          <div className="flex justify-between">
            <span>{t('orders.subtotal')}</span>
            <span>{fc(order.subtotal)}</span>
          </div>
          {order.discount_amount > 0.005 && (
            <div className="flex justify-between text-emerald-600">
              <span>
                {t('orders.discount')} ({order.discount_rate}%)
              </span>
              <span>−{fc(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>{t('orders.totalAmount')}</span>
            <span>{fc(order.total_amount)}</span>
          </div>
          <div className="flex justify-between text-emerald-600">
            <span>{t('orders.paid')}</span>
            <span>{fc(order.paid_amount)}</span>
          </div>
          <div
            className={cn(
              'flex justify-between',
              order.remaining_amount > 0.01 && 'text-destructive'
            )}
          >
            <span>{t('orders.remaining')}</span>
            <span>{fc(order.remaining_amount)}</span>
          </div>
        </div>
        <div>
          <EditableNoteCard
            label={t('orders.note')}
            value={order.note ?? ''}
            canEdit={canEditNote}
            isPending={noteMut.isPending}
            fieldId={`order-note-${order.id}`}
            onSave={async (text) => {
              await noteMut.mutateAsync({ id: order.id, text })
            }}
          />
        </div>
      </div>
    </div>
  )
}
