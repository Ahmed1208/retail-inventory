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
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import { createInventoryTransfer } from '@/services/inventoryTransferService'
import {
  getAllProducts,
  getProductQuantitiesByWarehouse,
} from '@/services/productService'
import { deleteWarehouse, listWarehouses } from '@/services/warehouseService'
import { getAllCategories } from '@/services/categoryService'
import type { ProductWithRelations } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useQtyInputDraft } from '@/hooks/useQtyInputDraft'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'
import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox'
import { ProductBrowserModal } from '@/components/orders/ProductBrowserModal'
import {
  findProductByInput,
  type TFn,
} from '@/components/orders/ordersShared'
import { cn } from '@/lib/utils'
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

/** # · ID · name · stock · qty · (delete) — same rhythm as POS, without price/discount/total */
const TRANSFER_TABLE_GRID =
  'grid-cols-[2rem_7rem_minmax(0,1fr)_3rem_3.5rem_2.25rem]'
const TRANSFER_LINE_CELL_COLS = 4 as const

type TransferLineRow = {
  key: string
  product_id: string
  productIdInput: string
  name: string
  qty: number
  stock: number
  lookupInvalid?: boolean
}

function emptyTransferLine(): TransferLineRow {
  return {
    key: crypto.randomUUID(),
    product_id: '',
    productIdInput: '',
    name: '',
    qty: 1,
    stock: 0,
  }
}

const focusRing = (active: boolean) =>
  cn(
    'h-8 rounded-md border text-xs outline-none transition-shadow',
    active && 'ring-2 ring-blue-500 ring-offset-1 border-blue-500'
  )

