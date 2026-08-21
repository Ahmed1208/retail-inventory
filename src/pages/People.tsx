import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, FileDown, FileUp, Loader2, Pencil, RefreshCw, Trash2, Users } from 'lucide-react'

import {
  getAllPeople,
  deletePerson,
  getPersonDeleteBlockMessage,
} from '@/services/peopleService'
import { listStockAlerts } from '@/services/stockAlertsService'
import { recalculateAllWalletsFromLedger } from '@/services/walletReconcileService'
import type { Person, PersonRole } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useMigrationImportDialog } from '@/hooks/useMigrationImportDialog'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { PersonFormDialog } from '@/components/people/PersonFormDialog'
import { PersonCsvImportDialog } from '@/components/people/PersonCsvImportDialog'
import { PersonPasteImportDialog } from '@/components/people/PersonPasteImportDialog'
import { downloadCsv } from '@/utils/csvDownload'

const DEBOUNCE_MS = 300

type RoleFilter = 'all' | 'customers' | 'suppliers'
type BalanceFilter = 'all' | 'positive' | 'negative' | 'zero'
type DiscountFilter = 'all' | 'has'

function balanceClass(b: number) {
  if (Math.abs(b) <= 0.005) {
    return 'text-muted-foreground'
  }
  if (b < -0.005) {
    return 'text-red-600 dark:text-red-400'
  }
  return 'text-green-600 dark:text-green-400'
}

