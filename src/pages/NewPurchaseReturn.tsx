import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

import { getAllPurchaseOrders } from '@/services/purchaseOrderService'
import { getAllPeople } from '@/services/peopleService'
import {
  confirmPurchaseReturnWithAdminNotice,
  createPurchaseReturn,
  getReturnablePurchaseLinesForOrder,
} from '@/services/purchaseReturnService'
import { listWarehouses } from '@/services/warehouseService'
import type {
  PaymentMethod,
  PurchaseOrderWithItems,
  PurchaseReturnSettlement,
  PurchaseReturnableLine,
} from '@/types'
import { buttonVariants } from '@/components/ui/button'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { PurchaseReturnForm } from '@/components/purchaseReturns/PurchaseReturnForm'
import { PurchaseReturnSettlementModal } from '@/components/purchaseReturns/PurchaseReturnSettlementModal'
import { SourcePurchaseOrderBrowserModal } from '@/components/purchaseReturns/SourcePurchaseOrderBrowserModal'
import {
  buildPurchaseReturnRows,
  purchaseReturnLinesTotal,
  rowsGoingNegative,
  selectedPurchaseReturnLines,
  type PurchaseReturnLineRow,
} from '@/components/purchaseReturns/purchaseReturnsShared'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function NewPurchaseReturn() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const fc = (n: number) => formatCurrency(n, lang)

  const canCreate = useFeatureEnabled('purchaseOrders.returnCreate')

  const [sourcePo, setSourcePo] = useState<PurchaseOrderWithItems | null>(null)
  const [rows, setRows] = useState<PurchaseReturnLineRow[]>([])
  const [rowsBuiltFrom, setRowsBuiltFrom] = useState<
    PurchaseReturnableLine[] | undefined
  >(undefined)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settlement, setSettlement] =
    useState<PurchaseReturnSettlement>('refund_to_register')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')

  useEffect(() => {
    document.title = `${t('purchaseReturns.newReturn')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => getAllPurchaseOrders(),
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })

  /** Only a received PO has stock on hand and a paid amount to claim back. */
  const returnablePurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (o) => !o.is_historical_snapshot && o.status === 'received'
      ),
    [purchaseOrders]
  )

  /** Deep link from a PO detail page: ?po=<uuid> preselects the source. */
  const preselectId = searchParams.get('po')
  const activePo =
    sourcePo ??
    (preselectId
      ? (returnablePurchaseOrders.find((o) => o.id === preselectId) ?? null)
      : null)

  const { data: returnableLines, isFetching: linesLoading } = useQuery({
    queryKey: ['returnablePurchaseLines', activePo?.id],
    queryFn: () => getReturnablePurchaseLinesForOrder(activePo!.id),
    enabled: !!activePo,
  })

  /** Rebuild the editable rows whenever a new set of returnable lines arrives. */
  if (returnableLines !== rowsBuiltFrom) {
    setRowsBuiltFrom(returnableLines)
    setRows(returnableLines ? buildPurchaseReturnRows(returnableLines) : [])
  }

  const lines = selectedPurchaseReturnLines(rows)
  const total = purchaseReturnLinesTotal(rows)
  const negativeRows = rowsGoingNegative(rows)
  const person = activePo?.person_id
    ? (people.find((p) => p.id === activePo.person_id) ?? null)
    : null

  /** A PO with no linked supplier has no account to debit, so the register is the only option. */
  const effectiveSettlement: PurchaseReturnSettlement = person
    ? settlement
    : 'refund_to_register'

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['purchaseReturns'] })
    qc.invalidateQueries({ queryKey: ['returnablePurchaseLines'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
  }

  const saveDraftMut = useMutation({
    mutationFn: () =>
      createPurchaseReturn({
        source_purchase_order_id: activePo!.id,
        items: lines,
        note: note || undefined,
      }),
    onSuccess: (created) => {
      invalidateAll()
      toast.success(t('purchaseReturns.toastDraftSaved'))
      navigate(`/purchase-orders/returns/${created.id}`)
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const confirmMut = useMutation({
    mutationFn: async () => {
      const created = await createPurchaseReturn({
        source_purchase_order_id: activePo!.id,
        items: lines,
        note: note || undefined,
      })
      return confirmPurchaseReturnWithAdminNotice(created.id, {
        settlement: effectiveSettlement,
        refund_method:
          effectiveSettlement === 'refund_to_register'
            ? refundMethod
            : undefined,
      })
    },
    onSuccess: ({ purchaseReturn, negatives }) => {
      invalidateAll()
      setSettleOpen(false)
      toast.success(t('purchaseReturns.toastConfirmed'))
      if (negatives.length > 0) {
        toast.warning(
          t('purchaseReturns.toastNegativeStock', { count: negatives.length })
        )
      }
      navigate(`/purchase-orders/returns/${purchaseReturn.id}`)
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  if (!canCreate) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {t('control.disabled.newPurchaseReturn')}
      </div>
    )
  }

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
          to="/purchase-orders/returns"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('purchaseReturns.backToReturns')}
        </Link>
      </div>

      <PurchaseReturnForm
        sourcePurchaseOrder={activePo}
        rows={rows}
        onRowsChange={setRows}
        people={people}
        warehouses={warehouses}
        lang={lang}
        isRTL={isRTL}
        formatCurrency={fc}
        linesLoading={linesLoading}
        canPickSourceOrder
        onRequestPickSourceOrder={() => setBrowserOpen(true)}
        canSave={!!activePo && lines.length > 0}
        saving={saveDraftMut.isPending || confirmMut.isPending}
        onSaveDraft={() => saveDraftMut.mutate()}
        onConfirm={() => setSettleOpen(true)}
        confirmLabel={t('purchaseReturns.confirmReturn')}
      />

      <SourcePurchaseOrderBrowserModal
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        purchaseOrders={returnablePurchaseOrders}
        people={people}
        isRTL={isRTL}
        lang={lang}
        formatCurrency={fc}
        onPick={setSourcePo}
      />

      <PurchaseReturnSettlementModal
        open={settleOpen}
        onOpenChange={setSettleOpen}
        isRTL={isRTL}
        formatCurrency={fc}
        total={total}
        personName={person?.name ?? null}
        settlement={effectiveSettlement}
        setSettlement={setSettlement}
        refundMethod={refundMethod}
        setRefundMethod={setRefundMethod}
        note={note}
        setNote={setNote}
        negativeRows={negativeRows}
        canConfirm={lines.length > 0 && total > 0}
        confirming={confirmMut.isPending}
        onConfirm={() => confirmMut.mutate()}
      />
    </div>
  )
}
