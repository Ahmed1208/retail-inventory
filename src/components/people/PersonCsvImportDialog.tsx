import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { FileUp, Loader2, Trash2 } from 'lucide-react'

import type { Person } from '@/types'
import type { PersonRole } from '@/types'
import {
  adjustBalance,
  createPerson,
  roundMoney,
} from '@/services/peopleService'
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
  IMPORT_FIELDS_ORDERED,
  IMPORT_FIELDS_REQUIRED,
  type ImportField,
  type ImportRowIssue,
  type FieldToColumnMapping,
  emptyFieldMapping,
  guessFieldToColumnMapping,
  buildRowDraft,
  computeIssuesForDraft,
  buildPhoneKeyCounts,
  existingPeoplePhoneKeys,
  getFirstSampleForColumn,
  unusedCsvHeaders,
  normalizeDraftNumbers,
  CSV_IMPORT_OPENING_BALANCE_NOTE,
  type PersonImportDraft,
} from '@/utils/personCsvImport'

const NONE_VALUE = '__none__'

type Step = 'upload' | 'match' | 'preview'

export type PersonCsvImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingPeople: Person[]
  onComplete: () => void
  isRTL: boolean
}

function assignColumn(
  prev: FieldToColumnMapping,
  field: ImportField,
  column: string | null
): FieldToColumnMapping {
  const next: FieldToColumnMapping = { ...prev }
  if (column) {
    for (const f of IMPORT_FIELDS_ORDERED) {
      if (f !== field && next[f] === column) {
        next[f] = null
      }
    }
  }
  next[field] = column
  return next
}

function fieldLabelKey(f: ImportField): string {
  const map: Record<ImportField, string> = {
    name: 'people.name',
    phone: 'people.phone',
    roles: 'people.roles',
    address: 'people.address',
    notes: 'people.notes',
    discount_rate: 'people.discount',
    credit_limit: 'people.creditLimit',
    initial_balance: 'people.importCsv.fieldInitialBalance',
  }
  return map[f]
}

function issueLabelKey(code: ImportRowIssue): string {
  return `people.importCsv.issue.${code}`
}