export function People() {
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const { isAdmin } = useAuth()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const personFromUrl = searchParams.get('person')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all')
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all')
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  const [formOpen, setFormOpen] = useState(false)
  const [importCsvOpen, setImportCsvOpen] = useState(false)
  const [importPasteOpen, setImportPasteOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)

  const canViewProfile = useFeatureEnabled('people.viewProfile')
  const canEditPerson = useFeatureEnabled('people.editPerson')
  const canDeletePerson = useFeatureEnabled('people.deletePerson')
  const canAddPerson = useFeatureEnabled('people.addPerson')

  useMigrationImportDialog(setImportPasteOpen, true, canAddPerson)

  useEffect(() => {
    document.title = 'People | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  useEffect(() => {
    if (!personFromUrl) return
    if (!canViewProfile) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          n.delete('person')
          return n
        },
        { replace: true }
      )
      return
    }
    navigate(`/people/${personFromUrl}`, { replace: true })
  }, [personFromUrl, canViewProfile, navigate, setSearchParams])

  const roleParam: PersonRole | undefined =
    roleFilter === 'customers'
      ? 'customer'
      : roleFilter === 'suppliers'
        ? 'supplier'
        : undefined

  const { data: rawPeople = [], isLoading } = useQuery({
    queryKey: ['people', debouncedSearch, roleParam],
    queryFn: () =>
      getAllPeople({
        search: debouncedSearch.trim() || undefined,
        role: roleParam,
        minDiscount: discountFilter === 'has' ? 0.01 : undefined,
      }),
  })

  const { data: alertsForDirection = [] } = useQuery({
    queryKey: ['stockAlerts', 'list', isAdmin],
    queryFn: () => listStockAlerts(120, { viewerIsAdmin: isAdmin }),
    staleTime: 20_000,
  })

  const walletDirectionUnreadByPerson = useMemo(() => {
    const s = new Set<string>()
    for (const a of alertsForDirection) {
      if (a.alert_type !== 'wallet_direction_changed') continue
      if (a.read_at != null) continue
      const pid = a.meta?.person_id
      if (typeof pid === 'string' && pid.length > 0) s.add(pid)
    }
    return s
  }, [alertsForDirection])

  const reconcileWalletsMut = useMutation({
    mutationFn: () => recalculateAllWalletsFromLedger(),
    onSuccess: (n) => {
      toast.success(t('people.reconcileWalletsSuccess', { count: n }))
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ['stockAlerts'] })
    },
    onError: () => toast.error(t('people.reconcileWalletsError')),
  })

  const people = useMemo(() => {
    let list = rawPeople
    if (balanceFilter === 'positive') {
      list = list.filter((p) => p.balance > 0.005)
    } else if (balanceFilter === 'negative') {
      list = list.filter((p) => p.balance < -0.005)
    } else if (balanceFilter === 'zero') {
      list = list.filter((p) => Math.abs(p.balance) <= 0.005)
    }
    return list
  }, [rawPeople, balanceFilter])

  const formatCurrencyDisplay = (n: number) => formatCurrency(n, lang)
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['people'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
  }

  const exportPeopleCsv = () => {
    const rows = people.map((p) => ({
      name: p.name,
      phone: p.phone ?? '',
      external_code: p.external_code ?? '',
      roles: p.roles.join(','),
      address: p.address ?? '',
      notes: p.notes ?? '',
      discount_rate: p.discount_rate,
      credit_limit: p.credit_limit ?? '',
      initial_balance: p.balance,
    }))
    downloadCsv(
      `people-export-${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    )
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('people.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div
          className="inline-flex flex-wrap rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5"
          role="tablist"
        >
          {(
            [
              ['all', 'people.filterRoleAll'],
              ['customers', 'people.filterRoleCustomers'],
              ['suppliers', 'people.filterRoleSuppliers'],
            ] as const
          ).map(([value, key]) => (
            <button
              key={value}
              type="button"
              role="tab"
              onClick={() => setRoleFilter(value as RoleFilter)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                roleFilter === value
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <Select
          value={balanceFilter}
          onValueChange={(v) => setBalanceFilter(v as BalanceFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('people.filterBalanceAll')}</SelectItem>
            <SelectItem value="positive">
              {t('people.filterBalancePositive')}
            </SelectItem>
            <SelectItem value="negative">
              {t('people.filterBalanceNegative')}
            </SelectItem>
            <SelectItem value="zero">{t('people.filterBalanceZero')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={discountFilter}
          onValueChange={(v) => setDiscountFilter(v as DiscountFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('people.filterDiscountAll')}</SelectItem>
            <SelectItem value="has">{t('people.filterDiscountHas')}</SelectItem>
          </SelectContent>
        </Select>
        {people.length > 0 && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            title={t('people.exportCsvHint')}
            onClick={exportPeopleCsv}
          >
            <FileDown className="h-4 w-4 shrink-0" aria-hidden />
            {t('common.exportCsv')}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          title={t('people.reconcileWalletsHint')}
          disabled={reconcileWalletsMut.isPending}
          onClick={() => reconcileWalletsMut.mutate()}
        >
          {reconcileWalletsMut.isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {t('people.reconcileWallets')}
        </Button>
        {canAddPerson && (
          <>
            <Button
              className="gap-2"
              variant="secondary"
              onClick={() => setImportPasteOpen(true)}
            >
              <FileUp className="h-4 w-4 shrink-0" />
              {t('people.importPaste.button')}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setImportCsvOpen(true)}
            >
              {t('people.importCsv.button')}
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              {t('people.addPerson')}
            </Button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} columns={8} />
          </div>
        ) : people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('people.emptyPeople')}</p>
            {canAddPerson && (
              <Button className="mt-4" onClick={() => setImportPasteOpen(true)}>
                {t('people.importPaste.emptyCta')}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('people.name')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('people.externalCode')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('people.phone')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('people.roles')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {t('people.balance')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {t('people.discount')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('people.creditLimit')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('people.lastUpdated')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr
                    key={p.id}
                    tabIndex={canViewProfile ? 0 : undefined}
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/30',
                      canViewProfile && 'cursor-pointer'
                    )}
                    aria-label={
                      canViewProfile
                        ? `${t('people.viewProfile')}: ${p.name}`
                        : undefined
                    }
                    onClick={() => {
                      if (canViewProfile) navigate(`/people/${p.id}`)
                    }}
                    onKeyDown={(e) => {
                      if (!canViewProfile) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/people/${p.id}`)
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {p.external_code ?? t('people.emDash')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.phone ?? t('people.emDash')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.roles.includes('customer') && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {t('people.customer')}
                          </span>
                        )}
                        {p.roles.includes('supplier') && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            {t('people.supplier')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div
                        className={cn(
                          'inline-flex items-center justify-end gap-1 tabular-nums font-medium',
                          balanceClass(p.balance)
                        )}
                      >
                        {walletDirectionUnreadByPerson.has(p.id) && (
                          <span
                            className="inline-flex shrink-0 text-amber-600"
                            title={t('people.balanceDirectionWarning')}
                          >
                            <AlertTriangle className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                        {formatCurrencyDisplay(p.balance)}
                      </div>
                      <div className="mt-0.5 max-w-[220px] text-[10px] leading-snug text-muted-foreground ms-auto">
                        {p.balance > 0.005
                          ? (t as (k: string, o: Record<string, string>) => string)(
                              'people.balanceExplanationPositive',
                              {
                                name: p.name,
                                amount: formatCurrencyDisplay(p.balance),
                              }
                            )
                          : p.balance < -0.005
                            ? (t as (k: string, o: Record<string, string>) => string)(
                                'people.balanceExplanationNegative',
                                {
                                  name: p.name,
                                  amount: formatCurrencyDisplay(
                                    Math.abs(p.balance)
                                  ),
                                }
                              )
                            : t('people.balanceExplanationZero')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end text-muted-foreground tabular-nums">
                      {p.discount_rate > 0
                        ? `${p.discount_rate}%`
                        : t('people.emDash')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.credit_limit != null
                        ? formatCurrencyDisplay(p.credit_limit)
                        : t('people.noLimit')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(p.updated_at)}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        {canEditPerson && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('common.edit')}
                            onClick={() => {
                              setEditing(p)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeletePerson && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('common.delete')}
                            className="text-destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PersonPasteImportDialog
        open={importPasteOpen}
        onOpenChange={setImportPasteOpen}
        existingPeople={rawPeople}
        lang={lang}
        onComplete={() => {
          invalidate()
        }}
        onGoNextMigration={() => navigate('/warehouses')}
      />

      <PersonCsvImportDialog
        open={importCsvOpen}
        onOpenChange={setImportCsvOpen}
        existingPeople={rawPeople}
        isRTL={isRTL}
        onComplete={() => {
          invalidate()
        }}
      />

      <PersonFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditing(null)
        }}
        person={editing}
        existingPeople={rawPeople}
        t={t}
        formatCurrency={formatCurrencyDisplay}
        onSaved={() => {
          invalidate()
          toast.success(
            editing ? t('people.toastUpdated') : t('people.toastCreated')
          )
          setFormOpen(false)
          setEditing(null)
        }}
        onError={(m) => toast.error(m || t('people.toastError'))}
      />

      <DeletePersonDialog
        person={deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        t={t}
        formatCurrency={formatCurrencyDisplay}
        onDeleted={() => {
          invalidate()
          toast.success(t('people.toastDeleted'))
          setDeleteTarget(null)
        }}
        onError={(m) => toast.error(m || t('people.toastError'))}
      />
    </div>
  )
}

function DeletePersonDialog({
  person,
  onOpenChange,
  t,
  formatCurrency,
  onDeleted,
  onError,
}: {
  person: Person | null
  onOpenChange: (o: boolean) => void
  t: (k: string, opts?: Record<string, string | number>) => string
  formatCurrency: (n: number) => string
  onDeleted: () => void
  onError: (m?: string) => void
}) {
  const { data: blockMessage } = useQuery({
    queryKey: ['personDeleteCheck', person?.id],
    queryFn: () => getPersonDeleteBlockMessage(person!.id),
    enabled: !!person?.id,
  })

  const blocked = Boolean(blockMessage)
  const canDelete =
    person && !blocked && Math.abs(person.balance) <= 0.005

  return (
    <AlertDialog open={!!person} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('people.deletePerson')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-2">
              {person && blockMessage && (
                <p className="text-destructive">{blockMessage}</p>
              )}
              {person && !blockMessage && (
                <p>
                  {(t as (k: string, o: Record<string, string>) => string)(
                    'people.deleteConfirm',
                    { name: person.name }
                  )}
                </p>
              )}
              {person && Math.abs(person.balance) > 0.005 && (
                <p className="text-destructive">
                  {(t as (k: string, o: Record<string, string>) => string)(
                    'people.deleteBlockedBalance',
                    { amount: formatCurrency(person.balance) }
                  )}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete}
            onClick={async () => {
              if (!person) return
              try {
                await deletePerson(person.id)
                onDeleted()
              } catch (e) {
                onError(e instanceof Error ? e.message : undefined)
              }
            }}
            className="bg-destructive text-destructive-foreground"
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
