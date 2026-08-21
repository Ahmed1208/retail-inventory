import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowLeft,
  CircleDollarSign,
  Loader2,
  Pencil,
  Wallet,
} from 'lucide-react'

import { getPersonById, roundMoney } from '@/services/peopleService'
import {
  getOrdersByPersonId,
  getPersonSalesAnalytics,
  type PersonSaleLine,
} from '@/services/orderService'
import { getAverageUnitCostsByProductIds } from '@/services/productService'
import {
  getPurchaseOrdersByPersonId,
  getSupplierPurchaseLinesAnalytics,
} from '@/services/purchaseOrderService'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { Person } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PersonFormDialog } from '@/components/people/PersonFormDialog'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { NoteWithDocLinks } from '@/components/common/NoteWithDocLinks'
import { useNoteFocusFromSearchParams } from '@/hooks/useNoteFocusFromSearchParams'

const DOC_SEARCH_DEBOUNCE_MS = 300
const DOCS_PAGE_SIZE = 15

function detailBalanceChipClass(b: number): string {
  if (Math.abs(b) <= 0.005) {
    return 'text-muted-foreground'
  }
  if (b < -0.005) {
    return 'text-red-600 dark:text-red-400'
  }
  return 'text-green-600 dark:text-green-400'
}

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 90)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function defaultMoneyChartRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 1)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function calendarDay(iso: string): string {
  return iso.slice(0, 10)
}

function matchesDocumentNumberSearch(
  searchRaw: string,
  orderNumber: number,
  kind: 'order' | 'po'
): boolean {
  const q = searchRaw.trim().toLowerCase()
  if (!q) return true
  const n = String(orderNumber)
  if (n.includes(q)) return true
  const label = kind === 'order' ? `o-${orderNumber}` : `po-${orderNumber}`
  return label.includes(q)
}

type MoneyChartRow = { date: string; customerTotal: number; supplierTotal: number }

function buildMoneyOverTimeChart(
  orders: { created_at: string; total_amount: number }[],
  pos: { created_at: string; total_amount: number }[],
  from: string,
  to: string
): MoneyChartRow[] {
  const byDay = new Map<string, { customerTotal: number; supplierTotal: number }>()
  for (const o of orders) {
    const day = calendarDay(o.created_at)
    if (day < from || day > to) continue
    const prev = byDay.get(day) ?? { customerTotal: 0, supplierTotal: 0 }
    prev.customerTotal = roundMoney(prev.customerTotal + Number(o.total_amount))
    byDay.set(day, prev)
  }
  for (const p of pos) {
    const day = calendarDay(p.created_at)
    if (day < from || day > to) continue
    const prev = byDay.get(day) ?? { customerTotal: 0, supplierTotal: 0 }
    prev.supplierTotal = roundMoney(prev.supplierTotal + Number(p.total_amount))
    byDay.set(day, prev)
  }
  return [...byDay.keys()]
    .sort()
    .map((date) => {
      const v = byDay.get(date)!
      return {
        date,
        customerTotal: v.customerTotal,
        supplierTotal: v.supplierTotal,
      }
    })
}

function aggregateSalesByDate(lines: PersonSaleLine[]) {
  const qty: Record<string, number> = {}
  const rev: Record<string, number> = {}
  for (const l of lines) {
    const day = l.orderCreatedAt.slice(0, 10)
    qty[day] = roundMoney((qty[day] ?? 0) + l.quantity)
    rev[day] = roundMoney((rev[day] ?? 0) + l.lineTotal)
  }
  const dates = [...new Set([...Object.keys(qty), ...Object.keys(rev)])].sort()
  return dates.map((date) => ({
    date,
    quantity: qty[date] ?? 0,
    revenue: rev[date] ?? 0,
  }))
}

function aggregatePurchasesByDate(
  lines: Awaited<ReturnType<typeof getSupplierPurchaseLinesAnalytics>>
) {
  const qty: Record<string, number> = {}
  const spend: Record<string, number> = {}
  for (const l of lines) {
    const day = l.createdAt.slice(0, 10)
    qty[day] = roundMoney((qty[day] ?? 0) + l.quantity)
    spend[day] = roundMoney((spend[day] ?? 0) + l.lineTotal)
  }
  const dates = [...new Set([...Object.keys(qty), ...Object.keys(spend)])].sort()
  return dates.map((date) => ({
    date,
    quantity: qty[date] ?? 0,
    spend: spend[date] ?? 0,
  }))
}

