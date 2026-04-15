import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { FileUp, Loader2, Trash2 } from 'lucide-react'

import type { Brand, Category, Person, ProductWithRelations, Warehouse } from '@/types'
import {
  createPurchaseOrder,
  importHistoricalPurchaseOrderSnapshot,
} from '@/services/purchaseOrderService'
import {
  createPerson,
  normalizePhoneKey,
  supabaseErrorMessage,
} from '@/services/peopleService'
import { createBrand } from '@/services/brandService'
import { createCategory } from '@/services/categoryService'
import { createProduct } from '@/services/productService'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getFirstSampleForColumn } from '@/utils/personCsvImport'
import { resolveCsvImportedDocumentDate } from '@/utils/csvImportDates'
import {
  PO_IMPORT_FIELDS_ORDERED,
  PO_IMPORT_FIELDS_REQUIRED,
  type PurchaseOrderCsvLineDraft,
  type PurchaseOrderFieldToColumnMapping,
  type PurchaseOrderImportField,
  buildPurchaseOrderLineDraft,
  computePurchaseOrderGroupIssues,
  computePurchaseOrderLineIssues,
  emptyPurchaseOrderFieldMapping,
  groupPurchaseOrderLinesByImportId,
  guessPurchaseOrderFieldToColumnMapping,
  unusedPurchaseOrderCsvHeaders,
} from '@/utils/purchaseOrderCsvImport'

const NONE_VALUE = '__none__'

type Step = 'mode' | 'upload' | 'match' | 'preview'
export type PurchaseOrderCsvImportMode = 'live' | 'historical'

export type PurchaseOrderCsvImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouses: Warehouse[]
  people: Person[]
  products: ProductWithRelations[]
  initialBrands: Brand[]
  initialCategories: Category[]
  onComplete: () => void
  isRTL: boolean
}

function assignPoColumn(
  prev: PurchaseOrderFieldToColumnMapping,
  field: PurchaseOrderImportField,
  column: string | null
): PurchaseOrderFieldToColumnMapping {
  const next: PurchaseOrderFieldToColumnMapping = { ...prev }
  if (column) {
    for (const f of PO_IMPORT_FIELDS_ORDERED) {
      if (f !== field && next[f] === column) {
        next[f] = null
      }
    }
  }
  next[field] = column
  return next
}

function fieldLabelKey(f: PurchaseOrderImportField): string {
  const map: Record<PurchaseOrderImportField, string> = {
    import_group_id: 'purchaseOrders.importCsv.fieldGroupId',
    warehouse_code: 'purchaseOrders.importCsv.fieldWarehouseCode',
    supplier_phone: 'purchaseOrders.importCsv.fieldSupplierPhone',
    supplier_name: 'purchaseOrders.importCsv.fieldSupplierName',
    po_note: 'purchaseOrders.importCsv.fieldPoNote',
    order_discount_rate: 'purchaseOrders.importCsv.fieldOrderDiscountRate',
    po_date: 'purchaseOrders.importCsv.fieldPoDate',
    product_code: 'purchaseOrders.importCsv.fieldProductCode',
    product_name: 'purchaseOrders.importCsv.fieldProductName',
    brand_name: 'purchaseOrders.importCsv.fieldBrandName',
    category_name: 'purchaseOrders.importCsv.fieldCategoryName',
    quantity: 'purchaseOrders.importCsv.fieldQuantity',
    cost_price: 'purchaseOrders.importCsv.fieldCostPrice',
    line_discount_rate: 'purchaseOrders.importCsv.fieldLineDiscountRate',
    update_default_cost_price:
      'purchaseOrders.importCsv.fieldUpdateDefaultCostPrice',
    catalog_customer_price:
      'purchaseOrders.importCsv.fieldCatalogCustomerPrice',
    catalog_business_price:
      'purchaseOrders.importCsv.fieldCatalogBusinessPrice',
  }
  return map[f]
}

function issueLabelKey(code: string): string {
  return `purchaseOrders.importCsv.issue.${code}`
}

function resolveWarehouse(
  codeRaw: string,
  warehouses: Warehouse[]
): Warehouse | null {
  const q = codeRaw.trim().toLowerCase()
  if (!q) return null
  const byCode = warehouses.filter((w) => w.code.trim().toLowerCase() === q)
  if (byCode.length === 1) return byCode[0]
  if (byCode.length > 1) return null
  const byName = warehouses.filter((w) => w.name.trim().toLowerCase() === q)
  if (byName.length === 1) return byName[0]
  return null
}

