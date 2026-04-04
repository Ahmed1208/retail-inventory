import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { ArrowLeft, AlertTriangle, Loader2, Pencil, ArrowLeftRight } from 'lucide-react'

import {
  getProductById,
  getProductPriceHistory,
  getStockMovements,
} from '@/services/productService'
import { getProductSalesAnalytics } from '@/services/orderService'
import type { ProductSaleLine } from '@/services/orderService'
import type { StockMovementType } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { roundMoney } from '@/services/peopleService'
import { getAllCategories as getCategories } from '@/services/categoryService'
import { getAllBrands as getBrands } from '@/services/brandService'
import { ProductFormDialog } from '@/components/products/ProductFormDialog'
import { ProductStockAdjustDialog } from '@/components/products/ProductStockAdjustDialog'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { PRODUCT_PRICE_CHART_STROKES } from '@/constants/productPriceChart'
import { useDocumentDarkClass } from '@/hooks/useDocumentDarkClass'
function priceRowDelta(
  current: number,
  older: number | undefined,
  fc: (n: number) => string
): { text: string; className: string } {
  if (older === undefined) {
    return { text: '—', className: 'text-muted-foreground' }
  }
  const d = roundMoney(current - older)
  if (d === 0) {
    return { text: '0', className: 'text-muted-foreground' }
  }
  const sign = d > 0 ? '+' : ''
  return {
    text: `${sign}${fc(d)}`,
    className: d > 0 ? 'text-green-600' : 'text-red-600',
  }
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

function aggregateSalesByDate(lines: ProductSaleLine[]) {
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

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { isRTL } = useLanguage()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const fc = (n: number) => formatCurrency(n, lang)
  const isDark = useDocumentDarkClass()
  const businessStroke = isDark
    ? PRODUCT_PRICE_CHART_STROKES.businessDark
    : PRODUCT_PRICE_CHART_STROKES.businessLight
  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [editOpen, setEditOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)

  const canEditProduct = useFeatureEnabled('products.editProduct')
  const canStockAdjust = useFeatureEnabled('products.stockAdjust')

  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProductById(id!),
    enabled: !!id,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: !!id && !!product,
  })

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
    enabled: !!id && !!product,
  })

  const { data: priceHistory = [], isLoading: priceHistoryLoading } = useQuery({
    queryKey: ['productPriceHistory', id],
    queryFn: () => getProductPriceHistory(id!),
    enabled: !!id && !!product,
  })

  const { data: saleLines = [], isLoading: salesLoading } = useQuery({
    queryKey: ['productSales', id, dateRange.from, dateRange.to],
    queryFn: () =>
      getProductSalesAnalytics(id!, {
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: !!id && !!product,
  })

  const { data: movements = [], isLoading: movLoading } = useQuery({
    queryKey: ['productMovements', id],
    queryFn: () =>
      getStockMovements({
        productId: id!,
        limit: 50,
      }),
    enabled: !!id && !!product,
  })

  const chartData = useMemo(() => aggregateSalesByDate(saleLines), [saleLines])

  const priceLineChartData = useMemo(() => {
    return [...priceHistory]
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map((row) => ({
        at: row.recorded_at,
        label: new Date(row.recorded_at).toLocaleDateString(
          lang === 'ar' ? 'ar-EG' : 'en-US',
          { month: 'short', day: 'numeric', year: '2-digit' }
        ),
        customer: row.customer_price,
        business: row.business_price,
        cost: row.cost_price,
      }))
  }, [priceHistory, lang])

  const invalidateProductQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['product', id] })
    queryClient.invalidateQueries({ queryKey: ['productPriceHistory', id] })
    queryClient.invalidateQueries({ queryKey: ['productMovements', id] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['recentMovements'] })
  }

  const kpis = useMemo(() => {
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

  useEffect(() => {
    if (product?.name) {
      document.title = `${product.name} | StockPilot`
      return () => {
        document.title = 'StockPilot'
      }
    }
    return undefined
  }, [product?.name])

  const movementTypeLabel = (type: StockMovementType) =>
    t(`stockMovements.${type}` as const)

  if (!id) return null

  if (productLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (productError || !product) {
    return (
      <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <Link
          to="/products"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('products.backToList')}
        </Link>
        <p className="mt-4 text-muted-foreground">{t('common.noResults')}</p>
      </div>
    )
  }

  const isLow = product.quantity <= product.low_stock_threshold

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Link
        to="/products"
        className="mb-1 -ms-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
        {t('products.backToList')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {product.product_code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditProduct && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 me-1.5" aria-hidden />
              {t('products.detailEditProduct')}
            </Button>
          )}
          {canStockAdjust && (
            <Button variant="outline" size="sm" onClick={() => setStockOpen(true)}>
              <ArrowLeftRight className="h-4 w-4 me-1.5" aria-hidden />
              {t('products.stockAdjust')}
            </Button>
          )}
          {isLow && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {t('common.lowStock')}
            </span>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {t('products.detailSectionInfo')}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('brands.title')}</dt>
            <dd className="font-medium">{product.brand?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('categories.title')}</dt>
            <dd className="font-medium">{product.category?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('common.quantity')}</dt>
            <dd className={cn('font-medium tabular-nums', isLow && 'text-red-600')}>
              {product.quantity}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('products.unit')}</dt>
            <dd className="font-medium">{product.unit}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t('products.lowStockThreshold')}
            </dt>
            <dd className="font-medium tabular-nums">
              {product.low_stock_threshold}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('products.customerPrice')}</dt>
            <dd className="font-medium tabular-nums">{fc(product.customer_price)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('products.businessPrice')}</dt>
            <dd className="font-medium tabular-nums">{fc(product.business_price)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('products.costPrice')}</dt>
            <dd className="font-medium tabular-nums">{fc(product.cost_price)}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-muted-foreground">{t('common.description')}</dt>
            <dd className="font-medium whitespace-pre-wrap">
              {product.description?.trim() ? product.description : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('products.detailUpdated')}</dt>
            <dd className="text-muted-foreground">
              {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(product.updated_at))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {t('products.priceHistorySection')}
        </h2>
        {priceHistoryLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : priceHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('products.priceHistoryEmpty')}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('products.priceHistoryChartTitle')}
            </p>
            <div className="mb-8 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={priceLineChartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      fc(Number(value ?? 0)),
                      name,
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.at
                        ? new Intl.DateTimeFormat(
                            lang === 'ar' ? 'ar-EG' : 'en-US',
                            { dateStyle: 'medium', timeStyle: 'short' }
                          ).format(new Date(payload[0].payload.at as string))
                        : ''
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="business"
                    name={t('products.legendBusinessPrice')}
                    stroke={businessStroke}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    name={t('products.legendCostPrice')}
                    stroke={PRODUCT_PRICE_CHART_STROKES.cost}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="customer"
                    name={t('products.legendCustomerPrice')}
                    stroke={PRODUCT_PRICE_CHART_STROKES.customer}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">
                      {t('products.priceHistoryColDate')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('products.customerPrice')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('products.priceHistoryColDeltaCustomer')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('products.businessPrice')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('products.priceHistoryColDeltaBusiness')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('products.costPrice')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('products.priceHistoryColDeltaCost')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((row, i) => {
                    const older = priceHistory[i + 1]
                    const dc = priceRowDelta(
                      row.customer_price,
                      older?.customer_price,
                      fc
                    )
                    const db = priceRowDelta(
                      row.business_price,
                      older?.business_price,
                      fc
                    )
                    const dco = priceRowDelta(row.cost_price, older?.cost_price, fc)
                    return (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                          {new Intl.DateTimeFormat(
                            lang === 'ar' ? 'ar-EG' : 'en-US',
                            { dateStyle: 'medium', timeStyle: 'short' }
                          ).format(new Date(row.recorded_at))}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums font-medium">
                          {fc(row.customer_price)}
                        </td>
                        <td className={cn('px-3 py-2 text-end tabular-nums text-xs', dc.className)}>
                          {dc.text}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums font-medium">
                          {fc(row.business_price)}
                        </td>
                        <td className={cn('px-3 py-2 text-end tabular-nums text-xs', db.className)}>
                          {db.text}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums font-medium">
                          {fc(row.cost_price)}
                        </td>
                        <td className={cn('px-3 py-2 text-end tabular-nums text-xs', dco.className)}>
                          {dco.text}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {t('products.detailSectionSales')}
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
            <p className="text-lg font-semibold tabular-nums">{kpis.units}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {t('products.detailKpiLineRevenue')}
            </p>
            <p className="text-lg font-semibold tabular-nums">{fc(kpis.revenue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {t('products.detailKpiOrders')}
            </p>
            <p className="text-lg font-semibold tabular-nums">{kpis.orderCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {t('products.detailKpiRetailLines')}
            </p>
            <p className="text-lg font-semibold tabular-nums">{kpis.retailLines}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {t('products.detailKpiWholesaleLines')}
            </p>
            <p className="text-lg font-semibold tabular-nums">{kpis.wholesaleLines}</p>
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
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                        formatter={(value) => [Number(value ?? 0), t('common.quantity')]}
                        labelFormatter={(l) => String(l)}
                      />
                      <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                        formatter={(value) => [fc(Number(value ?? 0)), t('products.detailLineTotal')]}
                        labelFormatter={(l) => String(l)}
                      />
                      <Bar dataKey="revenue" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <p className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            {t('products.detailRecentSales')}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="px-3 py-2 text-start font-medium">{t('orders.date')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('orders.orderNumber')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('orders.orderType')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('common.quantity')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('products.detailLineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {saleLines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    {t('products.detailNoSalesInRange')}
                  </td>
                </tr>
              ) : (
                [...saleLines]
                  .sort((a, b) => b.orderCreatedAt.localeCompare(a.orderCreatedAt))
                  .slice(0, 25)
                  .map((l) => (
                    <tr key={l.lineId} className="border-b border-border/50">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(l.orderCreatedAt))}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/orders/${l.orderId}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          #{l.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {l.orderType === 'retail'
                          ? t('orders.typeRetail')
                          : t('orders.typeWholesale')}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{fc(l.lineTotal)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {t('products.detailSectionMovements')}
        </h2>
        {movLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('products.detailNoMovements')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 text-start font-medium">
                    {t('stockMovements.dateTime')}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">{t('stockMovements.type')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('stockMovements.quantity')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('stockMovements.note')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(m.created_at))}
                    </td>
                    <td className="px-3 py-2">{movementTypeLabel(m.type)}</td>
                    <td className="px-3 py-2 text-end tabular-nums font-medium">
                      {m.type === 'in' && '+'}
                      {m.type === 'out' && '-'}
                      {m.type === 'adjustment' && '~'}
                      {m.quantity}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                      {m.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        categories={categories}
        brands={brands}
        mode="edit"
        initialProduct={product}
        showPriceHistoryInEdit
        priceHistoryLimit={10}
        onSuccess={() => {
          invalidateProductQueries()
          toast.success(t('products.toastUpdated'))
          setEditOpen(false)
        }}
        onError={() => toast.error(t('products.toastError'))}
      />

      <ProductStockAdjustDialog
        open={stockOpen}
        onOpenChange={setStockOpen}
        product={product}
        onSuccess={() => {
          invalidateProductQueries()
          toast.success(t('products.toastStockAdjusted'))
          setStockOpen(false)
        }}
        onError={() => toast.error(t('products.toastError'))}
      />
    </div>
  )
}
