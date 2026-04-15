import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { FileUp, Loader2, Trash2 } from 'lucide-react'

import type { Brand, Category, Person, ProductWithRelations, Warehouse } from '@/types'
import { createOrder, importHistoricalOrderSnapshot } from '@/services/orderService'
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
import {
  ORDER_IMPORT_FIELDS_ORDERED,
  ORDER_IMPORT_FIELDS_REQUIRED,
  type OrderCsvLineDraft,
  type OrderFieldToColumnMapping,
  type OrderImportField,
  buildOrderLineDraft,
  computeOrderGroupIssues,
  computeOrderLineIssues,
  emptyOrderFieldMapping,
  groupOrderLinesByImportId,
  guessOrderFieldToColumnMapping,
  parseOrderType,
  unusedOrderCsvHeaders,
} from '@/utils/orderCsvImport'
import { resolveCsvImportedDocumentDate } from '@/utils/csvImportDates'

const NONE_VALUE = '__none__'

type Step = 'mode' | 'upload' | 'match' | 'preview'
export type OrderCsvImportMode = 'live' | 'historical'

export type OrderCsvImportDialogProps = {
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

function assignOrderColumn(
  prev: OrderFieldToColumnMapping,
  field: OrderImportField,
  column: string | null
): OrderFieldToColumnMapping {
  const next: OrderFieldToColumnMapping = { ...prev }
  if (column) {
    for (const f of ORDER_IMPORT_FIELDS_ORDERED) {
      if (f !== field && next[f] === column) {
        next[f] = null
      }
    }
  }
  next[field] = column
  return next
}

function fieldLabelKey(f: OrderImportField): string {
  const map: Record<OrderImportField, string> = {
    import_group_id: 'orders.importCsv.fieldGroupId',
    order_type: 'orders.importCsv.fieldOrderType',
    warehouse_code: 'orders.importCsv.fieldWarehouseCode',
    customer_phone: 'orders.importCsv.fieldCustomerPhone',
    customer_name: 'orders.importCsv.fieldCustomerName',
    order_note: 'orders.importCsv.fieldOrderNote',
    order_discount_rate: 'orders.importCsv.fieldOrderDiscountRate',
    order_date: 'orders.importCsv.fieldOrderDate',
    product_code: 'orders.importCsv.fieldProductCode',
    product_name: 'orders.importCsv.fieldProductName',
    brand_name: 'orders.importCsv.fieldBrandName',
    category_name: 'orders.importCsv.fieldCategoryName',
    quantity: 'orders.importCsv.fieldQuantity',
    unit_price: 'orders.importCsv.fieldUnitPrice',
    line_discount_rate: 'orders.importCsv.fieldLineDiscountRate',
    product_customer_price: 'orders.importCsv.fieldProductCustomerPrice',
    product_business_price: 'orders.importCsv.fieldProductBusinessPrice',
    product_cost_price: 'orders.importCsv.fieldProductCostPrice',
  }
  return map[f]
}

function issueLabelKey(code: string): string {
  return `orders.importCsv.issue.${code}`
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

export function OrderCsvImportDialog({
  open,
  onOpenChange,
  warehouses,
  people,
  products,
  initialBrands,
  initialCategories,
  onComplete,
  isRTL,
}: OrderCsvImportDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importMode, setImportMode] = useState<OrderCsvImportMode>('live')
  const [step, setStep] = useState<Step>('mode')
  const [parseError, setParseError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [fieldToColumn, setFieldToColumn] =
    useState<OrderFieldToColumnMapping>(emptyOrderFieldMapping)
  const [drafts, setDrafts] = useState<OrderCsvLineDraft[]>([])
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 })

  const reset = useCallback(() => {
    setImportMode('live')
    setStep('mode')
    setParseError(null)
    setHeaders([])
    setRawRows([])
    setFieldToColumn(emptyOrderFieldMapping())
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
    const groups = groupOrderLinesByImportId(active)
    const m = new Map<string, string[]>()
    for (const [k, lines] of groups) {
      const gi = computeOrderGroupIssues(lines)
      if (gi.length) m.set(k, gi)
    }
    return m
  }, [drafts])

  const issuesById = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const d of drafts) {
      const lineIssues = computeOrderLineIssues(d).map(String)
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
    ORDER_IMPORT_FIELDS_REQUIRED.every(
      (f) => fieldToColumn[f] != null && fieldToColumn[f] !== ''
    ) &&
    (fieldToColumn.product_code != null || fieldToColumn.product_name != null)

  const activeDrafts = drafts.filter((d) => !d.discarded)
  const canIngest =
    warehouses.length > 0 &&
    activeDrafts.length > 0 &&
    activeDrafts.every((d) => (issuesById.get(d.id) ?? []).length === 0)

  const unusedHeaders = useMemo(
    () => unusedOrderCsvHeaders(headers, fieldToColumn),
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
          setParseError(msg || t('orders.importCsv.parseError'))
          return
        }
        const data = (results.data ?? []).filter((row) => {
          const vals = Object.values(row).some(
            (v) => v != null && String(v).trim() !== ''
          )
          return vals
        }) as Record<string, unknown>[]
        if (data.length === 0) {
          setParseError(t('orders.importCsv.emptyFile'))
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
        setFieldToColumn(guessOrderFieldToColumnMapping(hdrs, asStrings))
        setStep('match')
      },
      error: (err) => {
        setParseError(err.message || t('orders.importCsv.parseError'))
      },
    })
  }

  const goPreview = () => {
    const next = rawRows.map((row, i) =>
      buildOrderLineDraft(row, fieldToColumn, i)
    )
    setDrafts(next)
    setStep('preview')
  }

  const updateDraft = (id: string, patch: Partial<OrderCsvLineDraft>) => {
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
    const groups = groupOrderLinesByImportId(active)
    if (groups.size === 0) return

    setIngesting(true)
    setIngestProgress({ done: 0, total: groups.size })

    const customers = people.filter((p) => p.roles.includes('customer'))
    const phoneToCustomerId = new Map<string, string>()
    for (const p of customers) {
      const ph = p.phone?.trim()
      if (ph) phoneToCustomerId.set(normalizePhoneKey(ph), p.id)
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
      line: OrderCsvLineDraft
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
        customer_price: line.product_customer_price || 0,
        business_price: line.product_business_price || 0,
        cost_price: line.product_cost_price || 0,
        quantity: 0,
        low_stock_threshold: 0,
        unit: 'pc',
        description: null,
      })
      productByCode.set(created.product_code.trim().toLowerCase(), created.id)
      productByName.set(created.name.trim().toLowerCase(), created.id)
      return created.id
    }

    const resolveOrCreateCustomer = async (
      phoneRaw: string,
      nameRaw: string
    ): Promise<string | null> => {
      const phone = phoneRaw.trim()
      const name = nameRaw.trim()
      if (!phone && !name) return null
      if (!phone && name) {
        const matches = customers.filter(
          (p) => p.name.trim().toLowerCase() === name.toLowerCase()
        )
        if (matches.length === 1) return matches[0].id
        throw new Error(t('orders.importCsv.errorCustomerNameNoPhone'))
      }
      const key = normalizePhoneKey(phone)
      const existing = phoneToCustomerId.get(key)
      if (existing) return existing
      const created = await createPerson({
        name: name || phone,
        phone,
        roles: ['customer'],
        discount_rate: 0,
        credit_limit: null,
        address: null,
        notes: null,
      })
      phoneToCustomerId.set(
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
        if (!wh) throw new Error(t('orders.importCsv.errorUnknownWarehouse'))

        const ot = parseOrderType(first.order_type)
        if (!ot) throw new Error(t('orders.importCsv.errorInvalidOrderType'))

        const person_id = await resolveOrCreateCustomer(
          first.customer_phone,
          first.customer_name
        )

        const items = []
        for (const ln of lines) {
          const product_id = await resolveOrCreateProduct(ln)
          items.push({
            product_id,
            quantity: ln.quantity,
            unit_price: ln.unit_price,
            line_discount_rate: ln.line_discount_rate,
          })
        }

        const documentDateIso = resolveCsvImportedDocumentDate(
          first.order_date_iso
        )

        if (importMode === 'historical') {
          await importHistoricalOrderSnapshot({
            type: ot,
            warehouse_id: wh.id,
            person_id,
            note: first.order_note.trim() || null,
            discount_rate: first.order_discount_rate,
            created_at: documentDateIso,
            items,
          })
        } else {
          await createOrder({
            type: ot,
            note: first.order_note.trim() || undefined,
            items,
            payments: [],
            person_id: person_id ?? undefined,
            order_discount_rate: first.order_discount_rate,
            allow_remaining_on_account: true,
            warehouse_id: wh.id,
            created_at: documentDateIso,
          })
        }
        ok++
      } catch (e) {
        fail++
        console.error(e)
        const msg =
          supabaseErrorMessage(e) || t('orders.importCsv.errorGeneric')
        toast.error(`${t('orders.importCsv.groupFailed')}: ${first.import_group_id} — ${msg}`)
      }
      gi++
      setIngestProgress({ done: gi, total: groups.size })
    }

    setIngesting(false)
    if (ok > 0 && fail === 0) {
      toast.success(t('orders.importCsv.toastAllOk', { count: ok }))
    } else if (ok > 0 && fail > 0) {
      toast.warning(t('orders.importCsv.toastPartial', { ok, fail }))
    } else if (fail > 0) {
      toast.error(t('orders.importCsv.toastAllFailed', { count: fail }))
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
            <DialogTitle>{t('orders.importCsv.title')}</DialogTitle>
          </DialogHeader>

          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('orders.importCsv.modeIntro')}
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
                    {t('orders.importCsv.modeLiveTitle')}
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {t('orders.importCsv.modeLiveDesc')}
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
                    {t('orders.importCsv.modeHistoricalTitle')}
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {t('orders.importCsv.modeHistoricalDesc')}
                  </p>
                </button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('orders.importCsv.uploadHint')}
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
                {t('orders.importCsv.chooseFile')}
              </Button>
              {parseError && (
                <p className="text-sm text-destructive">{parseError}</p>
              )}
            </div>
          )}

          {step === 'match' && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                {t('orders.importCsv.matchHint')}
              </p>
              <div className="space-y-3 rounded-lg border border-border p-3">
                {ORDER_IMPORT_FIELDS_ORDERED.map((field) => {
                  const col = fieldToColumn[field]
                  const sample = getFirstSampleForColumn(rawRows, col)
                  const required = ORDER_IMPORT_FIELDS_REQUIRED.includes(field)
                  const productKey =
                    field === 'product_code' || field === 'product_name'
                  return (
                    <div
                      key={field}
                      className="grid items-start gap-2 sm:grid-cols-[minmax(0,160px)_1fr_minmax(0,1fr)]"
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
                            assignOrderColumn(prev, field, next)
                          )
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('orders.importCsv.notImported')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            {t('orders.importCsv.notImported')}
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
                          ? t('orders.importCsv.sample', { value: sample })
                          : t('orders.importCsv.sampleEmpty')}
                      </p>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('orders.importCsv.productKeyHint')}
              </p>
              {unusedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('orders.importCsv.unusedColumns')}{' '}
                  {unusedHeaders.join(', ')}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <p className="shrink-0 text-sm text-muted-foreground">
                {t('orders.importCsv.previewHint', {
                  mode:
                    importMode === 'live'
                      ? t('orders.importCsv.modeLiveTitle')
                      : t('orders.importCsv.modeHistoricalTitle'),
                })}
              </p>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('orders.importCsv.colStatus')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('orders.importCsv.fieldGroupId')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('orders.importCsv.fieldProductCode')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('orders.importCsv.fieldProductName')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('orders.importCsv.fieldQuantity')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('orders.importCsv.fieldUnitPrice')}
                      </th>
                      <th className="w-10 whitespace-nowrap px-2 py-2 text-start font-medium">
                        {t('orders.importCsv.discard')}
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
                              {t('orders.importCsv.discarded')}
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
                        <td className="min-w-[100px] px-2 py-2">
                          <Input
                            value={d.product_name}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                product_name: e.target.value,
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
                            value={d.unit_price}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                unit_price:
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
                            aria-label={t('orders.importCsv.discard')}
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
                {t('orders.importCsv.ingesting', {
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
                {t('orders.importCsv.continueToUpload')}
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
                {t('orders.importCsv.backToMode')}
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
                {t('orders.importCsv.backToUpload')}
              </Button>
              <Button type="button" disabled={!matchComplete} onClick={goPreview}>
                {t('orders.importCsv.continueToPreview')}
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
                {t('orders.importCsv.backToMatch')}
              </Button>
              <Button
                type="button"
                disabled={!canIngest || ingesting}
                onClick={() => void runIngest()}
              >
                {t('orders.importCsv.startIngesting')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
