import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { FileUp, Loader2, Trash2 } from 'lucide-react'

import type { Person } from '@/types'
import type { Warehouse } from '@/types'
import {
  resolvePersonIdFromDraft,
  resolveRegisterWarehouseId,
  parsePaymentDirection,
  parsePaymentMethodCell,
} from '@/utils/paymentCsvImport'
import { recordPayment as recordPaymentApi } from '@/services/peopleService'
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
  PAYMENT_IMPORT_FIELDS_ORDERED,
  PAYMENT_IMPORT_FIELDS_REQUIRED,
  type PaymentImportField,
  type PaymentFieldToColumnMapping,
  type PaymentImportDraft,
  emptyPaymentFieldMapping,
  guessPaymentFieldToColumnMapping,
  buildPaymentRowDraft,
  computePaymentIssuesForDraft,
  paymentMappingHasPersonId,
  unusedPaymentCsvHeaders,
} from '@/utils/paymentCsvImport'
import { getFirstSampleForColumn } from '@/utils/personCsvImport'

const NONE_VALUE = '__none__'

type Step = 'upload' | 'match' | 'preview'

export type PaymentCsvImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Person[]
  warehouses: Warehouse[]
  defaultRegisterWarehouseId: number | null
  onComplete: () => void
  isRTL: boolean
}

function assignPaymentColumn(
  prev: PaymentFieldToColumnMapping,
  field: PaymentImportField,
  column: string | null
): PaymentFieldToColumnMapping {
  const next: PaymentFieldToColumnMapping = { ...prev }
  if (column) {
    for (const f of PAYMENT_IMPORT_FIELDS_ORDERED) {
      if (f !== field && next[f] === column) {
        next[f] = null
      }
    }
  }
  next[field] = column
  return next
}

function fieldLabelKey(f: PaymentImportField): string {
  const map: Record<PaymentImportField, string> = {
    person_phone: 'payments.importCsv.fieldPersonPhone',
    person_name: 'payments.importCsv.fieldPersonName',
    payment_type: 'payments.importCsv.fieldPaymentType',
    payment_method: 'payments.importCsv.fieldPaymentMethod',
    amount: 'payments.importCsv.fieldAmount',
    note: 'payments.importCsv.fieldNote',
    register_warehouse: 'payments.importCsv.fieldRegisterWarehouse',
  }
  return map[f]
}

