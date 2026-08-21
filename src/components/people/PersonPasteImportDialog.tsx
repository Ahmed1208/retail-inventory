import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ClipboardPaste, Loader2 } from 'lucide-react'

import type { Person, PersonRole } from '@/types'
import {
  adjustBalance,
  createPerson,
  updatePerson,
} from '@/services/peopleService'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpTip } from '@/components/people/HelpTip'
import { parseClipboardTable } from '@/utils/clipboardTableParse'
import {
  PASTE_FIELDS_ORDERED,
  type ConflictAction,
  type MatchReason,
  type PasteFieldMapping,
  type PasteImportField,
  type PersonPasteDraft,
  type RowMatch,
  buildPasteDraft,
  draftHasName,
  emptyPasteMapping,
  fillEmptyProfilePatch,
  findFileDuplicate,
  guessPasteFieldMapping,
  loadSavedPasteMapping,
  matchDraftToPeople,
  proposedMergeBalance,
  savePasteMapping,
  unionRoles,
  IMPORT_OPENING_BALANCE_NOTE,
  MERGE_IMPORT_BALANCE_NOTE,
} from '@/utils/personPasteImport'
import { formatCurrency } from '@/utils/currency'
import { markMigrationStepDone } from '@/utils/migrationChecklistStorage'
import { cn } from '@/lib/utils'

const NONE = '__none__'

type WizardStep =
  | 'welcome'
  | 'paste'
  | 'map'
  | 'preview'
  | 'conflicts'
  | 'balances'
  | 'done'

const STEP_ORDER: WizardStep[] = [
  'welcome',
  'paste',
  'map',
  'preview',
  'conflicts',
  'balances',
  'done',
]

type RowPlan = {
  draft: PersonPasteDraft
  match: RowMatch | null
  fileDup: MatchReason | null
  action: ConflictAction
  overwriteFilled: boolean
  sellerMeansPayable: boolean
}

export type PersonPasteImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingPeople: Person[]
  onComplete: () => void
  lang: 'en' | 'ar'
  onGoNextMigration?: () => void
}

