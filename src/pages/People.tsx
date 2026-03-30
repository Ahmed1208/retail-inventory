import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Eye,
  Pencil,
  Trash2,
  Wallet,
  Users,
} from 'lucide-react'

import {
  getAllPeople,
  createPerson,
  updatePerson,
  deletePerson,
  recordPayment,
  getPersonTransactions,
  countCustomerOrdersForPerson,
  countSupplierPOsForPerson,
  getPersonDeleteBlockMessage,
  roundMoney,
} from '@/services/peopleService'
import {
  getOrdersByPersonId,
} from '@/services/orderService'
import {
  getPurchaseOrdersByPersonId,
} from '@/services/purchaseOrderService'
import type {
  BalanceTransaction,
  BalanceTransactionType,
  Person,
  PersonRole,
} from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

const DEBOUNCE_MS = 300

type RoleFilter = 'all' | 'customers' | 'suppliers'
type BalanceFilter = 'all' | 'positive' | 'negative' | 'zero'
type DiscountFilter = 'all' | 'has'

const personFormSchema = z
  .object({
    name: z.string().min(2),
    phone: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    roles: z.array(z.enum(['customer', 'supplier'])).min(1),
    discount_rate: z.coerce.number().min(0).max(100),
    use_credit_limit: z.boolean(),
    credit_limit: z.coerce.number().min(0).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.use_credit_limit && val.credit_limit === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['credit_limit'],
        message: 'required',
      })
    }
  })

type PersonFormValues = z.infer<typeof personFormSchema>

