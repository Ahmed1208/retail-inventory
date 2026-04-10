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
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react'

import { createPurchaseOrder } from '@/services/purchaseOrderService'
import {
  getAllProducts,
  getProductQuantitiesByWarehouse,
} from '@/services/productService'
import { listWarehouses } from '@/services/warehouseService'
import { getAllCategories } from '@/services/categoryService'
import {
  getAllPeople,
  roundMoney,
  supabaseErrorMessage,
} from '@/services/peopleService'
import type { PaymentMethod, Person, ProductWithRelations } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { ProductBrowserModal } from '@/components/orders/ProductBrowserModal'
import { SupplierBrowserModal } from '@/components/purchaseOrders/SupplierBrowserModal'
import { QuickCreatePersonDialog } from '@/components/people/QuickCreatePersonDialog'
import { PurchaseOrderCheckoutModal } from '@/components/purchaseOrders/PurchaseOrderCheckoutModal'
import { PoRegisterPaymentGateDialog } from '@/components/purchaseOrders/PoRegisterPaymentGateDialog'
import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox'
import {
  findProductByInput,
  PAYMENT_METHODS,
} from '@/components/orders/ordersShared'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { PoLineRow } from '@/components/purchaseOrders/PoLineRow'
import { PoCostOverrideDialog } from '@/components/purchaseOrders/PoCostOverrideDialog'
import {
  PoCatalogPricesDialog,
  type PoCatalogPricesValues,
} from '@/components/purchaseOrders/PoCatalogPricesDialog'
import {
  type POLineRow,
  PO_LINE_CELL_COLS,
  PO_TABLE_GRID,
  applyProductCostDefaults,
  clearedProductLinePatch,
  computePoPreview,
  costDiffersFromList,
  emptyPOLine,
} from '@/components/purchaseOrders/poLineShared'

function isPurchaseOrderDraftStatusConstraintError(err: unknown): boolean {
  return supabaseErrorMessage(err)
    .toLowerCase()
    .includes('purchase_orders_status_check')
}

