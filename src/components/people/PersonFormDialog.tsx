import { useEffect, useMemo, useRef } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import {
  createPerson,
  countCustomerOrdersForPerson,
  countSupplierPOsForPerson,
  DuplicatePhoneError,
  DUPLICATE_PHONE_ERROR,
  PHONE_REQUIRED_ERROR,
  roundMoney,
  supabaseErrorMessage,
  updatePerson,
} from '@/services/peopleService'
import type { Person, PersonRole } from '@/types'
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

export type PersonFormDialogProps = {
  open: boolean
  onOpenChange: (o: boolean) => void
  person: Person | null
  t: (k: string, opts?: Record<string, string | number>) => string
  formatCurrency: (n: number) => string
  onSaved: () => void
  onError: (m?: string) => void
}

export function PersonFormDialog({
  open,
  onOpenChange,
  person,
  t,
  formatCurrency,
  onSaved,
  onError,
}: PersonFormDialogProps) {
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
      const notesText = values.notes?.trim() || ''
      if (person) {
        await updatePerson(person.id, payload)
        await createAdminMentionNotificationIfNeeded({
          noteText: notesText,
          title: t('notifications.mentionTitlePersonNote', {
            name: values.name.trim(),
          }),
          redirectBasePath: `/people/${person.id}`,
          sourceType: 'person_form_note',
          sourceEntityId: person.id,
        })
      } else {
        const created = await createPerson(payload)
        await createAdminMentionNotificationIfNeeded({
          noteText: notesText,
          title: t('notifications.mentionTitlePersonNote', {
            name: values.name.trim(),
          }),
          redirectBasePath: `/people/${created.id}`,
          sourceType: 'person_form_note',
          sourceEntityId: created.id,
        })
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
