import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import {
  getAllPeople,
  listBalanceTransactionsWithPeople,
  roundMoney,
  supabaseErrorMessage,
  type PaymentGroupedListItem,
  type PaymentsHubTypeFilter,
} from '@/services/peopleService'
import type { BalanceTransactionType, PaymentMethod } from '@/types'
import { paymentLabel, PAYMENT_METHODS } from '@/components/orders/ordersShared'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/utils/currency'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

type MethodFilterState = 'all' | 'unspecified' | PaymentMethod

const DEBOUNCE_MS = 300
const MONEY_EPS = 0.005

function isPaymentMethod(m: unknown): m is PaymentMethod {
  return typeof m === 'string' && PAYMENT_METHODS.includes(m as PaymentMethod)
}

function aggregateTenderByMethod(
  lines: PaymentGroupedListItem['paymentLines']
): Record<PaymentMethod, number> {
  const sums = {
    cash: 0,
    visa: 0,
    cheque: 0,
    instapay: 0,
  } satisfies Record<PaymentMethod, number>
  for (const l of lines) {
    if (isPaymentMethod(l.payment_method)) {
      sums[l.payment_method] = roundMoney(
        sums[l.payment_method] + l.amount
      )
    }
  }
  return sums
}

function documentTotalValue(row: PaymentGroupedListItem): number | null {
  if (row.type === 'order') return roundMoney(row.amount)
  if (row.type === 'purchase_order') return roundMoney(Math.abs(row.amount))
  return null
}

function totalTenderAmount(
  lines: PaymentGroupedListItem['paymentLines']
): number {
  return roundMoney(lines.reduce((s, l) => s + l.amount, 0))
}