export function PersonCsvImportDialog({
  open,
  onOpenChange,
  existingPeople,
  onComplete,
  isRTL,
}: PersonCsvImportDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [parseError, setParseError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [fieldToColumn, setFieldToColumn] =
    useState<FieldToColumnMapping>(emptyFieldMapping)
  const [drafts, setDrafts] = useState<PersonImportDraft[]>([])
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 })

  const reset = useCallback(() => {
    setStep('upload')
    setParseError(null)
    setHeaders([])
    setRawRows([])
    setFieldToColumn(emptyFieldMapping())
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

  const existingPhoneKeys = useMemo(
    () => existingPeoplePhoneKeys(existingPeople),
    [existingPeople]
  )

  const phoneKeyCounts = useMemo(() => buildPhoneKeyCounts(drafts), [drafts])

  const issuesById = useMemo(() => {
    const m = new Map<string, ImportRowIssue[]>()
    for (const d of drafts) {
      m.set(
        d.id,
        computeIssuesForDraft(d, {
          phoneKeyCounts,
          existingPhoneKeys,
        })
      )
    }
    return m
  }, [drafts, phoneKeyCounts, existingPhoneKeys])

  const matchComplete = IMPORT_FIELDS_REQUIRED.every(
    (f) => fieldToColumn[f] != null && fieldToColumn[f] !== ''
  )

  const activeDrafts = drafts.filter((d) => !d.discarded)
  const canIngest =
    activeDrafts.length > 0 &&
    activeDrafts.every((d) => (issuesById.get(d.id) ?? []).length === 0)

  const unusedHeaders = useMemo(
    () => unusedCsvHeaders(headers, fieldToColumn),
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
          setParseError(msg || t('people.importCsv.parseError'))
          return
        }
        const data = (results.data ?? []).filter((row) => {
          const vals = Object.values(row).some(
            (v) => v != null && String(v).trim() !== ''
          )
          return vals
        }) as Record<string, unknown>[]
        if (data.length === 0) {
          setParseError(t('people.importCsv.emptyFile'))
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
        setFieldToColumn(guessFieldToColumnMapping(hdrs, asStrings))
        setStep('match')
      },
      error: (err) => {
        setParseError(err.message || t('people.importCsv.parseError'))
      },
    })
  }

  const goPreview = () => {
    const next = rawRows.map((row, i) => buildRowDraft(row, fieldToColumn, i))
    setDrafts(next)
    setStep('preview')
  }

  const updateDraft = (id: string, patch: Partial<PersonImportDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        const merged = { ...d, ...patch }
        if (
          patch.discount_rate != null ||
          patch.credit_limit !== undefined ||
          patch.initial_balance != null
        ) {
          return normalizeDraftNumbers(merged)
        }
        return merged
      })
    )
  }

  const toggleRole = (id: string, role: PersonRole, checked: boolean) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        const roles = checked
          ? d.roles.includes(role)
            ? d.roles
            : [...d.roles, role]
          : d.roles.filter((r) => r !== role)
        return { ...d, roles, rolesRaw: roles.join(',') }
      })
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
      const hasCustomer = d.roles.includes('customer')
      try {
        const created = await createPerson({
          name: d.name.trim(),
          phone: d.phone.trim(),
          address: d.address.trim() || null,
          notes: d.notes.trim() || null,
          roles: d.roles,
          discount_rate: hasCustomer ? roundMoney(d.discount_rate) : 0,
          credit_limit: hasCustomer ? d.credit_limit : null,
        })
        const bal = roundMoney(d.initial_balance)
        if (Math.abs(bal) > 0.005) {
          await adjustBalance({
            person_id: created.id,
            amount: bal,
            note: CSV_IMPORT_OPENING_BALANCE_NOTE,
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
      toast.success(t('people.importCsv.toastAllOk', { count: ok }))
    } else if (ok > 0 && fail > 0) {
      toast.warning(t('people.importCsv.toastPartial', { ok, fail }))
    } else {
      toast.error(t('people.importCsv.toastAllFailed', { count: fail }))
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
        <div className="p-6 pb-4 space-y-4 flex-1 min-h-0 flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('people.importCsv.title')}</DialogTitle>
          </DialogHeader>

          {step === 'upload' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('people.importCsv.uploadHint')}
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
                {t('people.importCsv.chooseFile')}
              </Button>
              {parseError && (
                <p className="text-sm text-destructive">{parseError}</p>
              )}
            </div>
          )}

          {step === 'match' && (
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                {t('people.importCsv.matchHint')}
              </p>
              <div className="space-y-3 rounded-lg border border-border p-3">
                {IMPORT_FIELDS_ORDERED.map((field) => {
                  const col = fieldToColumn[field]
                  const sample = getFirstSampleForColumn(rawRows, col)
                  const required = IMPORT_FIELDS_REQUIRED.includes(field)
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
                          const next =
                            v === NONE_VALUE ? null : v
                          setFieldToColumn((prev) =>
                            assignColumn(prev, field, next)
                          )
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('people.importCsv.notImported')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            {t('people.importCsv.notImported')}
                          </SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p
                        className="text-xs text-muted-foreground truncate pt-2"
                        title={sample}
                      >
                        {col
                          ? sample
                            ? t('people.importCsv.sample', { value: sample })
                            : t('people.importCsv.sampleEmpty')
                          : '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
              {unusedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('people.importCsv.unusedColumns')}{' '}
                  {unusedHeaders.join(', ')}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground shrink-0">
                {t('people.importCsv.previewHint', {
                  count: activeDrafts.length,
                })}
              </p>
              <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.importCsv.colStatus')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.name')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.phone')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.roles')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.address')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.notes')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.discount')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.creditLimit')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap">
                        {t('people.importCsv.fieldInitialBalance')}
                      </th>
                      <th className="px-2 py-2 text-start font-medium whitespace-nowrap w-10">
                        {t('people.importCsv.discard')}
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
                              {t('people.importCsv.discarded')}
                            </span>
                          )}
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
                        <td className="px-2 py-2 min-w-[100px]">
                          <Input
                            value={d.phone}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, { phone: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                disabled={d.discarded}
                                checked={d.roles.includes('customer')}
                                onChange={(e) =>
                                  toggleRole(
                                    d.id,
                                    'customer',
                                    e.target.checked
                                  )
                                }
                              />
                              {t('people.customer')}
                            </label>
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                disabled={d.discarded}
                                checked={d.roles.includes('supplier')}
                                onChange={(e) =>
                                  toggleRole(
                                    d.id,
                                    'supplier',
                                    e.target.checked
                                  )
                                }
                              />
                              {t('people.supplier')}
                            </label>
                          </div>
                        </td>
                        <td className="px-2 py-2 min-w-[80px]">
                          <Input
                            value={d.address}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, { address: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[80px]">
                          <Input
                            value={d.notes}
                            disabled={d.discarded}
                            onChange={(e) =>
                              updateDraft(d.id, { notes: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-20">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={d.discount_rate}
                            disabled={d.discarded}
                            onChange={(e) => {
                              const v = e.target.value
                              updateDraft(d.id, {
                                discount_rate:
                                  v === '' ? 0 : Number(v),
                              })
                            }}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-24">
                          <Input
                            type="number"
                            min={0}
                            value={d.credit_limit ?? ''}
                            disabled={d.discarded}
                            placeholder="—"
                            onChange={(e) => {
                              const v = e.target.value
                              updateDraft(d.id, {
                                credit_limit:
                                  v === '' ? null : Number(v),
                              })
                            }}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-24">
                          <Input
                            type="number"
                            value={d.initial_balance}
                            disabled={d.discarded}
                            onChange={(e) => {
                              const v = e.target.value
                              updateDraft(d.id, {
                                initial_balance:
                                  v === '' ? 0 : Number(v),
                              })
                            }}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={t('people.importCsv.discard')}
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
                {t('people.importCsv.ingesting', {
                  done: ingestProgress.done,
                  total: ingestProgress.total,
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border p-4 gap-2 sm:gap-2 flex-row flex-wrap justify-end">
          {step === 'upload' && (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          )}
          {step === 'match' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset()
                }}
              >
                {t('people.importCsv.backToUpload')}
              </Button>
              <Button
                type="button"
                disabled={!matchComplete}
                onClick={goPreview}
              >
                {t('people.importCsv.continueToPreview')}
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
                {t('people.importCsv.backToMatch')}
              </Button>
              <Button
                type="button"
                disabled={!canIngest || ingesting}
                onClick={() => void runIngest()}
              >
                {t('people.importCsv.startIngesting')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
