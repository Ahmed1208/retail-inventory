import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ListOrdered, MinusCircle, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'

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
import { Textarea } from '@/components/ui/textarea'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { useLanguage } from '@/hooks/useLanguage'
import { NoteWithDocLinks } from '@/components/common/NoteWithDocLinks'
import {
  depositToRegister,
  getRegisterBalances,
  ledgerPaymentOperationRouteId,
  listRegisterActivity,
  type RegisterActivityRow,
  withdrawFromRegister,
} from '@/services/registerService'
import type { PaymentMethod } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { paymentLabel, PAYMENT_METHODS } from '@/components/orders/ordersShared'
import { cn } from '@/lib/utils'

function RegisterActivityLinks({ row }: { row: RegisterActivityRow }) {
  const { t } = useTranslation()
  const links: ReactNode[] = []

  if (row.type === 'payment_in' || row.type === 'payment_out') {
    const refNum = row.reference_number ?? ''
    const refId = row.reference_id
    if (refId && /^O-/i.test(refNum)) {
      links.push(
        <Link
          key="order"
          to={`/orders/${refId}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('register.activityLinkOrder', { ref: refNum })}
        </Link>
      )
    }
    if (refId && /^PO-/i.test(refNum)) {
      links.push(
        <Link
          key="po"
          to={`/purchase-orders/${refId}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('register.activityLinkPO', { ref: refNum })}
        </Link>
      )
    }
    const payId = ledgerPaymentOperationRouteId(row)
    links.push(
      <Link
        key="pay"
        to={`/payments/operations/${payId}`}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {t('register.activityLinkPayment')}
      </Link>
    )
  }

  if (row.type === 'register_deposit' || row.type === 'register_withdraw') {
    links.push(
      <Link
        key="reg"
        to={`/payments/operations/${row.id}`}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {t('register.activityLinkRegister')}
      </Link>
    )
  }

  if (links.length === 0) return null

  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">{links}</div>
  )
}