/** Consolidated view: remaining receivable/payable on order/PO row; full ledger uses raw signed amount. */
function balanceImpactDisplay(
  row: PaymentGroupedListItem,
  fullLedger: boolean
): number {
  if (fullLedger) return row.amount
  if (row.type === 'order') {
    const hasKnownTender = row.paymentLines.some((l) =>
      isPaymentMethod(l.payment_method)
    )
    if (hasKnownTender) {
      return roundMoney(row.amount - totalTenderAmount(row.paymentLines))
    }
  }
  if (row.type === 'purchase_order') {
    const hasKnownTender = row.paymentLines.some((l) =>
      isPaymentMethod(l.payment_method)
    )
    if (hasKnownTender) {
      return roundMoney(row.amount + totalTenderAmount(row.paymentLines))
    }
  }
  return row.amount
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
  }
  return t(m[type])
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PaymentsList() {
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const canList = useFeatureEnabled('payments.list')

  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })
  const [to, setTo] = useState(() => new Date().toISOString())
  const [typeFilter, setTypeFilter] =
    useState<PaymentsHubTypeFilter>('all_types')
  const [personId, setPersonId] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<MethodFilterState>('all')
  const [fullLedger, setFullLedger] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: rows = [], isLoading, isError, error: queryError } = useQuery({
    queryKey: [
      'balanceTransactions',
      from,
      to,
      typeFilter,
      personId,
      methodFilter,
      fullLedger,
    ],
    queryFn: () =>
      listBalanceTransactionsWithPeople({
        from,
        to,
        personId: personId === 'all' ? undefined : personId,
        typeFilter,
        fullLedger,
        paymentMethodFilter:
          methodFilter === 'all'
            ? 'all'
            : methodFilter === 'unspecified'
              ? 'unspecified'
              : methodFilter,
      }),
    enabled: canList,
  })

  const fc = useMemo(() => (n: number) => formatCurrency(n, lang), [lang])
  const methodLabel = (m: PaymentMethod | null) =>
    m ? paymentLabel(m, t) : t('payments.methodUnspecified')

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const note = (r.note ?? '').toLowerCase()
      const ref = (r.reference_number ?? '').toLowerCase()
      const typeStr = txTypeLabel(r.type, t).toLowerCase()
      const sums = aggregateTenderByMethod(r.paymentLines)
      const methodCols = PAYMENT_METHODS.map((m) =>
        `${paymentLabel(m, t)} ${sums[m]} ${fc(sums[m])}`.toLowerCase()
      ).join(' ')
      const doc = documentTotalValue(r)
      const docStr =
        doc != null ? `${doc} ${fc(doc)}`.toLowerCase() : ''
      const impact = balanceImpactDisplay(r, fullLedger)
      const impactStr = `${impact} ${fc(impact)}`.toLowerCase()
      const meth = r.paymentLines
        .map((l) => {
          const label = l.payment_method
            ? paymentLabel(l.payment_method, t)
            : t('payments.methodUnspecified')
          return `${label} ${l.amount} ${fc(l.amount)}`.toLowerCase()
        })
        .join(' ')
      const displayName =
        r.person_id == null
          ? t('payments.walkInCustomer').toLowerCase()
          : r.person.name.toLowerCase()
      return (
        displayName.includes(q) ||
        (r.person.phone ?? '').toLowerCase().includes(q) ||
        note.includes(q) ||
        ref.includes(q) ||
        typeStr.includes(q) ||
        meth.includes(q) ||
        methodCols.includes(q) ||
        docStr.includes(q) ||
        impactStr.includes(q) ||
        r.id.toLowerCase().includes(q)
      )
    })
  }, [rows, debouncedSearch, t, fc, fullLedger, i18n.language])

  /** Wallet / adjustment / tender not mapped to the four method columns. */
  const formatResidualDetails = (row: PaymentGroupedListItem) => {
    if (row.type === 'wallet') return t('people.txWallet')
    if (row.type === 'adjustment') return t('people.emDash')
    const residual = row.paymentLines.filter(
      (l) => l.payment_method != null && !isPaymentMethod(l.payment_method)
    )
    if (residual.length === 0) return t('people.emDash')
    return residual
      .map((l) => `${methodLabel(l.payment_method)} ${fc(l.amount)}`.trim())
      .join(' · ')
  }

  const formatMethodCell = (amount: number) =>
    Math.abs(amount) < MONEY_EPS ? t('people.emDash') : fc(amount)
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  useEffect(() => {
    document.title = `${t('payments.allPayments')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  if (!canList) {
    return <Navigate to="/payments" replace />
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <Link
        to="/payments"
        className="mb-1 -ms-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {t('payments.backToHub')}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('payments.allPayments')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('payments.listIntro')}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 md:flex-row md:flex-wrap md:items-end md:gap-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('payments.filterFrom')}</Label>
            <Input
              type="datetime-local"
              value={toDatetimeLocalValue(from)}
              onChange={(e) => {
                const v = e.target.value
                if (v) setFrom(new Date(v).toISOString())
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('payments.filterTo')}</Label>
            <Input
              type="datetime-local"
              value={toDatetimeLocalValue(to)}
              onChange={(e) => {
                const v = e.target.value
                if (v) setTo(new Date(v).toISOString())
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('payments.filterType')}</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) =>
                setTypeFilter(v as PaymentsHubTypeFilter)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_types">
                  {t('payments.typeAllTransactions')}
                </SelectItem>
                <SelectItem value="payments_both">
                  {t('payments.typePaymentsBoth')}
                </SelectItem>
                <SelectItem value="payment_in">
                  {t('people.txPaymentIn')}
                </SelectItem>
                <SelectItem value="payment_out">
                  {t('people.txPaymentOut')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('payments.filterPerson')}</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payments.filterPersonAll')}</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('payments.filterPaymentMethod')}</Label>
            <Select
              value={methodFilter}
              onValueChange={(v) => setMethodFilter(v as MethodFilterState)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payments.methodFilterAll')}</SelectItem>
                <SelectItem value="unspecified">
                  {t('payments.methodUnspecified')}
                </SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {paymentLabel(m, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="w-full min-w-[min(100%,16rem)] flex-1 space-y-1.5 md:max-w-md">
          <Label className="text-xs">{t('payments.searchLabel')}</Label>
          <Input
            placeholder={t('payments.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm md:max-w-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border-input"
            checked={fullLedger}
            onChange={(e) => setFullLedger(e.target.checked)}
          />
          <span>
            <span className="font-medium">{t('payments.showFullLedger')}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('payments.showFullLedgerHelp')}
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} columns={11} />
          </div>
        ) : isError ? (
          <p className="px-4 py-12 text-center text-sm text-destructive">
            {supabaseErrorMessage(queryError) || t('people.toastError')}
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('payments.emptyList')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">
                    {t('people.transactionDate')}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">
                    {t('people.name')}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">
                    {t('people.transactionType')}
                  </th>
                  <th
                    className="px-3 py-2.5 text-end font-medium text-muted-foreground whitespace-nowrap"
                    title={t('payments.listDocumentTotalHint')}
                  >
                    {t('payments.listDocumentTotal')}
                  </th>
                  {PAYMENT_METHODS.map((m) => (
                    <th
                      key={m}
                      className="px-3 py-2.5 text-end font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {paymentLabel(m, t)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">
                    {t('payments.logDetailsColumn')}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">
                    {t('people.reference')}
                  </th>
                  <th
                    className="px-3 py-2.5 text-end font-medium text-muted-foreground"
                    title={t('payments.listBalanceImpactHint')}
                  >
                    {t('payments.listBalanceImpact')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row: PaymentGroupedListItem) => {
                  const sums = aggregateTenderByMethod(row.paymentLines)
                  const docTotal = documentTotalValue(row)
                  const impact = balanceImpactDisplay(row, fullLedger)
                  const personLabel =
                    row.person_id == null
                      ? t('payments.walkInCustomer')
                      : row.person.name
                  return (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{personLabel}</div>
                      {row.person.phone && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {row.person.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{txTypeLabel(row.type, t)}</td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted-foreground whitespace-nowrap">
                      {docTotal != null ? fc(docTotal) : t('people.emDash')}
                    </td>
                    {PAYMENT_METHODS.map((m) => (
                      <td
                        key={m}
                        className="px-3 py-2 text-end tabular-nums text-muted-foreground whitespace-nowrap"
                      >
                        {formatMethodCell(sums[m])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-muted-foreground max-w-[min(100%,14rem)] whitespace-normal">
                      {formatResidualDetails(row)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.reference_number ?? t('people.emDash')}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-end tabular-nums font-medium',
                        impact > 0
                          ? 'text-green-600 dark:text-green-400'
                          : impact < 0
                            ? 'text-red-600 dark:text-red-400'
                            : ''
                      )}
                    >
                      {impact > 0 ? '+' : ''}
                      {fc(impact)}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('payments.resultCount', { count: filtered.length })}
        </p>
      )}
    </div>
  )
}
