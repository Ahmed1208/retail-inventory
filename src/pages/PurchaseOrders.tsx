import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, XCircle, Truck, AlertTriangle } from 'lucide-react'

import {
  getAllPurchaseOrders,
  createPurchaseOrder,
  cancelPurchaseOrder,
} from '@/services/purchaseOrderService'
import { getAllProducts } from '@/services/productService'
import { getAllPeople } from '@/services/peopleService'
import type {
  PurchaseOrderWithItems,
  PurchaseOrderStatus,
  PaymentMethod,
  PurchaseOrderPayment,
  ProductWithRelations,
  Person,
} from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

const DEBOUNCE_MS = 300

type StatusFilter = 'all' | PurchaseOrderStatus

function paymentLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    cash: 'orders.paymentCash',
    card: 'orders.paymentCard',
    transfer: 'orders.paymentTransfer',
    other: 'orders.paymentOther',
  }
  return t(map[key] ?? 'orders.paymentNone')
}

function formatPOPaymentSummary(
  po: PurchaseOrderWithItems,
  t: (k: string) => string,
  formatCurrencyFn: (n: number) => string
): string {
  if (po.payments && po.payments.length > 0) {
    return po.payments
      .map((p) => `${paymentLabel(p.payment_method, t)} ${formatCurrencyFn(p.amount)}`)
      .join(', ')
  }
  return '—'
}

interface POLine {
  product_id: string
  name: string
  defaultCostPrice: number
  costPrice: number
  quantity: number
  updateDefaultCostPrice: boolean
}

