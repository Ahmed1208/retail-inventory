import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ChevronDown, Loader2, Trash2 } from 'lucide-react'

import {
  confirmOrder,
  createOrder,
  saveDraftOrder,
} from '@/services/orderService'
import { getAllProducts } from '@/services/productService'
import { getAllCategories } from '@/services/categoryService'
import { getAllPeople, roundMoney } from '@/services/peopleService'
import type { OrderType, PaymentMethod, ProductWithRelations } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { CustomerBrowserModal } from '@/components/orders/CustomerBrowserModal'
import { ProductBrowserModal } from '@/components/orders/ProductBrowserModal'
import { OrderCheckoutModal } from '@/components/orders/OrderCheckoutModal'
import {
  catalogPriceForOrderType,
  LINE_CELL_COLS,
  computePreview,
  emptyLine,
  findProductByInput,
  lineTotal,
  linesToPosInput,
  PAYMENT_METHODS,
  unitPriceDiffersFromList,
  type LineRow,
  type TFn,
} from '@/components/orders/ordersShared'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

/** # · ID · name · stock · qty · price+reset · % · total · (actions) */
const POS_TABLE_GRID =
  'grid-cols-[2rem_7rem_minmax(0,1fr)_3rem_3.5rem_9rem_3.25rem_4.5rem_2.25rem]'

export type PosOrderFormProps = {
  /** null = brand-new order at /orders/new */
  draftOrderId: string | null
  /** Sync draft from server (Order detail page) */
  initialDraft?: import('@/types').OrderWithItemsAndPayments | null
  isLoadingDraft?: boolean
}