function realizedGrossFromPersonLines(
  lines: PersonSaleLine[],
  wacByProduct: Map<string, number | null>
): {
  hasWac: boolean
  retailProfit: number | null
  retailPct: number | null
  wholesaleProfit: number | null
  wholesalePct: number | null
  totalProfit: number | null
} {
  if (lines.length === 0) {
    return {
      hasWac: false,
      retailProfit: null,
      retailPct: null,
      wholesaleProfit: null,
      wholesalePct: null,
      totalProfit: null,
    }
  }
  for (const l of lines) {
    const w = wacByProduct.get(l.productId)
    if (w == null || !Number.isFinite(w)) {
      return {
        hasWac: false,
        retailProfit: null,
        retailPct: null,
        wholesaleProfit: null,
        wholesalePct: null,
        totalProfit: null,
      }
    }
  }

  let revR = 0
  let cogsR = 0
  let revW = 0
  let cogsW = 0

  for (const l of lines) {
    const w = wacByProduct.get(l.productId)!
    const cogs = roundMoney(l.quantity * w)
    if (l.orderType === 'retail') {
      revR = roundMoney(revR + l.lineTotal)
      cogsR = roundMoney(cogsR + cogs)
    } else if (l.orderType === 'wholesale') {
      revW = roundMoney(revW + l.lineTotal)
      cogsW = roundMoney(cogsW + cogs)
    }
  }

  const profitR = roundMoney(revR - cogsR)
  const pctR = revR > 0.005 ? Math.round((profitR / revR) * 1000) / 10 : null
  const profitW = roundMoney(revW - cogsW)
  const pctW = revW > 0.005 ? Math.round((profitW / revW) * 1000) / 10 : null
  const totalRev = roundMoney(revR + revW)
  const totalCogs = roundMoney(cogsR + cogsW)
  const totalProfit = roundMoney(totalRev - totalCogs)

  return {
    hasWac: true,
    retailProfit: profitR,
    retailPct: pctR,
    wholesaleProfit: profitW,
    wholesalePct: pctW,
    totalProfit,
  }
}

