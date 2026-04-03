import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getOrdersByPersonId } from '@/services/orderService'
import { getPurchaseOrdersByPersonId } from '@/services/purchaseOrderService'
import {
  getPersonTransactions,
  roundMoney,
} from '@/services/peopleService'
import { LedgerReferenceLink } from '@/components/payments/LedgerReferenceLink'
import type { BalanceTransaction, BalanceTransactionType, Person } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NoteRichText } from '@/components/common/NoteWithDocLinks'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

function profileBalanceClass(b: number) {
  if (Math.abs(b) <= 0.005) {
    return 'text-green-600 dark:text-green-400'
  }
  return 'text-red-600 dark:text-red-400'
}

function txTypeLabel(
  type: BalanceTransactionType,
  t: (k: string) => string
): string {
  const m: Record<BalanceTransactionType, string> = {
    order: 'people.txOrder',
    purchase_order: 'people.txPurchaseOrder',
    payment_in: 'people.txPaymentIn',
    payment_out: 'people.txPaymentOut',
    adjustment: 'people.txAdjustment',
    wallet: 'people.txWallet',
    register_deposit: 'people.txRegisterDeposit',
    register_withdraw: 'people.txRegisterWithdraw',
  }
  return t(m[type])
}

function runningBalances(transactions: BalanceTransaction[]) {
  const asc = [...transactions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  let bal = 0
  const rows: Array<BalanceTransaction & { running: number }> = []
  for (const tx of asc) {
    bal = roundMoney(bal + tx.amount)
    rows.push({ ...tx, running: bal })
  }
  return rows.reverse()
}

export type PersonProfileDialogProps = {
  person: Person | null
  onOpenChange: (open: boolean) => void
  /** When set, shows Edit action (e.g. People page). */
  onEdit?: (p: Person) => void
}

export function PersonProfileDialog({
  person,
  onOpenChange,
  onEdit,
}: PersonProfileDialogProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const fc = (n: number) => formatCurrency(n, lang)
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  const [tab, setTab] = useState<
    'overview' | 'history' | 'orders' | 'pos'
  >('overview')
  const [txType, setTxType] = useState<BalanceTransactionType | 'all'>('all')
  const canEditPerson = useFeatureEnabled('people.editPerson')

  useEffect(() => {
    if (person) setTab('overview')
  }, [person])

  const pid = person?.id

  const { data: txs = [] } = useQuery({
    queryKey: ['personTxs', pid, txType],
    queryFn: () =>
      getPersonTransactions(pid!, {
        type: txType === 'all' ? undefined : txType,
      }),
    enabled: !!pid && !!person,
  })

  const { data: orders = [] } = useQuery({
    queryKey: ['personOrders', pid],
    queryFn: () => getOrdersByPersonId(pid!),
    enabled: Boolean(pid && person?.roles.includes('customer')),
  })

  const { data: pos = [] } = useQuery({
    queryKey: ['personPOs', pid],
    queryFn: () => getPurchaseOrdersByPersonId(pid!),
    enabled: Boolean(pid && person?.roles.includes('supplier')),
  })

  const running = useMemo(() => runningBalances(txs), [txs])

  const overview = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status_flow !== 'cancelled')
    const activePo = pos.filter((o) => o.status !== 'cancelled')
    return {
      orderCount: activeOrders.length,
      poCount: activePo.length,
      totalSpent: activeOrders.reduce((s, o) => s + o.total_amount, 0),
      totalBought: activePo.reduce((s, o) => s + o.total_amount, 0),
    }
  }, [orders, pos])

  const txSummary = useMemo(() => {
    let tin = 0
    let tout = 0
    for (const x of txs) {
      if (x.type === 'payment_in') tin += Math.abs(x.amount)
      if (x.type === 'payment_out') tout += Math.abs(x.amount)
    }
    return { tin, tout, net: tin - tout }
  }, [txs])

  if (!person) return null

  const explanation =
    person.balance > 0.005
      ? (t as (k: string, o: Record<string, string>) => string)(
          'people.balanceExplanationPositive',
          { name: person.name, amount: fc(person.balance) }
        )
      : person.balance < -0.005
        ? (t as (k: string, o: Record<string, string>) => string)(
            'people.balanceExplanationNegative',
            { name: person.name, amount: fc(-person.balance) }
          )
        : t('people.balanceExplanationZero')

  return (
    <Dialog open={!!person} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {person.name}
            {person.roles.includes('customer') && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {t('people.customer')}
              </span>
            )}
            {person.roles.includes('supplier') && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                {t('people.supplier')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {person.phone ?? '—'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {person.address ?? '—'}
              </p>
              <p
                className={cn(
                  'mt-2 text-3xl font-bold tabular-nums',
                  profileBalanceClass(person.balance)
                )}
              >
                {fc(Math.abs(person.balance))}
              </p>
              <p className="text-sm text-muted-foreground">{explanation}</p>
            </div>
            {canEditPerson && onEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => onEdit(person)}>
                  {t('people.editPerson')}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {(
              [
                ['overview', 'people.profileOverview'],
                ['history', 'people.balanceHistory'],
                ...(person.roles.includes('customer')
                  ? ([['orders', 'people.profileOrders']] as const)
                  : []),
                ...(person.roles.includes('supplier')
                  ? ([['pos', 'people.profilePurchaseOrders']] as const)
                  : []),
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  tab === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground'
                )}
                onClick={() => setTab(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('people.totalOrders')}
                  </p>
                  <p className="text-xl font-semibold">{overview.orderCount}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('people.totalPurchases')}
                  </p>
                  <p className="text-xl font-semibold">{overview.poCount}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('people.totalSpent')}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {fc(overview.totalSpent)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('people.totalBought')}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {fc(overview.totalBought)}
                  </p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  {t('people.discount')}:{' '}
                  {person.discount_rate > 0
                    ? `${person.discount_rate}%`
                    : t('people.emDash')}
                </p>
                <p>
                  {t('people.creditLimit')}:{' '}
                  {person.credit_limit != null
                    ? fc(person.credit_limit)
                    : t('people.noLimit')}
                </p>
                {person.notes ? (
                  <div className="text-muted-foreground">
                    <NoteRichText note={person.notes} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              <Select
                value={txType}
                onValueChange={(v) =>
                  setTxType(v === 'all' ? 'all' : (v as BalanceTransactionType))
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('people.filterTxAll')}</SelectItem>
                  <SelectItem value="order">{t('people.txOrder')}</SelectItem>
                  <SelectItem value="purchase_order">
                    {t('people.txPurchaseOrder')}
                  </SelectItem>
                  <SelectItem value="payment_in">
                    {t('people.txPaymentIn')}
                  </SelectItem>
                  <SelectItem value="payment_out">
                    {t('people.txPaymentOut')}
                  </SelectItem>
                  <SelectItem value="adjustment">
                    {t('people.txAdjustment')}
                  </SelectItem>
                  <SelectItem value="wallet">{t('people.txWallet')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-start">
                        {t('people.transactionDate')}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {t('people.transactionType')}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {t('people.reference')}
                      </th>
                      <th className="px-3 py-2 text-end">{t('people.amount')}</th>
                      <th className="px-3 py-2 text-end">
                        {t('people.runningBalance')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {running.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          {t('people.emptyTxHistory')}
                        </td>
                      </tr>
                    ) : (
                      running.map((row) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatDate(row.created_at)}
                          </td>
                          <td className="px-3 py-2">
                            {txTypeLabel(row.type, t)}
                          </td>
                          <td className="px-3 py-2">
                            <LedgerReferenceLink
                              row={{
                                type: row.type,
                                reference_id: row.reference_id,
                                reference_number: row.reference_number,
                                note: row.note,
                                ledger_operation_route_id:
                                  row.type === 'payment_in' ||
                                  row.type === 'payment_out'
                                    ? row.payment_group_id ?? row.id
                                    : undefined,
                              }}
                            />
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-end font-medium tabular-nums',
                              row.amount > 0
                                ? 'text-green-600'
                                : row.amount < 0
                                  ? 'text-red-600'
                                  : ''
                            )}
                          >
                            {row.amount > 0 ? '+' : ''}
                            {fc(row.amount)}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {fc(row.running)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  {t('people.summaryTotalIn')}: {fc(txSummary.tin)}
                </span>
                <span>
                  {t('people.summaryTotalOut')}: {fc(txSummary.tout)}
                </span>
                <span>
                  {t('people.summaryNet')}: {fc(txSummary.net)}
                </span>
              </div>
            </div>
          )}

          {tab === 'orders' && person.roles.includes('customer') && (
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('people.emptyOrdersForPerson')}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-start">
                        {t('orders.orderNumber')}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {t('orders.status')}
                      </th>
                      <th className="px-3 py-2 text-end">
                        {t('orders.totalAmount')}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {t('orders.date')}
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-border/50">
                        <td className="px-3 py-2">#{o.order_number}</td>
                        <td className="px-3 py-2">
                          {o.status_flow === 'draft' && t('orders.draft')}
                          {o.status_flow === 'confirmed' && t('orders.confirmed')}
                          {o.status_flow === 'completed' && t('orders.completed')}
                          {o.status_flow === 'cancelled' &&
                            t('orders.statusCancelled')}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums">
                          {fc(o.total_amount)}
                        </td>
                        <td className="px-3 py-2">{formatDate(o.created_at)}</td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => navigate(`/orders/${o.id}`)}
                          >
                            {t('people.openOrder')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'pos' && person.roles.includes('supplier') && (
            <div className="overflow-x-auto">
              {pos.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('people.emptyPOsForPerson')}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-start">
                        {t('purchaseOrders.orderNumber')}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {t('purchaseOrders.status')}
                      </th>
                      <th className="px-3 py-2 text-end">
                        {t('purchaseOrders.totalAmount')}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {t('purchaseOrders.date')}
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {pos.map((poRow) => (
                      <tr key={poRow.id} className="border-b border-border/50">
                        <td className="px-3 py-2">
                          #{t('purchaseOrders.poPrefix')}-{poRow.order_number}
                        </td>
                        <td className="px-3 py-2">{poRow.status}</td>
                        <td className="px-3 py-2 text-end tabular-nums">
                          {fc(poRow.total_amount)}
                        </td>
                        <td className="px-3 py-2">
                          {formatDate(poRow.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0"
                            onClick={() =>
                              navigate(`/purchase-orders/${poRow.id}`)
                            }
                          >
                            {t('people.openPO')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
