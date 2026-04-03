import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Eye,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react'

import {
  getAllPeople,
  createPerson,
  DuplicatePhoneError,
  DUPLICATE_PHONE_ERROR,
  PHONE_REQUIRED_ERROR,
  updatePerson,
  deletePerson,
  countCustomerOrdersForPerson,
  countSupplierPOsForPerson,
  getPersonDeleteBlockMessage,
  getPersonById,
  roundMoney,
  supabaseErrorMessage,
} from '@/services/peopleService'
import type { Person, PersonRole } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { PersonProfileDialog } from '@/components/people/PersonProfileDialog'

const DEBOUNCE_MS = 300

type RoleFilter = 'all' | 'customers' | 'suppliers'
type BalanceFilter = 'all' | 'positive' | 'negative' | 'zero'
type DiscountFilter = 'all' | 'has'

const personFormObjectSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  roles: z.array(z.enum(['customer', 'supplier'])).min(1),
  discount_rate: z.coerce.number().min(0).max(100),
  use_credit_limit: z.boolean(),
  credit_limit: z.coerce.number().min(0).optional(),
})

type PersonFormValues = z.infer<typeof personFormObjectSchema>

function balanceClass(b: number) {
  if (Math.abs(b) <= 0.005) {
    return 'text-green-600 dark:text-green-400'
  }
  return 'text-red-600 dark:text-red-400'
}

export function People() {
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const personFromUrl = searchParams.get('person')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all')
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all')
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [profilePerson, setProfilePerson] = useState<Person | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)

  const canViewProfile = useFeatureEnabled('people.viewProfile')
  const canEditPerson = useFeatureEnabled('people.editPerson')
  const canDeletePerson = useFeatureEnabled('people.deletePerson')
  const canAddPerson = useFeatureEnabled('people.addPerson')

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
    let cancelled = false
    ;(async () => {
      try {
        const full = await getPersonById(personFromUrl)
        if (cancelled) return
        const { transactions: _tx, ...rest } = full
        setProfilePerson(rest)
      } catch {
        /* invalid id */
      } finally {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev)
              n.delete('person')
              return n
            },
            { replace: true }
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [personFromUrl, canViewProfile, setSearchParams])

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
        {canAddPerson && (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t('people.addPerson')}
          </Button>
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
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
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
                          'tabular-nums font-medium',
                          balanceClass(p.balance)
                        )}
                      >
                        {formatCurrencyDisplay(Math.abs(p.balance))}
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canViewProfile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('people.viewProfile')}
                            onClick={() => setProfilePerson(p)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
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

      <PersonFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditing(null)
        }}
        person={editing}
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

      <PersonProfileDialog
        person={profilePerson}
        onOpenChange={(open) => {
          if (!open) setProfilePerson(null)
        }}
        onEdit={(p) => {
          setProfilePerson(null)
          setEditing(p)
          setFormOpen(true)
        }}
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