export function PurchaseOrderForm() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fc = useCallback((n: number) => formatCurrency(n, lang), [lang])
  const canSaveDraft = useFeatureEnabled('orders.posSaveDraft')
  const canCheckout = useFeatureEnabled('orders.posCheckout')
  const canAddPerson = useFeatureEnabled('people.addPerson')
  const useCostOverrideDialog = useFeatureEnabled(
    'purchaseOrders.costOverridePriceDialog'
  )

  const [selectedSupplier, setSelectedSupplier] = useState<Person | null>(null)
  const [supplierBrowserOpen, setSupplierBrowserOpen] = useState(false)
  const [quickCreateSupplierOpen, setQuickCreateSupplierOpen] = useState(false)
  const [peopleListRefreshKey, setPeopleListRefreshKey] = useState(0)
  const [productBrowserOpen, setProductBrowserOpen] = useState(false)
  const [browserTargetLineKey, setBrowserTargetLineKey] = useState<
    string | null
  >(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [registerGateOpen, setRegisterGateOpen] = useState(false)
  const [costOverrideLineKey, setCostOverrideLineKey] = useState<string | null>(
    null
  )
  const [catalogPricesLineKey, setCatalogPricesLineKey] = useState<
    string | null
  >(null)
  const [note, setNote] = useState('')
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
  const [allowRemaining, setAllowRemaining] = useState(false)
  const [applySupplierDiscount, setApplySupplierDiscount] = useState(true)
  const [discountRate, setDiscountRate] = useState(0)
  const [lines, setLines] = useState<POLineRow[]>(() => [emptyPOLine()])
  const warehouseInitRef = useRef(false)
  const [warehouseId, setWarehouseId] = useState(1)
  const [paymentRegisterWarehouseId, setPaymentRegisterWarehouseId] =
    useState(1)
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [focusCellPos, setFocusCellPos] = useState({ row: 0, col: 0 })
  const cellRefs = useRef<Map<string, (HTMLElement | null)[]>>(new Map())

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
  })
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })
  const { data: whStockMap = new Map<string, number>() } = useQuery({
    queryKey: ['warehouseStock', warehouseId],
    queryFn: () => getProductQuantitiesByWarehouse(warehouseId),
  })

  useEffect(() => {
    if (warehouseInitRef.current || warehouses.length === 0) return
    const d = warehouses.find((w) => w.is_default)
    setWarehouseId(d?.id ?? 1)
    warehouseInitRef.current = true
  }, [warehouses])

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId) ?? null,
    [warehouses, warehouseId]
  )
  const needsPaymentRegister = Boolean(
    selectedWarehouse && !selectedWarehouse.has_register
  )
  const registerOnlyWarehouses = useMemo(
    () => warehouses.filter((w) => w.has_register),
    [warehouses]
  )

  useEffect(() => {
    if (registerOnlyWarehouses.length === 0) return
    if (
      !registerOnlyWarehouses.some((w) => w.id === paymentRegisterWarehouseId)
    ) {
      const d =
        registerOnlyWarehouses.find((w) => w.is_default) ??
        registerOnlyWarehouses[0]
      setPaymentRegisterWarehouseId(d.id)
    }
  }, [registerOnlyWarehouses, paymentRegisterWarehouseId])
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getAllCategories,
  })
  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const suppliers = useMemo(
    () => people.filter((p) => p.roles.includes('supplier')),
    [people]
  )

  const poPreview = useMemo(
    () => computePoPreview(lines, discountRate),
    [lines, discountRate]
  )

  useEffect(() => {
    if (applySupplierDiscount && selectedSupplier) {
      setDiscountRate(selectedSupplier.discount_rate)
    }
  }, [selectedSupplier, applySupplierDiscount])

  const paidPreview = useMemo(() => {
    let s = 0
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = parseFloat(payAmounts[m]) || 0
      if (v > 0) s += v
    }
    return roundMoney(s)
  }, [payUse, payAmounts])

  const remainingPreview = roundMoney(poPreview.total - paidPreview)

  const supplierPersonId = selectedSupplier?.id ?? null

  const hasValidLines = useMemo(
    () => lines.some((l) => l.product_id && l.qty >= 1),
    [lines]
  )

  const canConfirm = useMemo(() => {
    if (!hasValidLines) return false
    if (!supplierPersonId) return false
    if (remainingPreview > 0.01) {
      if (!allowRemaining) return false
    }
    if (
      needsPaymentRegister &&
      paidPreview > 0.01 &&
      registerOnlyWarehouses.length === 0
    ) {
      return false
    }
    return true
  }, [
    hasValidLines,
    remainingPreview,
    allowRemaining,
    supplierPersonId,
    needsPaymentRegister,
    paidPreview,
    registerOnlyWarehouses.length,
  ])

  useEffect(() => {
    if (!selectedSupplier) {
      setAllowRemaining(false)
    }
  }, [selectedSupplier])

  useEffect(() => {
    if (focusCellPos.row >= lines.length && lines.length > 0) {
      setFocusCellPos({
        row: Math.max(0, lines.length - 1),
        col: 0,
      })
    }
  }, [lines.length, focusCellPos.row])

  const applyProductToLine = useCallback(
    (lineKey: string, p: ProductWithRelations) => {
      const defaults = applyProductCostDefaults(
        p,
        whStockMap.get(p.id) ?? 0
      )
      setLines((prev) =>
        prev.map((row) =>
          row.key === lineKey ? { ...row, ...defaults } : row
        )
      )
    },
    [whStockMap]
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
                  ...clearedProductLinePatch(),
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
                ...clearedProductLinePatch(),
                lookupInvalid: true,
              }
            : r
        )
      )
    },
    [products, applyProductToLine, t]
  )

  useEffect(() => {
    setLines((prev) =>
      prev.map((l) => {
        if (!l.product_id) return l
        const p = products.find((x) => x.id === l.product_id)
        if (!p) return l
        const list = p.cost_price
        const whQty = whStockMap.get(l.product_id) ?? 0
        return {
          ...l,
          listCostPrice: list,
          listCustomerPrice: p.customer_price,
          listBusinessPrice: p.business_price,
          stock: whQty,
          costPrice: l.costOverridden ? l.costPrice : list,
        }
      })
    )
  }, [products, whStockMap])

  const setCellRef = useCallback(
    (lineKey: string, col: number, el: HTMLElement | null) => {
      let arr = cellRefs.current.get(lineKey)
      if (!arr) {
        arr = Array.from({ length: PO_LINE_CELL_COLS }, () => null)
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
          const nl = emptyPOLine()
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

  const removeLine = useCallback((key: string, rowIndex: number) => {
    setCostOverrideLineKey((k) => (k === key ? null : k))
    setCatalogPricesLineKey((k) => (k === key ? null : k))
    setLines((prev) => {
      if (prev.length <= 1) return [emptyPOLine()]
      const next = prev.filter((r) => r.key !== key)
      return next.length ? next : [emptyPOLine()]
    })
    setFocusCellPos(() =>
      rowIndex > 0 ? { row: rowIndex - 1, col: 0 } : { row: 0, col: 0 }
    )
  }, [])

  const linesToApiItems = useCallback(() => {
    return lines
      .filter((l) => l.product_id)
      .map((l) => {
        const updateCatalog = useCostOverrideDialog
          ? l.costOverrideChoice === 'catalog'
          : l.updateDefaultCostPrice
        const base = {
          product_id: l.product_id,
          quantity: l.qty,
          cost_price: l.costPrice,
          line_discount_rate: roundMoney(
            Math.min(100, Math.max(0, l.discountPct))
          ),
          update_default_cost_price: updateCatalog,
        }
        if (
          useCostOverrideDialog &&
          l.costOverrideChoice === 'catalog' &&
          l.catalogCustomerPrice != null &&
          l.catalogBusinessPrice != null
        ) {
          return {
            ...base,
            catalog_customer_price: l.catalogCustomerPrice,
            catalog_business_price: l.catalogBusinessPrice,
          }
        }
        return base
      })
  }, [lines, useCostOverrideDialog])

  const hasUnsetCostOverride = useMemo(
    () =>
      useCostOverrideDialog &&
      lines.some(
        (l) =>
          Boolean(l.product_id) &&
          costDiffersFromList(l) &&
          l.costOverrideChoice === 'unset'
      ),
    [lines, useCostOverrideDialog]
  )

  const costOverrideLine = useMemo(
    () => lines.find((l) => l.key === costOverrideLineKey) ?? null,
    [lines, costOverrideLineKey]
  )

  const catalogPricesLine = useMemo(
    () => lines.find((l) => l.key === catalogPricesLineKey) ?? null,
    [lines, catalogPricesLineKey]
  )

  const handleAllowCostOnce = useCallback(() => {
    if (!costOverrideLineKey) return
    const rowIndex = lines.findIndex((l) => l.key === costOverrideLineKey)
    flushSync(() => {
      setLines((prev) =>
        prev.map((r) =>
          r.key === costOverrideLineKey
            ? {
                ...r,
                costOverrideChoice: 'once',
                updateDefaultCostPrice: false,
                catalogCustomerPrice: null,
                catalogBusinessPrice: null,
              }
            : r
        )
      )
      setCostOverrideLineKey(null)
    })
    if (rowIndex >= 0) {
      setFocusCellPos({ row: rowIndex, col: 6 })
    }
  }, [costOverrideLineKey, lines])

  const handleOpenCatalogFromChoice = useCallback(() => {
    if (!costOverrideLineKey) return
    setCatalogPricesLineKey(costOverrideLineKey)
    setCostOverrideLineKey(null)
  }, [costOverrideLineKey])

  const handleCatalogPricesConfirm = useCallback(
    (v: PoCatalogPricesValues) => {
      if (!catalogPricesLineKey) return
      const rowIndex = lines.findIndex((l) => l.key === catalogPricesLineKey)
      flushSync(() => {
        setLines((prev) =>
          prev.map((r) =>
            r.key === catalogPricesLineKey
              ? {
                  ...r,
                  costPrice: v.costPrice,
                  costOverridden:
                    Math.abs(v.costPrice - r.listCostPrice) > 0.005,
                  costOverrideChoice: 'catalog',
                  updateDefaultCostPrice: true,
                  catalogCustomerPrice: v.customerPrice,
                  catalogBusinessPrice: v.businessPrice,
                }
              : r
          )
        )
        setCatalogPricesLineKey(null)
      })
      if (rowIndex >= 0) {
        setFocusCellPos({ row: rowIndex, col: 6 })
      }
    },
    [catalogPricesLineKey, lines]
  )

  const handleCatalogPricesBack = useCallback(() => {
    if (!catalogPricesLineKey) return
    setCostOverrideLineKey(catalogPricesLineKey)
    setCatalogPricesLineKey(null)
  }, [catalogPricesLineKey])

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

  const mergeDuplicates = useCallback(() => {
    const byPid = new Map<string, POLineRow[]>()
    for (const l of lines) {
      if (!l.product_id) continue
      const arr = byPid.get(l.product_id) ?? []
      arr.push(l)
      byPid.set(l.product_id, arr)
    }
    setLines((prev) => {
      const kept: POLineRow[] = []
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
            discountPct: first.discountPct,
            lookupInvalid: false,
          })
        }
      }
      return kept.length ? kept : [emptyPOLine()]
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
        const cc = Math.max(0, Math.min(PO_LINE_CELL_COLS - 1, c))
        setFocusCellPos({ row: rr, col: cc })
      }

      if (colIndex === 3 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const line = lines[rowIndex]
        if (!line) return
        const delta = e.key === 'ArrowUp' ? -1 : 1
        const next = Math.max(1, line.qty + delta)
        setLines((prev) =>
          prev.map((r) => (r.key === lineKey ? { ...r, qty: next } : r))
        )
        return
      }

      if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault()
        if (colIndex < PO_LINE_CELL_COLS - 1) {
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
          go(rowIndex - 1, PO_LINE_CELL_COLS - 1)
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
        if (colIndex < PO_LINE_CELL_COLS - 1) {
          go(rowIndex, colIndex + 1)
        } else {
          const k = lines[rowIndex]?.key
          if (k) addLineAfter(k)
        }
      }
    },
    [lines, addLineAfter]
  )

  const openProductBrowser = useCallback(() => {
    const empty = lines.find((l) => !l.product_id)
    if (empty) {
      setBrowserTargetLineKey(empty.key)
    } else {
      const nl = emptyPOLine()
      setBrowserTargetLineKey(nl.key)
      setLines((prev) => [...prev, nl])
    }
    setProductBrowserOpen(true)
  }, [lines])

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

  const validateLines = (): boolean => {
    const errors: Record<string, string> = {}
    for (const line of lines) {
      if (!line.product_id) continue
      if (line.qty < 1) {
        errors[line.key] = t('purchaseOrders.validationQuantityMin')
      } else if (line.costPrice < 0) {
        errors[line.key] = t('purchaseOrders.validationCostPriceMin')
      } else if (line.discountPct < 0 || line.discountPct > 100) {
        errors[line.key] = t('purchaseOrders.invalidLineDiscount')
      }
    }
    setLineErrors(errors)
    return Object.keys(errors).length === 0
  }

  const buildPaymentsPayload = useCallback(() => {
    const out: { payment_method: PaymentMethod; amount: number }[] = []
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = roundMoney(parseFloat(payAmounts[m]) || 0)
      if (v > 0.001) out.push({ payment_method: m, amount: v })
    }
    return out
  }, [payUse, payAmounts])

  const invalidatePO = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['warehouseStock'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['recentMovements'] })
    queryClient.invalidateQueries({ queryKey: ['people'] })
  }

  const saveDraftMut = useMutation({
    mutationFn: async () => {
      return createPurchaseOrder({
        supplier_name: selectedSupplier?.name,
        person_id: selectedSupplier?.id,
        note: note.trim() || undefined,
        asDraft: true,
        items: linesToApiItems(),
        warehouse_id: warehouseId,
        apply_supplier_discount: applySupplierDiscount,
        order_discount_rate: discountRate,
      })
    },
    onSuccess: (created) => {
      invalidatePO()
      toast.success(t('purchaseOrders.toastDraftSaved'))
      navigate(`/purchase-orders/${created.id}`)
    },
    onError: (e: unknown) => {
      if (isPurchaseOrderDraftStatusConstraintError(e)) {
        toast.error(t('purchaseOrders.errorDraftStatusNotAllowed'))
        return
      }
      const message =
        e instanceof Error
          ? e.message
          : typeof (e as { message?: string })?.message === 'string'
            ? (e as { message: string }).message
            : undefined
      toast.error(message || t('purchaseOrders.toastError'))
    },
  })

  const onSaveDraftClick = () => {
    if (!hasValidLines) {
      toast.error(t('purchaseOrders.validationAtLeastOne'))
      return
    }
    if (!selectedSupplier) {
      toast.error(t('purchaseOrders.validationSupplierRequired'))
      return
    }
    if (hasUnsetCostOverride) {
      toast.error(t('purchaseOrders.costOverrideUnsetError'))
      return
    }
    if (!validateLines()) return
    saveDraftMut.mutate()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return
      if (
        supplierBrowserOpen ||
        productBrowserOpen ||
        checkoutOpen ||
        registerGateOpen ||
        saveDraftMut.isPending ||
        costOverrideLineKey ||
        catalogPricesLineKey
      )
        return
      e.preventDefault()
      const target = e.target
      const inSupplierZone =
        target instanceof Element &&
        Boolean(target.closest('[data-po-supplier-zone]'))
      if (inSupplierZone) {
        setSupplierBrowserOpen(true)
        return
      }
      const lineKey = lines[focusCellPos.row]?.key ?? lines.at(-1)?.key
      if (lineKey) setBrowserTargetLineKey(lineKey)
      setProductBrowserOpen(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    supplierBrowserOpen,
    productBrowserOpen,
    checkoutOpen,
    registerGateOpen,
    lines,
    focusCellPos.row,
    saveDraftMut.isPending,
    costOverrideLineKey,
    catalogPricesLineKey,
  ])

  const openCheckout = () => {
    if (!hasValidLines) {
      toast.error(t('purchaseOrders.validationAtLeastOne'))
      return
    }
    if (!selectedSupplier) {
      toast.error(t('purchaseOrders.validationSupplierRequired'))
      return
    }
    if (hasUnsetCostOverride) {
      toast.error(t('purchaseOrders.costOverrideUnsetError'))
      return
    }
    if (!validateLines()) return
    if (needsPaymentRegister && registerOnlyWarehouses.length > 0) {
      setRegisterGateOpen(true)
    } else {
      setCheckoutOpen(true)
    }
  }

  const continueRegisterGateToCheckout = () => {
    setRegisterGateOpen(false)
    setCheckoutOpen(true)
  }

  const handleConfirmCreate = async () => {
    if (!canConfirm) return
    setSubmitting(true)
    try {
      const payments = buildPaymentsPayload()
      const created = await createPurchaseOrder({
        supplier_name: selectedSupplier?.name,
        person_id: selectedSupplier?.id,
        note: note.trim() || undefined,
        allow_remaining_on_account: allowRemaining,
        payments,
        items: linesToApiItems(),
        warehouse_id: warehouseId,
        register_warehouse_id: needsPaymentRegister
          ? paymentRegisterWarehouseId
          : undefined,
        apply_supplier_discount: applySupplierDiscount,
        order_discount_rate: applySupplierDiscount
          ? undefined
          : discountRate,
      })
      invalidatePO()
      toast.success(t('purchaseOrders.toastCreated'))
      setCheckoutOpen(false)
      navigate(`/purchase-orders/${created.id}`)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof (err as { message?: string })?.message === 'string'
            ? (err as { message: string }).message
            : undefined
      toast.error(message || t('purchaseOrders.toastError'))
    } finally {
      setSubmitting(false)
    }
  }

  const showDupBanner = duplicateProductIds.size > 0

  return (
    <div
      className={cn(
        'flex max-h-[calc(100dvh-8.5rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <PoCostOverrideDialog
        open={Boolean(costOverrideLineKey && costOverrideLine)}
        onOpenChange={(open) => {
          if (!open) setCostOverrideLineKey(null)
        }}
        productName={costOverrideLine?.name ?? ''}
        listCostLabel={costOverrideLine ? fc(costOverrideLine.listCostPrice) : ''}
        onAllowOnce={handleAllowCostOnce}
        onUpdateCatalog={handleOpenCatalogFromChoice}
      />
      <PoCatalogPricesDialog
        open={Boolean(catalogPricesLineKey && catalogPricesLine)}
        onOpenChange={(open) => {
          if (!open) setCatalogPricesLineKey(null)
        }}
        initial={
          catalogPricesLine
            ? {
                costPrice: catalogPricesLine.costPrice,
                customerPrice: catalogPricesLine.listCustomerPrice,
                businessPrice: catalogPricesLine.listBusinessPrice,
              }
            : { costPrice: 0, customerPrice: 0, businessPrice: 0 }
        }
        onConfirm={handleCatalogPricesConfirm}
        onBack={handleCatalogPricesBack}
      />

      <SupplierBrowserModal
        open={supplierBrowserOpen}
        onOpenChange={setSupplierBrowserOpen}
        suppliers={suppliers}
        isRTL={isRTL}
        formatCurrency={fc}
        onPick={setSelectedSupplier}
        escapeClosesBrowser={!quickCreateSupplierOpen}
        showQuickCreate={canAddPerson}
        onRequestQuickCreate={() => setQuickCreateSupplierOpen(true)}
        listRefreshKey={peopleListRefreshKey}
      />
      <QuickCreatePersonDialog
        open={quickCreateSupplierOpen}
        onOpenChange={setQuickCreateSupplierOpen}
        role="supplier"
        isRTL={isRTL}
        onSuccess={() => setPeopleListRefreshKey((k) => k + 1)}
      />
      <ProductBrowserModal
        open={productBrowserOpen}
        onOpenChange={(o) => {
          setProductBrowserOpen(o)
          if (!o) setBrowserTargetLineKey(null)
        }}
        products={products}
        categories={categories}
        purpose="purchase"
        displayStock={(p) => whStockMap.get(p.id) ?? 0}
        lang={lang}
        isRTL={isRTL}
        onPick={onPickProduct}
      />
      <PoRegisterPaymentGateDialog
        open={registerGateOpen}
        onOpenChange={setRegisterGateOpen}
        isRTL={isRTL}
        registerWarehouses={registerOnlyWarehouses}
        value={paymentRegisterWarehouseId}
        onChange={setPaymentRegisterWarehouseId}
        onContinue={continueRegisterGateToCheckout}
      />
      <PurchaseOrderCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        isRTL={isRTL}
        formatCurrency={fc}
        preview={poPreview}
        discountRate={discountRate}
        paidPreview={paidPreview}
        supplierName={selectedSupplier?.name ?? null}
        payUse={payUse}
        setPayUse={setPayUse}
        payAmounts={payAmounts}
        setPayAmounts={setPayAmounts}
        allowRemaining={allowRemaining}
        setAllowRemaining={setAllowRemaining}
        supplierPersonId={supplierPersonId}
        note={note}
        setNote={setNote}
        canConfirm={canConfirm}
        confirming={submitting}
        onConfirm={handleConfirmCreate}
        registerPaymentPicker={null}
      />

      <header className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-2 py-1.5">
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
              disabled={!hasValidLines || saveDraftMut.isPending}
              onClick={onSaveDraftClick}
            >
              {saveDraftMut.isPending && (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {t('orders.saveDraft')}
            </Button>
          </div>
        )}
      </header>

      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-1.5 border-b bg-background px-2 py-1.5">
        <WarehouseCombobox
          id="po-receive-warehouse"
          label={t('warehouses.poLabel')}
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
          className="min-w-[200px] max-w-full flex-1"
        />
        <div
          data-po-supplier-zone
          className="flex min-w-[140px] max-w-full flex-1 flex-col gap-0.5 sm:min-w-[200px]"
        >
          <Label
            htmlFor="po-supplier-picker"
            className="text-[10px] font-medium text-muted-foreground sm:text-xs"
          >
            {t('purchaseOrders.selectSupplier')}
          </Label>
          <button
            id="po-supplier-picker"
            type="button"
            className={cn(
              'flex h-8 w-full max-w-md items-center justify-between rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
            )}
            onClick={() => setSupplierBrowserOpen(true)}
            onKeyDown={(ke) => {
              if (ke.key !== 'F1') return
              ke.preventDefault()
              if (
                supplierBrowserOpen ||
                productBrowserOpen ||
                checkoutOpen ||
                registerGateOpen ||
                saveDraftMut.isPending ||
                costOverrideLineKey ||
                catalogPricesLineKey
              )
                return
              setSupplierBrowserOpen(true)
            }}
          >
            <span className="truncate text-start">
              {selectedSupplier
                ? selectedSupplier.name
                : t('purchaseOrders.noLinkedSupplier')}
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 opacity-50"
              aria-hidden
            />
          </button>
        </div>
        {selectedSupplier && (
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            {t('purchaseOrders.supplierBalance')}:{' '}
            <span className="font-medium tabular-nums text-foreground">
              {fc(selectedSupplier.balance)}
            </span>
          </p>
        )}
      </div>

      {selectedSupplier && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-background px-2 py-1.5 text-[10px] text-muted-foreground sm:text-xs">
          <span>
            {t('orders.discount')}: {selectedSupplier.discount_rate}%
          </span>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={applySupplierDiscount}
              onChange={(e) => setApplySupplierDiscount(e.target.checked)}
            />
            <span className="whitespace-nowrap">
              {t('purchaseOrders.applySupplierDiscount')}
            </span>
          </label>
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
              disabled={applySupplierDiscount && !!selectedSupplier}
              value={discountRate}
              onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      )}

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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pt-1">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <Label className="text-sm font-medium">
            {t('purchaseOrders.orderLines')}
          </Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={openProductBrowser}
          >
            {t('purchaseOrders.addProducts')}
          </Button>
        </div>
        <p className="mb-2 px-1 text-[10px] text-muted-foreground sm:text-xs">
          {t('purchaseOrders.pressF1Products')}
        </p>

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
                PO_TABLE_GRID
              )}
            >
              <span>#</span>
              <span>{t('orders.productId')}</span>
              <span>{t('products.title')}</span>
              <span className="text-center">{t('orders.availableStock')}</span>
              <span>{t('common.quantity')}</span>
              <span>{t('purchaseOrders.costPrice')}</span>
              <span>%</span>
              <span className="text-end">{t('purchaseOrders.lineTotal')}</span>
              <span />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {lines.map((line, idx) => (
                <PoLineRow
                  key={line.key}
                  line={line}
                  rowIndex={idx}
                  t={t}
                  fc={fc}
                  duplicateProductIds={duplicateProductIds}
                  isRowFocused={focusCellPos.row === idx}
                  focusedCol={
                    focusCellPos.row === idx ? focusCellPos.col : -1
                  }
                  setCellRef={setCellRef}
                  onGridKeyDown={handleGridKeyDown}
                  onChange={(patch) =>
                    setLines((prev) =>
                      prev.map((r) =>
                        r.key === line.key ? { ...r, ...patch } : r
                      )
                    )
                  }
                  onDebouncedLookup={handleDebouncedLookup}
                  onRemove={() => removeLine(line.key, idx)}
                  onOpenBrowser={() => {
                    setBrowserTargetLineKey(line.key)
                    setProductBrowserOpen(true)
                  }}
                  onBackspaceEmpty={() => removeLine(line.key, idx)}
                  onFocusCell={(col) => setFocusCellPos({ row: idx, col })}
                  useCostOverrideDialog={useCostOverrideDialog}
                  onRequestCostOverride={(lineKey) =>
                    setCostOverrideLineKey(lineKey)
                  }
                />
              ))}
            </div>
          </div>
        <p className="shrink-0 py-0.5 text-[10px] text-muted-foreground sm:text-xs">
          {t('orders.pressF1')}
        </p>
        {Object.keys(lineErrors).length > 0 && (
          <p className="mt-1 px-1 text-sm text-destructive">
            {Object.values(lineErrors)[0]}
          </p>
        )}
      </div>

      <footer className="shrink-0 border-t bg-background/95 py-2 ps-2 pe-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5 text-xs tabular-nums sm:text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="text-muted-foreground">{t('orders.subtotal')}</span>
              <span>{fc(poPreview.subtotal)}</span>
            </div>
            {poPreview.discountAmount > 0.005 && (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-emerald-600">
                <span>
                  {t('orders.discount')} ({discountRate}%)
                </span>
                <span>−{fc(poPreview.discountAmount)}</span>
              </div>
            )}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-border pt-0.5 font-semibold">
              <span>{t('orders.totalAmount')}</span>
              <span>{fc(poPreview.total)}</span>
            </div>
          </div>
          {canCheckout && (
            <Button
              type="button"
              className="h-9 shrink-0"
              disabled={!hasValidLines || submitting}
              onClick={openCheckout}
            >
              {t('orders.checkout')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