export function Register() {
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const navigate = useNavigate()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const qc = useQueryClient()
  const activityRef = useRef<HTMLDivElement>(null)

  const canPage = useFeatureEnabled('sidebar.register')
  const canDeposit = useFeatureEnabled('register.deposit')
  const canWithdraw = useFeatureEnabled('register.withdraw')

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    document.title = `${t('register.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const fc = (n: number) => formatCurrency(n, lang)

  const balancesQuery = useQuery({
    queryKey: ['registerBalances'],
    queryFn: getRegisterBalances,
    enabled: canPage,
  })

  const activityQuery = useQuery({
    queryKey: ['registerActivity'],
    queryFn: () => listRegisterActivity(100),
    enabled: canPage,
  })

  const resetForm = () => {
    setMethod('cash')
    setAmountStr('')
    setNote('')
  }

  const depositMut = useMutation({
    mutationFn: () =>
      depositToRegister({
        payment_method: method,
        amount: parseFloat(amountStr) || 0,
        note: note.trim() || undefined,
      }),
    onSuccess: (data) => {
      toast.success(t('register.toastDeposited'), {
        action: {
          label: t('register.viewPayment'),
          onClick: () => navigate(`/payments/operations/${data.id}`),
        },
      })
      qc.invalidateQueries({ queryKey: ['registerBalances'] })
      qc.invalidateQueries({ queryKey: ['registerActivity'] })
      qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: Error) => toast.error(e.message || t('register.toastError')),
  })

  const withdrawMut = useMutation({
    mutationFn: () =>
      withdrawFromRegister({
        payment_method: method,
        amount: parseFloat(amountStr) || 0,
        note: note.trim() || undefined,
      }),
    onSuccess: (data) => {
      toast.success(t('register.toastWithdrawn'), {
        action: {
          label: t('register.viewPayment'),
          onClick: () => navigate(`/payments/operations/${data.id}`),
        },
      })
      qc.invalidateQueries({ queryKey: ['registerBalances'] })
      qc.invalidateQueries({ queryKey: ['registerActivity'] })
      qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
      setWithdrawOpen(false)
      resetForm()
    },
    onError: (e: Error) => toast.error(e.message || t('register.toastError')),
  })

  const submitDeposit = () => {
    const a = parseFloat(amountStr)
    if (!a || a < 0.01) {
      toast.error(t('register.validationAmount'))
      return
    }
    depositMut.mutate()
  }

  const submitWithdraw = () => {
    const a = parseFloat(amountStr)
    if (!a || a < 0.01) {
      toast.error(t('register.validationAmount'))
      return
    }
    withdrawMut.mutate()
  }

  const openAdd = () => {
    resetForm()
    setAddOpen(true)
  }

  const openWithdraw = () => {
    resetForm()
    setWithdrawOpen(true)
  }

  const scrollToActivity = () => {
    activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!canPage) {
    return <Navigate to="/" replace />
  }

  const b = balancesQuery.data

  const typeLabel = (tp: string) => {
    if (tp === 'payment_in') return t('people.txPaymentIn')
    if (tp === 'payment_out') return t('people.txPaymentOut')
    if (tp === 'register_deposit') return t('people.txRegisterDeposit')
    if (tp === 'register_withdraw') return t('people.txRegisterWithdraw')
    return tp
  }

  return (
    <div className={cn('space-y-6', isRTL && 'rtl')} dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('register.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('register.subtitle')}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t('register.disclaimer')}</p>
      </div>

      {balancesQuery.isLoading ? (
        <LoadingSkeleton className="h-40" />
      ) : balancesQuery.isError ? (
        <p className="text-sm text-destructive">{t('register.loadError')}</p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('register.balancesTitle')}
          </h2>
          <ul className="mt-3 space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <li
                key={m}
                className="flex items-center justify-between gap-4 text-sm tabular-nums"
              >
                <span>{paymentLabel(m, t)}</span>
                <span className="font-semibold">{fc(b?.[m] ?? 0)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t pt-4 text-base font-semibold tabular-nums">
            <span>{t('register.totalInRegister')}</span>
            <span>{fc(b?.total ?? 0)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="gap-2"
          disabled={!canDeposit}
          onClick={openAdd}
        >
          <PlusCircle className="h-4 w-4" aria-hidden />
          {t('register.addToRegister')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={!canWithdraw}
          onClick={openWithdraw}
        >
          <MinusCircle className="h-4 w-4" aria-hidden />
          {t('register.withdrawFromRegister')}
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={scrollToActivity}>
          <ListOrdered className="h-4 w-4" aria-hidden />
          {t('register.viewActivity')}
        </Button>
      </div>

      <div ref={activityRef} id="register-activity" className="scroll-mt-4 space-y-3">
        <h2 className="text-lg font-semibold">{t('register.activityTitle')}</h2>
        {activityQuery.isLoading ? (
          <LoadingSkeleton className="h-32" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-start">{t('register.colWhen')}</th>
                  <th className="px-3 py-2 text-start">{t('register.colType')}</th>
                  <th className="px-3 py-2 text-start">{t('register.colMethod')}</th>
                  <th className="px-3 py-2 text-end">{t('register.colEffect')}</th>
                  <th className="px-3 py-2 text-start">{t('register.colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {(activityQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      {t('register.activityEmpty')}
                    </td>
                  </tr>
                ) : (
                  (activityQuery.data ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(row.created_at))}
                      </td>
                      <td className="px-3 py-2">{typeLabel(row.type)}</td>
                      <td className="px-3 py-2">
                        {row.payment_method
                          ? paymentLabel(row.payment_method, t)
                          : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-end font-medium tabular-nums',
                          row.registerEffect > 0 && 'text-green-700 dark:text-green-400',
                          row.registerEffect < 0 && 'text-destructive'
                        )}
                      >
                        {row.registerEffect > 0 ? '+' : ''}
                        {fc(row.registerEffect)}
                      </td>
                      <td className="max-w-[min(24rem,55vw)] min-w-[10rem] px-3 py-2 align-top text-muted-foreground">
                        <div className="space-y-1 whitespace-normal break-words">
                          {row.note ? (
                            <NoteWithDocLinks note={row.note} />
                          ) : null}
                          <RegisterActivityLinks row={row} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('register.addToRegister')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>{t('register.fieldMethod')}</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {paymentLabel(m, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-add-amt">{t('register.fieldAmount')}</Label>
              <Input
                id="reg-add-amt"
                type="number"
                min={0}
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-add-note">{t('register.fieldNoteOptional')}</Label>
              <Textarea
                id="reg-add-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={depositMut.isPending}
              onClick={submitDeposit}
            >
              {t('register.confirmAdd')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={withdrawOpen}
        onOpenChange={(o) => {
          setWithdrawOpen(o)
          if (!o) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('register.withdrawFromRegister')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t('register.withdrawAvailable', {
              amount: fc(b?.[method] ?? 0),
            })}
          </p>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>{t('register.fieldMethod')}</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {paymentLabel(m, t)} ({fc(b?.[m] ?? 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-wd-amt">{t('register.fieldAmount')}</Label>
              <Input
                id="reg-wd-amt"
                type="number"
                min={0}
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-wd-note">{t('register.fieldNoteOptional')}</Label>
              <Textarea
                id="reg-wd-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWithdrawOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={withdrawMut.isPending}
              onClick={submitWithdraw}
            >
              {t('register.confirmWithdraw')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