function PersonFormDialog({
  open,
  onOpenChange,
  person,
  t,
  formatCurrency,
  onSaved,
  onError,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  person: Person | null
  t: (k: string, opts?: Record<string, string | number>) => string
  formatCurrency: (n: number) => string
  onSaved: () => void
  onError: (m?: string) => void
}) {
  const { data: linkedOrderCount = 0 } = useQuery({
    queryKey: ['personOrderCount', person?.id],
    queryFn: () => countCustomerOrdersForPerson(person!.id),
    enabled: open && !!person?.id && person.roles.includes('customer'),
  })

  const { data: linkedPOCount = 0 } = useQuery({
    queryKey: ['personPOCount', person?.id],
    queryFn: () => countSupplierPOsForPerson(person!.id),
    enabled: open && !!person?.id && person.roles.includes('supplier'),
  })

  const isEditRef = useRef(false)
  isEditRef.current = Boolean(person)

  const personFormValidationSchema = useMemo(
    () =>
      personFormObjectSchema.superRefine((val, ctx) => {
        if (val.use_credit_limit && val.credit_limit === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['credit_limit'],
            message: 'required',
          })
        }
        if (!isEditRef.current && !val.phone?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['phone'],
            message: 'required',
          })
        }
      }),
    []
  )

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(
      personFormValidationSchema
    ) as Resolver<PersonFormValues>,
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      notes: '',
      roles: ['customer'],
      discount_rate: 0,
      use_credit_limit: false,
      credit_limit: undefined,
    },
  })

  const rolesWatch = form.watch('roles')
  const hasCustomer = rolesWatch.includes('customer')

  useEffect(() => {
    if (!open) return
    if (person) {
      form.reset({
        name: person.name,
        phone: person.phone ?? '',
        address: person.address ?? '',
        notes: person.notes ?? '',
        roles: [...person.roles],
        discount_rate: person.discount_rate,
        use_credit_limit: person.credit_limit != null,
        credit_limit: person.credit_limit ?? undefined,
      })
    } else {
      form.reset({
        name: '',
        phone: '',
        address: '',
        notes: '',
        roles: ['customer'],
        discount_rate: 0,
        use_credit_limit: false,
        credit_limit: undefined,
      })
    }
  }, [open, person, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      const credit =
        values.use_credit_limit && values.credit_limit != null
          ? roundMoney(values.credit_limit)
          : null
      const discount = hasCustomer ? roundMoney(values.discount_rate) : 0
      const payload = {
        name: values.name.trim(),
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        notes: values.notes?.trim() || null,
        roles: values.roles as PersonRole[],
        discount_rate: discount,
        credit_limit: credit,
      }
      if (person) {
        await updatePerson(person.id, payload)
      } else {
        await createPerson(payload)
      }
      onSaved()
    } catch (e) {
      if (e instanceof DuplicatePhoneError) {
        const n = e.otherPersonName.trim()
        onError(
          n
            ? t('people.validationPhoneDuplicateNamed', { name: n })
            : t('people.validationPhoneDuplicate')
        )
        return
      }
      const msg = supabaseErrorMessage(e)
      if (msg === DUPLICATE_PHONE_ERROR) {
        onError(t('people.validationPhoneDuplicate'))
        return
      }
      if (msg === PHONE_REQUIRED_ERROR) {
        onError(t('people.validationPhoneRequired'))
        return
      }
      onError(msg || undefined)
    }
  })

  const showCustomerRoleWarning =
    !!person &&
    person.roles.includes('customer') &&
    !rolesWatch.includes('customer') &&
    linkedOrderCount > 0

  const showSupplierRoleWarning =
    !!person &&
    person.roles.includes('supplier') &&
    !rolesWatch.includes('supplier') &&
    linkedPOCount > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {person ? t('people.editPerson') : t('people.addPerson')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {person && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">
                {t('people.currentBalance')}:{' '}
              </span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(person.balance)}
              </span>
            </div>
          )}
          {!person && (
            <p className="text-sm text-muted-foreground">
              {t('people.formCreateRequiredHint')}
            </p>
          )}
          <div>
            <Label>
              {t('people.name')}
              {!person && (
                <span className="text-destructive" aria-hidden>
                  {' '}
                  *
                </span>
              )}
            </Label>
            <Input
              className="mt-1"
              {...form.register('name')}
              autoComplete="name"
              aria-required={!person}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">
                {t('people.validationNameMin')}
              </p>
            )}
          </div>
          <div>
            <Label>
              {t('people.phone')}
              {!person && (
                <span className="text-destructive" aria-hidden>
                  {' '}
                  *
                </span>
              )}
            </Label>
            <Input
              className="mt-1"
              {...form.register('phone')}
              type="tel"
              autoComplete="tel"
              aria-required={!person}
            />
            {form.formState.errors.phone && (
              <p className="text-sm text-destructive mt-1">
                {t('people.validationPhoneRequired')}
              </p>
            )}
          </div>
          <div>
            <Label>{t('people.address')}</Label>
            <Textarea className="mt-1" {...form.register('address')} />
          </div>
          <div>
            <Label htmlFor="person-form-notes">{t('people.notes')}</Label>
            <NoteMentionEditor
              id="person-form-notes"
              className="mt-1"
              value={form.watch('notes') ?? ''}
              onChange={(v) =>
                form.setValue('notes', v, { shouldDirty: true, shouldValidate: true })
              }
              rows={3}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('notes.mentionHint')}
            </p>
          </div>
          <div>
            <Label className="mb-2 block">{t('people.roles')}</Label>
            <div className="flex flex-wrap gap-4">
              {(['customer', 'supplier'] as const).map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rolesWatch.includes(role)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...rolesWatch, role]
                        : rolesWatch.filter((r) => r !== role)
                      form.setValue('roles', next, { shouldValidate: true })
                    }}
                  />
                  <span>
                    {role === 'customer'
                      ? t('people.customer')
                      : t('people.supplier')}
                  </span>
                </label>
              ))}
            </div>
            {form.formState.errors.roles && (
              <p className="text-sm text-destructive mt-1">
                {t('people.validationRoles')}
              </p>
            )}
          </div>
          {showCustomerRoleWarning && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {(t as (k: string, o: Record<string, number>) => string)(
                'people.roleRemovalWarning',
                { count: linkedOrderCount }
              )}
            </p>
          )}
          {showSupplierRoleWarning && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {(t as (k: string, o: Record<string, number>) => string)(
                'people.roleRemovalWarningSupplier',
                { count: linkedPOCount }
              )}
            </p>
          )}
          {hasCustomer && (
            <>
              <div>
                <Label>{t('people.discount')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="mt-1"
                  {...form.register('discount_rate')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('people.discountHelper')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use_credit"
                  checked={form.watch('use_credit_limit')}
                  onChange={(e) =>
                    form.setValue('use_credit_limit', e.target.checked)
                  }
                />
                <Label htmlFor="use_credit" className="cursor-pointer">
                  {t('people.creditLimitEnable')}
                </Label>
              </div>
              {form.watch('use_credit_limit') && (
                <div>
                  <Label>{t('people.creditLimit')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1"
                    {...form.register('credit_limit')}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('people.creditLimitHelper')}
                  </p>
                </div>
              )}
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