function balanceClass(b: number) {
  if (b > 0.005) return 'text-green-600 dark:text-green-400'
  if (b < -0.005) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

function txTypeLabel(
  type: BalanceTransactionType,
  t: (k: string) => string
): string {
  const m: Record<BalanceTransactionType, string> = {
    order: 'people.txOrder',
    purchase_order: 'people.txPurchaseOrder',
    payment_in: 'people.txPaymentIn',
    payment_out: 'people.txPaymentOut',
    adjustment: 'people.txAdjustment',
  }
  return t(m[type])
}

function runningBalances(transactions: BalanceTransaction[]) {
  const asc = [...transactions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  let bal = 0
  const rows: Array<BalanceTransaction & { running: number }> = []
  for (const tx of asc) {
    bal = roundMoney(bal + tx.amount)
    rows.push({ ...tx, running: bal })
  }
  return rows.reverse()
}

export function People() {
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all')
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all')
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [paymentPerson, setPaymentPerson] = useState<Person | null>(null)
  const [profilePerson, setProfilePerson] = useState<Person | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)

  const canViewProfile = useFeatureEnabled('people.viewProfile')
  const canEditPerson = useFeatureEnabled('people.editPerson')
  const canDeletePerson = useFeatureEnabled('people.deletePerson')
  const canRecordPayment = useFeatureEnabled('people.recordPayment')
  const canAddPerson = useFeatureEnabled('people.addPerson')

  useEffect(() => {
    document.title = 'People | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

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
                    <td
                      className={cn(
                        'px-4 py-3 text-end tabular-nums font-medium',
                        balanceClass(p.balance)
                      )}
                    >
                      {formatCurrencyDisplay(p.balance)}
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
                        {canRecordPayment && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('people.recordPayment')}
                            onClick={() => setPaymentPerson(p)}
                          >
                            <Wallet className="h-4 w-4" />
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

      <RecordPaymentDialog
        person={paymentPerson}
        onOpenChange={(o) => !o && setPaymentPerson(null)}
        t={t}
        formatCurrency={formatCurrencyDisplay}
        onSaved={() => {
          invalidate()
          toast.success(t('people.toastPayment'))
          setPaymentPerson(null)
        }}
        onError={(m) => toast.error(m || t('people.toastError'))}
      />

      <PersonProfileDialog
        person={profilePerson}
        onOpenChange={(o) => !o && setProfilePerson(null)}
        t={t}
        formatCurrency={formatCurrencyDisplay}
        formatDate={formatDate}
        onEdit={(p) => {
          setProfilePerson(null)
          setEditing(p)
          setFormOpen(true)
        }}
        onPay={(p) => {
          setProfilePerson(null)
          setPaymentPerson(p)
        }}
        navigate={navigate}
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

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema) as Resolver<PersonFormValues>,
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
      onError(e instanceof Error ? e.message : undefined)
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
          <div>
            <Label>{t('people.name')}</Label>
            <Input className="mt-1" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">
                {t('people.validationNameMin')}
              </p>
            )}
          </div>
          <div>
            <Label>{t('people.phone')}</Label>
            <Input className="mt-1" {...form.register('phone')} />
          </div>
          <div>
            <Label>{t('people.address')}</Label>
            <Textarea className="mt-1" {...form.register('address')} />
          </div>
          <div>
            <Label>{t('people.notes')}</Label>
            <Textarea className="mt-1" {...form.register('notes')} />
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

function RecordPaymentDialog({
  person,
  onOpenChange,
  t,
  formatCurrency,
  onSaved,
  onError,
}: {
  person: Person | null
  onOpenChange: (o: boolean) => void
  t: (k: string, opts?: Record<string, string | number>) => string
  formatCurrency: (n: number) => string
  onSaved: () => void
  onError: (m?: string) => void
}) {
  const [type, setType] = useState<'payment_in' | 'payment_out'>('payment_in')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (person) {
      if (person.balance > 0.005) setType('payment_in')
      else if (person.balance < -0.005) setType('payment_out')
      else setType('payment_in')
      setAmount('')
      setNote('')
    }
  }, [person])

  const amtNum = parseFloat(amount)
  const validAmt = Number.isFinite(amtNum) && amtNum >= 0.01
  const delta =
    person && validAmt
      ? type === 'payment_in'
        ? roundMoney(-amtNum)
        : roundMoney(amtNum)
      : 0
  const preview =
    person && validAmt ? roundMoney(person.balance + delta) : person?.balance ?? 0

  const explanation = person
    ? person.balance > 0.005
      ? (t as (k: string, o: Record<string, string>) => string)(
          'people.balanceExplanationPositive',
          { name: person.name, amount: formatCurrency(person.balance) }
        )
      : person.balance < -0.005
        ? (t as (k: string, o: Record<string, string>) => string)(
            'people.balanceExplanationNegative',
            { name: person.name, amount: formatCurrency(-person.balance) }
          )
        : t('people.balanceExplanationZero')
    : ''

  const submit = async () => {
    if (!person || !validAmt) return
    try {
      await recordPayment({
        person_id: person.id,
        type,
        amount: amtNum,
        note: note.trim() || undefined,
      })
      onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : undefined)
    }
  }

  return (
    <Dialog open={!!person} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('people.recordPayment')}</DialogTitle>
        </DialogHeader>
        {person && (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{person.name}</p>
              <p className={cn('text-2xl font-bold tabular-nums', balanceClass(person.balance))}>
                {formatCurrency(person.balance)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{explanation}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('people.recordPayment')}</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pt"
                    checked={type === 'payment_in'}
                    onChange={() => setType('payment_in')}
                  />
                  {t('people.receivedPayment')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pt"
                    checked={type === 'payment_out'}
                    onChange={() => setType('payment_out')}
                  />
                  {t('people.madePayment')}
                </label>
              </div>
            </div>
            <div>
              <Label>{t('people.paymentAmount')}</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                className="mt-1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('people.paymentNote')}</Label>
              <Input
                className="mt-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {validAmt && (
              <p className="text-sm">
                <span className="text-muted-foreground">
                  {t('people.paymentPreview')}:{' '}
                </span>
                <span className={cn('font-semibold tabular-nums', balanceClass(preview))}>
                  {formatCurrency(preview)}
                </span>
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={submit} disabled={!validAmt}>
                {t('people.savePayment')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PersonProfileDialog({
  person,
  onOpenChange,
  t,
  formatCurrency,
  formatDate,
  onEdit,
  onPay,
  navigate,
}: {
  person: Person | null
  onOpenChange: (o: boolean) => void
  t: (k: string, opts?: Record<string, string | number>) => string
  formatCurrency: (n: number) => string
  formatDate: (iso: string) => string
  onEdit: (p: Person) => void
  onPay: (p: Person) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const [tab, setTab] = useState<
    'overview' | 'history' | 'orders' | 'pos'
  >('overview')
  const [txType, setTxType] = useState<BalanceTransactionType | 'all'>('all')
  const canEditPerson = useFeatureEnabled('people.editPerson')
  const canRecordPaymentFc = useFeatureEnabled('people.recordPayment')

  useEffect(() => {
    if (person) setTab('overview')
  }, [person])

  const pid = person?.id

  const { data: txs = [] } = useQuery({
    queryKey: ['personTxs', pid, txType],
    queryFn: () =>
      getPersonTransactions(pid!, {
        type: txType === 'all' ? undefined : txType,
      }),
    enabled: !!pid && !!person,
  })

  const { data: orders = [] } = useQuery({
    queryKey: ['personOrders', pid],
    queryFn: () => getOrdersByPersonId(pid!),
    enabled: Boolean(pid && person?.roles.includes('customer')),
  })

  const { data: pos = [] } = useQuery({
    queryKey: ['personPOs', pid],
    queryFn: () => getPurchaseOrdersByPersonId(pid!),
    enabled: Boolean(pid && person?.roles.includes('supplier')),
  })

  const running = useMemo(() => runningBalances(txs), [txs])

  const overview = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status_flow !== 'cancelled')
    const activePo = pos.filter((o) => o.status !== 'cancelled')
    return {
      orderCount: activeOrders.length,
      poCount: activePo.length,
      totalSpent: activeOrders.reduce((s, o) => s + o.total_amount, 0),
      totalBought: activePo.reduce((s, o) => s + o.total_amount, 0),
    }
  }, [orders, pos])

  const txSummary = useMemo(() => {
    let tin = 0
    let tout = 0
    for (const x of txs) {
      if (x.type === 'payment_in') tin += Math.abs(x.amount)
      if (x.type === 'payment_out') tout += Math.abs(x.amount)
    }
    return { tin, tout, net: tin - tout }
  }, [txs])

  if (!person) return null

  const explanation =
    person.balance > 0.005
      ? (t as (k: string, o: Record<string, string>) => string)(
          'people.balanceExplanationPositive',
          { name: person.name, amount: formatCurrency(person.balance) }
        )
      : person.balance < -0.005
        ? (t as (k: string, o: Record<string, string>) => string)(
            'people.balanceExplanationNegative',
            { name: person.name, amount: formatCurrency(-person.balance) }
          )
        : t('people.balanceExplanationZero')

  return (
    <Dialog open={!!person} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {person.name}
            {person.roles.includes('customer') && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {t('people.customer')}
              </span>
            )}
            {person.roles.includes('supplier') && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                {t('people.supplier')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{person.phone ?? '—'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {person.address ?? '—'}
              </p>
              <p className={cn('text-3xl font-bold tabular-nums mt-2', balanceClass(person.balance))}>
                {formatCurrency(person.balance)}
              </p>
              <p className="text-sm text-muted-foreground">{explanation}</p>
            </div>
            {(canEditPerson || canRecordPaymentFc) && (
              <div className="flex flex-wrap gap-2">
                {canEditPerson && (
                  <Button variant="outline" onClick={() => onEdit(person)}>
                    {t('people.editPerson')}
                  </Button>
                )}
                {canRecordPaymentFc && (
                  <Button onClick={() => onPay(person)}>
                    {t('people.recordPayment')}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {(
              [
                ['overview', 'people.profileOverview'],
                ['history', 'people.balanceHistory'],
                ...(person.roles.includes('customer')
                  ? ([['orders', 'people.profileOrders']] as const)
                  : []),
                ...(person.roles.includes('supplier')
                  ? ([['pos', 'people.profilePurchaseOrders']] as const)
                  : []),
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  tab === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground'
                )}
                onClick={() => setTab(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{t('people.totalOrders')}</p>
                  <p className="text-xl font-semibold">{overview.orderCount}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{t('people.totalPurchases')}</p>
                  <p className="text-xl font-semibold">{overview.poCount}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{t('people.totalSpent')}</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCurrency(overview.totalSpent)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{t('people.totalBought')}</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCurrency(overview.totalBought)}
                  </p>
                </div>
              </div>
              <div className="text-sm space-y-1">
                <p>
                  {t('people.discount')}:{' '}
                  {person.discount_rate > 0 ? `${person.discount_rate}%` : t('people.emDash')}
                </p>
                <p>
                  {t('people.creditLimit')}:{' '}
                  {person.credit_limit != null
                    ? formatCurrency(person.credit_limit)
                    : t('people.noLimit')}
                </p>
                {person.notes && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{person.notes}</p>
                )}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              <Select
                value={txType}
                onValueChange={(v) =>
                  setTxType(v === 'all' ? 'all' : (v as BalanceTransactionType))
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('people.filterTxAll')}</SelectItem>
                  <SelectItem value="order">{t('people.txOrder')}</SelectItem>
                  <SelectItem value="purchase_order">
                    {t('people.txPurchaseOrder')}
                  </SelectItem>
                  <SelectItem value="payment_in">{t('people.txPaymentIn')}</SelectItem>
                  <SelectItem value="payment_out">{t('people.txPaymentOut')}</SelectItem>
                  <SelectItem value="adjustment">{t('people.txAdjustment')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-3 py-2 text-start">{t('people.transactionDate')}</th>
                      <th className="px-3 py-2 text-start">{t('people.transactionType')}</th>
                      <th className="px-3 py-2 text-start">{t('people.reference')}</th>
                      <th className="px-3 py-2 text-end">{t('people.amount')}</th>
                      <th className="px-3 py-2 text-end">{t('people.runningBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {running.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                          {t('people.emptyTxHistory')}
                        </td>
                      </tr>
                    ) : (
                      running.map((row) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDate(row.created_at)}
                          </td>
                          <td className="px-3 py-2">{txTypeLabel(row.type, t)}</td>
                          <td className="px-3 py-2">
                            {row.reference_number ?? t('people.emDash')}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-end tabular-nums font-medium',
                              row.amount > 0 ? 'text-green-600' : row.amount < 0 ? 'text-red-600' : ''
                            )}
                          >
                            {row.amount > 0 ? '+' : ''}
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {formatCurrency(row.running)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  {t('people.summaryTotalIn')}: {formatCurrency(txSummary.tin)}
                </span>
                <span>
                  {t('people.summaryTotalOut')}: {formatCurrency(txSummary.tout)}
                </span>
                <span>
                  {t('people.summaryNet')}: {formatCurrency(txSummary.net)}
                </span>
              </div>
            </div>
          )}

          {tab === 'orders' && person.roles.includes('customer') && (
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">
                  {t('people.emptyOrdersForPerson')}
                </p>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-start">{t('orders.orderNumber')}</th>
                    <th className="px-3 py-2 text-start">{t('orders.status')}</th>
                    <th className="px-3 py-2 text-end">{t('orders.totalAmount')}</th>
                    <th className="px-3 py-2 text-start">{t('orders.date')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/50">
                      <td className="px-3 py-2">#{o.order_number}</td>
                      <td className="px-3 py-2">
                        {o.status_flow === 'draft' && t('orders.draft')}
                        {o.status_flow === 'confirmed' && t('orders.confirmed')}
                        {o.status_flow === 'completed' && t('orders.completed')}
                        {o.status_flow === 'cancelled' && t('orders.statusCancelled')}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {formatCurrency(o.total_amount)}
                      </td>
                      <td className="px-3 py-2">{formatDate(o.created_at)}</td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() =>
                            navigate(`/orders/${o.id}`)
                          }
                        >
                          {t('people.openOrder')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}

          {tab === 'pos' && person.roles.includes('supplier') && (
            <div className="overflow-x-auto">
              {pos.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">
                  {t('people.emptyPOsForPerson')}
                </p>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-start">{t('purchaseOrders.orderNumber')}</th>
                    <th className="px-3 py-2 text-start">{t('purchaseOrders.status')}</th>
                    <th className="px-3 py-2 text-end">{t('purchaseOrders.totalAmount')}</th>
                    <th className="px-3 py-2 text-start">{t('purchaseOrders.date')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-b border-border/50">
                      <td className="px-3 py-2">
                        #{t('purchaseOrders.poPrefix')}-{po.order_number}
                      </td>
                      <td className="px-3 py-2">{po.status}</td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {formatCurrency(po.total_amount)}
                      </td>
                      <td className="px-3 py-2">{formatDate(po.created_at)}</td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        >
                          {t('people.openPO')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}
        </div>
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