function fieldLabelKey(f: PasteImportField): string {
  const map: Record<PasteImportField, string> = {
    external_code: 'people.externalCode',
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

function rolesLabel(roles: PersonRole[], t: (k: string) => string): string {
  return roles
    .map((r) => (r === 'customer' ? t('people.customer') : t('people.supplier')))
    .join(' · ')
}

export function PersonPasteImportDialog({
  open,
  onOpenChange,
  existingPeople,
  onComplete,
  lang,
  onGoNextMigration,
}: PersonPasteImportDialogProps) {
  const { t } = useTranslation()
  const fc = (n: number) => formatCurrency(n, lang)

  const [step, setStep] = useState<WizardStep>('welcome')
  const [pasteText, setPasteText] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [whatToCopyOpen, setWhatToCopyOpen] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<PasteFieldMapping>(emptyPasteMapping)
  const [drafts, setDrafts] = useState<PersonPasteDraft[]>([])
  const [plans, setPlans] = useState<RowPlan[]>([])
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)
  const [mergeIndex, setMergeIndex] = useState<number | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [createdPeople, setCreatedPeople] = useState<Person[]>([])
  const [balanceAmounts, setBalanceAmounts] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState({ created: 0, updated: 0, skipped: 0, failed: 0 })

  const reset = useCallback(() => {
    setStep('welcome')
    setPasteText('')
    setHasHeader(true)
    setHeaders([])
    setRawRows([])
    setMapping(emptyPasteMapping())
    setDrafts([])
    setPlans([])
    setReviewIndex(null)
    setMergeIndex(null)
    setApplyOpen(false)
    setIngesting(false)
    setCreatedPeople([])
    setBalanceAmounts({})
    setCounts({ created: 0, updated: 0, skipped: 0, failed: 0 })
  }, [])

  const parsePaste = useCallback(
    (text: string) => {
      const parsed = parseClipboardTable(text, { hasHeaderRow: hasHeader })
      if (parsed.rows.length === 0) {
        toast.error(t('people.importPaste.emptyPaste'))
        return false
      }
      setHeaders(parsed.headers)
      setRawRows(parsed.rows)
      const guessed = guessPasteFieldMapping(parsed.headers, parsed.rows)
      const saved = loadSavedPasteMapping()
      const next = emptyPasteMapping()
      for (const f of PASTE_FIELDS_ORDERED) {
        const s = saved?.[f]
        next[f] = s && parsed.headers.includes(s) ? s : guessed[f]
      }
      setMapping(next)
      return true
    },
    [hasHeader, t]
  )

  const rebuildDrafts = useCallback(
    (rows: Record<string, string>[], map: PasteFieldMapping) => {
      const next = rows.map((r, i) => buildPasteDraft(r, map, i))
      setDrafts(next)
      return next
    },
    []
  )

  const rebuildPlans = useCallback(
    (list: PersonPasteDraft[]) => {
      const next: RowPlan[] = list.map((draft) => {
        const match = draft.discarded ? null : matchDraftToPeople(draft, existingPeople)
        const fileDup = draft.discarded
          ? null
          : findFileDuplicate(draft, list)
        let action: ConflictAction = 'create'
        if (draft.discarded) action = 'skip'
        else if (match) action = 'skip'
        else if (fileDup) action = 'skip'
        return {
          draft,
          match,
          fileDup,
          action,
          overwriteFilled: false,
          sellerMeansPayable: true,
        }
      })
      setPlans(next)
      return next
    },
    [existingPeople]
  )

  const goMap = () => {
    if (!parsePaste(pasteText)) return
    setStep('map')
  }

  const goPreview = () => {
    if (!mapping.name) {
      toast.error(t('people.importPaste.nameRequiredMap'))
      return
    }
    savePasteMapping(mapping)
    const list = rebuildDrafts(rawRows, mapping)
    setStep('preview')
    rebuildPlans(list)
  }

  const goConflicts = () => {
    const list = drafts.filter((d) => !d.discarded)
    if (!list.some(draftHasName)) {
      toast.error(t('people.importPaste.needNamedRow'))
      return
    }
    rebuildPlans(drafts)
    setStep('conflicts')
  }

  const applyCounts = useMemo(() => {
    let created = 0
    let updated = 0
    let skipped = 0
    for (const p of plans) {
      if (p.draft.discarded || !draftHasName(p.draft)) {
        skipped += 1
        continue
      }
      if (p.action === 'skip') skipped += 1
      else if (p.action === 'create' || p.action === 'separate') created += 1
      else updated += 1
    }
    return { created, updated, skipped }
  }, [plans])

  const applyImport = async () => {
    setIngesting(true)
    const livePeople = [...existingPeople]
    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    const newOnes: Person[] = []
    const work = plans.filter((p) => !p.draft.discarded)
    setProgress({ done: 0, total: work.length })

    for (let i = 0; i < work.length; i++) {
      const plan = work[i]
      const d = plan.draft
      try {
        if (!draftHasName(d) || plan.action === 'skip') {
          skipped += 1
        } else if (plan.action === 'create' || plan.action === 'separate') {
          if (plan.action === 'separate' && plan.match) {
            const clashPhone =
              d.phone &&
              plan.match.person.phone &&
              d.phone.trim().toLowerCase() === plan.match.person.phone.trim().toLowerCase()
            const clashCode =
              d.external_code &&
              plan.match.person.external_code &&
              d.external_code.trim().toLowerCase() ===
                plan.match.person.external_code.trim().toLowerCase()
            if (clashPhone || clashCode) {
              toast.error(t('people.importPaste.separateBlocked'))
              failed += 1
              setProgress({ done: i + 1, total: work.length })
              continue
            }
          }
          const person = await createPerson({
            name: d.name,
            phone: d.phone || null,
            external_code: d.external_code || null,
            address: d.address || null,
            notes: d.notes || null,
            roles: d.roles,
            discount_rate: d.discount_rate,
            credit_limit: d.credit_limit,
          })
          livePeople.push(person)
          newOnes.push(person)
          created += 1
        } else if (plan.match && (plan.action === 'update' || plan.action === 'merge')) {
          const existing = plan.match.person
          const patch = fillEmptyProfilePatch(existing, d, plan.overwriteFilled)
          if (plan.action === 'merge') {
            patch.roles = unionRoles(existing.roles, d.roles)
            if (!existing.external_code && d.external_code) {
              patch.external_code = d.external_code
            }
          } else if (mapping.roles && d.rolesRaw) {
            patch.roles = d.roles
          }
          const updatedPerson = await updatePerson(existing.id, patch)
          const idx = livePeople.findIndex((p) => p.id === existing.id)
          if (idx >= 0) livePeople[idx] = updatedPerson

          if (d.initial_balance != null) {
            const { delta } = proposedMergeBalance(
              existing.balance,
              d.initial_balance,
              d.roles,
              plan.sellerMeansPayable
            )
            if (Math.abs(delta) > 0.0001) {
              await adjustBalance({
                person_id: existing.id,
                amount: delta,
                note:
                  plan.action === 'merge'
                    ? MERGE_IMPORT_BALANCE_NOTE
                    : IMPORT_OPENING_BALANCE_NOTE,
              })
            }
          }
          updated += 1
        } else {
          skipped += 1
        }
      } catch (e) {
        console.error(e)
        failed += 1
      }
      setProgress({ done: i + 1, total: work.length })
    }

    setCounts({ created, updated, skipped, failed })
    setCreatedPeople(newOnes)
    setBalanceAmounts(
      Object.fromEntries(newOnes.map((p) => [p.id, '']))
    )
    setIngesting(false)
    setApplyOpen(false)
    markMigrationStepDone('people_wizard')
    onComplete()
    if (newOnes.length > 0) setStep('balances')
    else setStep('done')
    if (failed === 0) {
      toast.success(
        t('people.importPaste.toastApplied', { created, updated, skipped })
      )
    } else {
      toast.warning(
        t('people.importPaste.toastPartial', { created, updated, skipped, failed })
      )
    }
  }

  const saveBalances = async () => {
    setIngesting(true)
    let ok = 0
    for (const p of createdPeople) {
      const raw = balanceAmounts[p.id]?.trim() ?? ''
      if (!raw) continue
      const n = parseFloat(raw.replace(/,/g, ''))
      if (Number.isNaN(n) || Math.abs(n) < 0.0001) continue
      const onlySupplier =
        p.roles.includes('supplier') && !p.roles.includes('customer')
      const amount = onlySupplier ? -Math.abs(n) : n
      try {
        await adjustBalance({
          person_id: p.id,
          amount,
          note: IMPORT_OPENING_BALANCE_NOTE,
        })
        ok += 1
      } catch (e) {
        console.error(e)
      }
    }
    setIngesting(false)
    onComplete()
    if (ok) toast.success(t('people.importPaste.toastBalances', { count: ok }))
    setStep('done')
  }

  const reviewing = reviewIndex != null ? plans[reviewIndex] : null
  const merging = mergeIndex != null ? plans[mergeIndex] : null
  const mergeMath =
    merging?.match && merging.draft.initial_balance != null
      ? proposedMergeBalance(
          merging.match.person.balance,
          merging.draft.initial_balance,
          merging.draft.roles,
          merging.sellerMeansPayable
        )
      : merging?.match
        ? { final: merging.match.person.balance, delta: 0 }
        : null

  const stepIndex = STEP_ORDER.indexOf(step)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset()
          onOpenChange(o)
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('people.importPaste.title')}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {t('people.importPaste.stepProgress', {
                current: stepIndex + 1,
                total: STEP_ORDER.length,
              })}
            </p>
          </DialogHeader>

          {step === 'welcome' && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{t('people.importPaste.welcomeBody')}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HelpTip text={t('people.importPaste.welcomeTip')} />
                {t('people.importPaste.welcomeTip')}
              </div>
              <Button type="button" variant="outline" onClick={() => setWhatToCopyOpen(true)}>
                {t('people.importPaste.whatToCopy')}
              </Button>
            </div>
          )}

          {step === 'paste' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm">{t('people.importPaste.pasteHint')}</p>
                <HelpTip text={t('people.importPaste.pasteTip')} />
              </div>
              <Textarea
                className="min-h-[180px] font-mono text-xs"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t('people.importPaste.pastePlaceholder')}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                />
                {t('people.importPaste.hasHeader')}
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText()
                      setPasteText(text)
                    } catch {
                      toast.error(t('people.importPaste.clipboardDenied'))
                    }
                  }}
                >
                  <ClipboardPaste className="size-4" />
                  {t('people.importPaste.pasteClipboard')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPasteText('')}>
                  {t('people.importPaste.clear')}
                </Button>
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const text = await file.text()
                      setPasteText(text)
                      e.target.value = ''
                    }}
                  />
                  <span className={cn(buttonVariants({ variant: 'outline' }))}>
                    {t('people.importPaste.uploadCsv')}
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-3">
              <p className="rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm">
                {t('people.importPaste.unmappedOk')}
              </p>
              {PASTE_FIELDS_ORDERED.map((f) => (
                <div key={f} className="grid gap-1 sm:grid-cols-[11rem_1fr]">
                  <Label className="flex items-center gap-1 pt-2">
                    {t(fieldLabelKey(f))}
                    {f === 'name' ? ' *' : ''}
                    <HelpTip text={t(`people.importPaste.tip.${f}`)} />
                  </Label>
                  <div>
                    <Select
                      value={mapping[f] ?? NONE}
                      onValueChange={(v) =>
                        setMapping((prev) => ({ ...prev, [f]: v === NONE ? null : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('people.importCsv.notImported')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('people.importCsv.notImported')}</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping[f] && rawRows[0]?.[mapping[f]!] ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('people.importCsv.sample', { value: rawRows[0][mapping[f]!] })}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HelpTip text={t('people.importPaste.previewTip')} />
                {t('people.importPaste.previewHint', { count: drafts.filter((d) => !d.discarded).length })}
              </div>
              <div className="max-h-[50vh] overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-1 text-start">{t('people.externalCode')}</th>
                      <th className="px-2 py-1 text-start">{t('people.name')}</th>
                      <th className="px-2 py-1 text-start">{t('people.phone')}</th>
                      <th className="px-2 py-1 text-start">{t('people.roles')}</th>
                      <th className="px-2 py-1">{t('people.importCsv.discard')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((d, i) => (
                      <tr key={d.rowId} className={cn(d.discarded && 'opacity-40')}>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.external_code}
                            onChange={(e) => {
                              const external_code = e.target.value
                              setDrafts((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, external_code } : x))
                              )
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.name}
                            onChange={(e) => {
                              const name = e.target.value
                              setDrafts((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, name } : x))
                              )
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.phone}
                            onChange={(e) => {
                              const phone = e.target.value
                              setDrafts((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, phone } : x))
                              )
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={
                              d.roles.includes('customer') && d.roles.includes('supplier')
                                ? 'both'
                                : d.roles.includes('supplier')
                                  ? 'supplier'
                                  : 'customer'
                            }
                            onValueChange={(v) => {
                              const roles: PersonRole[] =
                                v === 'both'
                                  ? ['customer', 'supplier']
                                  : v === 'supplier'
                                    ? ['supplier']
                                    : ['customer']
                              setDrafts((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, roles } : x))
                              )
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">{t('people.customer')}</SelectItem>
                              <SelectItem value="supplier">{t('people.supplier')}</SelectItem>
                              <SelectItem value="both">
                                {t('people.customer')} · {t('people.supplier')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1 text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDrafts((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, discarded: !x.discarded } : x
                                )
                              )
                            }
                          >
                            {d.discarded
                              ? t('people.importCsv.discarded')
                              : t('people.importCsv.discard')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'conflicts' && (
            <div className="space-y-3">
              <p className="text-sm">{t('people.importPaste.conflictsHint')}</p>
              <div className="max-h-[50vh] space-y-2 overflow-auto">
                {plans.map((p, i) => {
                  if (p.draft.discarded) return null
                  const status = p.match
                    ? t('people.importPaste.alreadyOnSystem')
                    : p.fileDup
                      ? t('people.importPaste.fileDuplicate')
                      : t('people.importPaste.newRow')
                  return (
                    <div
                      key={p.draft.rowId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{p.draft.name || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {status}
                          {p.match ? ` · ${p.match.person.name}` : ''}
                          {p.match
                            ? ` · ${p.match.reasons.map((r) => t(`people.importPaste.reason.${r}`)).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t(`people.importPaste.action.${p.action}`)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewIndex(i)}
                        >
                          {t('people.importPaste.review')}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'balances' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <p>{t('people.importPaste.balancesHint')}</p>
                <HelpTip text={t('people.importPaste.balancesTip')} />
              </div>
              {createdPeople.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('people.importPaste.noNewForBalances')}
                </p>
              ) : (
                <div className="max-h-[45vh] space-y-2 overflow-auto">
                  {createdPeople.map((p) => (
                    <div key={p.id} className="grid grid-cols-[1fr_8rem] items-center gap-2">
                      <div className="text-sm">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.external_code ?? '—'} · {rolesLabel(p.roles, t)}
                        </p>
                      </div>
                      <Input
                        className="h-8 text-sm"
                        inputMode="decimal"
                        value={balanceAmounts[p.id] ?? ''}
                        onChange={(e) =>
                          setBalanceAmounts((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3 text-sm">
              <p>{t('people.importPaste.doneBody')}</p>
              <p className="text-muted-foreground">
                {t('people.importPaste.toastApplied', counts)}
              </p>
            </div>
          )}

          {ingesting && (
            <p className="text-sm text-muted-foreground">
              {t('people.importCsv.ingesting', progress)}
            </p>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {step === 'welcome' && (
              <Button onClick={() => setStep('paste')}>{t('people.importPaste.start')}</Button>
            )}
            {step === 'paste' && (
              <>
                <Button variant="ghost" onClick={() => setStep('welcome')}>
                  {t('common.back')}
                </Button>
                <Button onClick={goMap} disabled={!pasteText.trim()}>
                  {t('common.next')}
                </Button>
              </>
            )}
            {step === 'map' && (
              <>
                <Button variant="ghost" onClick={() => setStep('paste')}>
                  {t('common.back')}
                </Button>
                <Button onClick={goPreview}>{t('common.next')}</Button>
              </>
            )}
            {step === 'preview' && (
              <>
                <Button variant="ghost" onClick={() => setStep('map')}>
                  {t('common.back')}
                </Button>
                <Button onClick={goConflicts}>{t('common.next')}</Button>
              </>
            )}
            {step === 'conflicts' && (
              <>
                <Button variant="ghost" onClick={() => setStep('preview')}>
                  {t('common.back')}
                </Button>
                <Button onClick={() => setApplyOpen(true)} disabled={ingesting}>
                  {t('people.importPaste.apply')}
                </Button>
              </>
            )}
            {step === 'balances' && (
              <>
                <Button variant="ghost" onClick={() => setStep('done')} disabled={ingesting}>
                  {t('people.importPaste.skipBalances')}
                </Button>
                <Button onClick={() => void saveBalances()} disabled={ingesting}>
                  {ingesting ? <Loader2 className="size-4 animate-spin" /> : t('people.importPaste.setBalances')}
                </Button>
              </>
            )}
            {step === 'done' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    reset()
                    setStep('paste')
                  }}
                >
                  {t('people.importPaste.importMore')}
                </Button>
                {onGoNextMigration ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onOpenChange(false)
                      reset()
                      onGoNextMigration()
                    }}
                  >
                    {t('people.importPaste.nextMigration')}
                  </Button>
                ) : null}
                <Button
                  onClick={() => {
                    onOpenChange(false)
                    reset()
                  }}
                >
                  {t('people.importPaste.goToPeople')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={whatToCopyOpen} onOpenChange={setWhatToCopyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('people.importPaste.whatToCopy')}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {t('people.importPaste.whatToCopyBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>{t('common.close')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={reviewIndex != null}
        onOpenChange={(o) => !o && setReviewIndex(null)}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('people.importPaste.reviewTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-foreground">
                {reviewing ? (
                  <>
                    <p className="text-muted-foreground">
                      {reviewing.match
                        ? t('people.importPaste.matchedBecause', {
                            reason: reviewing.match.reasons
                              .map((r) => t(`people.importPaste.reason.${r}`))
                              .join(', '),
                          })
                        : reviewing.fileDup
                          ? t('people.importPaste.fileDuplicate')
                          : t('people.importPaste.newRow')}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border p-2">
                        <p className="mb-1 font-semibold">
                          {t('people.importPaste.existingCol')}
                        </p>
                        {reviewing.match ? (
                          <>
                            <p>{reviewing.match.person.external_code ?? '—'}</p>
                            <p>{reviewing.match.person.name}</p>
                            <p>{reviewing.match.person.phone ?? '—'}</p>
                            <p>{rolesLabel(reviewing.match.person.roles, t)}</p>
                            <p className="tabular-nums">{fc(reviewing.match.person.balance)}</p>
                          </>
                        ) : (
                          <p>—</p>
                        )}
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="mb-1 font-semibold">{t('people.importPaste.incomingCol')}</p>
                        <p>{reviewing.draft.external_code || '—'}</p>
                        <p>{reviewing.draft.name}</p>
                        <p>{reviewing.draft.phone || '—'}</p>
                        <p>{rolesLabel(reviewing.draft.roles, t)}</p>
                        <p className="tabular-nums">
                          {reviewing.draft.initial_balance != null
                            ? fc(reviewing.draft.initial_balance)
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={reviewing.overwriteFilled}
                        onChange={(e) => {
                          const checked = e.target.checked
                          const idx = reviewIndex
                          if (idx == null) return
                          setPlans((prev) =>
                            prev.map((x, j) =>
                              j === idx ? { ...x, overwriteFilled: checked } : x
                            )
                          )
                        }}
                      />
                      {t('people.importPaste.overwriteFilled')}
                    </label>
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap">
            <AlertDialogCancel>{t('common.close')}</AlertDialogCancel>
            {(['skip', 'update', 'merge', 'separate'] as const).map((a) => (
              <Button
                key={a}
                type="button"
                size="sm"
                variant={a === 'merge' ? 'default' : 'outline'}
                disabled={
                  (a === 'update' || a === 'merge') && !reviewing?.match
                }
                title={t(`people.importPaste.actionHint.${a}`)}
                onClick={() => {
                  const idx = reviewIndex
                  if (idx == null) return
                  if (a === 'merge') {
                    setPlans((prev) =>
                      prev.map((x, j) => (j === idx ? { ...x, action: a } : x))
                    )
                    setReviewIndex(null)
                    setMergeIndex(idx)
                    return
                  }
                  setPlans((prev) =>
                    prev.map((x, j) => (j === idx ? { ...x, action: a } : x))
                  )
                  setReviewIndex(null)
                }}
              >
                {t(`people.importPaste.action.${a}`)}
              </Button>
            ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={mergeIndex != null} onOpenChange={(o) => !o && setMergeIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('people.importPaste.mergeTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-foreground">
                {merging && mergeMath ? (
                  <>
                    <p>{t('people.importPaste.mergeBody')}</p>
                    <ul className="list-disc ps-4">
                      <li>
                        {t('people.importPaste.mergeExisting', {
                          amount: fc(merging.match?.person.balance ?? 0),
                        })}
                      </li>
                      <li>
                        {t('people.importPaste.mergeIncoming', {
                          amount: fc(mergeMath.delta),
                        })}
                      </li>
                      <li className="font-semibold">
                        {t('people.importPaste.mergeFinal', {
                          amount: fc(mergeMath.final),
                        })}
                      </li>
                    </ul>
                    {merging.draft.initial_balance != null &&
                    merging.draft.roles.includes('supplier') &&
                    !merging.draft.roles.includes('customer') ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={merging.sellerMeansPayable}
                          onChange={(e) => {
                            const v = e.target.checked
                            const idx = mergeIndex
                            if (idx == null) return
                            setPlans((prev) =>
                              prev.map((x, j) =>
                                j === idx ? { ...x, sellerMeansPayable: v } : x
                              )
                            )
                          }}
                        />
                        {t('people.importPaste.sellerMeansPayable')}
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setMergeIndex(null)}>
              {t('people.importPaste.confirmMerge')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={applyOpen} onOpenChange={setApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('people.importPaste.applyTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('people.importPaste.applyBody', applyCounts)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ingesting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={ingesting}
              onClick={(e) => {
                e.preventDefault()
                void applyImport()
              }}
            >
              {ingesting ? <Loader2 className="size-4 animate-spin" /> : t('people.importPaste.apply')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