export function PurchaseOrders() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailPO, setDetailPO] = useState<PurchaseOrderWithItems | null>(null)
  const [cancelPOState, setCancelPOState] =
    useState<PurchaseOrderWithItems | null>(null)

  const canCreatePO = useFeatureEnabled('purchaseOrders.create')
  const canCancelPO = useFeatureEnabled('purchaseOrders.cancel')

  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  useEffect(() => {
    document.title = 'Purchase Orders | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    [debouncedSearch, statusFilter, dateFrom, dateTo]
  )

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchaseOrders', filters],
    queryFn: () => getAllPurchaseOrders(filters),
  })

  useEffect(() => {
    const st = location.state as { openPOId?: string } | null
    if (!st?.openPOId || purchaseOrders.length === 0) return
    const po = purchaseOrders.find((x) => x.id === st.openPOId)
    if (po) {
      setDetailPO(po)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, purchaseOrders, location.pathname, navigate])

  const formatCurrencyDisplay = (n: number) => formatCurrency(n, lang)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
    }).format(new Date(iso))

  const invalidatePO = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['recentMovements'] })
    queryClient.invalidateQueries({ queryKey: ['people'] })
  }

  return (
    <div className="space-y-4">
      <BackToInventoryLink />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('purchaseOrders.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div
          className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
          role="tablist"
        >
          {(
            [
              ['all', 'purchaseOrders.filterStatusAll'],
              ['received', 'purchaseOrders.filterStatusReceived'],
              ['cancelled', 'purchaseOrders.filterStatusCancelled'],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              role="tab"
              onClick={() => setStatusFilter(value as StatusFilter)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === value
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[140px]"
          aria-label={t('purchaseOrders.dateFrom')}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[140px]"
          aria-label={t('purchaseOrders.dateTo')}
        />
        {canCreatePO && (
          <Button onClick={() => setCreateOpen(true)}>
            {t('purchaseOrders.newPurchaseOrder')}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} columns={7} />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('purchaseOrders.emptyOrders')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('purchaseOrders.orderNumber')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('purchaseOrders.supplierName')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    —
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {t('purchaseOrders.totalAmount')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('orders.paymentMethod')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('purchaseOrders.status')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('purchaseOrders.date')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr
                    key={po.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      #{t('purchaseOrders.poPrefix')}-{po.order_number}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {po.supplier_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {po.items.length === 1
                        ? t('purchaseOrders.itemCount')
                        : t('purchaseOrders.itemsCount', { count: po.items.length })}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatCurrencyDisplay(po.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatPOPaymentSummary(po, t, formatCurrencyDisplay)}
                    </td>
                    <td className="px-4 py-3">
                      <POStatusBadge status={po.status} t={t} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(po.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailPO(po)}
                          aria-label={t('purchaseOrders.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {po.status === 'received' && canCancelPO && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCancelPOState(po)}
                            aria-label={t('purchaseOrders.cancelPurchaseOrder')}
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreatePurchaseOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        t={t}
        formatCurrency={formatCurrencyDisplay}
        onSuccess={() => {
          invalidatePO()
          toast.success(t('purchaseOrders.toastCreated'))
          setCreateOpen(false)
        }}
        onError={(message) =>
          toast.error(message || t('purchaseOrders.toastError'))
        }
      />

      {detailPO && (
        <PODetailDialog
          po={detailPO}
          open={!!detailPO}
          onOpenChange={(open) => !open && setDetailPO(null)}
          t={t}
          formatCurrency={formatCurrencyDisplay}
          formatDate={formatDate}
          canCancel={canCancelPO}
          onCancelClick={() => {
            setDetailPO(null)
            setCancelPOState(detailPO)
          }}
        />
      )}

      {cancelPOState && (
        <AlertDialog
          open={!!cancelPOState}
          onOpenChange={(open) => !open && setCancelPOState(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('purchaseOrders.cancelConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {(t as (key: string, opts?: Record<string, number>) => string)(
                  'purchaseOrders.cancelConfirmMessage',
                  { number: cancelPOState.order_number }
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await cancelPurchaseOrder(cancelPOState.id)
                    invalidatePO()
                    toast.success(t('purchaseOrders.toastCancelled'))
                    setCancelPOState(null)
                    setDetailPO(null)
                  } catch {
                    toast.error(t('purchaseOrders.toastError'))
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('purchaseOrders.cancelPurchaseOrder')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function POStatusBadge({
  status,
  t,
}: { status: PurchaseOrderStatus; t: (k: string) => string }) {
  const styles = {
    received:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const keys = {
    received: 'purchaseOrders.statusReceived',
    cancelled: 'purchaseOrders.statusCancelled',
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        styles[status]
      )}
    >
      {t(keys[status])}
    </span>
  )
}

function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
  t,
  formatCurrency,
  onSuccess,
  onError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (k: string) => string
  formatCurrency: (n: number) => string
  onSuccess: () => void
  onError: (message?: string) => void
}) {
  const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'other']
  const [supplierName, setSupplierName] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Person | null>(null)
  const [note, setNote] = useState('')
  const [paymentSelected, setPaymentSelected] = useState<Record<PaymentMethod, boolean>>({
    cash: false,
    card: false,
    transfer: false,
    other: false,
  })
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentMethod, number>>({
    cash: 0,
    card: 0,
    transfer: 0,
    other: 0,
  })
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [lines, setLines] = useState<POLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})

  const debouncedSupplierSearch = useDebouncedValue(supplierSearch, DEBOUNCE_MS)

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
    enabled: open,
  })

  const { data: supplierPeople = [] } = useQuery({
    queryKey: ['people', 'po-picker', debouncedSupplierSearch],
    queryFn: () =>
      getAllPeople({
        role: 'supplier',
        search: debouncedSupplierSearch.trim() || undefined,
      }),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setSupplierSearch('')
      setSelectedSupplier(null)
    }
  }, [open])

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 20)
    const q = productSearch.trim().toLowerCase()
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) &&
          !lines.some((l) => l.product_id === p.id)
      )
      .slice(0, 20)
  }, [products, productSearch, lines])

  const addProduct = (product: ProductWithRelations) => {
    if (lines.some((l) => l.product_id === product.id)) return
    setLines((prev) => [
      ...prev,
      {
        product_id: product.id,
        name: product.name,
        defaultCostPrice: product.cost_price,
        costPrice: product.cost_price,
        quantity: 1,
        updateDefaultCostPrice: false,
      },
    ])
    setProductSearch('')
  }

  const updateLine = (
    productId: string,
    upd: Partial<Pick<POLine, 'costPrice' | 'quantity' | 'updateDefaultCostPrice'>>
  ) => {
    setLines((prev) =>
      prev.map((l) =>
        l.product_id === productId ? { ...l, ...upd } : l
      )
    )
    setLineErrors((e) => {
      const next = { ...e }
      delete next[productId]
      return next
    })
  }

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.product_id !== productId))
    setLineErrors((e) => {
      const next = { ...e }
      delete next[productId]
      return next
    })
  }

  const runningTotal = useMemo(
    () =>
      lines.reduce((sum, l) => sum + l.costPrice * l.quantity, 0),
    [lines]
  )

  const paymentTotal = useMemo(
    () =>
      PAYMENT_METHODS.reduce(
        (sum, method) => sum + (paymentAmounts[method] || 0),
        0
      ),
    [paymentAmounts]
  )

  const setPaymentAmount = (method: PaymentMethod, value: number) => {
    setPaymentAmounts((prev) => ({ ...prev, [method]: Math.max(0, value) }))
    setPaymentError(null)
  }

  const togglePaymentMethod = (method: PaymentMethod, checked: boolean) => {
    setPaymentSelected((prev) => ({ ...prev, [method]: checked }))
    if (!checked) setPaymentAmounts((prev) => ({ ...prev, [method]: 0 }))
    setPaymentError(null)
  }

  const validate = (): boolean => {
    if (lines.length === 0) {
      return false
    }
    const errors: Record<string, string> = {}
    for (const line of lines) {
      if (line.quantity < 1) {
        errors[line.product_id] = t('purchaseOrders.validationQuantityMin')
      } else if (line.costPrice < 0) {
        errors[line.product_id] = t('purchaseOrders.validationCostPriceMin')
      }
    }
    setLineErrors(errors)
    const hasPayment = PAYMENT_METHODS.some((m) => (paymentAmounts[m] || 0) > 0)
    if (hasPayment && Math.abs(paymentTotal - runningTotal) > 0.01) {
      setPaymentError(
        (t as (key: string, opts?: Record<string, number>) => string)(
          'orders.validationPaymentTotal',
          { total: runningTotal }
        )
      )
      return false
    }
    setPaymentError(null)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      toast.error(t('purchaseOrders.validationAtLeastOne'))
      return
    }
    if (!validate()) return
    const payments = PAYMENT_METHODS.filter((m) => (paymentAmounts[m] || 0) > 0).map(
      (method) => ({ payment_method: method, amount: paymentAmounts[method] })
    )
    try {
      await createPurchaseOrder({
        supplier_name: supplierName.trim() || undefined,
        person_id: selectedSupplier?.id,
        note: note.trim() || undefined,
        payments,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          cost_price: l.costPrice,
          update_default_cost_price: l.updateDefaultCostPrice,
        })),
      })
      onSuccess()
      setSupplierName('')
      setSelectedSupplier(null)
      setSupplierSearch('')
      setNote('')
      setPaymentSelected({ cash: false, card: false, transfer: false, other: false })
      setPaymentAmounts({ cash: 0, card: 0, transfer: 0, other: 0 })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof (err as { message?: string })?.message === 'string'
            ? (err as { message: string }).message
            : undefined
      onError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('purchaseOrders.createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('purchaseOrders.selectSupplier')}</Label>
            <Input
              placeholder={t('orders.searchPeople')}
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="mb-2"
            />
            {selectedSupplier && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1 mb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{selectedSupplier.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSupplier(null)}
                  >
                    {t('common.close')}
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  {t('purchaseOrders.supplierBalance')}:{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCurrency(selectedSupplier.balance)}
                  </span>
                </p>
              </div>
            )}
            <div className="max-h-24 overflow-y-auto rounded border border-border divide-y mb-3">
              {supplierPeople
                .filter((p) => !selectedSupplier || p.id !== selectedSupplier.id)
                .slice(0, 12)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setSelectedSupplier(p)
                      setSupplierName(p.name)
                    }}
                  >
                    {p.name}
                    {p.phone ? ` — ${p.phone}` : ''}
                  </button>
                ))}
            </div>
            <Label>{t('purchaseOrders.supplierNameOptional')}</Label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="mt-1"
              placeholder={t('purchaseOrders.supplierNamePlaceholder')}
            />
          </div>
          <div>
            <Label>{t('purchaseOrders.noteOptional')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div>
            <Label className="mb-2 block">{t('orders.paymentBreakdown')}</Label>
            <p className="text-sm text-muted-foreground mb-2">
              {t('purchaseOrders.runningTotal')}: {formatCurrency(runningTotal)}
            </p>
            <div className="space-y-2 rounded-lg border border-border p-3">
              {PAYMENT_METHODS.map((method) => (
                <div key={method} className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={paymentSelected[method]}
                      onChange={(e) => togglePaymentMethod(method, e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>{paymentLabel(method, t)}</span>
                  </label>
                  {paymentSelected[method] && (
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder={t('orders.paymentAmount')}
                      value={paymentAmounts[method] || ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        setPaymentAmount(method, Number.isFinite(v) ? v : 0)
                      }}
                      className="w-28 h-8"
                    />
                  )}
                </div>
              ))}
            </div>
            {(paymentTotal > 0 || paymentError) && (
              <p className="text-sm mt-1.5">
                <span className="text-muted-foreground">
                  {t('orders.paymentRemaining')}:{' '}
                </span>
                <span
                  className={
                    Math.abs(paymentTotal - runningTotal) > 0.01
                      ? 'text-destructive font-medium'
                      : ''
                  }
                >
                  {formatCurrency(runningTotal - paymentTotal)}
                </span>
              </p>
            )}
            {paymentError && (
              <p className="text-sm text-destructive mt-1">{paymentError}</p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">{t('purchaseOrders.addProducts')}</Label>
            <Input
              placeholder={t('purchaseOrders.searchProducts')}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mb-2"
            />
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {filteredProducts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    {p.name} — {formatCurrency(p.cost_price)} {t('purchaseOrders.perUnit')}
                  </button>
                </li>
              ))}
              {filteredProducts.length === 0 && productSearch.trim() && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {t('common.noResults')}
                </li>
              )}
            </ul>
          </div>

          {lines.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('purchaseOrders.orderLines')}</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-3 py-2 text-start font-medium">{t('common.name')}</th>
                      <th className="px-3 py-2 text-end font-medium">{t('purchaseOrders.defaultCostPrice')}</th>
                      <th className="px-3 py-2 text-end font-medium">{t('purchaseOrders.costPrice')}</th>
                      <th className="px-3 py-2 text-end font-medium">{t('common.quantity')}</th>
                      <th className="px-3 py-2 text-end font-medium">{t('purchaseOrders.lineTotal')}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const diffFromDefault = line.costPrice !== line.defaultCostPrice
                      return (
                        <React.Fragment key={line.product_id}>
                          <tr className="border-b border-border/50">
                            <td className="px-3 py-2 font-medium">{line.name}</td>
                            <td className="px-3 py-2 text-end text-muted-foreground tabular-nums">
                              {formatCurrency(line.defaultCostPrice)}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                className="w-24 text-right h-8"
                                value={line.costPrice === 0 && line.defaultCostPrice === 0 ? '' : line.costPrice}
                                onChange={(e) =>
                                  updateLine(line.product_id, {
                                    costPrice: e.target.value === '' ? 0 : Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={1}
                                className="w-20 text-right h-8"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateLine(line.product_id, {
                                    quantity: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-2 text-end tabular-nums">
                              {formatCurrency(line.costPrice * line.quantity)}
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeLine(line.product_id)}
                                aria-label={t('purchaseOrders.remove')}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                          {diffFromDefault && (
                            <tr className="border-b border-border/50">
                              <td colSpan={6} className="px-3 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs">
                                <span className="inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {(t as (key: string, opts?: Record<string, string>) => string)(
                                    'purchaseOrders.costPriceDiffWarning',
                                    { default: formatCurrency(line.defaultCostPrice) }
                                  )}
                                </span>
                                <label className="ml-2 inline-flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={line.updateDefaultCostPrice}
                                    onChange={(e) =>
                                      updateLine(line.product_id, {
                                        updateDefaultCostPrice: e.target.checked,
                                      })
                                    }
                                  />
                                  {t('purchaseOrders.updateDefaultCostPrice')}
                                </label>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {Object.keys(lineErrors).length > 0 && (
                <p className="text-sm text-destructive">
                  {Object.values(lineErrors)[0]}
                </p>
              )}
              <p className="text-sm font-semibold">
                {t('purchaseOrders.runningTotal')}: {formatCurrency(runningTotal)}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={lines.length === 0}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PODetailDialog({
  po,
  open,
  onOpenChange,
  t,
  formatCurrency,
  formatDate,
  canCancel,
  onCancelClick,
}: {
  po: PurchaseOrderWithItems
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (k: string) => string
  formatCurrency: (n: number) => string
  formatDate: (iso: string) => string
  canCancel: boolean
  onCancelClick: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {(t as (key: string, opts?: Record<string, number>) => string)(
              'purchaseOrders.detailTitle',
              { number: po.order_number }
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t('purchaseOrders.supplierName')}:</span>{' '}
              {po.supplier_name ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">{t('purchaseOrders.date')}:</span>{' '}
              {formatDate(po.created_at)}
            </p>
            <p>
              <span className="text-muted-foreground">{t('purchaseOrders.status')}:</span>{' '}
              <POStatusBadge status={po.status} t={t} />
            </p>
            {po.payments && po.payments.length > 0 && (
              <p className="col-span-2">
                <span className="text-muted-foreground">{t('orders.paymentMethod')}:</span>
                <span className="block mt-1">
                  {po.payments.map((p: PurchaseOrderPayment) => (
                    <span key={p.id ?? p.payment_method} className="block">
                      {paymentLabel(p.payment_method, t)}: {formatCurrency(p.amount)}
                    </span>
                  ))}
                </span>
              </p>
            )}
            {po.note && (
              <p className="col-span-2">
                <span className="text-muted-foreground">{t('purchaseOrders.note')}:</span>{' '}
                {po.note}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-2 text-start font-medium">{t('common.name')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('common.quantity')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('purchaseOrders.costPricePaid')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('purchaseOrders.previousCostPrice')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('purchaseOrders.costPriceUpdated')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('purchaseOrders.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 font-medium">{item.product.name}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {formatCurrency(item.cost_price)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">
                      {item.previous_cost_price != null
                        ? formatCurrency(item.previous_cost_price)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.cost_price_updated ? t('common.yes') : t('common.no')}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {formatCurrency(item.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm font-semibold">
            {t('purchaseOrders.totalAmount')}: {formatCurrency(po.total_amount)}
          </p>
          {po.status === 'received' && canCancel && (
            <Button variant="destructive" onClick={onCancelClick}>
              {t('purchaseOrders.cancelPurchaseOrder')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
