import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { FileUp, Loader2, Trash2 } from 'lucide-react'

import type { Brand, Category, Warehouse } from '@/types'
import { adjustStock, createProduct } from '@/services/productService'
import { createBrand } from '@/services/brandService'
import { createCategory } from '@/services/categoryService'
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
import {
  PRODUCT_IMPORT_FIELDS_ORDERED,
  PRODUCT_IMPORT_FIELDS_REQUIRED,
  type ProductImportField,
  type ProductFieldToColumnMapping,
  type ProductImportDraft,
  emptyProductFieldMapping,
  guessProductFieldToColumnMapping,
  buildProductRowDraft,
  computeProductIssuesForDraft,
  buildProductCodeKeyCounts,
  buildProductNameKeyCounts,
  existingProductCodesLower,
  existingProductNamesLower,
  unusedProductCsvHeaders,
} from '@/utils/productCsvImport'
import { getFirstSampleForColumn } from '@/utils/personCsvImport'

const NONE_VALUE = '__none__'

type Step = 'upload' | 'match' | 'preview'

export type ProductCsvImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingProducts: { product_code: string; name: string }[]
  initialBrands: Brand[]
  initialCategories: Category[]
  warehouses: Warehouse[]
  onComplete: () => void
  isRTL: boolean
}

function assignProductColumn(
  prev: ProductFieldToColumnMapping,
  field: ProductImportField,
  column: string | null
): ProductFieldToColumnMapping {
  const next: ProductFieldToColumnMapping = { ...prev }
  if (column) {
    for (const f of PRODUCT_IMPORT_FIELDS_ORDERED) {
      if (f !== field && next[f] === column) {
        next[f] = null
      }
    }
  }
  next[field] = column
  return next
}

function fieldLabelKey(f: ProductImportField): string {
  const map: Record<ProductImportField, string> = {
    product_code: 'products.importCsv.fieldProductCode',
    name: 'common.name',
    brand_name: 'products.importCsv.fieldBrandName',
    category_name: 'products.importCsv.fieldCategoryName',
    customer_price: 'products.customerPrice',
    business_price: 'products.businessPrice',
    cost_price: 'products.costPrice',
    quantity: 'products.importCsv.fieldQuantity',
    low_stock_threshold: 'products.importCsv.fieldLowStock',
    unit: 'products.unit',
    description: 'products.importCsv.fieldDescription',
  }
  return map[f]
}

function issueLabelKey(code: string): string {
  return `products.importCsv.issue.${code}`
}

