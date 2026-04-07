import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'

import {
  getAllPeople,
  listBalanceTransactionsWithPeople,
  roundMoney,
  supabaseErrorMessage,
  type PaymentGroupedListItem,
  type PaymentsHubTypeFilter,
} from '@/services/peopleService'
import type { BalanceTransactionType, PaymentMethod, Person } from '@/types'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { NoteWithDocLinks } from '@/components/common/NoteWithDocLinks'
import { LedgerReferenceLink } from '@/components/payments/LedgerReferenceLink'
import { isRetainedFromCancelledDocumentNote } from '@/utils/ledgerLinks'
import { PersonProfileDialog } from '@/components/people/PersonProfileDialog'

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

/** Consolidated view: order = customer-centric (negative = still owes / balance down, positive = credit or overpay); PO = signed payable remainder; full ledger uses raw signed amount. */
function balanceImpactDisplay(
  row: PaymentGroupedListItem,
  fullLedger: boolean
): number {
  if (fullLedger) return row.amount
  if (row.reversed) return 0
  if (row.type === 'order') {
    const tender = totalTenderAmount(row.paymentLines)
    return roundMoney(tender - row.amount)
  }
  if (row.type === 'purchase_order') {
    const hasKnownTender = row.paymentLines.some((l) =>
      isPaymentMethod(l.payment_method)
    )
    if (hasKnownTender) {
      return roundMoney(row.amount + totalTenderAmount(row.paymentLines))
    }
  }
  if (row.type === 'register_deposit') return roundMoney(row.amount)
  if (row.type === 'register_withdraw') return roundMoney(-row.amount)
  return row.amount
}

/**
 * Signed person-ledger total for green/red on Balance impact. The displayed number can differ
 * (e.g. remaining on document for orders/POs); color follows actual balance movement when a person is linked.
 */
function personBalanceDeltaForStyle(
  row: PaymentGroupedListItem,
  fullLedger: boolean
): number {
  if (row.type === 'register_deposit' || row.type === 'register_withdraw') {
    return 0
  }
  if (!fullLedger && row.reversed) return 0
  if (!fullLedger && row.person_id == null) return 0
  if (!fullLedger && row.type === 'order') {
    return roundMoney(
      totalTenderAmount(row.paymentLines) - row.amount
    )
  }
  return row.amount
}

/**
 * Net register (drawer / tender) effect aligned with `registerEffectForRow`: payment lines use `-amount`,
 * deposits positive, withdraws negative; order/PO use tender totals when attached to the row.
 */
