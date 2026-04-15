import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import {
  cancelPurchaseOrder,
  clonePurchaseOrderAsReplacementDraft,
  confirmPurchaseOrder,
  type CancelPurchaseOrderSettlement,
  getPurchaseOrderById,
  updatePurchaseOrderNote,
} from '@/services/purchaseOrderService'
import {
  getAllPeople,
  getLedgerPaymentOperationRouteIdForPo,
  roundMoney,
  supabaseErrorMessage,
} from '@/services/peopleService'
import { listWarehouses } from '@/services/warehouseService'
import { fetchRegisterIdsForPoPayments } from '@/services/paymentRegisterDisplayService'
import type { PaymentMethod, PurchaseOrderPayment } from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import {
  POStatusBadge,
  paymentLabelPO,
} from '@/components/purchaseOrders/purchaseOrderShared'
import { EditableNoteCard } from '@/components/common/EditableNoteCard'
import { PAYMENT_METHODS } from '@/components/orders/ordersShared'
import { PurchaseOrderCheckoutModal } from '@/components/purchaseOrders/PurchaseOrderCheckoutModal'
import { PoRegisterPaymentGateDialog } from '@/components/purchaseOrders/PoRegisterPaymentGateDialog'

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const qc = useQueryClient()
  const fc = (n: number) => formatCurrency(n, lang)

  const canCancelPO = useFeatureEnabled('purchaseOrders.cancel')
  const canClonePo = useFeatureEnabled('purchaseOrders.cloneAsReplacementDraft')
  const canCreatePo = useFeatureEnabled('purchaseOrders.create')
  const canConfirmReceive = useFeatureEnabled('purchaseOrders.confirmReceive')
  const canEditPoNote = useFeatureEnabled('purchaseOrders.editNote')
  const canListPayments = useFeatureEnabled('payments.list')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [payUse, setPayUse] = useState<Record<PaymentMethod, boolean>>({
    cash: false,
    visa: false,
    cheque: false,
    instapay: false,
  })
  const [payAmounts, setPayAmounts] = useState<Record<PaymentMethod, string>>({
    cash: '',
    visa: '',
    cheque: '',
    instapay: '',
  })
  const [allowRemaining, setAllowRemaining] = useState(false)
  const [confirmNote, setConfirmNote] = useState('')
  const [paymentRegisterWarehouseId, setPaymentRegisterWarehouseId] =
    useState(1)

  const [registerGateOpen, setRegisterGateOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelSettlement, setCancelSettlement] =
    useState<CancelPurchaseOrderSettlement>('reverse_payments')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneSettlement, setCloneSettlement] =
    useState<CancelPurchaseOrderSettlement>('reverse_payments')

  const {
    data: po,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => getPurchaseOrderById(id!),
    enabled: !!id,
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })

  const poWarehouseId = useMemo(() => {
    if (!po) return 1
    return po.warehouse_id != null && Number.isFinite(Number(po.warehouse_id))
      ? Math.trunc(Number(po.warehouse_id))
      : 1
  }, [po])

  const poWarehouse = useMemo(
    () => warehouses.find((w) => w.id === poWarehouseId) ?? null,
    [warehouses, poWarehouseId]
  )

  const needsPaymentRegister = Boolean(poWarehouse && !poWarehouse.has_register)

  const registerOnlyWarehouses = useMemo(
    () => warehouses.filter((w) => w.has_register),
    [warehouses]
  )

  useEffect(() => {
    if (registerOnlyWarehouses.length === 0) return
    if (
      !registerOnlyWarehouses.some((w) => w.id === paymentRegisterWarehouseId)
    ) {
      const d =
        registerOnlyWarehouses.find((w) => w.is_default) ??
        registerOnlyWarehouses[0]
      setPaymentRegisterWarehouseId(d.id)
    }
  }, [registerOnlyWarehouses, paymentRegisterWarehouseId])

  const supplierPerson = useMemo(() => {
    if (!po?.person_id) return null
    return people.find((p) => p.id === po.person_id) ?? null
  }, [po?.person_id, people])

  const showPoPaymentOpLink =
    !!po &&
    po.status === 'received' &&
    !!po.person_id &&
    (po.payments?.length ?? 0) > 0 &&
    canListPayments

  const { data: poPaymentOpRouteId, isFetching: poPaymentOpFetching } =
    useQuery({
      queryKey: ['poLedgerPaymentOpRoute', po?.id],
      queryFn: () => getLedgerPaymentOperationRouteIdForPo(po!.id),
      enabled: showPoPaymentOpLink,
    })

  const { data: poPaymentRegisterIds, isFetching: poPayRegFetching } =
    useQuery({
      queryKey: ['poPaymentRegisters', po?.id, po?.payments?.length ?? 0],
      queryFn: () =>
        fetchRegisterIdsForPoPayments(po!.id, po!.payments ?? []),
      enabled: !!po && (po.payments?.length ?? 0) > 0,
    })

  useEffect(() => {
    if (po) setConfirmNote(po.note ?? '')
  }, [po?.id, po?.note])

  const paidPreview = useMemo(() => {
    let s = 0
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = parseFloat(payAmounts[m]) || 0
      if (v > 0) s += v
    }
    return roundMoney(s)
  }, [payUse, payAmounts])

  const confirmDraftPreview = useMemo(() => {
    if (!po) {
      return { subtotal: 0, discountAmount: 0, total: 0 }
    }
    return {
      subtotal: roundMoney(po.subtotal),
      discountAmount: roundMoney(po.discount_amount),
      total: roundMoney(po.total_amount),
    }
  }, [po])

  const canConfirmDraft = useMemo(() => {
    if (!po || po.status !== 'draft') return false
    if (!po.person_id) return false
    const total = roundMoney(po.total_amount)
    const rem = roundMoney(total - paidPreview)
    if (rem > 0.01 && !allowRemaining) return false
    if (
      needsPaymentRegister &&
      paidPreview > 0.01 &&
      registerOnlyWarehouses.length === 0
    ) {
      return false
    }
    return true
  }, [
    po,
    paidPreview,
    allowRemaining,
    needsPaymentRegister,
    registerOnlyWarehouses.length,
  ])

  useEffect(() => {
    if (po) {
      document.title = `${(t as (key: string, opts?: Record<string, number>) => string)('purchaseOrders.detailTitle', { number: po.order_number })} | StockPilot`
    } else {
      document.title = `${t('purchaseOrders.title')} | StockPilot`
    }
    return () => {
      document.title = 'StockPilot'
    }
  }, [po, t])

  const invalidatePO = () => {
    qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
    qc.invalidateQueries({ queryKey: ['purchaseOrder'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['dashboardStats'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
  }

  const noteMut = useMutation({
    mutationFn: (text: string) => updatePurchaseOrderNote(id!, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchaseOrder', id] })
      invalidatePO()
    },
    onError: (e: unknown) =>
      toast.error(supabaseErrorMessage(e) || t('purchaseOrders.toastError')),
  })

  const cloneMut = useMutation({
    mutationFn: (p: {
      pid: string
      settlement?: CancelPurchaseOrderSettlement
    }) =>
      clonePurchaseOrderAsReplacementDraft(
        p.pid,
        p.settlement ? { settlement: p.settlement } : undefined
      ),
    onSuccess: (created) => {
      invalidatePO()
      setCloneOpen(false)
      toast.success(t('purchaseOrders.toastClonedAsDraft'))
      navigate(`/purchase-orders/${created.id}`)
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t('purchaseOrders.cloneError')
      ),
  })

  const openConfirmDraft = () => {
    if (!po || po.status !== 'draft') return
    setPayUse({
      cash: false,
      visa: false,
      cheque: false,
      instapay: false,
    })
    setPayAmounts({
      cash: '',
      visa: '',
      cheque: '',
      instapay: '',
    })
    setAllowRemaining(false)
    setConfirmNote(po.note ?? '')
    if (needsPaymentRegister && registerOnlyWarehouses.length > 0) {
      setRegisterGateOpen(true)
    } else {
      setConfirmOpen(true)
    }
  }

  const continuePoRegisterGateToConfirm = () => {
    setRegisterGateOpen(false)
    setConfirmOpen(true)
  }

  const buildPaymentsFromState = () => {
    const out: { payment_method: PaymentMethod; amount: number }[] = []
    for (const m of PAYMENT_METHODS) {
      if (!payUse[m]) continue
      const v = roundMoney(parseFloat(payAmounts[m]) || 0)
      if (v > 0.001) out.push({ payment_method: m, amount: v })
    }
    return out
  }

  const handleConfirmDraftSubmit = async () => {
    if (!po || po.status !== 'draft' || !canConfirmDraft) return
    setConfirming(true)
    try {
      await confirmPurchaseOrder(po.id, {
        payments: buildPaymentsFromState(),
        allow_remaining_on_account: allowRemaining,
        note: confirmNote,
        register_warehouse_id: needsPaymentRegister
          ? paymentRegisterWarehouseId
          : undefined,
      })
      invalidatePO()
      setConfirmOpen(false)
      toast.success(t('purchaseOrders.toastCreated'))
    } catch {
      toast.error(t('purchaseOrders.toastError'))
    } finally {
      setConfirming(false)
    }
  }

  if (!id) return null

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !po) {
    return (
      <div className="p-6">
        <Link
          to="/purchase-orders/list"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToList')}
        </Link>
        <p className="mt-4 text-muted-foreground">{t('common.noResults')}</p>
      </div>
    )
  }

  const canCancel =
    canCancelPO &&
    !po.is_historical_snapshot &&
    (po.status === 'received' || po.status === 'draft')

  const paidAtPo = roundMoney((po.payments ?? []).reduce((s, p) => s + p.amount, 0))
  const hasRecordedPoPayments =
    paidAtPo > 0.01 ||
    (po.payments ?? []).some((p) => roundMoney(p.amount) > 0.01)
  const showCancelSettlementChoice =
    po.status === 'received' && !!po.person_id && hasRecordedPoPayments
  const showPoSupplierPaymentCancelHint =
    po.status === 'received' && !po.person_id && hasRecordedPoPayments

  const showClonePoButton =
    canClonePo &&
    !po.is_historical_snapshot &&
    po.status !== 'cancelled' &&
    po.items.length > 0 &&
    Boolean(po.person_id?.trim())

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-10rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-2 py-2">
        <Link
          to="/purchase-orders/list"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseOrders.backToList')}
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <header className="flex flex-wrap items-start gap-3 border-b bg-background p-4">
          <div>
            <h1 className="text-2xl font-bold tabular-nums">
              #{t('purchaseOrders.poPrefix')}-{po.order_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
              }).format(new Date(po.created_at))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {po.is_historical_snapshot ? (
              <span
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-900/50 dark:text-amber-100"
                title={t('purchaseOrders.historicalImportBadge')}
              >
                {t('purchaseOrders.historicalImportBadge')}
              </span>
            ) : null}
            <POStatusBadge status={po.status} t={t} />
          </div>
          <div className="ms-auto flex flex-wrap gap-2">
            {po.status === 'draft' &&
              !po.is_historical_snapshot &&
              canCreatePo &&
              canConfirmReceive && (
              <Button type="button" onClick={openConfirmDraft}>
                {t('purchaseOrders.confirmReceiveDraft')}
              </Button>
            )}
            {showClonePoButton ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCloneSettlement('reverse_payments')
                  setCloneOpen(true)
                }}
              >
                {t('purchaseOrders.editAsReplacement')}
              </Button>
            ) : null}
            {canCancel && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setCancelSettlement('reverse_payments')
                  setCancelOpen(true)
                }}
              >
                {t('purchaseOrders.cancelPurchaseOrder')}
              </Button>
            )}
          </div>
        </header>

        <div className="border-b bg-background p-4">
          <p className="font-medium">
            {supplierPerson?.name ?? po.supplier_name ?? '—'}
          </p>
          {supplierPerson && (
            <p className="text-sm text-muted-foreground">
              {t('purchaseOrders.supplierBalance')}:{' '}
              {fc(supplierPerson.balance)}
            </p>
          )}
        </div>

        <div className="p-4">
          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">
                {t('purchaseOrders.date')}:
              </span>{' '}
              {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
                dateStyle: 'medium',
              }).format(new Date(po.created_at))}
            </p>
            <p>
              <span className="text-muted-foreground">
                {t('orders.inventoryForDocument')}:
              </span>{' '}
              {poWarehouse
                ? `#${poWarehouse.id} · ${poWarehouse.name}`
                : `#${poWarehouseId}`}
            </p>
            {po.payments && po.payments.length > 0 && (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">
                  {t('orders.paymentMethod')}:
                </span>
                <span className="mt-1 block">
                  {po.payments.map((p: PurchaseOrderPayment, i: number) => {
                    const rwId = poPaymentRegisterIds?.[i]
                    const rwName =
                      rwId != null
                        ? warehouses.find((w) => w.id === rwId)?.name
                        : undefined
                    return (
                      <span
                        key={p.id ?? `${p.payment_method}-${i}`}
                        className="block"
                      >
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>
                            {paymentLabelPO(p.payment_method, t)}: {fc(p.amount)}
                          </span>
                          {poPayRegFetching ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : rwId != null ? (
                            <span className="text-muted-foreground">
                              {t('orders.paymentRegister')}: #{rwId}
                              {rwName ? ` · ${rwName}` : ''}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    )
                  })}
                </span>
                {showPoPaymentOpLink && (
                  <span className="mt-2 block text-muted-foreground">
                    {poPaymentOpFetching ? (
                      <Loader2 className="inline h-4 w-4 animate-spin align-middle" />
                    ) : poPaymentOpRouteId ? (
                      <Link
                        to={`/payments/operations/${poPaymentOpRouteId}`}
                        className={cn(
                          buttonVariants({ variant: 'link' }),
                          'h-auto p-0 align-baseline font-medium text-primary'
                        )}
                      >
                        {t('purchaseOrders.openPaymentOperation')}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </span>
                )}
              </p>
            )}
            <div className="sm:col-span-2">
              <EditableNoteCard
                label={t('purchaseOrders.note')}
                value={po.note ?? ''}
                canEdit={canEditPoNote && !po.is_historical_snapshot}
                isPending={noteMut.isPending}
                fieldId={`po-note-${po.id}`}
                onSave={async (text) => {
                  await noteMut.mutateAsync(text)
                }}
              />
            </div>
          </div>

          <h2 className="mb-2 text-sm font-semibold">{t('orders.products')}</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">
                    {t('common.name')}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t('common.quantity')}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t('purchaseOrders.costPricePaid')}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">%</th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t('purchaseOrders.previousCostPrice')}
                  </th>
                  <th className="px-3 py-2 text-center font-medium">
                    {t('purchaseOrders.costPriceUpdated')}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t('purchaseOrders.lineTotal')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {item.product.name}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {fc(item.cost_price)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">
                      {item.line_discount_rate > 0.005
                        ? `${roundMoney(item.line_discount_rate)}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">
                      {item.previous_cost_price != null
                        ? fc(item.previous_cost_price)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.cost_price_updated
                        ? t('common.yes')
                        : t('common.no')}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {fc(item.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-1 text-sm tabular-nums">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('orders.subtotal')}</span>
              <span>{fc(po.subtotal)}</span>
            </div>
            {po.discount_amount > 0.005 && (
              <div className="flex justify-between gap-4 text-emerald-600">
                <span>
                  {t('orders.discount')} ({roundMoney(po.discount_rate)}%)
                </span>
                <span>−{fc(po.discount_amount)}</span>
              </div>
            )}
            <p className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
              <span>{t('purchaseOrders.totalAmount')}</span>
              <span>{fc(po.total_amount)}</span>
            </p>
          </div>
        </div>
      </div>

      <PoRegisterPaymentGateDialog
        open={registerGateOpen}
        onOpenChange={setRegisterGateOpen}
        isRTL={isRTL}
        registerWarehouses={registerOnlyWarehouses}
        value={paymentRegisterWarehouseId}
        onChange={setPaymentRegisterWarehouseId}
        onContinue={continuePoRegisterGateToConfirm}
      />
      <PurchaseOrderCheckoutModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        isRTL={isRTL}
        formatCurrency={fc}
        preview={confirmDraftPreview}
        discountRate={po ? roundMoney(po.discount_rate) : 0}
        paidPreview={paidPreview}
        supplierName={po.supplier_name ?? null}
        payUse={payUse}
        setPayUse={setPayUse}
        payAmounts={payAmounts}
        setPayAmounts={setPayAmounts}
        allowRemaining={allowRemaining}
        setAllowRemaining={setAllowRemaining}
        supplierPersonId={po.person_id}
        note={confirmNote}
        setNote={setConfirmNote}
        canConfirm={canConfirmDraft}
        confirming={confirming}
        onConfirm={handleConfirmDraftSubmit}
        registerPaymentPicker={null}
      />

      <AlertDialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('purchaseOrders.cloneConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-start text-muted-foreground">
                <p>
                  {(
                    t as (key: string, opts: Record<string, number>) => string
                  )('purchaseOrders.cloneConfirmIntro', {
                    number: po.order_number,
                  })}
                </p>
                {showPoSupplierPaymentCancelHint && (
                  <p className="text-sm text-foreground">
                    {t('purchaseOrders.cancelSupplierPaymentsHint')}
                  </p>
                )}
                {showCancelSettlementChoice && (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <p className="text-sm text-foreground">
                      {t('purchaseOrders.cancelSettlementIntro')}
                    </p>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-foreground">
                        {t('purchaseOrders.cancelSettlementLegend')}
                      </legend>
                      <div className="flex items-start gap-2">
                        <input
                          id="po-clone-reverse"
                          type="radio"
                          name="po-clone-settlement"
                          className="mt-1"
                          checked={cloneSettlement === 'reverse_payments'}
                          onChange={() =>
                            setCloneSettlement('reverse_payments')
                          }
                        />
                        <Label
                          htmlFor="po-clone-reverse"
                          className="cursor-pointer font-normal leading-snug"
                        >
                          {t('purchaseOrders.cancelSettlementReverse')}
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <input
                          id="po-clone-retain"
                          type="radio"
                          name="po-clone-settlement"
                          className="mt-1"
                          checked={
                            cloneSettlement === 'retain_paid_as_wallet_credit'
                          }
                          onChange={() =>
                            setCloneSettlement('retain_paid_as_wallet_credit')
                          }
                        />
                        <Label
                          htmlFor="po-clone-retain"
                          className="cursor-pointer font-normal leading-snug"
                        >
                          {t('purchaseOrders.cancelSettlementRetain')}
                        </Label>
                      </div>
                    </fieldset>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cloneMut.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={cloneMut.isPending}
              onClick={() =>
                cloneMut.mutate({
                  pid: po.id,
                  settlement: showCancelSettlementChoice
                    ? cloneSettlement
                    : undefined,
                })
              }
            >
              {cloneMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('purchaseOrders.cloneConfirmAction')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('purchaseOrders.cancelConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-start text-muted-foreground">
                <p>
                  {(
                    t as (key: string, opts?: Record<string, number>) => string
                  )(
                    po.status === 'draft'
                      ? 'purchaseOrders.cancelConfirmMessageDraft'
                      : 'purchaseOrders.cancelConfirmMessage',
                    {
                      number: po.order_number,
                    }
                  )}
                </p>
                {showPoSupplierPaymentCancelHint && (
                  <p className="text-sm text-foreground">
                    {t('purchaseOrders.cancelSupplierPaymentsHint')}
                  </p>
                )}
                {showCancelSettlementChoice && (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <p className="text-sm text-foreground">
                      {t('purchaseOrders.cancelSettlementIntro')}
                    </p>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-foreground">
                        {t('purchaseOrders.cancelSettlementLegend')}
                      </legend>
                    <div className="flex items-start gap-2">
                      <input
                        id="po-cancel-reverse"
                        type="radio"
                        name="po-cancel-settlement"
                        className="mt-1"
                        checked={cancelSettlement === 'reverse_payments'}
                        onChange={() =>
                          setCancelSettlement('reverse_payments')
                        }
                      />
                      <Label
                        htmlFor="po-cancel-reverse"
                        className="cursor-pointer font-normal leading-snug"
                      >
                        {t('purchaseOrders.cancelSettlementReverse')}
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <input
                        id="po-cancel-retain"
                        type="radio"
                        name="po-cancel-settlement"
                        className="mt-1"
                        checked={
                          cancelSettlement === 'retain_paid_as_wallet_credit'
                        }
                        onChange={() =>
                          setCancelSettlement('retain_paid_as_wallet_credit')
                        }
                      />
                      <Label
                        htmlFor="po-cancel-retain"
                        className="cursor-pointer font-normal leading-snug"
                      >
                        {t('purchaseOrders.cancelSettlementRetain')}
                      </Label>
                    </div>
                    </fieldset>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelSubmitting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelSubmitting}
              onClick={async () => {
                setCancelSubmitting(true)
                try {
                  await cancelPurchaseOrder(
                    po.id,
                    showCancelSettlementChoice
                      ? { settlement: cancelSettlement }
                      : undefined
                  )
                  invalidatePO()
                  setCancelOpen(false)
                  toast.success(t('purchaseOrders.toastCancelled'))
                } catch {
                  toast.error(t('purchaseOrders.toastError'))
                } finally {
                  setCancelSubmitting(false)
                }
              }}
            >
              {cancelSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('purchaseOrders.cancelPurchaseOrder')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