export function ProductCsvImportDialog({
  open,
  onOpenChange,
  existingProducts,
  initialBrands,
  initialCategories,
  warehouses,
  onComplete,
  isRTL,
}: ProductCsvImportDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importWarehouseId, setImportWarehouseId] = useState(1)
  const [step, setStep] = useState<Step>('upload')
  const [parseError, setParseError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [fieldToColumn, setFieldToColumn] =
    useState<ProductFieldToColumnMapping>(emptyProductFieldMapping)
  const [drafts, setDrafts] = useState<ProductImportDraft[]>([])
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 })

  const reset = useCallback(() => {
    setStep('upload')
    setParseError(null)
    setHeaders([])
    setRawRows([])
    setFieldToColumn(emptyProductFieldMapping())
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

  useEffect(() => {
    if (!open || warehouses.length === 0) return
    setImportWarehouseId((prev) =>
      warehouses.some((w) => w.id === prev)
        ? prev
        : warehouses.find((w) => w.is_default)?.id ?? warehouses[0].id
    )
  }, [open, warehouses])

  const existingCodes = useMemo(
    () => existingProductCodesLower(existingProducts),
    [existingProducts]
  )
  const existingNames = useMemo(
    () => existingProductNamesLower(existingProducts),
    [existingProducts]
  )

  const codeKeyCounts = useMemo(
    () => buildProductCodeKeyCounts(drafts),
    [drafts]
  )
  const nameKeyCounts = useMemo(
    () => buildProductNameKeyCounts(drafts),
    [drafts]
  )

  const issuesById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeProductIssuesForDraft>>()
    for (const d of drafts) {
      m.set(
        d.id,
        computeProductIssuesForDraft(d, {
          codeKeyCounts,
          nameKeyCounts,
          existingCodes,
          existingNames,
        })
      )
    }
    return m
  }, [drafts, codeKeyCounts, nameKeyCounts, existingCodes, existingNames])

  const matchComplete = PRODUCT_IMPORT_FIELDS_REQUIRED.every(
    (f) => fieldToColumn[f] != null && fieldToColumn[f] !== ''
  )

  const activeDrafts = drafts.filter((d) => !d.discarded)
  const canIngest =
    warehouses.length > 0 &&
    activeDrafts.length > 0 &&
    activeDrafts.every((d) => (issuesById.get(d.id) ?? []).length === 0)

  const unusedHeaders = useMemo(
    () => unusedProductCsvHeaders(headers, fieldToColumn),
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
          setParseError(msg || t('products.importCsv.parseError'))
          return
        }
        const data = (results.data ?? []).filter((row) => {
          const vals = Object.values(row).some(
            (v) => v != null && String(v).trim() !== ''
          )
          return vals
        }) as Record<string, unknown>[]
        if (data.length === 0) {
          setParseError(t('products.importCsv.emptyFile'))
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
        setFieldToColumn(guessProductFieldToColumnMapping(hdrs, asStrings))
        setStep('match')
      },
      error: (err) => {
        setParseError(err.message || t('products.importCsv.parseError'))
      },
    })
  }

  const goPreview = () => {
    const next = rawRows.map((row, i) =>
      buildProductRowDraft(row, fieldToColumn, i)
    )
    setDrafts(next)
    setStep('preview')
  }

  const updateDraft = (id: string, patch: Partial<ProductImportDraft>) => {
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
    const toRun = drafts.filter((d) => !d.discarded)
    if (!toRun.length) return
    setIngesting(true)
    setIngestProgress({ done: 0, total: toRun.length })

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

    const stockNote = t('products.importCsv.stockMovementNote')
    let ok = 0
    let fail = 0
    for (let i = 0; i < toRun.length; i++) {
      const d = toRun[i]
      setIngestProgress({ done: i, total: toRun.length })
      try {
        const brand_id = await ensureBrand(d.brand_name)
        const category_id = await ensureCategory(d.category_name)
        const created = await createProduct({
          name: d.name.trim(),
          product_code: d.product_code.trim() || undefined,
          brand_id,
          category_id,
          customer_price: d.customer_price,
          business_price: d.business_price,
          cost_price: d.cost_price,
          quantity: 0,
          low_stock_threshold: d.low_stock_threshold,
          unit: d.unit.trim() || 'pc',
          description: d.description.trim() || null,
        })
        if (d.quantity > 0) {
          await adjustStock(created.id, 'in', d.quantity, stockNote, {
            warehouseId: importWarehouseId,
            inboundUnitCost: d.cost_price,
          })
        }
        ok++
      } catch (e) {
        fail++
        console.error(e)
      }
      setIngestProgress({ done: i + 1, total: toRun.length })
    }
    setIngesting(false)
    if (ok > 0 && fail === 0) {
      toast.success(t('products.importCsv.toastAllOk', { count: ok }))
    } else if (ok > 0 && fail > 0) {
      toast.warning(t('products.importCsv.toastPartial', { ok, fail }))
    } else {
      toast.error(t('products.importCsv.toastAllFailed', { count: fail }))
    }
    onComplete()
    handleOpenChange(false)
  }

  const issueChips = (id: string) => {
    const list = issuesById.get(id) ?? []
    if (!list.length) return null
    return (
      <div className="flex flex-wrap gap-1 mt-1">
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
        <div className="p-6 pb-4 space-y-4 flex-1 min-h-0 flex flex-col relative">
          <DialogHeader>
            <DialogTitle>{t('products.importCsv.title')}</DialogTitle>
          </DialogHeader>

          {warehouses.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="product-csv-import-warehouse">
                {t('products.importCsv.importWarehouseLabel')}
              </Label>
              <Select
                value={String(importWarehouseId)}
                onValueChange={(v) => setImportWarehouseId(Number(v))}
                disabled={ingesting}
              >
                <SelectTrigger id="product-csv-import-warehouse" className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('products.importCsv.importWarehouseHint')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              {t('products.importCsv.noWarehouses')}
            </p>
          )}

          {step === 'upload' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('products.importCsv.uploadHint')}
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
                disabled={warehouses.length === 0}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4" />
                {t('products.importCsv.chooseFile')}
              </Button>
              {parseError && (
                <p className="text-sm text-destructive">{parseError}</p>
              )}
            </div>
          )}

          {step === 'match' && (
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                {t('products.importCsv.matchHint')}
              </p>
              <div className="space-y-3 rounded-lg border border-border p-3">
                {PRODUCT_IMPORT_FIELDS_ORDERED.map((field) => {
                  const col = fieldToColumn[field]
                  const sample = getFirstSampleForColumn(rawRows, col)
                  const required = PRODUCT_IMPORT_FIELDS_REQUIRED.includes(field)
                  return (
                    <div
                      key={field}
                      className="grid gap-2 sm:grid-cols-[minmax(0,140px)_1fr_minmax(0,1fr)] items-start"
                    >
                      <Label className="pt-2 text-sm font-medium">
                        {t(fieldLabelKey(field))}
                        {required && (
                          <span className="text-destructive ms-0.5">*</span>
                        )}
                      </Label>
                      <Select
                        value={col ?? NONE_VALUE}
                        onValueChange={(v) => {
                          const next = v === NONE_VALUE ? null : v
                          setFieldToColumn((prev) =>
                            assignProductColumn(prev, field, next)
                          )
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('products.importCsv.notImported')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            {t('products.importCsv.notImported')}
                          </SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground break-all pt-2">
                        {sample
                          ? t('products.importCsv.sample', { value: sample })
                          : t('products.importCsv.sampleEmpty')}
                      </p>
                    </div>
                  )
                })}
              </div>
              {unusedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('products.importCsv.unusedColumns')}{' '}
                  {unusedHeaders.join(', ')}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground shrink-0">
                {t('products.importCsv.previewHint', {
                  count: activeDrafts.length,
                })}
              </p>
              <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('products.importCsv.colStatus')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('products.productId')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('common.name')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('brands.title')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('categories.title')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('products.customerPrice')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('products.businessPrice')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('products.costPrice')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('products.importCsv.fieldQuantity')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap w-10">
                        {t('products.importCsv.discard')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          'border-b border-border/50 align-top',
                          d.discarded && 'opacity-45 line-through'
                        )}
                      >
                        <td className="px-2 py-2 w-[140px]">
                          {!d.discarded ? (
                            issueChips(d.id)
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t('products.importCsv.discarded')}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 min-w-[80px]">
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
                        <td className="px-2 py-2 min-w-[100px]">
                          <Input
                            value={d.name}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, { name: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[80px]">
                          <Input
                            value={d.brand_name}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                brand_name: e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[80px]">
                          <Input
                            value={d.category_name}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                category_name: e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-20">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={d.customer_price}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                customer_price:
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-20">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={d.business_price}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                business_price:
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-20">
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
                        <td className="px-2 py-2 w-16">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={d.quantity}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                quantity:
                                  e.target.value === ''
                                    ? 0
                                    : parseInt(e.target.value, 10) || 0,
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
                            aria-label={t('products.importCsv.discard')}
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
                {t('products.importCsv.ingesting', {
                  done: ingestProgress.done,
                  total: ingestProgress.total,
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border p-4 gap-2 sm:gap-2 flex-row flex-wrap justify-end">
          {step === 'upload' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
          )}
          {step === 'match' && (
            <>
              <Button type="button" variant="outline" onClick={() => reset()}>
                {t('products.importCsv.backToUpload')}
              </Button>
              <Button
                type="button"
                disabled={!matchComplete}
                onClick={goPreview}
              >
                {t('products.importCsv.continueToPreview')}
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
                {t('products.importCsv.backToMatch')}
              </Button>
              <Button
                type="button"
                disabled={!canIngest || ingesting}
                onClick={() => void runIngest()}
              >
                {t('products.importCsv.startIngesting')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
