import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox'
import { recordPayment, roundMoney, supabaseErrorMessage } from '@/services/peopleService'
import { listWarehouses } from '@/services/warehouseService'
import type { PaymentMethod, Person } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'
import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import { Label } from '@/components/ui/label'
import { DialogFooter } from '@/components/ui/dialog'
import { PAYMENT_METHODS, paymentLabel } from '@/components/orders/ordersShared'
import { cn } from '@/lib/utils'

function balanceClass(b: number) {
  if (b > 0.005) return 'text-green-600 dark:text-green-400'
  if (b < -0.005) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

const emptyPayUse = (): Record<PaymentMethod, boolean> => ({
  cash: false,
  visa: false,
  cheque: false,
  instapay: false,
})

const emptyPayAmounts = (): Record<PaymentMethod, string> => ({
  cash: '',
  visa: '',
  cheque: '',
  instapay: '',
})

type Props = {
  person: Person
  formatCurrency: (n: number) => string
  onSuccess: () => void
  onError: (m?: string) => void
  showDialogFooter?: boolean
  onCancel?: () => void
}

export function RecordPaymentForm({
  person,
  formatCurrency,
  onSuccess,
  onError,
  showDialogFooter = true,
  onCancel,
}: Props) {
  const { t } = useTranslation()
  const [type, setType] = useState<'payment_in' | 'payment_out'>('payment_in')
  const [payUse, setPayUse] = useState(emptyPayUse)
  const [payAmounts, setPayAmounts] = useState(emptyPayAmounts)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [registerWarehouseId, setRegisterWarehouseId] = useState(1)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })

  const registerWarehouses = useMemo(
    () => warehouses.filter((w) => w.has_register),
    [warehouses]
  )

  useEffect(() => {
    if (person.balance > 0.005) setType('payment_in')
    else if (person.balance < -0.005) setType('payment_out')
    else setType('payment_in')
    setPayUse(emptyPayUse())
    setPayAmounts(emptyPayAmounts())
    setNote('')
    if (registerWarehouses.length > 0) {
      const d =
        registerWarehouses.find((w) => w.is_default) ?? registerWarehouses[0]
      setRegisterWarehouseId(d.id)
    }
  }, [person, registerWarehouses])

  useEffect(() => {
    if (registerWarehouses.length === 0) return
    if (!registerWarehouses.some((w) => w.id === registerWarehouseId)) {
      const d =
        registerWarehouses.find((w) => w.is_default) ?? registerWarehouses[0]
      setRegisterWarehouseId(d.id)
    }
  }, [registerWarehouses, registerWarehouseId])

  const paymentsPayload = useMemo(() => {
    const out: { payment_method: PaymentMethod; amount: number }[] = []
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = roundMoney(parseFloat(payAmounts[m]) || 0)
      if (v > 0.001) out.push({ payment_method: m, amount: v })
    }
    return out
  }, [payUse, payAmounts])

  const totalEntered = roundMoney(
    paymentsPayload.reduce((s, p) => s + p.amount, 0)
  )
  const validPayment = totalEntered >= 0.01

  const preview = validPayment
    ? type === 'payment_in'
      ? roundMoney(person.balance - totalEntered)
      : roundMoney(person.balance + totalEntered)
    : person.balance

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

  const submit = async () => {
    if (!validPayment) return
    setSubmitting(true)
    try {
      const noteText = note.trim()
      await recordPayment({
        person_id: person.id,
        type,
        payments: paymentsPayload,
        note: noteText || undefined,
        register_warehouse_id: registerWarehouseId,
      })
      await createAdminMentionNotificationIfNeeded({
        noteText,
        title: t('notifications.mentionTitleRecordPayment', {
          name: person.name,
        }),
        redirectBasePath: `/people/${person.id}`,
        sourceType: 'record_payment_note',
        sourceEntityId: person.id,
      })
      onSuccess()
    } catch (e) {
      onError(supabaseErrorMessage(e) || undefined)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold">{person.name}</p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums',
            balanceClass(person.balance)
          )}
        >
          {formatCurrency(person.balance)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>
      </div>
      <div className="space-y-2">
        <Label>{t('people.recordPayment')}</Label>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="pt"
              checked={type === 'payment_in'}
              onChange={() => setType('payment_in')}
            />
            {t('people.receivedPayment')}
          </label>
          <label className="flex cursor-pointer items-center gap-2">
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
      {registerWarehouses.length > 0 ? (
        <WarehouseCombobox
          id="record-payment-register-wh"
          label={t('payments.recordPaymentRegisterWarehouse')}
          warehouses={registerWarehouses}
          value={registerWarehouseId}
          onChange={setRegisterWarehouseId}
        />
      ) : (
        <p className="text-sm text-destructive">
          {t('payments.noRegisterWarehouseForPayments')}
        </p>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">
          {t('orders.paymentBreakdown')}
        </p>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <div key={m} className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={payUse[m]}
                onChange={(e) =>
                  setPayUse((p) => ({ ...p, [m]: e.target.checked }))
                }
                aria-label={paymentLabel(m, t)}
              />
              <span className="w-24 text-sm">{paymentLabel(m, t)}</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="max-w-[140px]"
                disabled={!payUse[m]}
                value={payAmounts[m]}
                onChange={(e) =>
                  setPayAmounts((p) => ({ ...p, [m]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('payments.splitHint')}
        </p>
      </div>
      <div>
        <Label htmlFor="record-payment-note">{t('people.paymentNote')}</Label>
        <NoteMentionEditor
          id="record-payment-note"
          className="mt-1"
          value={note}
          onChange={setNote}
          rows={2}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t('notes.mentionHint')}
        </p>
      </div>
      {validPayment && (
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t('people.paymentPreview')}:{' '}
          </span>
          <span
            className={cn('font-semibold tabular-nums', balanceClass(preview))}
          >
            {formatCurrency(preview)}
          </span>
          <span className="ms-2 text-muted-foreground tabular-nums">
            ({t('payments.totalTendered')}: {formatCurrency(totalEntered)})
          </span>
        </p>
      )}
      {showDialogFooter ? (
        <DialogFooter className="gap-2 sm:gap-0">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
          )}
          <Button
            type="button"
            onClick={submit}
            disabled={
              !validPayment || submitting || registerWarehouses.length === 0
            }
          >
            {t('people.savePayment')}
          </Button>
        </DialogFooter>
      ) : (
        <div className="flex flex-wrap gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
          )}
          <Button
            type="button"
            onClick={submit}
            disabled={
              !validPayment || submitting || registerWarehouses.length === 0
            }
          >
            {t('people.savePayment')}
          </Button>
        </div>
      )}
    </div>
  )
}
