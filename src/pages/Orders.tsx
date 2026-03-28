import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, XCircle, ShoppingCart } from 'lucide-react'

import {
  getAllOrders,
  createOrder,
  cancelOrder,
} from '@/services/orderService'
import { getAllProducts } from '@/services/productService'
import { getAllPeople, roundMoney } from '@/services/peopleService'
import type {
  OrderWithItems,
  OrderType,
  OrderStatus,
  PaymentMethod,
  OrderPayment,
  Person,
} from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 300

type StatusFilter = 'all' | OrderStatus
type TypeFilter = 'all' | OrderType

interface OrderLine {
  product_id: string
  name: string
  availableStock: number
  quantity: number
}

function paymentLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    cash: 'orders.paymentCash',
    card: 'orders.paymentCard',
    transfer: 'orders.paymentTransfer',
    other: 'orders.paymentOther',
  }
  return t(map[key] ?? 'orders.paymentNone')
}

function formatPaymentSummary(
  order: OrderWithItems,
  t: (k: string) => string,
  formatCurrency: (n: number) => string
): string {
  if (order.payments && order.payments.length > 0) {
    return order.payments
      .map((p) => `${paymentLabel(p.payment_method, t)} ${formatCurrency(p.amount)}`)
      .join(', ')
  }
  if (order.payment_method) {
    return paymentLabel(order.payment_method, t)
  }
  return '—'
}