export function PosOrderForm({
  draftOrderId,
  initialDraft,
  isLoadingDraft,
}: PosOrderFormProps) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fc = useCallback((n: number) => formatCurrency(n, lang), [lang])
  const canSaveDraft = useFeatureEnabled('orders.posSaveDraft')
  const canCheckout = useFeatureEnabled('orders.posCheckout')

  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserTargetLineKey, setBrowserTargetLineKey] = useState<
    string | null
  >(null)
  const [customerBrowserOpen, setCustomerBrowserOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const [orderType, setOrderType] = useState<OrderType>('retail')
  const [personId, setPersonId] = useState<string | null>(null)
  const [applyPersonDiscount, setApplyPersonDiscount] = useState(true)
  const [discountRate, setDiscountRate] = useState(0)
  const [allowRemaining, setAllowRemaining] = useState(false)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineRow[]>(() => [emptyLine()])
  const [payUse, setPayUse] = useState<Record<PaymentMethod, boolean>>({
    cash: false,
    visa: false,
    cheque: false,
    instapay: false,
  })
  const [payAmounts, setPayAmounts] = useState<Record<PaymentMethod, string>>({
    cash: '',
    visa: '',
    cheque: '',
    instapay: '',
  })

  const [focusCellPos, setFocusCellPos] = useState({ row: 0, col: 0 })
  const cellRefs = useRef<Map<string, (HTMLElement | null)[]>>(new Map())
  const formSyncKey = useRef<string | null>(null)

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getAllCategories,
  })
  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const customers = useMemo(
    () => people.filter((p) => p.roles.includes('customer')),
    [people]
  )
  const selectedPerson = useMemo(
    () => (personId ? customers.find((p) => p.id === personId) ?? null : null),
    [customers, personId]
  )

  const syncDraftFormFromOrder = useCallback(
    (o: import('@/types').OrderWithItemsAndPayments) => {
      const key = `${o.id}:${o.updated_at}`
      if (formSyncKey.current === key) return
      formSyncKey.current = key
      setOrderType(o.type)
      setPersonId(o.person_id)
      setDiscountRate(o.discount_rate)
      setAllowRemaining(o.allow_remaining_on_account)
      setNote(o.note ?? '')
      setLines(
        o.items.length
          ? o.items.map((it) => {
              const list = catalogPriceForOrderType(it.product, o.type)
              return {
                key: it.id,
                product_id: it.product_id,
                productIdInput: it.product.product_code,
                name: it.product.name,
                qty: it.quantity,
                unitPrice: it.unit_price,
                listUnitPrice: list,
                priceOverridden: Math.abs(it.unit_price - list) > 0.005,
                discountPct: it.line_discount_rate,
                stock: it.product.quantity,
                lookupInvalid: false,
              }
            })
          : [emptyLine()]
      )
      const use: Record<PaymentMethod, boolean> = {
        cash: false,
        visa: false,
        cheque: false,
        instapay: false,
      }
      const amts: Record<PaymentMethod, string> = {
        cash: '',
        visa: '',
        cheque: '',
        instapay: '',
      }
      for (const p of o.payment_installments) {
        use[p.method] = true
        const cur = parseFloat(amts[p.method]) || 0
        amts[p.method] = String(roundMoney(cur + p.amount))
      }
      setPayUse(use)
      setPayAmounts(amts)
      const pers = o.person_id
        ? customers.find((c) => c.id === o.person_id)
        : null
      if (pers && pers.discount_rate === o.discount_rate) {
        setApplyPersonDiscount(true)
      } else {
        setApplyPersonDiscount(false)
      }
      setFocusCellPos({ row: 0, col: 0 })
    },
    [customers]
  )

  useEffect(() => {
    if (!draftOrderId) {
      formSyncKey.current = null
      return
    }
    if (!initialDraft || initialDraft.status_flow !== 'draft') return
    syncDraftFormFromOrder(initialDraft)
  }, [draftOrderId, initialDraft, syncDraftFormFromOrder])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return
      if (browserOpen || customerBrowserOpen) return
      e.preventDefault()
      const target = e.target
      const inCustomerZone =
        target instanceof Element &&
        Boolean(target.closest('[data-order-customer-zone]'))
      if (inCustomerZone) {
        setCustomerBrowserOpen(true)
        return
      }
      const lineKey = lines[focusCellPos.row]?.key ?? lines.at(-1)?.key
      if (lineKey) setBrowserTargetLineKey(lineKey)
      setBrowserOpen(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [browserOpen, customerBrowserOpen, lines, focusCellPos.row])

  useEffect(() => {
    if (!selectedPerson) {
      setApplyPersonDiscount(false)
      return
    }
    if (applyPersonDiscount) {
      setDiscountRate(selectedPerson.discount_rate)
    }
  }, [selectedPerson, applyPersonDiscount])

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['order'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['people'] })
  }, [qc])

  const preview = useMemo(
    () => computePreview(lines, discountRate),
    [lines, discountRate]
  )

  const paidPreview = useMemo(() => {
    let s = 0
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = parseFloat(payAmounts[m]) || 0
      if (v > 0) s += v
    }
    return roundMoney(s)
  }, [payUse, payAmounts])

  const remainingPreview = roundMoney(preview.total - paidPreview)

  const overpaymentExcess = useMemo(() => {
    if (paidPreview <= preview.total + 0.01) return 0
    return roundMoney(paidPreview - preview.total)
  }, [paidPreview, preview.total])

  const buildPaymentsPayload = useCallback(() => {
    const out: { payment_method: PaymentMethod; amount: number }[] = []
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = roundMoney(parseFloat(payAmounts[m]) || 0)
      if (v > 0.001) out.push({ payment_method: m, amount: v })
    }
    return out
  }, [payUse, payAmounts])

  const hasValidLines = useMemo(
    () => lines.some((l) => l.product_id && l.qty >= 1),
    [lines]
  )
  const stockOk = useMemo(
    () => lines.every((l) => !l.product_id || l.qty <= l.stock),
    [lines]
  )
  const canConfirm = useMemo(() => {
    if (!hasValidLines || !stockOk) return false
    if (overpaymentExcess > 0.01 && !personId) return false
    if (remainingPreview > 0.01) {
      if (allowRemaining) {
        if (!personId) return false
      } else {
        return false
      }
    }
    return true
  }, [
    hasValidLines,
    stockOk,
    remainingPreview,
    allowRemaining,
    personId,
    overpaymentExcess,
  ])

  const duplicateProductIds = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lines) {
      if (!l.product_id) continue
      m.set(l.product_id, (m.get(l.product_id) ?? 0) + 1)
    }
    return new Set(
      [...m.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    )
  }, [lines])

  const applyProductToLine = useCallback(
    (lineKey: string, p: ProductWithRelations) => {
      const price = catalogPriceForOrderType(p, orderType)
      setLines((prev) =>
        prev.map((row) =>
          row.key === lineKey
            ? {
                ...row,
                product_id: p.id,
                productIdInput: p.product_code,
                name: p.name,
                unitPrice: price,
                listUnitPrice: price,
                priceOverridden: false,
                stock: p.quantity,
                lookupInvalid: false,
              }
            : row
        )
      )
    },
    [orderType]
  )

  const handleDebouncedLookup = useCallback(
    (lineKey: string, raw: string) => {
      const q = raw.trim()
      if (!q) {
        setLines((prev) =>
          prev.map((r) =>
            r.key === lineKey
              ? {
                  ...r,
                  product_id: '',
                  name: '',
                  unitPrice: 0,
                  listUnitPrice: 0,
                  priceOverridden: false,
                  stock: 0,
                  lookupInvalid: false,
                }
              : r
          )
        )
        return
      }
      const res = findProductByInput(products, q)
      if (res === 'ambiguous') {
        toast.warning(t('orders.duplicateProduct'))
        setLines((prev) =>
          prev.map((r) =>
            r.key === lineKey ? { ...r, lookupInvalid: true } : r
          )
        )
        return
      }
      if (res) {
        applyProductToLine(lineKey, res)
        return
      }
      setLines((prev) =>
        prev.map((r) =>
          r.key === lineKey
            ? {
                ...r,
                product_id: '',
                name: '',
                unitPrice: 0,
                listUnitPrice: 0,
                priceOverridden: false,
                stock: 0,
                lookupInvalid: true,
              }
            : r
        )
      )
    },
    [products, applyProductToLine, t]
  )

  const setCellRef = useCallback(
    (lineKey: string, col: number, el: HTMLElement | null) => {
      let arr = cellRefs.current.get(lineKey)
      if (!arr) {
        arr = Array.from({ length: LINE_CELL_COLS }, () => null)
        cellRefs.current.set(lineKey, arr)
      }
      arr[col] = el
    },
    []
  )

  useLayoutEffect(() => {
    const key = lines[focusCellPos.row]?.key
    if (!key) return
    const el = cellRefs.current.get(key)?.[focusCellPos.col]
    el?.focus()
  }, [focusCellPos, lines])

  const addLineAfter = useCallback(
    (afterKey: string | null) => {
      let newRowIndex: number | null = null
      flushSync(() => {
        setLines((prev) => {
          const i = afterKey
            ? prev.findIndex((r) => r.key === afterKey)
            : prev.length - 1
          if (i < 0) return prev
          if (!prev[i].product_id) {
            toast.warning(t('orders.fillRowBeforeAdd'))
            return prev
          }
          const nl = emptyLine()
          newRowIndex = i + 1
          const next = [...prev]
          next.splice(newRowIndex, 0, nl)
          return next
        })
      })
      if (newRowIndex !== null) {
        setFocusCellPos({ row: newRowIndex, col: 0 })
      }
    },
    [t]
  )

  const removeLine = useCallback(
    (key: string, rowIndex: number) => {
      setLines((prev) => {
        if (prev.length <= 1) return [emptyLine()]
        const next = prev.filter((r) => r.key !== key)
        return next.length ? next : [emptyLine()]
      })
    setFocusCellPos(() =>
      rowIndex > 0 ? { row: rowIndex - 1, col: 0 } : { row: 0, col: 0 }
    )
    },
    []
  )

  const mergeDuplicates = useCallback(() => {
    const byPid = new Map<string, LineRow[]>()
    for (const l of lines) {
      if (!l.product_id) continue
      const arr = byPid.get(l.product_id) ?? []
      arr.push(l)
      byPid.set(l.product_id, arr)
    }
    setLines((prev) => {
      const kept: LineRow[] = []
      const consumed = new Set<string>()
      for (const l of prev) {
        if (!l.product_id) {
          kept.push(l)
          continue
        }
        if (consumed.has(l.product_id)) continue
        const group = byPid.get(l.product_id) ?? [l]
        consumed.add(l.product_id)
        if (group.length === 1) {
          kept.push(l)
        } else {
          const qty = group.reduce((s, x) => s + x.qty, 0)
          const first = group[0]
          kept.push({
            ...first,
            key: crypto.randomUUID(),
            qty,
            lookupInvalid: false,
          })
        }
      }
      return kept.length ? kept : [emptyLine()]
    })
    toast.success(t('orders.mergeRows'))
  }, [lines, t])

  const handleGridKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      rowIndex: number,
      colIndex: number,
      lineKey: string
    ) => {
      const maxRow = lines.length - 1
      const go = (r: number, c: number) => {
        const rr = Math.max(0, Math.min(maxRow, r))
        const cc = Math.max(0, Math.min(LINE_CELL_COLS - 1, c))
        setFocusCellPos({ row: rr, col: cc })
      }

      if (colIndex === 3 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const line = lines[rowIndex]
        if (!line) return
        const delta = e.key === 'ArrowUp' ? -1 : 1
        const next = Math.max(
          1,
          Math.min(line.stock || 999999, line.qty + delta)
        )
        setLines((prev) =>
          prev.map((r) => (r.key === lineKey ? { ...r, qty: next } : r))
        )
        return
      }

      if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault()
        if (colIndex < LINE_CELL_COLS - 1) {
          go(rowIndex, colIndex + 1)
        } else {
          const line = lines[rowIndex]
          const k = line?.key
          if (line?.product_id && k) {
            addLineAfter(k)
          } else if (rowIndex < maxRow) {
            go(rowIndex + 1, 0)
          } else if (k) {
            addLineAfter(k)
          }
        }
        return
      }
      if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        if (colIndex > 0) {
          go(rowIndex, colIndex - 1)
        } else if (rowIndex > 0) {
          go(rowIndex - 1, LINE_CELL_COLS - 1)
        }
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (rowIndex < maxRow) go(rowIndex + 1, colIndex)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (rowIndex > 0) go(rowIndex - 1, colIndex)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (colIndex < LINE_CELL_COLS - 1) {
          go(rowIndex, colIndex + 1)
        } else {
          const k = lines[rowIndex]?.key
          if (k) addLineAfter(k)
        }
      }
    },
    [lines, addLineAfter]
  )

  const saveMut = useMutation({
    mutationFn: async () => {
      const items = linesToPosInput(lines)
      if (!items.length) {
        throw new Error(t('orders.validationAtLeastOneProduct'))
      }
      const payments = buildPaymentsPayload()
      const effectiveDiscount = applyPersonDiscount
        ? undefined
        : discountRate
      if (!draftOrderId) {
        return createOrder({
          type: orderType,
          note,
          items,
          payments,
          person_id: personId ?? undefined,
          apply_person_discount: applyPersonDiscount,
          order_discount_rate: effectiveDiscount,
          allow_remaining_on_account: allowRemaining,
        })
      }
      return saveDraftOrder(draftOrderId, {
        items,
        payments,
        person_id: personId,
        order_discount_rate: discountRate,
        allow_remaining_on_account: allowRemaining,
        note,
      })
    },
    onSuccess: (o) => {
      invalidateAll()
      if (!draftOrderId) {
        navigate(`/orders/${o.id}`, { replace: true })
      }
      toast.success(t('orders.saveDraft'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const confirmMut = useMutation({
    mutationFn: async () => {
      const items = linesToPosInput(lines)
      if (!items.length) {
        throw new Error(t('orders.validationAtLeastOneProduct'))
      }
      const payments = buildPaymentsPayload()
      const effectiveDiscount = applyPersonDiscount
        ? undefined
        : discountRate
      let id = draftOrderId
      if (!id) {
        const created = await createOrder({
          type: orderType,
          note,
          items,
          payments,
          person_id: personId ?? undefined,
          apply_person_discount: applyPersonDiscount,
          order_discount_rate: effectiveDiscount,
          allow_remaining_on_account: allowRemaining,
        })
        id = created.id
        navigate(`/orders/${id}`, { replace: true })
      } else {
        await saveDraftOrder(id, {
          items,
          payments,
          person_id: personId,
          order_discount_rate: discountRate,
          allow_remaining_on_account: allowRemaining,
          note,
        })
      }
      return confirmOrder(id)
    },
    onSuccess: () => {
      invalidateAll()
      setCheckoutOpen(false)
      toast.success(t('orders.confirmOrder'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  useEffect(() => {
    setLines((prev) =>
      prev.map((l) => {
        if (!l.product_id) return l
        const p = products.find((x) => x.id === l.product_id)
        if (!p) return l
        const list = catalogPriceForOrderType(p, orderType)
        return {
          ...l,
          listUnitPrice: list,
          stock: p.quantity,
          unitPrice: l.priceOverridden ? l.unitPrice : list,
        }
      })
    )
  }, [orderType, products])

  const onPickProduct = (p: ProductWithRelations) => {
    const key = browserTargetLineKey ?? lines[lines.length - 1]?.key
    if (key) {
      const existing = lines.filter((l) => l.product_id === p.id)
      if (existing.length > 0) {
        toast.warning(t('orders.duplicateProduct'))
      }
      applyProductToLine(key, p)
    }
    setBrowserTargetLineKey(null)
  }

  const showDupBanner = [...duplicateProductIds].length > 0

  if (isLoadingDraft) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex max-h-[calc(100dvh-8.5rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <ProductBrowserModal
        open={browserOpen}
        onOpenChange={(o) => {
          setBrowserOpen(o)
          if (!o) setBrowserTargetLineKey(null)
        }}
        products={products}
        categories={categories}
        orderType={orderType}
        lang={lang}
        isRTL={isRTL}
        onPick={onPickProduct}
      />
      <CustomerBrowserModal
        open={customerBrowserOpen}
        onOpenChange={setCustomerBrowserOpen}
        customers={customers}
        isRTL={isRTL}
        formatCurrency={fc}
        onPick={(p) => setPersonId(p?.id ?? null)}
      />
      <OrderCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        isRTL={isRTL}
        formatCurrency={fc}
        preview={preview}
        discountRate={discountRate}
        paidPreview={paidPreview}
        personName={selectedPerson?.name ?? null}
        payUse={payUse}
        setPayUse={setPayUse}
        payAmounts={payAmounts}
        setPayAmounts={setPayAmounts}
        allowRemaining={allowRemaining}
        setAllowRemaining={setAllowRemaining}
        personId={personId}
        note={note}
        setNote={setNote}
        canConfirm={canConfirm}
        confirming={confirmMut.isPending}
        onConfirm={() => confirmMut.mutate()}
      />

      <header className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-2 py-1.5">
        <div className="flex rounded-md border p-0.5">
          {(['retail', 'wholesale'] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setOrderType(tp)}
              className={cn(
                'rounded px-2 py-1 text-[11px] font-medium sm:text-xs',
                orderType === tp
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {tp === 'retail'
                ? t('orders.typeRetail')
                : t('orders.typeWholesale')}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100 sm:text-xs">
          {t('orders.draft')}
        </span>
        {canSaveDraft && (
          <div className="ms-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              disabled={!hasValidLines || saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending && (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {t('orders.saveDraft')}
            </Button>
          </div>
        )}
      </header>

      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-1.5 border-b bg-background px-2 py-1.5">
        <div
          data-order-customer-zone
          className="flex min-w-[140px] max-w-full flex-1 flex-col gap-0.5 sm:min-w-[200px]"
        >
          <Label
            htmlFor="order-customer-picker"
            className="text-[10px] font-medium text-muted-foreground sm:text-xs"
          >
            {t('orders.selectCustomer')}
          </Label>
          <button
            id="order-customer-picker"
            type="button"
            className={cn(
              'flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
            )}
            onClick={() => setCustomerBrowserOpen(true)}
            onKeyDown={(ke) => {
              if (ke.key !== 'F1') return
              ke.preventDefault()
              if (browserOpen || customerBrowserOpen) return
              setCustomerBrowserOpen(true)
            }}
          >
            <span className="truncate text-start">
              {selectedPerson ? selectedPerson.name : t('orders.walkIn')}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
          </button>
        </div>
        {selectedPerson && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
            <span>
              {t('orders.personBalance')}: {fc(selectedPerson.balance)}
            </span>
            <span>
              {t('orders.discount')}: {selectedPerson.discount_rate}%
            </span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={applyPersonDiscount}
                onChange={(e) => setApplyPersonDiscount(e.target.checked)}
              />
              <span className="whitespace-nowrap">
                {t('orders.applyPersonDiscount')}
              </span>
            </label>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Label className="whitespace-nowrap text-[10px] text-muted-foreground sm:text-xs">
            {t('orders.discount')} %
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className="h-8 w-[4.25rem] px-1.5 text-xs"
            disabled={applyPersonDiscount && !!selectedPerson}
            value={discountRate}
            onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {showDupBanner && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{t('orders.duplicateProduct')}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={mergeDuplicates}
          >
            {t('orders.mergeRows')}
          </Button>
        </div>
      )}

      {!stockOk && hasValidLines && (
        <p className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {t('orders.stockWarning')}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pt-1">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card',
            'min-w-[min(100%,52rem)]'
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div
            className={cn(
              'grid shrink-0 gap-1 border-b bg-muted/50 px-2 py-1.5 text-[10px] font-medium uppercase text-muted-foreground sm:text-xs',
              POS_TABLE_GRID
            )}
          >
            <span>#</span>
            <span>{t('orders.productId')}</span>
            <span>{t('products.title')}</span>
            <span className="text-center">{t('orders.availableStock')}</span>
            <span>{t('common.quantity')}</span>
            <span>{t('orders.unitPrice')}</span>
            <span>%</span>
            <span className="text-end">{t('orders.lineTotal')}</span>
            <span />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
          {lines.map((line, idx) => (
            <PosLineRow
              key={line.key}
              line={line}
              rowIndex={idx}
              t={t}
              fc={fc}
              duplicateProductIds={duplicateProductIds}
              isRowFocused={focusCellPos.row === idx}
              focusedCol={focusCellPos.row === idx ? focusCellPos.col : -1}
              setCellRef={setCellRef}
              onGridKeyDown={handleGridKeyDown}
              onChange={(patch) =>
                setLines((prev) =>
                  prev.map((r) => (r.key === line.key ? { ...r, ...patch } : r))
                )
              }
              onDebouncedLookup={handleDebouncedLookup}
              onRemove={() => removeLine(line.key, idx)}
              onOpenBrowser={() => {
                setBrowserTargetLineKey(line.key)
                setBrowserOpen(true)
              }}
              onBackspaceEmpty={() => removeLine(line.key, idx)}
              onFocusCell={(col) => setFocusCellPos({ row: idx, col })}
            />
          ))}
          </div>
        </div>
        <p className="shrink-0 py-0.5 text-[10px] text-muted-foreground sm:text-xs">
          {t('orders.pressF1')}
        </p>
      </div>

      <footer className="shrink-0 border-t bg-background/95 py-2 ps-2 pe-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs tabular-nums sm:text-sm">
            <span className="text-muted-foreground">{t('orders.subtotal')}</span>
            <span>{fc(preview.subtotal)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold">{t('orders.totalAmount')}</span>
            <span className="font-semibold">{fc(preview.total)}</span>
            <span
              className={cn(
                remainingPreview > 0.01 && 'font-medium text-destructive'
              )}
            >
              {t('orders.remaining')}: {fc(remainingPreview)}
            </span>
          </div>
          {canCheckout && (
            <Button
              type="button"
              className="h-9 shrink-0"
              disabled={
                !hasValidLines || !stockOk || confirmMut.isPending
              }
              onClick={() => setCheckoutOpen(true)}
            >
              {t('orders.checkout')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

const focusRing = (active: boolean) =>
  cn(
    'h-8 rounded-md border text-xs outline-none transition-shadow',
    active && 'ring-2 ring-blue-500 ring-offset-1 border-blue-500'
  )

function PosLineRow({
  line,
  rowIndex,
  t,
  fc,
  duplicateProductIds,
  isRowFocused,
  focusedCol,
  setCellRef,
  onGridKeyDown,
  onChange,
  onDebouncedLookup,
  onRemove,
  onOpenBrowser,
  onBackspaceEmpty,
  onFocusCell,
}: {
  line: LineRow
  rowIndex: number
  t: TFn
  fc: (n: number) => string
  duplicateProductIds: Set<string>
  isRowFocused: boolean
  focusedCol: number
  setCellRef: (lineKey: string, col: number, el: HTMLElement | null) => void
  onGridKeyDown: (
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number,
    lineKey: string
  ) => void
  onChange: (p: Partial<LineRow>) => void
  onDebouncedLookup: (lineKey: string, raw: string) => void
  onRemove: () => void
  onOpenBrowser: () => void
  onBackspaceEmpty: () => void
  onFocusCell: (col: number) => void
}) {
  const debouncedInput = useDebouncedValue(line.productIdInput, 300)

  useEffect(() => {
    onDebouncedLookup(line.key, debouncedInput)
  }, [debouncedInput, line.key, onDebouncedLookup])

  const lt = lineTotal(line)
  const dup =
    line.product_id && duplicateProductIds.has(line.product_id)
  const stockWarn = line.product_id && line.qty > line.stock
  const idInvalid = Boolean(line.lookupInvalid && line.productIdInput.trim())

  const rowBg = cn(
    'grid items-center gap-1 border-b border-border/50 px-2 py-0.5 sm:py-1',
    POS_TABLE_GRID,
    dup && 'bg-amber-50/80 dark:bg-amber-950/20',
    isRowFocused && 'bg-sky-50/60 dark:bg-sky-950/20'
  )

  const qtyTitle =
    line.product_id && stockWarn
      ? t('orders.onlyXUnitsAvailable', { count: line.stock })
      : undefined

  return (
    <div className={rowBg}>
      <span className="text-center text-xs text-muted-foreground">
        {rowIndex + 1}
      </span>
      <div className="relative">
        <Input
          ref={(el) => setCellRef(line.key, 0, el)}
          title={
            idInvalid ? t('orders.productNotFound') : undefined
          }
          className={cn(
            focusRing(focusedCol === 0),
            'px-1 font-mono',
            idInvalid && 'border-destructive ring-destructive/30'
          )}
          value={line.productIdInput}
          onChange={(e) =>
            onChange({
              productIdInput: e.target.value,
              product_id: '',
              name: '',
              unitPrice: 0,
              listUnitPrice: 0,
              priceOverridden: false,
              stock: 0,
              lookupInvalid: false,
            })
          }
          onFocus={() => onFocusCell(0)}
          onKeyDown={(e) => {
            if (e.key === 'F1') {
              e.preventDefault()
              onOpenBrowser()
              return
            }
            if (
              e.key === 'Backspace' &&
              !line.productIdInput &&
              !line.product_id
            ) {
              e.preventDefault()
              onBackspaceEmpty()
              return
            }
            onGridKeyDown(e, rowIndex, 0, line.key)
          }}
        />
        {dup && (
          <AlertTriangle
            className="absolute -end-1 top-1/2 h-3 w-3 -translate-y-1/2 text-amber-600"
            aria-label={t('orders.duplicateProduct')}
          />
        )}
      </div>
      <Input
        ref={(el) => setCellRef(line.key, 1, el)}
        readOnly
        tabIndex={0}
        title={line.name || undefined}
        className={cn(focusRing(focusedCol === 1), 'bg-muted/50 px-1')}
        value={line.name}
        placeholder="—"
        onFocus={() => onFocusCell(1)}
        onKeyDown={(e) => onGridKeyDown(e, rowIndex, 1, line.key)}
      />
      <div
        ref={(el) => setCellRef(line.key, 2, el)}
        tabIndex={0}
        title={
          line.product_id
            ? t('orders.onlyXUnitsAvailable', { count: line.stock })
            : undefined
        }
        className={cn(
          focusRing(focusedCol === 2),
          'flex h-8 items-center justify-center bg-muted/40 px-0.5 text-[11px] tabular-nums sm:text-xs',
          stockWarn && 'font-medium text-destructive'
        )}
        onFocus={() => onFocusCell(2)}
        onKeyDown={(e) => onGridKeyDown(e, rowIndex, 2, line.key)}
      >
        {line.product_id ? line.stock : '—'}
      </div>
      <Input
        ref={(el) => setCellRef(line.key, 3, el)}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        title={qtyTitle}
        className={cn(
          focusRing(focusedCol === 3),
          'px-1 tabular-nums',
          stockWarn && 'border-destructive'
        )}
        value={line.qty}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '')
          if (raw === '') {
            onChange({ qty: 1 })
            return
          }
          onChange({ qty: Math.max(1, parseInt(raw, 10) || 1) })
        }}
        onFocus={() => onFocusCell(3)}
        onKeyDown={(e) => onGridKeyDown(e, rowIndex, 3, line.key)}
      />
      <div className="flex min-w-0 items-center gap-0.5">
        <Input
          ref={(el) => setCellRef(line.key, 4, el)}
          type="number"
          min={0}
          step="0.01"
          title={
            unitPriceDiffersFromList(line)
              ? t('orders.priceModifiedWarning')
              : undefined
          }
          className={cn(
            focusRing(focusedCol === 4),
            'min-w-0 flex-1 px-1',
            unitPriceDiffersFromList(line) &&
              'border-amber-500/80 ring-1 ring-amber-500/40'
          )}
          value={line.unitPrice}
          onChange={(e) => {
            const v = parseFloat(e.target.value) || 0
            const list = line.listUnitPrice
            const overridden =
              Boolean(line.product_id) && Math.abs(v - list) > 0.005
            onChange({ unitPrice: v, priceOverridden: overridden })
          }}
          onFocus={() => onFocusCell(4)}
          onKeyDown={(e) => onGridKeyDown(e, rowIndex, 4, line.key)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          tabIndex={-1}
          className="h-7 shrink-0 px-1 py-0 text-[10px] font-normal leading-tight"
          disabled={!line.product_id || !unitPriceDiffersFromList(line)}
          title={t('orders.restoreCatalogPrice')}
          onClick={() =>
            onChange({
              unitPrice: line.listUnitPrice,
              priceOverridden: false,
            })
          }
        >
          {t('orders.originalPrice')}
        </Button>
      </div>
      <Input
        ref={(el) => setCellRef(line.key, 5, el)}
        type="number"
        min={0}
        max={100}
        step="0.01"
        className={cn(focusRing(focusedCol === 5), 'px-1')}
        value={line.discountPct}
        onChange={(e) =>
          onChange({
            discountPct: Math.min(
              100,
              Math.max(0, parseFloat(e.target.value) || 0)
            ),
          })
        }
        onFocus={() => onFocusCell(5)}
        onKeyDown={(e) => onGridKeyDown(e, rowIndex, 5, line.key)}
      />
      <div
        ref={(el) => setCellRef(line.key, 6, el)}
        tabIndex={0}
        className={cn(
          focusRing(focusedCol === 6),
          'flex h-8 items-center justify-end bg-muted/50 px-1 tabular-nums'
        )}
        onFocus={() => onFocusCell(6)}
        onKeyDown={(e) => onGridKeyDown(e, rowIndex, 6, line.key)}
      >
        {line.product_id ? fc(lt) : '—'}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onRemove}
        aria-label={t('orders.remove')}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