export function PaymentCsvImportDialog({
  open,
  onOpenChange,
  people,
  warehouses,
  defaultRegisterWarehouseId,
  onComplete,
  isRTL,
}: PaymentCsvImportDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [parseError, setParseError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [fieldToColumn, setFieldToColumn] =
    useState<PaymentFieldToColumnMapping>(emptyPaymentFieldMapping)
  const [drafts, setDrafts] = useState<PaymentImportDraft[]>([])
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 })

  const reset = useCallback(() => {
    setStep('upload')
    setParseError(null)
    setHeaders([])
    setRawRows([])
    setFieldToColumn(emptyPaymentFieldMapping())
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

  const whCtx = useMemo(
    () =>
      warehouses.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        has_register: w.has_register,
      })),
    [warehouses]
  )

  const issuesById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computePaymentIssuesForDraft>>()
    for (const d of drafts) {
      m.set(
        d.id,
        computePaymentIssuesForDraft(d, {
          people,
          warehouses: whCtx,
          defaultRegisterWarehouseId,
        })
      )
    }
    return m
  }, [drafts, people, whCtx, defaultRegisterWarehouseId])

  const matchComplete =
    paymentMappingHasPersonId(fieldToColumn) &&
    PAYMENT_IMPORT_FIELDS_REQUIRED.every(
      (f) => fieldToColumn[f] != null && fieldToColumn[f] !== ''
    )

  const activeDrafts = drafts.filter((d) => !d.discarded)
  const canIngest =
    activeDrafts.length > 0 &&
    activeDrafts.every((d) => (issuesById.get(d.id) ?? []).length === 0)

  const unusedHeaders = useMemo(
    () => unusedPaymentCsvHeaders(headers, fieldToColumn),
    [headers, fieldToColumn]
  )

  const onFile = (file: File) => {
    setParseError(null)
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors.length) {
          setParseError(
            results.errors.map((e) => e.message).join('; ') ||
              t('payments.importCsv.parseError')
          )
          return
        }
        const data = (results.data ?? []).filter((row) => {
          const vals = Object.values(row).some(
            (v) => v != null && String(v).trim() !== ''
          )
          return vals
        }) as Record<string, unknown>[]
        if (data.length === 0) {
          setParseError(t('payments.importCsv.emptyFile'))
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
        setFieldToColumn(guessPaymentFieldToColumnMapping(hdrs))
        setStep('match')
      },
      error: (err) => {
        setParseError(err.message || t('payments.importCsv.parseError'))
      },
    })
  }

  const goPreview = () => {
    setDrafts(rawRows.map((row, i) => buildPaymentRowDraft(row, fieldToColumn, i)))
    setStep('preview')
  }

  const updateDraft = (id: string, patch: Partial<PaymentImportDraft>) => {
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
    let ok = 0
    let fail = 0
    for (let i = 0; i < toRun.length; i++) {
      const d = toRun[i]
      setIngestProgress({ done: i, total: toRun.length })
      try {
        const pr = resolvePersonIdFromDraft(d, people)
        if ('error' in pr) throw new Error(pr.error)
        const whTok = d.register_warehouse.trim()
        const regId = whTok
          ? resolveRegisterWarehouseId(whTok, whCtx)
          : defaultRegisterWarehouseId != null
            ? { id: defaultRegisterWarehouseId }
            : { error: 'warehouse_missing' as const }
        if ('error' in regId) throw new Error(regId.error)
        if (!d.payment_type || !d.payment_method) throw new Error('invalid')
        await recordPaymentApi({
          person_id: pr.person_id,
          type: d.payment_type,
          payments: [{ payment_method: d.payment_method, amount: d.amount }],
          note: d.note.trim() || undefined,
          register_warehouse_id: regId.id,
        })
        ok++
      } catch (e) {
        fail++
        console.error(e)
      }
      setIngestProgress({ done: i + 1, total: toRun.length })
    }
    setIngesting(false)
    if (ok > 0 && fail === 0) {
      toast.success(t('payments.importCsv.toastAllOk', { count: ok }))
    } else if (ok > 0 && fail > 0) {
      toast.warning(t('payments.importCsv.toastPartial', { ok, fail }))
    } else {
      toast.error(t('payments.importCsv.toastAllFailed', { count: fail }))
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
            {t(`payments.importCsv.issue.${code}`)}
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
            <DialogTitle>{t('payments.importCsv.title')}</DialogTitle>
          </DialogHeader>

          {step === 'upload' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('payments.importCsv.uploadHint')}
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
                {t('payments.importCsv.chooseFile')}
              </Button>
              {parseError && (
                <p className="text-sm text-destructive">{parseError}</p>
              )}
            </div>
          )}

          {step === 'match' && (
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                {t('payments.importCsv.matchHint')}
              </p>
              <div className="space-y-3 rounded-lg border border-border p-3">
                {PAYMENT_IMPORT_FIELDS_ORDERED.map((field) => {
                  const col = fieldToColumn[field]
                  const sample = getFirstSampleForColumn(rawRows, col)
                  const required = PAYMENT_IMPORT_FIELDS_REQUIRED.includes(field)
                  return (
                    <div
                      key={field}
                      className="grid gap-2 sm:grid-cols-[minmax(0,160px)_1fr_minmax(0,1fr)] items-start"
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
                            assignPaymentColumn(prev, field, next)
                          )
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('payments.importCsv.notImported')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            {t('payments.importCsv.notImported')}
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
                          ? t('payments.importCsv.sample', { value: sample })
                          : t('payments.importCsv.sampleEmpty')}
                      </p>
                    </div>
                  )
                })}
              </div>
              {!paymentMappingHasPersonId(fieldToColumn) && (
                <p className="text-sm text-destructive">
                  {t('payments.importCsv.needPersonColumn')}
                </p>
              )}
              {unusedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('payments.importCsv.unusedColumns')}{' '}
                  {unusedHeaders.join(', ')}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground shrink-0">
                {t('payments.importCsv.previewHint', {
                  count: activeDrafts.length,
                })}
              </p>
              <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('payments.importCsv.colStatus')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('payments.importCsv.fieldPersonPhone')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('payments.importCsv.fieldPersonName')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('payments.importCsv.fieldPaymentType')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('payments.importCsv.fieldPaymentMethod')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('payments.importCsv.fieldAmount')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('payments.importCsv.fieldRegisterWarehouse')}
                      </th>
                      <th className="px-2 py-2 w-10">
                        {t('payments.importCsv.discard')}
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
                        <td className="px-2 py-2 w-[130px]">
                          {!d.discarded ? (
                            issueChips(d.id)
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t('payments.importCsv.discarded')}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 min-w-[90px]">
                          <Input
                            value={d.person_phone}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                person_phone: e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[90px]">
                          <Input
                            value={d.person_name}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                person_name: e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[80px]">
                          <Input
                            value={d.payment_type_raw}
                            disabled={d.discarded}
                            onChange={(e) => {
                              const raw = e.target.value
                              updateDraft(d.id, {
                                payment_type_raw: raw,
                                payment_type: parsePaymentDirection(raw),
                              })
                            }}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[70px]">
                          <Input
                            value={d.payment_method_raw}
                            disabled={d.discarded}
                            onChange={(e) => {
                              const raw = e.target.value
                              updateDraft(d.id, {
                                payment_method_raw: raw,
                                payment_method: parsePaymentMethodCell(raw),
                              })
                            }}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-20">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={d.amount}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                amount:
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[80px]">
                          <Input
                            value={d.register_warehouse}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                register_warehouse: e.target.value,
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
                            aria-label={t('payments.importCsv.discard')}
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
                {t('payments.importCsv.ingesting', {
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
                {t('payments.importCsv.backToUpload')}
              </Button>
              <Button
                type="button"
                disabled={!matchComplete}
                onClick={goPreview}
              >
                {t('payments.importCsv.continueToPreview')}
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
                {t('payments.importCsv.backToMatch')}
              </Button>
              <Button
                type="button"
                disabled={!canIngest || ingesting}
                onClick={() => void runIngest()}
              >
                {t('payments.importCsv.startIngesting')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
