import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Papa from 'papaparse'
import { Loader2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  buildReturnLineDraft,
  computeReturnGroupIssues,
  computeReturnLineIssues,
  emptyReturnFieldMapping,
  groupReturnLinesByImportId,
  guessReturnFieldToColumnMapping,
  RETURN_IMPORT_FIELDS_ORDERED,
  RETURN_IMPORT_FIELDS_REQUIRED,
  type ReturnCsvLineDraft,
  type ReturnFieldToColumnMapping,
} from '@/utils/returnCsvImport'
import {
  getOrderIdByNumber,
  getReturnableLinesForOrder,
  importHistoricalReturnSnapshot,
} from '@/services/returnService'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRTL: boolean
  onImported: () => void
}

type Stage = 'pick' | 'map' | 'result'

type ImportResult = {
  created: number
  failures: { group: string; message: string }[]
}

export function ReturnCsvImportDialog({
  open,
  onOpenChange,
  isRTL,
  onImported,
}: Props) {
  const { t } = useTranslation()
  const [stage, setStage] = useState<Stage>('pick')
  const [headers, setHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<ReturnFieldToColumnMapping>(
    emptyReturnFieldMapping()
  )
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = useCallback(() => {
    setStage('pick')
    setHeaders([])
    setCsvRows([])
    setMapping(emptyReturnFieldMapping())
    setParseError(null)
    setImporting(false)
    setResult(null)
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset()
      onOpenChange(next)
    },
    [onOpenChange, reset]
  )

  const onFile = useCallback((file: File) => {
    setParseError(null)
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = (res.meta.fields ?? []).filter(Boolean) as string[]
        if (cols.length === 0 || res.data.length === 0) {
          setParseError(t('returns.importCsv.emptyFile'))
          return
        }
        setHeaders(cols)
        setCsvRows(res.data)
        setMapping(guessReturnFieldToColumnMapping(cols))
        setStage('map')
      },
      error: (err) => setParseError(err.message),
    })
  }, [t])

  const drafts = useMemo<ReturnCsvLineDraft[]>(
    () => csvRows.map((row, i) => buildReturnLineDraft(row, mapping, i)),
    [csvRows, mapping]
  )

  const lineIssues = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const d of drafts) {
      const issues = computeReturnLineIssues(d)
      if (issues.length > 0) m.set(d.id, issues)
    }
    return m
  }, [drafts])

  const groups = useMemo(() => groupReturnLinesByImportId(drafts), [drafts])

  const missingRequired = RETURN_IMPORT_FIELDS_REQUIRED.filter(
    (f) => !mapping[f]
  )
  const readyGroups = useMemo(() => {
    const out: [string, ReturnCsvLineDraft[]][] = []
    for (const [key, lines] of groups) {
      const clean =
        lines.every((l) => !lineIssues.has(l.id)) &&
        computeReturnGroupIssues(lines).length === 0
      if (clean) out.push([key, lines])
    }
    return out
  }, [groups, lineIssues])

  const canImport =
    missingRequired.length === 0 && readyGroups.length > 0 && !importing

  const runImport = useCallback(async () => {
    setImporting(true)
    const failures: ImportResult['failures'] = []
    let created = 0

    for (const [key, lines] of readyGroups) {
      try {
        const orderNumber = lines[0].order_number
        const orderId = await getOrderIdByNumber(orderNumber)
        if (!orderId) {
          throw new Error(
            t('returns.importCsv.orderNotFound', { number: orderNumber })
          )
        }
        const returnable = await getReturnableLinesForOrder(orderId)
        const byCode = new Map(
          returnable.map((l) => [
            (l.product.product_code ?? '').trim().toLowerCase(),
            l,
          ])
        )

        const items = lines.map((l) => {
          const src = byCode.get(l.product_code.trim().toLowerCase())
          if (!src) {
            throw new Error(
              t('returns.importCsv.productNotInOrder', {
                code: l.product_code,
                number: orderNumber,
              })
            )
          }
          return {
            source_order_item_id: src.source_order_item_id,
            product_id: src.product_id,
            quantity: l.quantity,
            unit_price: src.unit_price,
          }
        })

        await importHistoricalReturnSnapshot({
          source_order_id: orderId,
          items,
          note: lines[0].return_note || undefined,
          created_at: lines[0].return_date_iso || undefined,
        })
        created += 1
      } catch (e) {
        failures.push({
          group: key,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }

    setResult({ created, failures })
    setStage('result')
    setImporting(false)
    if (created > 0) onImported()
  }, [readyGroups, onImported, t])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0',
          isRTL && 'rtl'
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-start">
          <DialogTitle>{t('returns.importCsv.title')}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {stage === 'pick' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('returns.importCsv.intro')}
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-sm transition-colors hover:bg-muted/50">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span>{t('returns.importCsv.chooseFile')}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onFile(f)
                  }}
                />
              </label>
              {parseError && (
                <p className="text-sm text-destructive" role="alert">
                  {parseError}
                </p>
              )}
            </div>
          )}

          {stage === 'map' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {RETURN_IMPORT_FIELDS_ORDERED.map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <Label className="w-40 shrink-0 text-xs">
                      {t(`returns.importCsv.field_${field}`)}
                      {RETURN_IMPORT_FIELDS_REQUIRED.includes(field) && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <select
                      className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                      value={mapping[field] ?? ''}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m,
                          [field]: e.target.value || null,
                        }))
                      }
                    >
                      <option value="">
                        {t('returns.importCsv.notMapped')}
                      </option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p>
                  {t('returns.importCsv.summary', {
                    rows: drafts.length,
                    groups: groups.size,
                    ready: readyGroups.length,
                  })}
                </p>
                {missingRequired.length > 0 && (
                  <p className="mt-1 text-destructive">
                    {t('returns.importCsv.missingRequired', {
                      fields: missingRequired
                        .map((f) => t(`returns.importCsv.field_${f}`))
                        .join(', '),
                    })}
                  </p>
                )}
                {lineIssues.size > 0 && (
                  <p className="mt-1 text-amber-700 dark:text-amber-400">
                    {t('returns.importCsv.rowsWithIssues', {
                      count: lineIssues.size,
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {stage === 'result' && result && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">
                {t('returns.importCsv.createdCount', {
                  count: result.created,
                })}
              </p>
              {result.failures.length > 0 && (
                <div>
                  <p className="mb-1 text-destructive">
                    {t('returns.importCsv.failedCount', {
                      count: result.failures.length,
                    })}
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {result.failures.map((f) => (
                      <li key={f.group}>
                        <span className="font-mono">{f.group}</span>:{' '}
                        {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {stage === 'result' ? t('common.close') : t('common.cancel')}
          </Button>
          {stage === 'map' && (
            <Button type="button" disabled={!canImport} onClick={runImport}>
              {importing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('returns.importCsv.import')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
