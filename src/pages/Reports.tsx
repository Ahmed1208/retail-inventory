import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Download } from 'lucide-react'

import { getAllProducts } from '@/services/productService'
import { getAllOrders } from '@/services/orderService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/utils/currency'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

function getDefaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

interface ReportsProps {
  /** When true, skip setting document.title (used when embedded in Dashboard). */
  embedded?: boolean
}

export function Reports({ embedded = false }: ReportsProps) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const canExportCsv = useFeatureEnabled('reports.exportCsv')

  useEffect(() => {
    if (embedded) return
    document.title = 'Reports | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [embedded])

  const formatCurrencyDisplay = (n: number) => formatCurrency(n, lang)

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
  })

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'status_flow_completed', dateRange.from, dateRange.to],
    queryFn: () =>
      getAllOrders({
        status_flow: 'completed',
        from: dateRange.from,
        to: dateRange.to,
      }),
  })

  const inventoryRows = useMemo(() => {
    return products.map((p) => {
      const totalCost = p.quantity * p.cost_price
      const totalRetail = p.quantity * p.customer_price
      const margin =
        totalRetail > 0
          ? ((totalRetail - totalCost) / totalRetail) * 100
          : 0
      return {
        name: p.name,
        brand: p.brand?.name ?? '—',
        category: p.category?.name ?? '—',
        quantity: p.quantity,
        cost_price: p.cost_price,
        customer_price: p.customer_price,
        business_price: p.business_price,
        totalCost,
        totalRetail,
        margin,
      }
    })
  }, [products])

  const inventoryTotals = useMemo(() => {
    return inventoryRows.reduce(
      (acc, row) => ({
        totalCost: acc.totalCost + row.totalCost,
        totalRetail: acc.totalRetail + row.totalRetail,
      }),
      { totalCost: 0, totalRetail: 0 }
    )
  }, [inventoryRows])

  const salesPerDay = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of orders) {
      const day = o.created_at.slice(0, 10)
      map[day] = (map[day] ?? 0) + o.total_amount
    }
    const sorted = Object.entries(map)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return sorted
  }, [orders])

  const salesStats = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0)
    const totalOrdersCount = orders.length
    const avgOrder = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0
    const productQty: Record<string, { name: string; qty: number }> = {}
    for (const o of orders) {
      for (const item of o.items) {
        const id = item.product_id
        if (!productQty[id])
          productQty[id] = { name: item.product.name, qty: 0 }
        productQty[id].qty += item.quantity
      }
    }
    const mostSold = Object.values(productQty).sort(
      (a, b) => b.qty - a.qty
    )[0]
    return {
      totalRevenue,
      totalOrdersCount,
      avgOrder,
      mostSold: mostSold ?? null,
    }
  }, [orders])

  const exportCsv = () => {
    const headers = [
      t('reports.productName'),
      t('reports.brand'),
      t('reports.category'),
      t('reports.quantity'),
      t('reports.costPrice'),
      t('reports.customerPrice'),
      t('reports.businessPrice'),
      t('reports.totalCostValue'),
      t('reports.totalRetailValue'),
      t('reports.marginPct'),
    ]
    const escape = (v: string | number) =>
      `"${String(v).replace(/"/g, '""')}"`
    const rows = inventoryRows.map((r) =>
      [
        r.name,
        r.brand,
        r.category,
        r.quantity,
        r.cost_price,
        r.customer_price,
        r.business_price,
        r.totalCost,
        r.totalRetail,
        r.margin.toFixed(1),
      ].map(escape).join(',')
    )
    const totalLine = [
      t('reports.totals'),
      '',
      '',
      '',
      '',
      '',
      '',
      inventoryTotals.totalCost,
      inventoryTotals.totalRetail,
      '',
    ].map(escape).join(',')
    const csv = [headers.map(escape).join(','), ...rows, totalLine].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-value-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* Report 1 — Inventory Value */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">
            {t('reports.inventoryReport')}
          </h2>
          {canExportCsv && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 me-2" />
              {t('reports.exportCsv')}
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {productsLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : inventoryRows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('common.noResults')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('reports.productName')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('reports.brand')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {t('reports.category')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('reports.quantity')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('reports.costPrice')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('reports.customerPrice')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('reports.businessPrice')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('reports.totalCostValue')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('reports.totalRetailValue')}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                      {t('reports.marginPct')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/50 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.brand}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.category}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {formatCurrencyDisplay(row.cost_price)}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {formatCurrencyDisplay(row.customer_price)}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {formatCurrencyDisplay(row.business_price)}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {formatCurrencyDisplay(row.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {formatCurrencyDisplay(row.totalRetail)}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {row.margin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="px-4 py-3" colSpan={7}>
                      {t('reports.totals')}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatCurrencyDisplay(inventoryTotals.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatCurrencyDisplay(inventoryTotals.totalRetail)}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Report 2 — Sales */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{t('reports.salesReport')}</h2>
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
        {ordersLoading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('reports.totalRevenue')}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrencyDisplay(salesStats.totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('reports.totalOrders')}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {salesStats.totalOrdersCount}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('reports.averageOrderValue')}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrencyDisplay(salesStats.avgOrder)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('reports.mostSoldProduct')}
                </p>
                <p className="text-lg font-semibold truncate">
                  {salesStats.mostSold
                    ? `${salesStats.mostSold.name} (${salesStats.mostSold.qty})`
                    : '—'}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground mb-4">
                {t('reports.salesPerDay')}
              </p>
              <div className="h-[300px] w-full">
                {salesPerDay.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {t('common.noResults')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesPerDay} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                            notation: 'compact',
                            maximumFractionDigits: 0,
                          }).format(v)
                        }
                      />
                      <Tooltip
                        formatter={(value) =>
                          value != null ? [formatCurrencyDisplay(Number(value)), ''] : []
                        }
                        labelFormatter={(label) =>
                          new Date(String(label)).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')
                        }
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