export function Orders() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<OrderWithItems | null>(null)
  const [cancelOrderState, setCancelOrderState] =
    useState<OrderWithItems | null>(null)

  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  useEffect(() => {
    document.title = 'Orders | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    [debouncedSearch, statusFilter, typeFilter, dateFrom, dateTo]
  )

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => getAllOrders(filters),
  })

  useEffect(() => {
    const st = location.state as { openOrderId?: string } | null
    if (!st?.openOrderId || orders.length === 0) return
    const o = orders.find((x) => x.id === st.openOrderId)
    if (o) {
      setDetailOrder(o)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, orders, location.pathname, navigate])

  const totalRevenue = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + o.total_amount, 0),
    [orders]
  )
  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === 'pending').length,
    [orders]
  )
  const cancelledCount = useMemo(
    () => orders.filter((o) => o.status === 'cancelled').length,
    [orders]
  )

  const formatCurrencyDisplay = (n: number) => formatCurrency(n, lang)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
    }).format(new Date(iso))

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['recentMovements'] })
    queryClient.invalidateQueries({ queryKey: ['people'] })
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('orders.searchPlaceholder')}
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
              ['all', 'orders.filterStatusAll'],
              ['pending', 'orders.filterStatusPending'],
              ['completed', 'orders.filterStatusCompleted'],
              ['cancelled', 'orders.filterStatusCancelled'],
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
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('orders.filterTypeAll')}</SelectItem>
            <SelectItem value="retail">{t('orders.filterTypeRetail')}</SelectItem>
            <SelectItem value="wholesale">
              {t('orders.filterTypeWholesale')}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[140px]"
          aria-label={t('orders.dateFrom')}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[140px]"
          aria-label={t('orders.dateTo')}
        />
        <Button onClick={() => setCreateOpen(true)}>{t('orders.newOrder')}</Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('orders.totalOrders')}
          value={String(orders.length)}
        />
        <StatCard
          label={t('orders.totalRevenue')}
          value={formatCurrencyDisplay(totalRevenue)}
        />
        <StatCard
          label={t('orders.pendingOrders')}
          value={String(pendingCount)}
        />
        <StatCard
          label={t('orders.cancelledOrders')}
          value={String(cancelledCount)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('orders.emptyOrders')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('orders.orderNumber')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('common.type')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('orders.status')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    —
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {t('orders.totalAmount')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('orders.paymentMethod')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground max-w-[180px]">
                    {t('orders.note')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('orders.date')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={order.type} t={t} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} t={t} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.items.length === 1
                        ? t('orders.itemCount')
                        : t('orders.itemsCount', { count: order.items.length })}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatCurrencyDisplay(order.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatPaymentSummary(order, t, formatCurrencyDisplay)}
                    </td>
                    <td
                      className="px-4 py-3 text-muted-foreground max-w-[180px] truncate"
                      title={order.note ?? undefined}
                    >
                      {order.note ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailOrder(order)}
                          aria-label={t('orders.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCancelOrderState(order)}
                            aria-label={t('orders.cancelOrder')}
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

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        t={t}
        formatCurrency={formatCurrencyDisplay}
        onSuccess={() => {
          invalidateOrders()
          toast.success(t('orders.toastOrderCreated'))
          setCreateOpen(false)
        }}
        onError={(message) =>
          toast.error(message || t('orders.toastError'))
        }
      />

      {detailOrder && (
        <OrderDetailDialog
          order={detailOrder}
          open={!!detailOrder}
          onOpenChange={(open) => !open && setDetailOrder(null)}
          t={t}
          formatCurrency={formatCurrencyDisplay}
          formatDate={formatDate}
          paymentLabel={(key) => paymentLabel(key, t)}
          onCancelClick={() => {
            setDetailOrder(null)
            setCancelOrderState(detailOrder)
          }}
        />
      )}

      {cancelOrderState && (
        <AlertDialog
          open={!!cancelOrderState}
          onOpenChange={(open) => !open && setCancelOrderState(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('orders.cancelConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {(t as (key: string, opts?: Record<string, number>) => string)(
                  'orders.cancelConfirmMessage',
                  { number: cancelOrderState.order_number }
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await cancelOrder(cancelOrderState.id)
                    invalidateOrders()
                    toast.success(t('orders.toastOrderCancelled'))
                    setCancelOrderState(null)
                    setDetailOrder(null)
                  } catch {
                    toast.error(t('orders.toastError'))
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('orders.cancelOrder')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function TypeBadge({
  type,
  t,
}: { type: OrderType; t: (k: string) => string }) {
  const styles = {
    retail:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    wholesale:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        styles[type]
      )}
    >
      {type === 'retail' ? t('orders.typeRetail') : t('orders.typeWholesale')}
    </span>
  )
}

function StatusBadge({
  status,
  t,
}: { status: OrderStatus; t: (k: string) => string }) {
  const styles = {
    pending:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const keys = {
    pending: 'orders.statusPending',
    completed: 'orders.statusCompleted',
    cancelled: 'orders.statusCancelled',
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

function CreateOrderDialog({
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
  const [orderType, setOrderType] = useState<OrderType>('retail')
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
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<OrderLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [personSearch, setPersonSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [applyPersonDiscount, setApplyPersonDiscount] = useState(true)

  const debouncedPersonSearch = useDebouncedValue(personSearch, DEBOUNCE_MS)

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
    enabled: open,
  })

  const { data: customerPeople = [] } = useQuery({
    queryKey: ['people', 'order-picker', debouncedPersonSearch],
    queryFn: () =>
      getAllPeople({
        role: 'customer',
        search: debouncedPersonSearch.trim() || undefined,
      }),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setPersonSearch('')
      setSelectedPerson(null)
      setApplyPersonDiscount(true)
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

  const addProduct = (product: { id: string; name: string; quantity: number }) => {
    if (lines.some((l) => l.product_id === product.id)) return
    setLines((prev) => [
      ...prev,
      {
        product_id: product.id,
        name: product.name,
        availableStock: product.quantity,
        quantity: 1,
      },
    ])
    setProductSearch('')
  }

  const getUnitPrice = (productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return 0
    return orderType === 'retail' ? p.customer_price : p.business_price
  }

  const updateQuantity = (productId: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.product_id === productId
          ? { ...l, quantity: Math.max(0, quantity) }
          : l
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

  const runningTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const p = products.find((x) => x.id === l.product_id)
      const unitPrice = p
        ? orderType === 'retail'
          ? p.customer_price
          : p.business_price
        : 0
      return sum + unitPrice * l.quantity
    }, 0)
  }, [lines, orderType, products])

  const orderTotal = useMemo(() => {
    const sub = roundMoney(runningTotal)
    if (
      !selectedPerson ||
      !applyPersonDiscount ||
      selectedPerson.discount_rate <= 0
    ) {
      return sub
    }
    return roundMoney(sub * (1 - selectedPerson.discount_rate / 100))
  }, [runningTotal, selectedPerson, applyPersonDiscount])

  const creditExceeded = Boolean(
    selectedPerson &&
      selectedPerson.credit_limit != null &&
      roundMoney(selectedPerson.balance + orderTotal) >
        roundMoney(selectedPerson.credit_limit) + 0.001
  )

  const availableCredit =
    selectedPerson && selectedPerson.credit_limit != null
      ? roundMoney(
          Math.max(0, selectedPerson.credit_limit - selectedPerson.balance)
        )
      : null

  const paymentTotal = useMemo(
    () =>
      (PAYMENT_METHODS as PaymentMethod[]).reduce(
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
      if (line.quantity > line.availableStock) {
        errors[line.product_id] = (
          t as (key: string, opts?: Record<string, number>) => string
        )('orders.validationQuantityExceeds', {
          available: line.availableStock,
        })
      }
    }
    setLineErrors(errors)
    const hasPayment = (PAYMENT_METHODS as PaymentMethod[]).some(
      (m) => (paymentAmounts[m] || 0) > 0
    )
    if (hasPayment && Math.abs(paymentTotal - orderTotal) > 0.01) {
      setPaymentError(
        (t as (key: string, opts?: Record<string, number>) => string)(
          'orders.validationPaymentTotal',
          { total: orderTotal }
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
      return
    }
    if (!validate()) return
    const payments = (PAYMENT_METHODS as PaymentMethod[])
      .filter((m) => (paymentAmounts[m] || 0) > 0)
      .map((method) => ({ payment_method: method, amount: paymentAmounts[method] }))
    try {
      await createOrder({
        type: orderType,
        payments,
        note: note.trim() || undefined,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: getUnitPrice(l.product_id),
        })),
        person_id: selectedPerson?.id,
        apply_person_discount: applyPersonDiscount,
      })
      onSuccess()
      setLines([])
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
          <DialogTitle>{t('orders.createOrderTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('orders.selectCustomer')}</Label>
            <Input
              placeholder={t('orders.searchPeople')}
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              className="mb-2"
            />
            {selectedPerson && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2 mb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{selectedPerson.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPerson(null)}
                  >
                    {t('common.close')}
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  {t('orders.personBalance')}:{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCurrency(selectedPerson.balance)}
                  </span>
                </p>
                {selectedPerson.credit_limit != null && (
                  <p className="text-muted-foreground">
                    {t('orders.availableCredit')}:{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatCurrency(availableCredit ?? 0)}
                    </span>
                  </p>
                )}
                {selectedPerson.discount_rate > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyPersonDiscount}
                      onChange={(e) => setApplyPersonDiscount(e.target.checked)}
                    />
                    <span>
                      {(t as (k: string, o: Record<string, number>) => string)(
                        'orders.applyDiscountToggle',
                        { pct: selectedPerson.discount_rate }
                      )}
                    </span>
                  </label>
                )}
              </div>
            )}
            <div className="max-h-28 overflow-y-auto rounded border border-border divide-y">
              {customerPeople
                .filter((p) => !selectedPerson || p.id !== selectedPerson.id)
                .slice(0, 12)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setSelectedPerson(p)
                      setApplyPersonDiscount(p.discount_rate > 0)
                    }}
                  >
                    {p.name}
                    {p.phone ? ` — ${p.phone}` : ''}
                  </button>
                ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">{t('orders.orderType')}</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="orderType"
                  checked={orderType === 'retail'}
                  onChange={() => setOrderType('retail')}
                  className="rounded-full"
                />
                <span>{t('orders.typeRetail')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="orderType"
                  checked={orderType === 'wholesale'}
                  onChange={() => setOrderType('wholesale')}
                  className="rounded-full"
                />
                <span>{t('orders.typeWholesale')}</span>
              </label>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">{t('orders.paymentBreakdown')}</Label>
            <div className="text-sm text-muted-foreground mb-2 space-y-0.5">
              <p>
                {t('orders.subtotal')}: {formatCurrency(runningTotal)}
              </p>
              {Math.abs(orderTotal - roundMoney(runningTotal)) > 0.001 && (
                <p>
                  {t('orders.discountedTotal')}: {formatCurrency(orderTotal)}
                </p>
              )}
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3">
              {(PAYMENT_METHODS as PaymentMethod[]).map((method) => (
                <div
                  key={method}
                  className="flex items-center gap-3 flex-wrap"
                >
                  <label className="flex items-center gap-2 cursor-pointer min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={paymentSelected[method]}
                      onChange={(e) =>
                        togglePaymentMethod(method, e.target.checked)
                      }
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
                  className={Math.abs(paymentTotal - orderTotal) > 0.01 ? 'text-destructive font-medium' : ''}
                >
                  {formatCurrency(orderTotal - paymentTotal)}
                </span>
              </p>
            )}
            {paymentError && (
              <p className="text-sm text-destructive mt-1">{paymentError}</p>
            )}
          </div>
          <div>
            <Label>{t('orders.noteOptional')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div>
            <Label className="mb-2 block">{t('orders.addProducts')}</Label>
            <Input
              placeholder={t('orders.searchProducts')}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-32 overflow-y-auto rounded border border-border p-2 space-y-1">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                >
                  {p.name} — {t('orders.availableStock')}: {p.quantity} —{' '}
                  {formatCurrency(
                    orderType === 'retail' ? p.customer_price : p.business_price
                  )}
                </button>
              ))}
              {filteredProducts.length === 0 && productSearch.trim() && (
                <p className="text-sm text-muted-foreground px-2 py-1">
                  {t('common.noResults')}
                </p>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {lines.map((line) => (
                <div
                  key={line.product_id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                >
                  <span className="font-medium flex-1 min-w-[120px]">
                    {line.name}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {t('orders.availableStock')}: {line.availableStock}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {t('orders.unitPrice')}:{' '}
                    {formatCurrency(getUnitPrice(line.product_id))}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={line.availableStock}
                    value={line.quantity}
                    onChange={(e) =>
                      updateQuantity(
                        line.product_id,
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-20 h-8"
                  />
                  <span className="font-medium w-20 text-end">
                    {formatCurrency(
                      getUnitPrice(line.product_id) * line.quantity
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(line.product_id)}
                  >
                    {t('orders.remove')}
                  </Button>
                  {lineErrors[line.product_id] && (
                    <p className="text-sm text-destructive w-full">
                      {lineErrors[line.product_id]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('orders.validationAtLeastOneProduct')}
              </p>
            )}
            <p className="mt-2 font-semibold">
              {t('orders.runningTotal')}: {formatCurrency(orderTotal)}
            </p>
            {creditExceeded && (
              <p className="mt-2 text-sm text-destructive font-medium">
                {t('orders.creditBlocked')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={lines.length === 0 || creditExceeded}>
              {t('common.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  t,
  formatCurrency,
  formatDate,
  paymentLabel,
  onCancelClick,
}: {
  order: OrderWithItems
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (k: string) => string
  formatCurrency: (n: number) => string
  formatDate: (iso: string) => string
  paymentLabel: (key: string) => string
  onCancelClick: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {(t as (key: string, opts?: Record<string, number>) => string)(
              'orders.orderDetailTitle',
              { number: order.order_number }
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t('common.type')}:</span>{' '}
            <TypeBadge type={order.type} t={t} />{' '}
            <StatusBadge status={order.status} t={t} />
          </p>
          <p>
            <span className="text-muted-foreground">
              {t('orders.paymentMethod')}:
            </span>{' '}
            {order.payments && order.payments.length > 0 ? (
              <span className="block mt-1">
                {order.payments.map((p: OrderPayment) => (
                  <span key={p.id ?? p.payment_method} className="block">
                    {paymentLabel(p.payment_method)}: {formatCurrency(p.amount)}
                  </span>
                ))}
              </span>
            ) : order.payment_method ? (
              paymentLabel(order.payment_method)
            ) : (
              '—'
            )}
          </p>
          <p>
            <span className="text-muted-foreground">{t('orders.date')}:</span>{' '}
            {formatDate(order.created_at)}
          </p>
          {order.note && (
            <p>
              <span className="text-muted-foreground">{t('orders.note')}:</span>{' '}
              {order.note}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2 font-medium">
                  {t('common.name')}
                </th>
                <th className="text-end py-2 font-medium">
                  {t('common.quantity')}
                </th>
                <th className="text-end py-2 font-medium">
                  {t('orders.unitPrice')}
                </th>
                <th className="text-end py-2 font-medium">
                  {t('orders.lineTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-2">{item.product.name}</td>
                  <td className="py-2 text-end">{item.quantity}</td>
                  <td className="py-2 text-end">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-2 text-end">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-semibold text-end">
          {t('orders.totalAmount')}: {formatCurrency(order.total_amount)}
        </p>
        {order.status === 'pending' && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={onCancelClick}
          >
            {t('orders.cancelOrder')}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
