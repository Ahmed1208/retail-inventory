import { useEffect, useMemo, useRef, useState } from 'react'
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
  DuplicateExternalCodeError,
  DUPLICATE_PHONE_ERROR,
  DUPLICATE_EXTERNAL_CODE_ERROR,
  PHONE_REQUIRED_ERROR,
  roundMoney,
  supabaseErrorMessage,
  updatePerson,
} from '@/services/peopleService'
import {
  fillEmptyProfilePatch,
  matchDraftToPeople,
  proposedMergeBalance,
  unionRoles,
  type PersonPasteDraft,
  type RowMatch,
} from '@/utils/personPasteImport'
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
  external_code: z.string().optional(),
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
  existingPeople?: Person[]
}

export function PersonFormDialog({
  open,
  onOpenChange,
  person,
  t,
  formatCurrency,
  onSaved,
  onError,
  existingPeople = [],
}: PersonFormDialogProps) {
  const [conflict, setConflict] = useState<RowMatch | null>(null)
  const [pendingCreate, setPendingCreate] = useState<
    Parameters<typeof createPerson>[0] | null
  >(null)
  const [overwriteFilled, setOverwriteFilled] = useState(false)
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false)

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
      external_code: '',
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
        external_code: person.external_code ?? '',
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
        external_code: '',
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
        external_code: values.external_code?.trim() || null,
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
        const draft: PersonPasteDraft = {
          rowId: 'form',
          external_code: payload.external_code ?? '',
          name: payload.name,
          phone: payload.phone ?? '',
          roles: payload.roles,
          rolesRaw: '',
          rolesUnrecognized: false,
          address: payload.address ?? '',
          notes: payload.notes ?? '',
          discount_rate: payload.discount_rate,
          credit_limit: payload.credit_limit,
          initial_balance: null,
          discarded: false,
        }
        const hit = matchDraftToPeople(draft, existingPeople)
        if (hit) {
          setPendingCreate(payload)
          setConflict(hit)
          setOverwriteFilled(false)
          setMergeConfirmOpen(false)
          return
        }
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
      if (e instanceof DuplicateExternalCodeError) {
        onError(
          e.otherPersonName.trim()
            ? t('people.validationExternalCodeDuplicateNamed', {
                name: e.otherPersonName.trim(),
              })
            : t('people.validationExternalCodeDuplicate')
        )
        return
      }
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
      if (msg === DUPLICATE_EXTERNAL_CODE_ERROR) {
        onError(t('people.validationExternalCodeDuplicate'))
        return
      }
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

  const pendingDraft: PersonPasteDraft | null = pendingCreate
    ? {
        rowId: 'form',
        external_code: pendingCreate.external_code ?? '',
        name: pendingCreate.name,
        phone: pendingCreate.phone ?? '',
        roles: pendingCreate.roles,
        rolesRaw: '',
        rolesUnrecognized: false,
        address: pendingCreate.address ?? '',
        notes: pendingCreate.notes ?? '',
        discount_rate: pendingCreate.discount_rate,
        credit_limit: pendingCreate.credit_limit,
        initial_balance: null,
        discarded: false,
      }
    : null

  const mergeMath = conflict
    ? proposedMergeBalance(conflict.person.balance, null, pendingCreate?.roles ?? [], true)
    : null

  const separateBlocked =
    !!conflict &&
    !!pendingCreate &&
    ((!!pendingCreate.phone &&
      !!conflict.person.phone &&
      pendingCreate.phone.trim().toLowerCase() ===
        conflict.person.phone.trim().toLowerCase()) ||
      (!!pendingCreate.external_code &&
        !!conflict.person.external_code &&
        pendingCreate.external_code.trim().toLowerCase() ===
          conflict.person.external_code.trim().toLowerCase()))

  return (
    <>
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
            <Label>{t('people.phone')}</Label>
            <Input
              className="mt-1"
              {...form.register('phone')}
              type="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <Label>{t('people.externalCode')}</Label>
            <Input
              className="mt-1"
              {...form.register('external_code')}
              autoComplete="off"
            />
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

    <AlertDialog
      open={!!conflict && !mergeConfirmOpen}
      onOpenChange={(o) => {
        if (!o) {
          setConflict(null)
          setPendingCreate(null)
          setMergeConfirmOpen(false)
        }
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('people.importPaste.reviewTitle')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-foreground">
              {conflict && pendingCreate ? (
                <>
                  <p className="text-muted-foreground">
                    {t('people.importPaste.matchedBecause', {
                      reason: conflict.reasons
                        .map((r) => t(`people.importPaste.reason.${r}`))
                        .join(', '),
                    })}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border p-2">
                      <p className="mb-1 font-semibold">
                        {t('people.importPaste.existingCol')}
                      </p>
                      <p>{conflict.person.external_code ?? '—'}</p>
                      <p>{conflict.person.name}</p>
                      <p>{conflict.person.phone ?? '—'}</p>
                      <p>
                        {conflict.person.roles
                          .map((r) =>
                            r === 'customer'
                              ? t('people.customer')
                              : t('people.supplier')
                          )
                          .join(' · ')}
                      </p>
                      <p className="tabular-nums">
                        {formatCurrency(conflict.person.balance)}
                      </p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="mb-1 font-semibold">
                        {t('people.importPaste.incomingCol')}
                      </p>
                      <p>{pendingCreate.external_code ?? '—'}</p>
                      <p>{pendingCreate.name}</p>
                      <p>{pendingCreate.phone ?? '—'}</p>
                      <p>
                        {pendingCreate.roles
                          .map((r) =>
                            r === 'customer'
                              ? t('people.customer')
                              : t('people.supplier')
                          )
                          .join(' · ')}
                      </p>
                      <p className="tabular-nums">{formatCurrency(0)}</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={overwriteFilled}
                      onChange={(e) => setOverwriteFilled(e.target.checked)}
                    />
                    {t('people.importPaste.overwriteFilled')}
                  </label>
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap">
          <AlertDialogCancel>{t('people.importPaste.action.skip')}</AlertDialogCancel>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title={t('people.importPaste.actionHint.update')}
            onClick={async () => {
              if (!conflict || !pendingDraft || !pendingCreate) return
              try {
                const patch = fillEmptyProfilePatch(
                  conflict.person,
                  pendingDraft,
                  overwriteFilled
                )
                patch.roles = pendingCreate.roles
                await updatePerson(conflict.person.id, patch)
                setConflict(null)
                setPendingCreate(null)
                onSaved()
              } catch (e) {
                onError(supabaseErrorMessage(e) || undefined)
              }
            }}
          >
            {t('people.importPaste.action.update')}
          </Button>
          <Button
            type="button"
            size="sm"
            title={t('people.importPaste.actionHint.merge')}
            onClick={() => setMergeConfirmOpen(true)}
          >
            {t('people.importPaste.action.merge')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title={t('people.importPaste.actionHint.separate')}
            disabled={separateBlocked}
            onClick={async () => {
              if (!pendingCreate) return
              if (separateBlocked) {
                onError(t('people.importPaste.separateBlocked'))
                return
              }
              try {
                await createPerson(pendingCreate)
                setConflict(null)
                setPendingCreate(null)
                onSaved()
              } catch (e) {
                onError(supabaseErrorMessage(e) || undefined)
              }
            }}
          >
            {t('people.importPaste.action.separate')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={mergeConfirmOpen}
      onOpenChange={(o) => {
        if (!o) setMergeConfirmOpen(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('people.importPaste.mergeTitle')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-foreground">
              <p>{t('people.importPaste.mergeBody')}</p>
              {conflict && mergeMath ? (
                <ul className="list-disc ps-4">
                  <li>
                    {t('people.importPaste.mergeExisting', {
                      amount: formatCurrency(conflict.person.balance),
                    })}
                  </li>
                  <li>
                    {t('people.importPaste.mergeIncoming', {
                      amount: formatCurrency(mergeMath.delta),
                    })}
                  </li>
                  <li className="font-semibold">
                    {t('people.importPaste.mergeFinal', {
                      amount: formatCurrency(mergeMath.final),
                    })}
                  </li>
                </ul>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault()
              if (!conflict || !pendingCreate) return
              try {
                await updatePerson(conflict.person.id, {
                  roles: unionRoles(conflict.person.roles, pendingCreate.roles),
                  external_code:
                    conflict.person.external_code || pendingCreate.external_code,
                  phone: conflict.person.phone || pendingCreate.phone,
                })
                setMergeConfirmOpen(false)
                setConflict(null)
                setPendingCreate(null)
                onSaved()
              } catch (err) {
                onError(supabaseErrorMessage(err) || undefined)
              }
            }}
          >
            {t('people.importPaste.confirmMerge')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
