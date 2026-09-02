import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

import { getAllOrders } from '@/services/orderService'
import { getAllPeople } from '@/services/peopleService'
import {
  confirmReturn,
  createReturn,
  getReturnableLinesForOrder,
} from '@/services/returnService'
import { listWarehouses } from '@/services/warehouseService'
import type {
  OrderWithItemsAndPayments,
  PaymentMethod,
  ReturnSettlement,
  ReturnableLine,
} from '@/types'
import { buttonVariants } from '@/components/ui/button'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { ReturnForm } from '@/components/returns/ReturnForm'
import { ReturnSettlementModal } from '@/components/returns/ReturnSettlementModal'
import { SourceOrderBrowserModal } from '@/components/returns/SourceOrderBrowserModal'
import {
  buildReturnRows,
  returnLinesTotal,
  selectedReturnLines,
  type ReturnLineRow,
} from '@/components/returns/returnsShared'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function NewReturn() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const fc = (n: number) => formatCurrency(n, lang)

  const canCreate = useFeatureEnabled('orders.returnCreate')

  const [sourceOrder, setSourceOrder] =
    useState<OrderWithItemsAndPayments | null>(null)
  const [rows, setRows] = useState<ReturnLineRow[]>([])
  const [rowsBuiltFrom, setRowsBuiltFrom] = useState<
    ReturnableLine[] | undefined
  >(undefined)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settlement, setSettlement] =
    useState<ReturnSettlement>('refund_to_register')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')

  useEffect(() => {
    document.title = `${t('returns.newReturn')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getAllOrders(),
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })

  /** Only a real, non-cancelled sale has stock and money to give back. */
  const returnableOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          !o.is_historical_snapshot &&
          (o.status_flow === 'confirmed' || o.status_flow === 'completed')
      ),
    [orders]
  )

  /** Deep link from an order detail page: ?order=<uuid> preselects the source. */
  const preselectId = searchParams.get('order')
  const activeOrder =
    sourceOrder ??
    (preselectId
      ? (returnableOrders.find((o) => o.id === preselectId) ?? null)
      : null)

  const { data: returnableLines, isFetching: linesLoading } = useQuery({
    queryKey: ['returnableLines', activeOrder?.id],
    queryFn: () => getReturnableLinesForOrder(activeOrder!.id),
    enabled: !!activeOrder,
  })

  /** Rebuild the editable rows whenever a new set of returnable lines arrives. */
  if (returnableLines !== rowsBuiltFrom) {
    setRowsBuiltFrom(returnableLines)
    setRows(returnableLines ? buildReturnRows(returnableLines) : [])
  }

  const lines = selectedReturnLines(rows)
  const total = returnLinesTotal(rows)
  const person = activeOrder?.person_id
    ? (people.find((p) => p.id === activeOrder.person_id) ?? null)
    : null

  /** A walk-in order has no account to credit, so the register is the only option. */
  const effectiveSettlement: ReturnSettlement = person
    ? settlement
    : 'refund_to_register'

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['returns'] })
    qc.invalidateQueries({ queryKey: ['returnableLines'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
  }

  const saveDraftMut = useMutation({
    mutationFn: () =>
      createReturn({
        source_order_id: activeOrder!.id,
        items: lines,
        note: note || undefined,
      }),
    onSuccess: (created) => {
      invalidateAll()
      toast.success(t('returns.toastDraftSaved'))
      navigate(`/orders/returns/${created.id}`)
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const confirmMut = useMutation({
    mutationFn: async () => {
      const created = await createReturn({
        source_order_id: activeOrder!.id,
        items: lines,
        note: note || undefined,
      })
      return confirmReturn(created.id, {
        settlement: effectiveSettlement,
        refund_method:
          effectiveSettlement === 'refund_to_register'
            ? refundMethod
            : undefined,
      })
    },
    onSuccess: (confirmed) => {
      invalidateAll()
      setSettleOpen(false)
      toast.success(t('returns.toastConfirmed'))
      navigate(`/orders/returns/${confirmed.id}`)
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  if (!canCreate) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {t('control.disabled.newReturn')}
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
          to="/orders/returns"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('returns.backToReturns')}
        </Link>
      </div>

      <ReturnForm
        sourceOrder={activeOrder}
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
        canSave={!!activeOrder && lines.length > 0}
        saving={saveDraftMut.isPending || confirmMut.isPending}
        onSaveDraft={() => saveDraftMut.mutate()}
        onConfirm={() => setSettleOpen(true)}
        confirmLabel={t('returns.confirmReturn')}
      />

      <SourceOrderBrowserModal
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        orders={returnableOrders}
        people={people}
        isRTL={isRTL}
        lang={lang}
        formatCurrency={fc}
        onPick={setSourceOrder}
      />

      <ReturnSettlementModal
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
        canConfirm={lines.length > 0 && total > 0}
        confirming={confirmMut.isPending}
        onConfirm={() => confirmMut.mutate()}
      />
    </div>
  )
}