export function PurchaseOrderCsvImportDialog({
  open,
  onOpenChange,
  warehouses,
  people,
  products,
  initialBrands,
  initialCategories,
  onComplete,
  isRTL,
}: PurchaseOrderCsvImportDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importMode, setImportMode] =
    useState<PurchaseOrderCsvImportMode>('live')
  const [step, setStep] = useState<Step>('mode')
  const [parseError, setParseError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [fieldToColumn, setFieldToColumn] =
    useState<PurchaseOrderFieldToColumnMapping>(emptyPurchaseOrderFieldMapping)
  const [drafts, setDrafts] = useState<PurchaseOrderCsvLineDraft[]>([])
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 })

  const reset = useCallback(() => {
    setImportMode('live')
    setStep('mode')
    setParseError(null)
    setHeaders([])
    setRawRows([])
    setFieldToColumn(emptyPurchaseOrderFieldMapping())
    setDrafts([])
    setIngesting(false)
    setIngestProgress({ done: 0, total: 0 })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset()
      onOpenChange(next)
    },
    [onOpenChange, reset]
  )

  const groupIssueMap = useMemo(() => {
    const active = drafts.filter((d) => !d.discarded)
    const groups = groupPurchaseOrderLinesByImportId(active)
    const m = new Map<string, string[]>()
    for (const [k, lines] of groups) {
      const gi = computePurchaseOrderGroupIssues(lines)
      if (gi.length) m.set(k, gi)
    }
    return m
  }, [drafts])

  const issuesById = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const d of drafts) {
      const lineIssues = computePurchaseOrderLineIssues(d).map(String)
      const gk = d.import_group_id.trim().toLowerCase()
      const extra = gk ? (groupIssueMap.get(gk) ?? []).map(String) : []
      const wh = resolveWarehouse(d.warehouse_code, warehouses)
      const merged = [...lineIssues, ...extra]
      if (d.warehouse_code.trim() && !wh) {
        merged.push('unknown_warehouse')
      }
      m.set(d.id, merged)
    }
    return m
  }, [drafts, groupIssueMap, warehouses])

  const matchComplete =
    PO_IMPORT_FIELDS_REQUIRED.every(
      (f) => fieldToColumn[f] != null && fieldToColumn[f] !== ''
    ) &&
    (fieldToColumn.product_code != null || fieldToColumn.product_name != null)

  const activeDrafts = drafts.filter((d) => !d.discarded)
  const canIngest =
    warehouses.length > 0 &&
    activeDrafts.length > 0 &&
    activeDrafts.every((d) => (issuesById.get(d.id) ?? []).length === 0)

  const unusedHeaders = useMemo(
    () => unusedPurchaseOrderCsvHeaders(headers, fieldToColumn),
    [headers, fieldToColumn]
  )

  const onFile = (file: File) => {
    setParseError(null)
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors.length) {
          const msg = results.errors.map((e) => e.message).join('; ')
          setParseError(msg || t('purchaseOrders.importCsv.parseError'))
          return
        }
        const data = (results.data ?? []).filter((row) => {
          const vals = Object.values(row).some(
            (v) => v != null && String(v).trim() !== ''
          )
          return vals
        }) as Record<string, unknown>[]
        if (data.length === 0) {
          setParseError(t('purchaseOrders.importCsv.emptyFile'))
          return
        }
        const metaFields = results.meta.fields?.filter(Boolean) as
          | string[]
          | undefined
        const hdrs =
          metaFields && metaFields.length > 0
            ? metaFields
            : Object.keys(data[0] ?? {})
        setHeaders(hdrs)
        setRawRows(data)
        const asStrings = data.map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, v == null ? '' : String(v)])
          )
        ) as Record<string, string>[]
        setFieldToColumn(guessPurchaseOrderFieldToColumnMapping(hdrs, asStrings))
        setStep('match')
      },
      error: (err) => {
        setParseError(err.message || t('purchaseOrders.importCsv.parseError'))
      },
    })
  }

  const goPreview = () => {
    const next = rawRows.map((row, i) =>
      buildPurchaseOrderLineDraft(row, fieldToColumn, i)
    )
    setDrafts(next)
    setStep('preview')
  }

  const updateDraft = (id: string, patch: Partial<PurchaseOrderCsvLineDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
    )
  }

  const toggleDiscard = (id: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, discarded: !d.discarded } : d
      )
    )
  }

  const runIngest = async () => {
    const active = drafts.filter((d) => !d.discarded)
    const groups = groupPurchaseOrderLinesByImportId(active)
    if (groups.size === 0) return

    setIngesting(true)
    setIngestProgress({ done: 0, total: groups.size })

    const suppliers = people.filter((p) => p.roles.includes('supplier'))
    const phoneToSupplierId = new Map<string, string>()
    for (const p of suppliers) {
      const ph = p.phone?.trim()
      if (ph) phoneToSupplierId.set(normalizePhoneKey(ph), p.id)
    }

    const productByCode = new Map<string, string>()
    const productByName = new Map<string, string>()
    for (const pr of products) {
      productByCode.set(pr.product_code.trim().toLowerCase(), pr.id)
      productByName.set(pr.name.trim().toLowerCase(), pr.id)
    }

    const brandByLower = new Map<string, string>()
    const categoryByLower = new Map<string, string>()
    for (const b of initialBrands) {
      brandByLower.set(b.name.trim().toLowerCase(), b.id)
    }
    for (const c of initialCategories) {
      categoryByLower.set(c.name.trim().toLowerCase(), c.id)
    }

    const ensureBrand = async (raw: string): Promise<string | null> => {
      const name = raw.trim()
      if (!name) return null
      const k = name.toLowerCase()
      const hit = brandByLower.get(k)
      if (hit) return hit
      const created = await createBrand(name)
      brandByLower.set(k, created.id)
      return created.id
    }

    const ensureCategory = async (raw: string): Promise<string | null> => {
      const name = raw.trim()
      if (!name) return null
      const k = name.toLowerCase()
      const hit = categoryByLower.get(k)
      if (hit) return hit
      const created = await createCategory(name)
      categoryByLower.set(k, created.id)
      return created.id
    }

    const resolveOrCreateProduct = async (
      line: PurchaseOrderCsvLineDraft
    ): Promise<string> => {
      const codeK = line.product_code.trim().toLowerCase()
      const nameK = line.product_name.trim().toLowerCase()
      if (codeK) {
        const id = productByCode.get(codeK)
        if (id) return id
      }
      if (nameK) {
        const id = productByName.get(nameK)
        if (id) return id
      }
      const displayName =
        line.product_name.trim() || line.product_code.trim() || 'Product'
      const brand_id = await ensureBrand(line.brand_name)
      const category_id = await ensureCategory(line.category_name)
      const created = await createProduct({
        name: displayName,
        product_code: line.product_code.trim() || undefined,
        brand_id,
        category_id,
        customer_price: 0,
        business_price: 0,
        cost_price: line.cost_price,
        quantity: 0,
        low_stock_threshold: 0,
        unit: 'pc',
        description: null,
      })
      productByCode.set(created.product_code.trim().toLowerCase(), created.id)
      productByName.set(created.name.trim().toLowerCase(), created.id)
      return created.id
    }

    const resolveOrCreateSupplier = async (
      phoneRaw: string,
      nameRaw: string
    ): Promise<string> => {
      const phone = phoneRaw.trim()
      if (!phone) {
        throw new Error(t('purchaseOrders.importCsv.errorSupplierPhone'))
      }
      const key = normalizePhoneKey(phone)
      const existing = phoneToSupplierId.get(key)
      if (existing) return existing
      const name = nameRaw.trim() || phone
      const created = await createPerson({
        name,
        phone,
        roles: ['supplier'],
        discount_rate: 0,
        credit_limit: null,
        address: null,
        notes: null,
      })
      phoneToSupplierId.set(
        normalizePhoneKey(created.phone?.trim() || phone),
        created.id
      )
      return created.id
    }

    let ok = 0
    let fail = 0
    let gi = 0
    for (const [, lines] of groups) {
      const first = lines[0]
      try {
        const wh = resolveWarehouse(first.warehouse_code, warehouses)
        if (!wh) throw new Error(t('purchaseOrders.importCsv.errorUnknownWarehouse'))

        const person_id = await resolveOrCreateSupplier(
          first.supplier_phone,
          first.supplier_name
        )

        const items = []
        for (const ln of lines) {
          const product_id = await resolveOrCreateProduct(ln)
          const fullCatalog =
            ln.update_default_cost_price &&
            ln.catalog_customer_price != null &&
            ln.catalog_business_price != null
          items.push({
            product_id,
            quantity: ln.quantity,
            cost_price: ln.cost_price,
            line_discount_rate: ln.line_discount_rate,
            update_default_cost_price: ln.update_default_cost_price,
            catalog_customer_price: fullCatalog
              ? ln.catalog_customer_price
              : null,
            catalog_business_price: fullCatalog
              ? ln.catalog_business_price
              : null,
          })
        }

        const documentDateIso = resolveCsvImportedDocumentDate(first.po_date_iso)

        if (importMode === 'historical') {
          await importHistoricalPurchaseOrderSnapshot({
            person_id,
            supplier_name: first.supplier_name.trim() || null,
            note: first.po_note.trim() || null,
            order_discount_rate:
              first.order_discount_rate > 0.005
                ? first.order_discount_rate
                : undefined,
            created_at: documentDateIso,
            warehouse_id: wh.id,
            items,
          })
        } else {
          const manualPoDiscount = first.order_discount_rate > 0.005
          await createPurchaseOrder({
            person_id,
            supplier_name: first.supplier_name.trim() || undefined,
            note: first.po_note.trim() || undefined,
            items,
            payments: [],
            allow_remaining_on_account: true,
            ...(manualPoDiscount
              ? {
                  order_discount_rate: first.order_discount_rate,
                  apply_supplier_discount: false as const,
                }
              : {}),
            asDraft: true,
            warehouse_id: wh.id,
            created_at: documentDateIso,
          })
        }
        ok++
      } catch (e) {
        fail++
        console.error(e)
        const msg =
          supabaseErrorMessage(e) ||
          t('purchaseOrders.importCsv.errorGeneric')
        toast.error(
          `${t('purchaseOrders.importCsv.groupFailed')}: ${first.import_group_id} — ${msg}`
        )
      }
      gi++
      setIngestProgress({ done: gi, total: groups.size })
    }

    setIngesting(false)
    if (ok > 0 && fail === 0) {
      toast.success(t('purchaseOrders.importCsv.toastAllOk', { count: ok }))
    } else if (ok > 0 && fail > 0) {
      toast.warning(t('purchaseOrders.importCsv.toastPartial', { ok, fail }))
    } else if (fail > 0) {
      toast.error(
        t('purchaseOrders.importCsv.toastAllFailed', { count: fail })
      )
    }
    onComplete()
    handleOpenChange(false)
  }

  const issueChips = (id: string) => {
    const list = issuesById.get(id) ?? []
    if (!list.length) return null
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {list.map((code) => (
          <span
            key={code}
            className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          >
            {t(issueLabelKey(code))}
          </span>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-[max(0.75rem,5dvh)] max-h-[min(92dvh,calc(100dvh-1.5rem))] w-[calc(100vw-1rem)] max-w-5xl translate-y-0 flex flex-col overflow-hidden gap-0 p-0 sm:w-full"
        dir={isRTL ? 'rtl' : 'ltr'}
        showClose={!ingesting}
        onPointerDownOutside={(e) => {
          if (ingesting) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (ingesting) e.preventDefault()
        }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col space-y-4 p-6 pb-4">
          <DialogHeader>
            <DialogTitle>{t('purchaseOrders.importCsv.title')}</DialogTitle>
          </DialogHeader>

          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('purchaseOrders.importCsv.modeIntro')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setImportMode('live')}
                  className={cn(
                    'rounded-lg border p-4 text-start text-sm transition-colors',
                    importMode === 'live'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <div className="font-semibold">
                    {t('purchaseOrders.importCsv.modeLiveTitle')}
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {t('purchaseOrders.importCsv.modeLiveDesc')}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('historical')}
                  className={cn(
                    'rounded-lg border p-4 text-start text-sm transition-colors',
                    importMode === 'historical'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <div className="font-semibold">
                    {t('purchaseOrders.importCsv.modeHistoricalTitle')}
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {t('purchaseOrders.importCsv.modeHistoricalDesc')}
                  </p>
                </button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('purchaseOrders.importCsv.uploadHint')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFile(f)
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4" />
                {t('purchaseOrders.importCsv.chooseFile')}
              </Button>
              {parseError && (
                <p className="text-sm text-destructive">{parseError}</p>
              )}
            </div>
          )}

          {step === 'match' && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                {t('purchaseOrders.importCsv.matchHint')}
              </p>
              <div className="space-y-3 rounded-lg border border-border p-3">
                {PO_IMPORT_FIELDS_ORDERED.map((field) => {
                  const col = fieldToColumn[field]
                  const sample = getFirstSampleForColumn(rawRows, col)
                  const required = PO_IMPORT_FIELDS_REQUIRED.includes(field)
                  const productKey =
                    field === 'product_code' || field === 'product_name'
                  return (
                    <div
                      key={field}
                      className="grid items-start gap-2 sm:grid-cols-[minmax(0,180px)_1fr_minmax(0,1fr)]"
                    >
                      <Label className="pt-2 text-sm font-medium">
                        {t(fieldLabelKey(field))}
                        {(required || productKey) && (
                          <span className="ms-0.5 text-destructive">
                            {required ? '*' : ''}
                          </span>
                        )}
                      </Label>
                      <Select
                        value={col ?? NONE_VALUE}
                        onValueChange={(v) => {
                          const next = v === NONE_VALUE ? null : v
                          setFieldToColumn((prev) =>
                            assignPoColumn(prev, field, next)
                          )
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('purchaseOrders.importCsv.notImported')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            {t('purchaseOrders.importCsv.notImported')}
                          </SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="break-all pt-2 text-xs text-muted-foreground">
                        {sample
                          ? t('purchaseOrders.importCsv.sample', {
                              value: sample,
                            })
                          : t('purchaseOrders.importCsv.sampleEmpty')}
                      </p>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('purchaseOrders.importCsv.productKeyHint')}
              </p>
              {unusedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('purchaseOrders.importCsv.unusedColumns')}{' '}
                  {unusedHeaders.join(', ')}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <p className="shrink-0 text-sm text-muted-foreground">
                {t('purchaseOrders.importCsv.previewHint', {
                  mode:
                    importMode === 'live'
                      ? t('purchaseOrders.importCsv.modeLiveTitle')
                      : t('purchaseOrders.importCsv.modeHistoricalTitle'),
                })}
              </p>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('purchaseOrders.importCsv.colStatus')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('purchaseOrders.importCsv.fieldGroupId')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('purchaseOrders.importCsv.fieldSupplierPhone')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('purchaseOrders.importCsv.fieldProductCode')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('purchaseOrders.importCsv.fieldQuantity')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('purchaseOrders.importCsv.fieldCostPrice')}
                      </th>
                      <th className="w-10 whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('purchaseOrders.importCsv.discard')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          'border-b border-border/50 align-top',
                          d.discarded && 'line-through opacity-45'
                        )}
                      >
                        <td className="w-[140px] px-2 py-2">
                          {!d.discarded ? (
                            issueChips(d.id)
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t('purchaseOrders.importCsv.discarded')}
                            </span>
                          )}
                        </td>
                        <td className="min-w-[80px] px-2 py-2">
                          <Input
                            value={d.import_group_id}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                import_group_id: e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="min-w-[100px] px-2 py-2">
                          <Input
                            value={d.supplier_phone}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                supplier_phone: e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="min-w-[80px] px-2 py-2">
                          <Input
                            value={d.product_code}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                product_code: e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="w-20 px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={d.quantity}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                quantity:
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="w-24 px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={d.cost_price}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                cost_price:
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={t('purchaseOrders.importCsv.discard')}
                            onClick={() => toggleDiscard(d.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ingesting && (
            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-3 rounded-lg bg-background/90 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {t('purchaseOrders.importCsv.ingesting', {
                  done: ingestProgress.done,
                  total: ingestProgress.total,
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-border p-4 sm:gap-2">
          {step === 'mode' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => setStep('upload')}>
                {t('purchaseOrders.importCsv.continueToUpload')}
              </Button>
            </>
          )}
          {step === 'upload' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('mode')}
              >
                {t('purchaseOrders.importCsv.backToMode')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
            </>
          )}
          {step === 'match' && (
            <>
              <Button type="button" variant="outline" onClick={() => reset()}>
                {t('purchaseOrders.importCsv.backToUpload')}
              </Button>
              <Button type="button" disabled={!matchComplete} onClick={goPreview}>
                {t('purchaseOrders.importCsv.continueToPreview')}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={ingesting}
                onClick={() => setStep('match')}
              >
                {t('purchaseOrders.importCsv.backToMatch')}
              </Button>
              <Button
                type="button"
                disabled={!canIngest || ingesting}
                onClick={() => void runIngest()}
              >
                {t('purchaseOrders.importCsv.startIngesting')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
