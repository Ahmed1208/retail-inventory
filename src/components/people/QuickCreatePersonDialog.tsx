import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createPerson, roundMoney } from '@/services/peopleService'
import type { Person, PersonRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'
import { cn } from '@/lib/utils'

const quickCustomerSchema = z
  .object({
    name: z.string().min(2),
    phone: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
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

const quickSupplierSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type QuickCustomerValues = z.infer<typeof quickCustomerSchema>
type QuickSupplierValues = z.infer<typeof quickSupplierSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: PersonRole
  isRTL: boolean
  onSuccess: (person: Person) => void
}

export function QuickCreatePersonDialog({
  open,
  onOpenChange,
  role,
  isRTL,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const isCustomer = role === 'customer'

  const customerForm = useForm<QuickCustomerValues>({
    resolver: zodResolver(quickCustomerSchema) as Resolver<QuickCustomerValues>,
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      notes: '',
      discount_rate: 0,
      use_credit_limit: false,
      credit_limit: undefined,
    },
  })

  const supplierForm = useForm<QuickSupplierValues>({
    resolver: zodResolver(quickSupplierSchema) as Resolver<QuickSupplierValues>,
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (isCustomer) {
      customerForm.reset({
        name: '',
        phone: '',
        address: '',
        notes: '',
        discount_rate: 0,
        use_credit_limit: false,
        credit_limit: undefined,
      })
    } else {
      supplierForm.reset({
        name: '',
        phone: '',
        address: '',
        notes: '',
      })
    }
  }, [open, isCustomer, customerForm, supplierForm])

  const mut = useMutation({
    mutationFn: async (payload: {
      name: string
      phone: string | null
      address: string | null
      notes: string | null
      roles: PersonRole[]
      discount_rate: number
      credit_limit: number | null
    }) => createPerson(payload),
    onSuccess: async (person) => {
      await qc.invalidateQueries({ queryKey: ['people'] })
      toast.success(t('people.toastCreated'))
      onOpenChange(false)
      onSuccess(person)
    },
    onError: (e: Error) => {
      toast.error(e?.message || t('people.toastError'))
    },
  })

  const submitCustomer = customerForm.handleSubmit((values) => {
    const credit =
      values.use_credit_limit && values.credit_limit != null
        ? roundMoney(values.credit_limit)
        : null
    mut.mutate({
      name: values.name.trim(),
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
      roles: ['customer'],
      discount_rate: roundMoney(values.discount_rate),
      credit_limit: credit,
    })
  })

  const submitSupplier = supplierForm.handleSubmit((values) => {
    mut.mutate({
      name: values.name.trim(),
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
      roles: ['supplier'],
      discount_rate: 0,
      credit_limit: null,
    })
  })

  const titleKey =
    role === 'customer'
      ? 'orders.quickCreateCustomerTitle'
      : 'purchaseOrders.quickCreateSupplierTitle'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg',
          isRTL && 'rtl'
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
        </DialogHeader>
        {isCustomer ? (
          <form onSubmit={submitCustomer} className="space-y-4">
            <div>
              <Label>{t('people.name')}</Label>
              <Input className="mt-1" {...customerForm.register('name')} />
              {customerForm.formState.errors.name && (
                <p className="mt-1 text-sm text-destructive">
                  {t('people.validationNameMin')}
                </p>
              )}
            </div>
            <div>
              <Label>{t('people.phone')}</Label>
              <Input className="mt-1" {...customerForm.register('phone')} />
            </div>
            <div>
              <Label>{t('people.address')}</Label>
              <Textarea className="mt-1" {...customerForm.register('address')} />
            </div>
            <div>
              <Label htmlFor="quick-person-notes">{t('people.notes')}</Label>
              <NoteMentionEditor
                id="quick-person-notes"
                className="mt-1"
                value={customerForm.watch('notes') ?? ''}
                onChange={(v) =>
                  customerForm.setValue('notes', v, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                rows={3}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('notes.mentionHint')}
              </p>
            </div>
            <div>
              <Label>{t('people.discount')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                className="mt-1"
                {...customerForm.register('discount_rate')}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('people.discountHelper')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="quick_use_credit"
                checked={customerForm.watch('use_credit_limit')}
                onChange={(e) =>
                  customerForm.setValue('use_credit_limit', e.target.checked)
                }
              />
              <Label htmlFor="quick_use_credit" className="cursor-pointer">
                {t('people.creditLimitEnable')}
              </Label>
            </div>
            {customerForm.watch('use_credit_limit') && (
              <div>
                <Label>{t('people.creditLimit')}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1"
                  {...customerForm.register('credit_limit')}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={submitSupplier} className="space-y-4">
            <div>
              <Label>{t('people.name')}</Label>
              <Input className="mt-1" {...supplierForm.register('name')} />
              {supplierForm.formState.errors.name && (
                <p className="mt-1 text-sm text-destructive">
                  {t('people.validationNameMin')}
                </p>
              )}
            </div>
            <div>
              <Label>{t('people.phone')}</Label>
              <Input className="mt-1" {...supplierForm.register('phone')} />
            </div>
            <div>
              <Label>{t('people.address')}</Label>
              <Textarea className="mt-1" {...supplierForm.register('address')} />
            </div>
            <div>
              <Label htmlFor="quick-supplier-notes">{t('people.notes')}</Label>
              <NoteMentionEditor
                id="quick-supplier-notes"
                className="mt-1"
                value={supplierForm.watch('notes') ?? ''}
                onChange={(v) =>
                  supplierForm.setValue('notes', v, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                rows={3}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('notes.mentionHint')}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
