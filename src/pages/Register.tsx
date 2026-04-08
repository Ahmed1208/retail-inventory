import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ListOrdered, MinusCircle, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { useLanguage } from '@/hooks/useLanguage'
import { NoteWithDocLinks } from '@/components/common/NoteWithDocLinks'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'
import {
  depositToRegister,
  getRegisterBalances,
  ledgerPaymentOperationRouteId,
  listRegisterActivity,
  type RegisterActivityRow,
  withdrawAllFromRegister,
  withdrawFromRegister,
} from '@/services/registerService'
import {
  DEFAULT_WAREHOUSE_ID,
  listWarehouses,
  updateWarehouse,
} from '@/services/warehouseService'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const qc = useQueryClient()
  const activityRef = useRef<HTMLDivElement>(null)
  const withdrawAllFlowConsumed = useRef(false)

  const canPage = useFeatureEnabled('sidebar.register')
  const canDeposit = useFeatureEnabled('register.deposit')
  const canWithdraw = useFeatureEnabled('register.withdraw')
  const canViewActivity = useFeatureEnabled('register.viewActivity')

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [registerWarehouseId, setRegisterWarehouseId] = useState<number | null>(
    null
  )
  const [withdrawAllDialogOpen, setWithdrawAllDialogOpen] = useState(false)
  const [disableRegisterPromptOpen, setDisableRegisterPromptOpen] =
    useState(false)

  const { data: warehouses = [], isSuccess: warehousesReady } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
    enabled: canPage,
  })

  const registerWarehouses = useMemo(
    () => warehouses.filter((w) => w.has_register),
    [warehouses]
  )

  useEffect(() => {
    if (!warehousesReady || registerWarehouses.length === 0) return
    const qp = searchParams.get('registerWarehouseId')
    if (qp) {
      const n = Math.trunc(Number(qp))
      if (registerWarehouses.some((w) => w.id === n)) {
        setRegisterWarehouseId(n)
        return
      }
    }
    const d =
      registerWarehouses.find((w) => w.is_default && w.has_register) ??
      registerWarehouses[0]
    setRegisterWarehouseId(d.id)
  }, [warehousesReady, registerWarehouses, searchParams])

  const setRegisterSelection = (id: number) => {
    setRegisterWarehouseId(id)
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('registerWarehouseId', String(id))
        return n
      },
      { replace: true }
    )
  }

  useEffect(() => {
    document.title = `${t('register.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const fc = (n: number) => formatCurrency(n, lang)

  const balancesQuery = useQuery({
    queryKey: ['registerBalances', registerWarehouseId],
    queryFn: () => getRegisterBalances(registerWarehouseId!),
    enabled: canPage && registerWarehouseId != null,
  })

  const clearWithdrawQueryParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('withdrawAll')
        n.delete('disableRegisterAfter')
        return n
      },
      { replace: true }
    )
  }, [setSearchParams])

  useEffect(() => {
    if (searchParams.get('withdrawAll') !== '1') {
      withdrawAllFlowConsumed.current = false
      return
    }
    if (!canPage) return
    if (!warehousesReady || registerWarehouseId == null) return
    if (!balancesQuery.isSuccess) return
    if (withdrawAllFlowConsumed.current) return

    if (!canWithdraw) {
      withdrawAllFlowConsumed.current = true
      toast.error(t('register.withdrawAllDisabled'))
      clearWithdrawQueryParams()
      return
    }

    withdrawAllFlowConsumed.current = true
    const total = balancesQuery.data?.total ?? 0
    const wantsDisable = searchParams.get('disableRegisterAfter') === '1'
    const w = warehouses.find((x) => x.id === registerWarehouseId)
    const mayDisable =
      Boolean(w) && w!.id !== DEFAULT_WAREHOUSE_ID && !w!.is_default

    if (total < 0.01) {
      clearWithdrawQueryParams()
      if (wantsDisable) {
        if (mayDisable) setDisableRegisterPromptOpen(true)
        else toast.message(t('register.disableRegisterNotAllowed'))
      }
      return
    }

    setWithdrawAllDialogOpen(true)
  }, [
    searchParams,
    canPage,
    canWithdraw,
    warehousesReady,
    registerWarehouseId,
    balancesQuery.isSuccess,
    balancesQuery.data?.total,
    warehouses,
    clearWithdrawQueryParams,
    t,
  ])

  const activityQuery = useQuery({
    queryKey: ['registerActivity', registerWarehouseId],
    queryFn: () => listRegisterActivity(registerWarehouseId!, 100),
    enabled: canPage && canViewActivity && registerWarehouseId != null,
  })

  const resetForm = () => {
    setMethod('cash')
    setAmountStr('')
    setNote('')
  }

  const depositMut = useMutation({
    mutationFn: () =>
      depositToRegister({
        register_warehouse_id: registerWarehouseId!,
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
        register_warehouse_id: registerWarehouseId!,
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

  const withdrawAllMut = useMutation({
    mutationFn: async (opts: { wantsDisableAfter: boolean }) => {
      const res = await withdrawAllFromRegister({
        register_warehouse_id: registerWarehouseId!,
        note: t('register.withdrawAllLedgerNote'),
      })
      return { ...res, wantsDisableAfter: opts.wantsDisableAfter }
    },
    onSuccess: (data) => {
      setWithdrawAllDialogOpen(false)
      clearWithdrawQueryParams()
      toast.success(t('register.toastWithdrawAllDone'))
      qc.invalidateQueries({ queryKey: ['registerBalances'] })
      qc.invalidateQueries({ queryKey: ['registerActivity'] })
      qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
      const w = warehouses.find((x) => x.id === registerWarehouseId)
      if (
        data.wantsDisableAfter &&
        w &&
        w.id !== DEFAULT_WAREHOUSE_ID &&
        !w.is_default
      ) {
        setDisableRegisterPromptOpen(true)
      }
    },
    onError: (e: Error) => toast.error(e.message || t('register.toastError')),
  })

  const disableRegisterMut = useMutation({
    mutationFn: async () => {
      const wid = registerWarehouseId!
      const w = warehouses.find((x) => x.id === wid)
      if (!w) throw new Error(t('register.disableRegisterWarehouseMissing'))
      return updateWarehouse(wid, {
        name: w.name,
        location: w.location?.trim() || null,
        has_register: false,
      })
    },
    onSuccess: () => {
      toast.success(t('warehouses.toastUpdated'))
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      qc.invalidateQueries({ queryKey: ['registerBalances'] })
      setDisableRegisterPromptOpen(false)
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
  const selectedWarehouse = warehouses.find((x) => x.id === registerWarehouseId)

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

      {warehousesReady && registerWarehouses.length > 0 && registerWarehouseId != null ? (
        <div className="max-w-md">
          <WarehouseCombobox
            id="register-warehouse-picker"
            label={t('register.registerWarehouseLabel')}
            warehouses={registerWarehouses}
            value={registerWarehouseId}
            onChange={setRegisterSelection}
          />
        </div>
      ) : warehousesReady && registerWarehouses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('register.noRegisterWarehouse')}</p>
      ) : null}

      {balancesQuery.isLoading || registerWarehouseId == null ? (
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
        {canViewActivity ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={scrollToActivity}
          >
            <ListOrdered className="h-4 w-4" aria-hidden />
            {t('register.viewActivity')}
          </Button>
        ) : null}
      </div>

      {canViewActivity ? (
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
      ) : null}

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
              <NoteMentionEditor
                id="reg-add-note"
                value={note}
                onChange={setNote}
                rows={2}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('notes.mentionHint')}
              </p>
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
              <NoteMentionEditor
                id="reg-wd-note"
                value={note}
                onChange={setNote}
                rows={2}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('notes.mentionHint')}
              </p>
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

      <AlertDialog
        open={withdrawAllDialogOpen}
        onOpenChange={(open) => {
          setWithdrawAllDialogOpen(open)
          if (!open) clearWithdrawQueryParams()
        }}
      >
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('register.withdrawAllConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-start text-muted-foreground">
                <p>{t('register.withdrawAllConfirmDescription')}</p>
                {b ? (
                  <ul className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                    {PAYMENT_METHODS.map((m) => (
                      <li
                        key={m}
                        className="flex justify-between gap-4 tabular-nums"
                      >
                        <span>{paymentLabel(m, t)}</span>
                        <span>{fc(b[m])}</span>
                      </li>
                    ))}
                    <li className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
                      <span>{t('register.totalInRegister')}</span>
                      <span>{fc(b.total)}</span>
                    </li>
                  </ul>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={withdrawAllMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                withdrawAllMut.mutate({
                  wantsDisableAfter:
                    searchParams.get('disableRegisterAfter') === '1',
                })
              }}
            >
              {t('register.withdrawAllConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={disableRegisterPromptOpen}
        onOpenChange={setDisableRegisterPromptOpen}
      >
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('register.disableRegisterPromptTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              {t('register.disableRegisterPromptDescription', {
                name: selectedWarehouse?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('register.disableRegisterKeep')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={disableRegisterMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                disableRegisterMut.mutate()
              }}
            >
              {t('register.disableRegisterConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