function registerImpactValue(
  row: PaymentGroupedListItem,
  fullLedger: boolean
): number | null {
  if (!fullLedger && row.reversed) return 0
  const t = row.type
  if (t === 'payment_in' || t === 'payment_out') {
    return roundMoney(-row.amount)
  }
  if (t === 'register_deposit') return roundMoney(row.amount)
  if (t === 'register_withdraw') return roundMoney(-row.amount)
  if (t === 'order') {
    const tender = totalTenderAmount(row.paymentLines)
    return Math.abs(tender) < MONEY_EPS ? null : roundMoney(tender)
  }
  if (t === 'purchase_order') {
    const tender = totalTenderAmount(row.paymentLines)
    return Math.abs(tender) < MONEY_EPS ? null : roundMoney(-tender)
  }
  return null
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
  const canFullLedgerView = useFeatureEnabled('payments.fullLedgerView')

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
  const effectiveFullLedger = canFullLedgerView && fullLedger
  const [expandedNestedParents, setExpandedNestedParents] = useState<
    Set<string>
  >(() => new Set())
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)
  const [ledgerProfilePerson, setLedgerProfilePerson] = useState<Person | null>(
    null
  )

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const peopleById = useMemo(() => {
    const m = new Map<string, Person>()
    for (const p of people) m.set(p.id, p)
    return m
  }, [people])

  const { data: rows = [], isLoading, isError, error: queryError } = useQuery({
    queryKey: [
      'balanceTransactions',
      from,
      to,
      typeFilter,
      personId,
      methodFilter,
      effectiveFullLedger,
    ],
    queryFn: () =>
      listBalanceTransactionsWithPeople({
        from,
        to,
        personId: personId === 'all' ? undefined : personId,
        typeFilter,
        fullLedger: effectiveFullLedger,
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

    const reversedBadgeStr = t('payments.reversedBadge').toLowerCase()
    const reversedHintStr = t('payments.reversedDetailsHint').toLowerCase()
    const poCancelledStr = t('payments.poCancelledBadge').toLowerCase()
    const orderCancelledStr = t('payments.orderCancelledBadge').toLowerCase()
    const orderCompletedStr = t('payments.orderCompletedBadge').toLowerCase()

    const matchesSearchRow = (r: PaymentGroupedListItem) => {
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
      const impact = balanceImpactDisplay(r, effectiveFullLedger)
      const impactStr = `${impact} ${fc(impact)}`.toLowerCase()
      const reg = registerImpactValue(r, effectiveFullLedger)
      const regStr =
        reg == null ? '' : `${reg} ${fc(reg)}`.toLowerCase()
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
        regStr.includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.reversed && reversedBadgeStr.includes(q)) ||
        (r.reversed && reversedHintStr.includes(q)) ||
        (r.type === 'purchase_order' &&
          r.purchaseOrderStatus === 'cancelled' &&
          poCancelledStr.includes(q)) ||
        (r.type === 'order' &&
          r.orderStatus === 'cancelled' &&
          orderCancelledStr.includes(q)) ||
        (r.type === 'order' &&
          r.orderStatus === 'completed' &&
          orderCompletedStr.includes(q))
      )
    }

    return rows.filter(
      (parent) =>
        matchesSearchRow(parent) ||
        (parent.children ?? []).some((c) => matchesSearchRow(c))
    )
  }, [rows, debouncedSearch, t, fc, effectiveFullLedger, i18n.language])

  const toggleNestedParent = (parentId: string) => {
    setExpandedNestedParents((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

  const visibleRowCount = useMemo(
    () =>
      filtered.reduce((n, p) => {
        const childCount = p.children?.length ?? 0
        const showChildren =
          !effectiveFullLedger && childCount > 0 && expandedNestedParents.has(p.id)
        return n + 1 + (showChildren ? childCount : 0)
      }, 0),
    [filtered, effectiveFullLedger, expandedNestedParents]
  )

  /** Wallet / adjustment / tender not mapped to the four method columns. */
  const formatResidualDetails = (row: PaymentGroupedListItem) => {
    if (
      !effectiveFullLedger &&
      row.reversed &&
      (row.type === 'payment_in' ||
        row.type === 'payment_out' ||
        row.type === 'wallet')
    ) {
      return t('payments.reversedDetailsHint')
    }
    if (row.type === 'wallet') return t('people.txWallet')
    if (row.type === 'register_deposit') return t('people.txRegisterDeposit')
    if (row.type === 'register_withdraw') return t('people.txRegisterWithdraw')
    if (row.type === 'adjustment') return t('people.emDash')
    const residual = row.paymentLines.filter(
      (l) => l.payment_method != null && !isPaymentMethod(l.payment_method)
    )
    if (residual.length === 0) return t('people.emDash')
    return residual
      .map((l) => `${methodLabel(l.payment_method)} ${fc(l.amount)}`.trim())
      .join(' · ')
  }

  const renderLogDetailsCell = (row: PaymentGroupedListItem) => {
    if (
      row.note &&
      isRetainedFromCancelledDocumentNote(row.note) &&
      (row.type === 'payment_in' ||
        row.type === 'payment_out' ||
        row.type === 'wallet')
    ) {
      return <NoteWithDocLinks note={row.note} />
    }
    return <span>{formatResidualDetails(row)}</span>
  }

  const formatMethodCell = (amount: number) =>
    Math.abs(amount) < MONEY_EPS ? t('people.emDash') : fc(amount)
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  const renderTransactionRow = (
    row: PaymentGroupedListItem,
    isChild: boolean,
    rowKey: string,
    nestedExpand?: { expanded: boolean; onToggle: () => void }
  ) => {
    const sums = aggregateTenderByMethod(row.paymentLines)
    const docTotal = documentTotalValue(row)
    const impact = balanceImpactDisplay(row, effectiveFullLedger)
    const balanceStyleDelta = personBalanceDeltaForStyle(
      row,
      effectiveFullLedger
    )
    const registerImpact = registerImpactValue(row, effectiveFullLedger)
    const personLabel =
      row.person_id == null &&
      (row.type === 'register_deposit' || row.type === 'register_withdraw')
        ? t('register.ledgerPartyName')
        : row.person_id == null
          ? t('payments.walkInCustomer')
          : row.person.name
    const profilePerson =
      row.person_id != null ? peopleById.get(row.person_id) ?? null : null
    const strikeTender = row.reversed && !effectiveFullLedger
    const poCancelled =
      row.type === 'purchase_order' &&
      row.purchaseOrderStatus === 'cancelled'
    const orderCancelled =
      row.type === 'order' && row.orderStatus === 'cancelled'
    const orderCompleted =
      !isChild &&
      row.type === 'order' &&
      row.orderStatus === 'completed'

    const statusInner = isChild ? (
      row.reversed ? (
        <Badge
          variant="outline"
          className="font-normal text-muted-foreground"
        >
          {t('payments.reversedBadge')}
        </Badge>
      ) : (
        <span className="text-muted-foreground">{t('people.emDash')}</span>
      )
    ) : row.reversed ||
      poCancelled ||
      orderCancelled ||
      orderCompleted ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {row.reversed && (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {t('payments.reversedBadge')}
          </Badge>
        )}
        {poCancelled && (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {t('payments.poCancelledBadge')}
          </Badge>
        )}
        {orderCancelled && (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {t('payments.orderCancelledBadge')}
          </Badge>
        )}
        {orderCompleted && (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {t('payments.orderCompletedBadge')}
          </Badge>
        )}
      </div>
    ) : (
      <span className="text-muted-foreground">{t('people.emDash')}</span>
    )

    return (
      <tr
        key={rowKey}
        className={cn(
          'border-b border-border/50 hover:bg-muted/30',
          strikeTender && 'opacity-[0.85]',
          isChild && 'bg-muted/15'
        )}
      >
        <td
          className={cn(
            'px-3 py-2 whitespace-nowrap',
            isChild && 'border-s-2 border-s-border ps-8'
          )}
        >
          {formatDateTime(row.created_at)}
        </td>
        <td className="px-3 py-2">
          {profilePerson ? (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-medium text-foreground hover:text-primary"
              onClick={() => setLedgerProfilePerson(profilePerson)}
            >
              {personLabel}
            </Button>
          ) : (
            <div className="font-medium">{personLabel}</div>
          )}
          {row.person_id != null && row.person.phone ? (
            <div className="text-xs text-muted-foreground font-mono">
              {row.person.phone}
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2">
          {nestedExpand ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-expanded={nestedExpand.expanded}
                aria-label={t('payments.expandNestedPaymentsAria')}
                onClick={() => nestedExpand.onToggle()}
              >
                <ChevronRight
                  className={cn(
                    'size-4 transition-transform',
                    nestedExpand.expanded && 'rotate-90',
                    isRTL && '-scale-x-100'
                  )}
                />
              </Button>
              <span>{txTypeLabel(row.type, t)}</span>
            </div>
          ) : (
            txTypeLabel(row.type, t)
          )}
        </td>
        <td className="px-3 py-2 align-top">{statusInner}</td>
        <td className="px-3 py-2 text-end tabular-nums text-muted-foreground whitespace-nowrap">
          {docTotal != null ? fc(docTotal) : t('people.emDash')}
        </td>
        {PAYMENT_METHODS.map((m) => (
          <td
            key={m}
            className="px-3 py-2 text-end tabular-nums text-muted-foreground whitespace-nowrap"
          >
            <span
              className={cn(strikeTender && 'line-through opacity-80')}
            >
              {formatMethodCell(sums[m])}
            </span>
          </td>
        ))}
        <td className="px-3 py-2 text-muted-foreground max-w-[min(100%,14rem)] whitespace-normal">
          {renderLogDetailsCell(row)}
        </td>
        <td className="px-3 py-2 text-muted-foreground">
          <LedgerReferenceLink row={row} />
        </td>
        <td
          className={cn(
            'px-3 py-2 text-end tabular-nums font-medium',
            balanceStyleDelta > 0
              ? 'text-green-600 dark:text-green-400'
              : balanceStyleDelta < 0
                ? 'text-red-600 dark:text-red-400'
                : ''
          )}
          title={
            row.reversed && !effectiveFullLedger
              ? t('payments.reversedBalanceImpactHint')
              : undefined
          }
        >
          {impact > 0 ? '+' : ''}
          {fc(impact)}
        </td>
        <td
          className={cn(
            'px-3 py-2 text-end tabular-nums font-medium whitespace-nowrap',
            registerImpact != null &&
              (registerImpact > 0
                ? 'text-green-600 dark:text-green-400'
                : registerImpact < 0
                  ? 'text-red-600 dark:text-red-400'
                  : '')
          )}
          title={t('payments.listRegisterImpactHint')}
        >
          <span
            className={cn(strikeTender && 'line-through opacity-80')}
          >
            {registerImpact == null ? (
              t('people.emDash')
            ) : (
              <>
                {registerImpact > 0 ? '+' : ''}
                {fc(registerImpact)}
              </>
            )}
          </span>
        </td>
      </tr>
    )
  }

  useEffect(() => {
    document.title = `${t('payments.allPayments')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  useEffect(() => {
    setExpandedNestedParents(new Set())
  }, [effectiveFullLedger])

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
        {canFullLedgerView ? (
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
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} columns={13} />
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
                  <th className="px-3 py-2.5 text-start font-medium text-muted-foreground whitespace-nowrap">
                    {t('payments.logStatusColumn')}
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
                  <th
                    className="px-3 py-2.5 text-end font-medium text-muted-foreground whitespace-nowrap"
                    title={t('payments.listRegisterImpactHint')}
                  >
                    {t('payments.listRegisterImpact')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((parent) => {
                  const nestedChildCount = parent.children?.length ?? 0
                  const hasNestedChildren =
                    !effectiveFullLedger && nestedChildCount > 0
                  const nestedOpen =
                    hasNestedChildren && expandedNestedParents.has(parent.id)
                  return (
                    <Fragment key={parent.id}>
                      {renderTransactionRow(
                        parent,
                        false,
                        parent.id,
                        hasNestedChildren
                          ? {
                              expanded: nestedOpen,
                              onToggle: () => toggleNestedParent(parent.id),
                            }
                          : undefined
                      )}
                      {nestedOpen &&
                        (parent.children ?? []).map((child) =>
                          renderTransactionRow(
                            child,
                            true,
                            `${parent.id}:${child.id}`
                          )
                        )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('payments.resultCount', { count: visibleRowCount })}
        </p>
      )}

      <PersonProfileDialog
        person={ledgerProfilePerson}
        onOpenChange={(open) => {
          if (!open) setLedgerProfilePerson(null)
        }}
      />
    </div>
  )
}