export function PersonDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { isRTL } = useLanguage()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const fc = (n: number) => formatCurrency(n, lang)

  const canView = useFeatureEnabled('people.viewProfile')
  const canEditPerson = useFeatureEnabled('people.editPerson')

  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [purchaseDateRange, setPurchaseDateRange] = useState(defaultDateRange)
  const [moneyChartRange, setMoneyChartRange] = useState(defaultMoneyChartRange)
  const [docsSearch, setDocsSearch] = useState('')
  const debouncedDocsSearch = useDebouncedValue(docsSearch, DOC_SEARCH_DEBOUNCE_MS)
  const [docsDateFrom, setDocsDateFrom] = useState('')
  const [docsDateTo, setDocsDateTo] = useState('')
  const [ordersDocPage, setOrdersDocPage] = useState(0)
  const [poDocPage, setPoDocPage] = useState(0)
  const [editOpen, setEditOpen] = useState(false)

  const {
    data: person,
    isLoading: personLoading,
    error: personError,
  } = useQuery({
    queryKey: ['personDetail', id],
    queryFn: async () => {
      const row = await getPersonById(id!)
      const { transactions: _tx, ...rest } = row
      return rest as Person
    },
    enabled: !!id && canView,
  })

  const isCustomer = Boolean(person?.roles.includes('customer'))
  const isSupplier = Boolean(person?.roles.includes('supplier'))

  const { data: saleLines = [], isLoading: salesLoading } = useQuery({
    queryKey: ['personSales', id, dateRange.from, dateRange.to],
    queryFn: () =>
      getPersonSalesAnalytics(id!, {
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: !!id && canView && isCustomer,
  })

  const {
    data: saleLinesLifetime = [],
    isPending: lifetimeSalesPending,
  } = useQuery({
    queryKey: ['personSalesLifetime', id],
    queryFn: () => getPersonSalesAnalytics(id!),
    enabled: !!id && canView && isCustomer,
  })

  const productIdsForWac = useMemo(
    () => [...new Set(saleLinesLifetime.map((l) => l.productId))],
    [saleLinesLifetime]
  )

  const { data: wacByProduct = new Map<string, number | null>() } = useQuery({
    queryKey: [
      'personSaleProductWacs',
      id,
      [...productIdsForWac].sort().join(','),
    ],
    queryFn: () => getAverageUnitCostsByProductIds(productIdsForWac),
    enabled:
      !!id && canView && isCustomer && productIdsForWac.length > 0,
  })

  const { data: personOrders = [], isLoading: ordersListLoading } = useQuery({
    queryKey: ['personOrders', id],
    queryFn: () => getOrdersByPersonId(id!),
    enabled: !!id && canView && isCustomer,
  })

  const { data: personPOs = [], isLoading: posListLoading } = useQuery({
    queryKey: ['personPOs', id],
    queryFn: () => getPurchaseOrdersByPersonId(id!),
    enabled: !!id && canView && isSupplier,
  })

  const { data: purchaseLines = [], isLoading: purchaseLoading } = useQuery({
    queryKey: [
      'personPurchases',
      id,
      purchaseDateRange.from,
      purchaseDateRange.to,
    ],
    queryFn: () =>
      getSupplierPurchaseLinesAnalytics(id!, {
        from: purchaseDateRange.from,
        to: purchaseDateRange.to,
      }),
    enabled: !!id && canView && isSupplier,
  })

  const realizedFromSales = useMemo(
    () => realizedGrossFromPersonLines(saleLinesLifetime, wacByProduct),
    [saleLinesLifetime, wacByProduct]
  )

  const chartData = useMemo(() => aggregateSalesByDate(saleLines), [saleLines])

  const purchaseChartData = useMemo(
    () => aggregatePurchasesByDate(purchaseLines),
    [purchaseLines]
  )

  const salesKpis = useMemo(() => {
    const units = saleLines.reduce((s, l) => s + l.quantity, 0)
    const revenue = roundMoney(saleLines.reduce((s, l) => s + l.lineTotal, 0))
    const orderIds = new Set(saleLines.map((l) => l.orderId))
    const retail = saleLines.filter((l) => l.orderType === 'retail').length
    const wholesale = saleLines.filter((l) => l.orderType === 'wholesale').length
    return {
      units,
      revenue,
      orderCount: orderIds.size,
      retailLines: retail,
      wholesaleLines: wholesale,
    }
  }, [saleLines])

  const purchaseKpis = useMemo(() => {
    const units = purchaseLines.reduce((s, l) => s + l.quantity, 0)
    const spend = roundMoney(
      purchaseLines.reduce((s, l) => s + l.lineTotal, 0)
    )
    const poIds = new Set(purchaseLines.map((l) => l.purchaseOrderId))
    return { units, spend, poCount: poIds.size }
  }, [purchaseLines])

  const filteredPersonOrders = useMemo(() => {
    return personOrders.filter((o) => {
      if (
        !matchesDocumentNumberSearch(debouncedDocsSearch, o.order_number, 'order')
      ) {
        return false
      }
      const day = calendarDay(o.created_at)
      if (docsDateFrom && day < docsDateFrom) return false
      if (docsDateTo && day > docsDateTo) return false
      return true
    })
  }, [personOrders, debouncedDocsSearch, docsDateFrom, docsDateTo])

  const filteredPersonPOs = useMemo(() => {
    return personPOs.filter((p) => {
      if (
        !matchesDocumentNumberSearch(debouncedDocsSearch, p.order_number, 'po')
      ) {
        return false
      }
      const day = calendarDay(p.created_at)
      if (docsDateFrom && day < docsDateFrom) return false
      if (docsDateTo && day > docsDateTo) return false
      return true
    })
  }, [personPOs, debouncedDocsSearch, docsDateFrom, docsDateTo])

  useEffect(() => {
    setOrdersDocPage(0)
    setPoDocPage(0)
  }, [debouncedDocsSearch, docsDateFrom, docsDateTo])

  const paginatedPersonOrders = useMemo(() => {
    const start = ordersDocPage * DOCS_PAGE_SIZE
    return filteredPersonOrders.slice(start, start + DOCS_PAGE_SIZE)
  }, [filteredPersonOrders, ordersDocPage])

  const paginatedPersonPOs = useMemo(() => {
    const start = poDocPage * DOCS_PAGE_SIZE
    return filteredPersonPOs.slice(start, start + DOCS_PAGE_SIZE)
  }, [filteredPersonPOs, poDocPage])

  const ordersDocTotalPages =
    filteredPersonOrders.length === 0
      ? 0
      : Math.ceil(filteredPersonOrders.length / DOCS_PAGE_SIZE)
  const poDocTotalPages =
    filteredPersonPOs.length === 0
      ? 0
      : Math.ceil(filteredPersonPOs.length / DOCS_PAGE_SIZE)

  const ordersDocFrom =
    filteredPersonOrders.length === 0
      ? 0
      : ordersDocPage * DOCS_PAGE_SIZE + 1
  const ordersDocTo =
    filteredPersonOrders.length === 0
      ? 0
      : Math.min(
          (ordersDocPage + 1) * DOCS_PAGE_SIZE,
          filteredPersonOrders.length
        )
  const poDocFrom =
    filteredPersonPOs.length === 0
      ? 0
      : poDocPage * DOCS_PAGE_SIZE + 1
  const poDocTo =
    filteredPersonPOs.length === 0
      ? 0
      : Math.min(
          (poDocPage + 1) * DOCS_PAGE_SIZE,
          filteredPersonPOs.length
        )

  const moneyOverTimeData = useMemo(() => {
    return buildMoneyOverTimeChart(
      personOrders,
      personPOs,
      moneyChartRange.from,
      moneyChartRange.to
    )
  }, [personOrders, personPOs, moneyChartRange.from, moneyChartRange.to])

  const orderFlowLabel = (flow: string) => {
    if (flow === 'cancelled') return t('orders.filterStatusCancelled')
    if (flow === 'pending') return t('orders.statusPending')
    if (flow === 'completed') return t('orders.completed')
    if (flow === 'confirmed') return t('orders.confirmed')
    if (flow === 'draft') return t('orders.draft')
    return flow
  }

  const poStatusLabel = (st: string) => {
    if (st === 'draft') return t('purchaseOrders.statusDraft')
    if (st === 'received') return t('purchaseOrders.statusReceived')
    if (st === 'cancelled') return t('purchaseOrders.statusCancelled')
    return st
  }

  const formatDocDateTime = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  const invalidatePerson = () => {
    queryClient.invalidateQueries({ queryKey: ['personDetail', id] })
    queryClient.invalidateQueries({ queryKey: ['people'] })
    queryClient.invalidateQueries({ queryKey: ['personSales', id] })
    queryClient.invalidateQueries({ queryKey: ['personSalesLifetime', id] })
    queryClient.invalidateQueries({ queryKey: ['personPurchases', id] })
    queryClient.invalidateQueries({ queryKey: ['personOrders', id] })
    queryClient.invalidateQueries({ queryKey: ['personPOs', id] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
  }

  useEffect(() => {
    if (person?.name) {
      document.title = `${person.name} | StockPilot`
      return () => {
        document.title = 'StockPilot'
      }
    }
    return undefined
  }, [person?.name])

  useNoteFocusFromSearchParams(person ? `person-notes-${person.id}` : null)

  if (!canView) {
    return <Navigate to="/people" replace />
  }

  if (!id) return null

  if (personLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (personError || !person) {
    return (
      <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <Link
          to="/people"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('people.detailBack')}
        </Link>
        <p className="mt-4 text-muted-foreground">{t('common.noResults')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Link
        to="/people"
        className="mb-1 -ms-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
        {t('people.detailBack')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {person.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
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
          </div>
          {(person.external_code || person.phone) ? (
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              {[person.external_code, person.phone].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm shadow-sm"
            title={
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
            }
          >
            <span className="flex shrink-0 flex-col items-center gap-0.5">
              <Wallet
                className="h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <span className="max-w-[4.5rem] text-center text-[0.625rem] leading-none text-muted-foreground">
                {person.balance > 0.005
                  ? t('people.balanceChipOwesYou')
                  : person.balance < -0.005
                    ? t('people.balanceChipYouOwe')
                    : t('people.balanceChipSettled')}
              </span>
            </span>
            <span className="hidden min-[380px]:inline text-muted-foreground text-xs">
              {t('people.balance')}
            </span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                detailBalanceChipClass(person.balance)
              )}
            >
              {fc(person.balance)}
            </span>
          </span>
          {isCustomer && realizedFromSales.hasWac && (
            <span
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm shadow-sm"
              title={t('products.totalProfitFromSalesHint')}
            >
              <CircleDollarSign
                className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <span className="hidden min-[380px]:inline text-muted-foreground text-xs">
                {t('products.totalProfitFromSales')}
              </span>
              {lifetimeSalesPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    (realizedFromSales.totalProfit ?? 0) >= 0
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {fc(realizedFromSales.totalProfit ?? 0)}
                </span>
              )}
            </span>
          )}
          {canEditPerson && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 me-1.5" aria-hidden />
              {t('people.detailEdit')}
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {t('people.detailSectionInfo')}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {isCustomer && (
            <>
              <div>
                <dt className="text-muted-foreground">{t('people.discount')}</dt>
                <dd className="font-medium tabular-nums">
                  {person.discount_rate > 0.005
                    ? `${person.discount_rate}%`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('people.creditLimit')}</dt>
                <dd className="font-medium tabular-nums">
                  {person.credit_limit != null
                    ? fc(person.credit_limit)
                    : t('people.noLimit')}
                </dd>
              </div>
            </>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-muted-foreground">{t('people.address')}</dt>
            <dd className="font-medium whitespace-pre-wrap">
              {person.address?.trim() ? person.address : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-muted-foreground">{t('people.notes')}</dt>
            <dd id={`person-notes-${person.id}`} className="font-medium">
              {person.notes?.trim() ? (
                <NoteWithDocLinks note={person.notes} />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('people.lastUpdated')}</dt>
            <dd className="text-muted-foreground">
              {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(person.updated_at))}
            </dd>
          </div>
        </dl>
      </section>

      {isCustomer && (
        <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {t('people.detailSectionSales')}
          </h2>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('reports.from')}
              </Label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, from: e.target.value }))
                }
                className="mt-1 w-[140px]"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('reports.to')}
              </Label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, to: e.target.value }))
                }
                className="mt-1 w-[140px]"
              />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('products.detailKpiUnitsSold')}
              </p>
              <p className="text-lg font-semibold tabular-nums">{salesKpis.units}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('products.detailKpiLineRevenue')}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {fc(salesKpis.revenue)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('products.detailKpiOrders')}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {salesKpis.orderCount}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('products.detailKpiRetailLines')}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {salesKpis.retailLines}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('products.detailKpiWholesaleLines')}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {salesKpis.wholesaleLines}
              </p>
            </div>
          </div>

          {salesLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {t('products.detailChartUnitsPerDay')}
                </p>
                <div className="h-[240px] w-full">
                  {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t('products.detailNoSalesInRange')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString(
                              lang === 'ar' ? 'ar-EG' : 'en-US',
                              { month: 'short', day: 'numeric' }
                            )
                          }
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value) => [
                            Number(value ?? 0),
                            t('common.quantity'),
                          ]}
                          labelFormatter={(l) => String(l)}
                        />
                        <Bar
                          dataKey="quantity"
                          fill="var(--primary)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {t('products.detailChartRevenuePerDay')}
                </p>
                <div className="h-[240px] w-full">
                  {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t('products.detailNoSalesInRange')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString(
                              lang === 'ar' ? 'ar-EG' : 'en-US',
                              { month: 'short', day: 'numeric' }
                            )
                          }
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value) => [
                            fc(Number(value ?? 0)),
                            t('products.detailKpiLineRevenue'),
                          ]}
                          labelFormatter={(l) => String(l)}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name={t('products.detailKpiLineRevenue')}
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {isSupplier && (
        <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {t('people.detailSectionPurchases')}
          </h2>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('reports.from')}
              </Label>
              <Input
                type="date"
                value={purchaseDateRange.from}
                onChange={(e) =>
                  setPurchaseDateRange((prev) => ({
                    ...prev,
                    from: e.target.value,
                  }))
                }
                className="mt-1 w-[140px]"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('reports.to')}
              </Label>
              <Input
                type="date"
                value={purchaseDateRange.to}
                onChange={(e) =>
                  setPurchaseDateRange((prev) => ({
                    ...prev,
                    to: e.target.value,
                  }))
                }
                className="mt-1 w-[140px]"
              />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('people.detailPurchaseKpiUnits')}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {purchaseKpis.units}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('people.detailPurchaseKpiSpend')}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {fc(purchaseKpis.spend)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('people.detailPurchaseKpiPos')}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {purchaseKpis.poCount}
              </p>
            </div>
          </div>

          {purchaseLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {t('people.detailChartPurchaseUnits')}
                </p>
                <div className="h-[240px] w-full">
                  {purchaseChartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t('people.detailNoPurchasesInRange')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={purchaseChartData}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString(
                              lang === 'ar' ? 'ar-EG' : 'en-US',
                              { month: 'short', day: 'numeric' }
                            )
                          }
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value) => [
                            Number(value ?? 0),
                            t('common.quantity'),
                          ]}
                          labelFormatter={(l) => String(l)}
                        />
                        <Bar
                          dataKey="quantity"
                          fill="hsl(24 95% 53%)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {t('people.detailChartPurchaseSpend')}
                </p>
                <div className="h-[240px] w-full">
                  {purchaseChartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t('people.detailNoPurchasesInRange')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={purchaseChartData}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString(
                              lang === 'ar' ? 'ar-EG' : 'en-US',
                              { month: 'short', day: 'numeric' }
                            )
                          }
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value) => [
                            fc(Number(value ?? 0)),
                            t('people.detailPurchaseKpiSpend'),
                          ]}
                          labelFormatter={(l) => String(l)}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="spend"
                          name={t('people.detailPurchaseKpiSpend')}
                          stroke="hsl(24 95% 53%)"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {(isCustomer || isSupplier) && (
        <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {t('people.detailMoneyOverTime')}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t('people.detailMoneyOverTimeHelp')}
          </p>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('reports.from')}
              </Label>
              <Input
                type="date"
                value={moneyChartRange.from}
                onChange={(e) =>
                  setMoneyChartRange((prev) => ({
                    ...prev,
                    from: e.target.value,
                  }))
                }
                className="mt-1 w-[140px]"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('reports.to')}
              </Label>
              <Input
                type="date"
                value={moneyChartRange.to}
                onChange={(e) =>
                  setMoneyChartRange((prev) => ({
                    ...prev,
                    to: e.target.value,
                  }))
                }
                className="mt-1 w-[140px]"
              />
            </div>
          </div>
          <div className="h-[280px] w-full">
            {ordersListLoading || posListLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : moneyOverTimeData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('people.detailMoneyChartEmpty')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={moneyOverTimeData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString(
                        lang === 'ar' ? 'ar-EG' : 'en-US',
                        { month: 'short', day: 'numeric' }
                      )
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      fc(Number(value ?? 0)),
                      name,
                    ]}
                    labelFormatter={(l) => String(l)}
                  />
                  <Legend />
                  {isSupplier && (
                    <Line
                      type="monotone"
                      dataKey="supplierTotal"
                      name={t('people.detailMoneyLineSupplier')}
                      stroke="hsl(24 95% 53%)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  )}
                  {isCustomer && (
                    <Line
                      type="monotone"
                      dataKey="customerTotal"
                      name={t('people.detailMoneyLineCustomer')}
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      )}

      {(isCustomer || isSupplier) && (
        <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {t('people.detailDocumentsSection')}
          </h2>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[min(100%,14rem)] flex-1">
              <Label className="text-muted-foreground text-xs">
                {t('people.detailDocSearchLabel')}
              </Label>
              <Input
                className="mt-1"
                placeholder={t('people.detailDocSearchPlaceholder')}
                value={docsSearch}
                onChange={(e) => setDocsSearch(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('orders.dateFrom')}
              </Label>
              <Input
                type="date"
                value={docsDateFrom}
                onChange={(e) => setDocsDateFrom(e.target.value)}
                className="mt-1 w-[140px]"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                {t('orders.dateTo')}
              </Label>
              <Input
                type="date"
                value={docsDateTo}
                onChange={(e) => setDocsDateTo(e.target.value)}
                className="mt-1 w-[140px]"
              />
            </div>
          </div>

          {isCustomer && (
            <div className="mb-8">
              <h3 className="mb-2 text-base font-medium">
                {t('people.detailSalesOrders')}
              </h3>
              {ordersListLoading ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredPersonOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('people.detailNoDocumentsMatch')}
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                          <th className="px-3 py-2 text-start font-medium">
                            {t('orders.orderNumber')}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {t('orders.date')}
                          </th>
                          <th className="px-3 py-2 text-end font-medium">
                            {t('orders.totalAmount')}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {t('orders.status')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPersonOrders.map((o) => (
                          <tr key={o.id} className="border-b border-border/50">
                            <td className="px-3 py-2 font-medium">
                              <Link
                                to={`/orders/${o.id}`}
                                className="text-primary hover:underline"
                              >
                                O-{o.order_number}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {formatDocDateTime(o.created_at)}
                            </td>
                            <td className="px-3 py-2 text-end tabular-nums">
                              {fc(o.total_amount)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {orderFlowLabel(o.status_flow)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {ordersDocTotalPages > 1 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        {t('stockMovements.pageInfo', {
                          from: ordersDocFrom,
                          to: ordersDocTo,
                          total: filteredPersonOrders.length,
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={ordersDocPage <= 0}
                          onClick={() =>
                            setOrdersDocPage((p) => Math.max(0, p - 1))
                          }
                        >
                          {t('stockMovements.pagePrev')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={ordersDocPage >= ordersDocTotalPages - 1}
                          onClick={() =>
                            setOrdersDocPage((p) =>
                              Math.min(ordersDocTotalPages - 1, p + 1)
                            )
                          }
                        >
                          {t('stockMovements.pageNext')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {isSupplier && (
            <div>
              <h3 className="mb-2 text-base font-medium">
                {t('people.detailPurchaseOrdersTable')}
              </h3>
              {posListLoading ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredPersonPOs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('people.detailNoDocumentsMatch')}
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                          <th className="px-3 py-2 text-start font-medium">
                            {t('purchaseOrders.orderNumber')}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {t('purchaseOrders.date')}
                          </th>
                          <th className="px-3 py-2 text-end font-medium">
                            {t('purchaseOrders.totalAmount')}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {t('purchaseOrders.status')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPersonPOs.map((p) => (
                          <tr key={p.id} className="border-b border-border/50">
                            <td className="px-3 py-2 font-medium">
                              <Link
                                to={`/purchase-orders/${p.id}`}
                                className="text-primary hover:underline"
                              >
                                PO-{p.order_number}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {formatDocDateTime(p.created_at)}
                            </td>
                            <td className="px-3 py-2 text-end tabular-nums">
                              {fc(p.total_amount)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {poStatusLabel(p.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {poDocTotalPages > 1 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        {t('stockMovements.pageInfo', {
                          from: poDocFrom,
                          to: poDocTo,
                          total: filteredPersonPOs.length,
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={poDocPage <= 0}
                          onClick={() =>
                            setPoDocPage((p) => Math.max(0, p - 1))
                          }
                        >
                          {t('stockMovements.pagePrev')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={poDocPage >= poDocTotalPages - 1}
                          onClick={() =>
                            setPoDocPage((p) =>
                              Math.min(poDocTotalPages - 1, p + 1)
                            )
                          }
                        >
                          {t('stockMovements.pageNext')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <PersonFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        person={person}
        t={t}
        formatCurrency={fc}
        onSaved={() => {
          invalidatePerson()
          toast.success(t('people.toastUpdated'))
          setEditOpen(false)
        }}
        onError={(m) => toast.error(m || t('people.toastError'))}
      />
    </div>
  )
}