export function InventoryTransferForm() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()

  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserTargetLineKey, setBrowserTargetLineKey] = useState<
    string | null
  >(null)
  const [fromWarehouseId, setFromWarehouseId] = useState(1)
  const [toWarehouseId, setToWarehouseId] = useState(2)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<TransferLineRow[]>(() => [
    emptyTransferLine(),
  ])
  const [focusCellPos, setFocusCellPos] = useState({ row: 0, col: 0 })
  const cellRefs = useRef<Map<string, (HTMLElement | null)[]>>(new Map())
  const initRef = useRef(false)
  const prefillAllDoneRef = useRef(false)
  const [postTransferPath, setPostTransferPath] = useState<string | null>(null)
  const [promptDeleteAfterTransfer, setPromptDeleteAfterTransfer] = useState<
    number | null
  >(null)
  const [deleteAfterTransferPending, setDeleteAfterTransferPending] =
    useState(false)

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
  })
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getAllCategories,
  })
  const { data: whStockMap = new Map<string, number>() } = useQuery({
    queryKey: ['warehouseStock', fromWarehouseId],
    queryFn: () => getProductQuantitiesByWarehouse(fromWarehouseId),
  })

  useEffect(() => {
    if (initRef.current || warehouses.length === 0) return
    const fromParam = searchParams.get('fromWarehouseId')
    if (fromParam) {
      const fid = Math.trunc(Number(fromParam))
      if (warehouses.some((w) => w.id === fid)) {
        setFromWarehouseId(fid)
        const def = warehouses.find((w) => w.is_default && w.id !== fid)
        const alt = warehouses.find((w) => w.id !== fid)
        const dest = def ?? alt ?? warehouses[0]
        if (dest) setToWarehouseId(dest.id)
        initRef.current = true
        return
      }
    }
    const def = warehouses.find((w) => w.is_default)
    const fromId = def?.id ?? warehouses[0].id
    const other = warehouses.find((w) => w.id !== fromId)
    setFromWarehouseId(fromId)
    setToWarehouseId(other?.id ?? fromId)
    initRef.current = true
  }, [warehouses, searchParams])

  useEffect(() => {
    if (prefillAllDoneRef.current) return
    if (searchParams.get('prefill') !== 'all') return
    const fid = searchParams.get('fromWarehouseId')
    if (!fid || products.length === 0) return
    const wid = Math.trunc(Number(fid))
    prefillAllDoneRef.current = true
    ;(async () => {
      try {
        const map = await getProductQuantitiesByWarehouse(wid)
        const rows: TransferLineRow[] = []
        for (const [pid, qty] of map.entries()) {
          if (qty <= 0) continue
          const p = products.find((pr) => pr.id === pid)
          rows.push({
            key: crypto.randomUUID(),
            product_id: pid,
            productIdInput: p?.product_code ?? '',
            name: p?.name ?? '',
            qty,
            stock: qty,
          })
        }
        if (rows.length > 0) setLines(rows)
      } catch {
        /* ignore prefill errors */
      }
    })()
  }, [searchParams, products])

  useEffect(() => {
    setLines((prev) =>
      prev.map((l) =>
        l.product_id
          ? { ...l, stock: whStockMap.get(l.product_id) ?? 0 }
          : l
      )
    )
  }, [whStockMap])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return
      if (browserOpen) return
      e.preventDefault()
      const lineKey =
        lines[focusCellPos.row]?.key ?? lines.at(-1)?.key
      if (lineKey) setBrowserTargetLineKey(lineKey)
      setBrowserOpen(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [browserOpen, lines, focusCellPos.row])

  const applyProductToLine = useCallback(
    (lineKey: string, p: ProductWithRelations) => {
      setLines((prev) =>
        prev.map((row) =>
          row.key === lineKey
            ? {
                ...row,
                product_id: p.id,
                productIdInput: p.product_code,
                name: p.name,
                stock: whStockMap.get(p.id) ?? 0,
                lookupInvalid: false,
              }
            : row
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
                  product_id: '',
                  name: '',
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
        arr = Array.from({ length: TRANSFER_LINE_CELL_COLS }, () => null)
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
          const nl = emptyTransferLine()
          newRowIndex = i + 1
          const next = [...prev]
          next.splice(newRowIndex!, 0, nl)
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
    setLines((prev) => {
      if (prev.length <= 1) return [emptyTransferLine()]
      const next = prev.filter((r) => r.key !== key)
      return next.length ? next : [emptyTransferLine()]
    })
    setFocusCellPos(() =>
      rowIndex > 0 ? { row: rowIndex - 1, col: 0 } : { row: 0, col: 0 }
    )
  }, [])

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
    const byPid = new Map<string, TransferLineRow[]>()
    for (const l of lines) {
      if (!l.product_id) continue
      const arr = byPid.get(l.product_id) ?? []
      arr.push(l)
      byPid.set(l.product_id, arr)
    }
    setLines((prev) => {
      const kept: TransferLineRow[] = []
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
      return kept.length ? kept : [emptyTransferLine()]
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
        const cc = Math.max(
          0,
          Math.min(TRANSFER_LINE_CELL_COLS - 1, c)
        )
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
        if (colIndex < TRANSFER_LINE_CELL_COLS - 1) {
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
          go(rowIndex - 1, TRANSFER_LINE_CELL_COLS - 1)
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
        if (colIndex < TRANSFER_LINE_CELL_COLS - 1) {
          go(rowIndex, colIndex + 1)
        } else {
          const k = lines[rowIndex]?.key
          if (k) addLineAfter(k)
        }
      }
    },
    [lines, addLineAfter]
  )

  const validLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          l.product_id &&
          l.qty >= 1 &&
          l.qty <= Math.max(0, l.stock) &&
          !l.lookupInvalid
      ),
    [lines]
  )

  const hasValidLines = useMemo(
    () => lines.some((l) => l.product_id && l.qty >= 1),
    [lines]
  )
  const stockOk = useMemo(
    () => lines.every((l) => !l.product_id || l.qty <= l.stock),
    [lines]
  )

  const canSubmit =
    validLines.length > 0 &&
    fromWarehouseId !== toWarehouseId &&
    stockOk

  const mut = useMutation({
    mutationFn: () =>
      createInventoryTransfer({
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        note: note.trim() || null,
        items: validLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.qty,
        })),
      }),
    onSuccess: async (transferId) => {
      await createAdminMentionNotificationIfNeeded({
        noteText: note,
        title: t('notifications.mentionTitleInventoryTransfer'),
        redirectBasePath: `/inventory-transfers/${transferId}`,
        sourceType: 'inventory_transfer_note',
        sourceEntityId: transferId,
      })
      qc.invalidateQueries({ queryKey: ['inventoryTransfers'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['warehouseStock'] })
      toast.success(t('inventoryTransfers.toastCreated'))
      const promptWh = searchParams.get('promptDeleteWarehouse')
      const src = fromWarehouseId
      if (promptWh != null && Math.trunc(Number(promptWh)) === src) {
        const map = await getProductQuantitiesByWarehouse(src)
        const total = [...map.values()].reduce(
          (s, q) => s + Math.max(0, q),
          0
        )
        if (total <= 0) {
          setPostTransferPath(`/inventory-transfers/${transferId}`)
          setPromptDeleteAfterTransfer(Math.trunc(Number(promptWh)))
          return
        }
      }
      setSearchParams({}, { replace: true })
      navigate(`/inventory-transfers/${transferId}`)
    },
    onError: (e: Error) =>
      toast.error(e.message || t('inventoryTransfers.toastError')),
  })

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
        orderType="retail"
        purpose="sale"
        displayStock={(p) => whStockMap.get(p.id) ?? 0}
        lang={lang}
        isRTL={isRTL}
        showCatalogPrice={false}
        onPick={onPickProduct}
      />

      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 border-b bg-background px-2 py-2">
        <WarehouseCombobox
          id="transfer-from-wh"
          warehouses={warehouses}
          value={fromWarehouseId}
          onChange={setFromWarehouseId}
          label={t('inventoryTransfers.fromWarehouse')}
          className="min-w-[180px] max-w-full flex-1"
        />
        <WarehouseCombobox
          id="transfer-to-wh"
          warehouses={warehouses}
          value={toWarehouseId}
          onChange={setToWarehouseId}
          label={t('inventoryTransfers.toWarehouse')}
          className="min-w-[180px] max-w-full flex-1"
        />
        <div className="min-w-[200px] max-w-full flex-[2]">
          <Label
            htmlFor="transfer-note"
            className="text-[10px] font-medium text-muted-foreground sm:text-xs"
          >
            {t('inventoryTransfers.note')}
          </Label>
          <NoteMentionEditor
            id="transfer-note"
            className="mt-0.5 [&_textarea]:min-h-[52px] [&_textarea]:text-xs"
            rows={2}
            value={note}
            onChange={setNote}
            placeholder={t('inventoryTransfers.notePlaceholder')}
            aria-label={t('inventoryTransfers.note')}
          />
        </div>
      </div>

      {fromWarehouseId === toWarehouseId && (
        <p className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {t('inventoryTransfers.sameWarehouseError')}
        </p>
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

      {!stockOk && hasValidLines && (
        <p className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {t('orders.stockWarning')}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pt-1">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card',
            'min-w-[min(100%,42rem)]'
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div
            className={cn(
              'grid shrink-0 gap-1 border-b bg-muted/50 px-2 py-1.5 text-[10px] font-medium uppercase text-muted-foreground sm:text-xs',
              TRANSFER_TABLE_GRID
            )}
          >
            <span>#</span>
            <span>{t('orders.productId')}</span>
            <span>{t('products.title')}</span>
            <span className="text-center">
              {t('orders.availableStock')}
            </span>
            <span>{t('common.quantity')}</span>
            <span />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {lines.map((line, idx) => (
              <TransferLineRowView
                key={line.key}
                line={line}
                rowIndex={idx}
                t={t}
                duplicateProductIds={duplicateProductIds}
                isRowFocused={focusCellPos.row === idx}
                focusedCol={focusCellPos.row === idx ? focusCellPos.col : -1}
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

      <footer className="shrink-0 border-t bg-background/95 py-2 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-3">
        <Button
          type="button"
          className="h-9"
          disabled={!canSubmit || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending && (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          )}
          {t('inventoryTransfers.submitTransfer')}
        </Button>
      </footer>

      <AlertDialog
        open={promptDeleteAfterTransfer != null}
        onOpenChange={(open) => {
          if (!open && postTransferPath) {
            setSearchParams({}, { replace: true })
            navigate(postTransferPath)
            setPostTransferPath(null)
            setPromptDeleteAfterTransfer(null)
          }
        }}
      >
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('inventoryTransfers.promptDeleteWarehouseTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('inventoryTransfers.promptDeleteWarehouseDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault()
                if (postTransferPath) {
                  setSearchParams({}, { replace: true })
                  navigate(postTransferPath)
                }
                setPostTransferPath(null)
                setPromptDeleteAfterTransfer(null)
              }}
            >
              {t('inventoryTransfers.keepWarehouse')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAfterTransferPending}
              onClick={async (e) => {
                e.preventDefault()
                if (promptDeleteAfterTransfer == null) return
                setDeleteAfterTransferPending(true)
                try {
                  await deleteWarehouse(promptDeleteAfterTransfer)
                  toast.success(t('warehouses.toastDeleted'))
                  if (postTransferPath) {
                    setSearchParams({}, { replace: true })
                    navigate(postTransferPath)
                  }
                  setPostTransferPath(null)
                  setPromptDeleteAfterTransfer(null)
                  qc.invalidateQueries({ queryKey: ['warehouses'] })
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : t('warehouses.toastError')
                  )
                } finally {
                  setDeleteAfterTransferPending(false)
                }
              }}
            >
              {deleteAfterTransferPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('warehouses.deleteWarehouse')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TransferLineRowView({
  line,
  rowIndex,
  t,
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
  line: TransferLineRow
  rowIndex: number
  t: TFn
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
  onChange: (p: Partial<TransferLineRow>) => void
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

  const dup =
    line.product_id && duplicateProductIds.has(line.product_id)
  const stockWarn = line.product_id && line.qty > line.stock
  const idInvalid = Boolean(line.lookupInvalid && line.productIdInput.trim())

  const qtyTitle =
    line.product_id && stockWarn
      ? t('orders.onlyXUnitsAvailable', { count: line.stock })
      : undefined

  const qtyInput = useQtyInputDraft(
    line.key,
    line.product_id,
    line.qty,
    (p) => onChange(p)
  )

  const rowBg = cn(
    'grid items-center gap-1 border-b border-border/50 px-2 py-0.5 sm:py-1',
    TRANSFER_TABLE_GRID,
    dup && 'bg-amber-50/80 dark:bg-amber-950/20',
    isRowFocused && 'bg-sky-50/60 dark:bg-sky-950/20'
  )

  return (
    <div className={rowBg}>
      <span className="text-center text-xs text-muted-foreground">
        {rowIndex + 1}
      </span>
      <div className="relative">
        <Input
          ref={(el) => setCellRef(line.key, 0, el)}
          title={idInvalid ? t('orders.productNotFound') : undefined}
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
        value={qtyInput.displayValue}
        onChange={qtyInput.onQtyChange}
        onFocus={() => {
          qtyInput.onQtyFocus()
          onFocusCell(3)
        }}
        onBlur={qtyInput.onQtyBlur}
        onKeyDown={(e) => onGridKeyDown(e, rowIndex, 3, line.key)}
      />
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
