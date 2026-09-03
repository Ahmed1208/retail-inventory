import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import { getAllPeople } from '@/services/peopleService'
import {
  cancelPurchaseReturn,
  confirmPurchaseReturnWithAdminNotice,
  getPurchaseReturnById,
  getReturnablePurchaseLinesForOrder,
  getSourcePurchaseOrderNumbers,
  updatePurchaseReturnItems,
  updatePurchaseReturnNote,
} from '@/services/purchaseReturnService'
import { listWarehouses } from '@/services/warehouseService'
import type {
  PaymentMethod,
  PurchaseReturnSettlement,
  PurchaseReturnWithItems,
  PurchaseReturnableLine,
} from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { PrintPurchaseReturnReceipt } from '@/components/purchaseReturns/PrintPurchaseReturnReceipt'
import { PurchaseReturnDetailReadOnly } from '@/components/purchaseReturns/PurchaseReturnDetailReadOnly'
import { PurchaseReturnForm } from '@/components/purchaseReturns/PurchaseReturnForm'
import { PurchaseReturnSettlementModal } from '@/components/purchaseReturns/PurchaseReturnSettlementModal'
import {
  buildPurchaseReturnRows,
  purchaseReturnLinesTotal,
  rowsGoingNegative,
  selectedPurchaseReturnLines,
  type PurchaseReturnLineRow,
} from '@/components/purchaseReturns/purchaseReturnsShared'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { useNoteFocusFromSearchParams } from '@/hooks/useNoteFocusFromSearchParams'

export function PurchaseReturnDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const qc = useQueryClient()
  const fc = (n: number) => formatCurrency(n, lang)

  const canConfirmReturn = useFeatureEnabled('purchaseOrders.returnConfirm')
  const canCancelReturn = useFeatureEnabled('purchaseOrders.returnCancel')
  const canPrintReturn = useFeatureEnabled('purchaseOrders.returnPrint')
  const canEditNote = useFeatureEnabled('purchaseOrders.returnEditNote')

  const [rows, setRows] = useState<PurchaseReturnLineRow[]>([])
  const [rowsBuiltFrom, setRowsBuiltFrom] = useState<
    PurchaseReturnableLine[] | undefined
  >(undefined)
  const [printTrigger, setPrintTrigger] = useState(0)
  const [printReturn, setPrintReturn] =
    useState<PurchaseReturnWithItems | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settlement, setSettlement] =
    useState<PurchaseReturnSettlement>('refund_to_register')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash')
  /** Null until the user types, so the saved note stays authoritative after a refetch. */
  const [noteDraft, setNoteDraft] = useState<string | null>(null)

  const {
    data: purchaseReturn,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['purchaseReturn', id],
    queryFn: () => getPurchaseReturnById(id!),
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

  const { data: sourceNumbers } = useQuery({
    queryKey: [
      'purchaseReturnSourceOrderNumbers',
      purchaseReturn?.source_purchase_order_id,
    ],
    queryFn: () =>
      getSourcePurchaseOrderNumbers([
        purchaseReturn!.source_purchase_order_id,
      ]),
    enabled: !!purchaseReturn,
  })

  const isDraft = purchaseReturn?.status_flow === 'draft'

  const { data: returnableLines, isFetching: linesLoading } = useQuery({
    queryKey: [
      'returnablePurchaseLines',
      purchaseReturn?.source_purchase_order_id,
      id,
    ],
    queryFn: () =>
      getReturnablePurchaseLinesForOrder(
        purchaseReturn!.source_purchase_order_id,
        { excludeReturnId: id }
      ),
    enabled: !!purchaseReturn && isDraft,
  })

  /** Pre-tick the rows this draft already holds so editing starts from its current state. */
  const draftQuantities = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of purchaseReturn?.items ?? []) {
      m.set(it.source_purchase_order_item_id, it.quantity)
    }
    return m
  }, [purchaseReturn])

  /** Rebuild the editable rows whenever a new set of returnable lines arrives. */
  if (returnableLines !== rowsBuiltFrom) {
    setRowsBuiltFrom(returnableLines)
    setRows(
      returnableLines
        ? buildPurchaseReturnRows(returnableLines, draftQuantities)
        : []
    )
  }

  useEffect(() => {
    document.title = purchaseReturn
      ? `${t('purchaseReturns.returnDetailTitle', { number: purchaseReturn.return_number })} | StockPilot`
      : `${t('purchaseReturns.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [purchaseReturn, t])

  useNoteFocusFromSearchParams(
    purchaseReturn && !isDraft
      ? `purchase-return-note-${purchaseReturn.id}`
      : null
  )

  const person = purchaseReturn?.person_id
    ? (people.find((p) => p.id === purchaseReturn.person_id) ?? null)
    : null

  /** A PO with no linked supplier has no account to debit, so the register is the only option. */
  const effectiveSettlement: PurchaseReturnSettlement = person
    ? settlement
    : 'refund_to_register'
  const note = noteDraft ?? purchaseReturn?.note ?? ''

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['purchaseReturns'] })
    qc.invalidateQueries({ queryKey: ['purchaseReturn'] })
    qc.invalidateQueries({ queryKey: ['returnablePurchaseLines'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
  }

  const noteMut = useMutation({
    mutationFn: async ({ id: rid, text }: { id: string; text: string }) => {
      await updatePurchaseReturnNote(rid, text)
      const num = purchaseReturn?.return_number
      await createAdminMentionNotificationIfNeeded({
        noteText: text,
        title: t('notifications.mentionTitlePurchaseReturnNote', {
          number: num != null ? String(num) : rid.slice(0, 8),
        }),
        redirectBasePath: `/purchase-orders/returns/${rid}`,
        sourceType: 'purchase_return_note',
        sourceEntityId: rid,
      })
    },
    onSuccess: () => invalidateAll(),
  })

  const saveDraftMut = useMutation({
    mutationFn: () =>
      updatePurchaseReturnItems(id!, selectedPurchaseReturnLines(rows)),
    onSuccess: () => {
      invalidateAll()
      toast.success(t('purchaseReturns.toastDraftSaved'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const confirmMut = useMutation({
    mutationFn: async () => {
      await updatePurchaseReturnItems(id!, selectedPurchaseReturnLines(rows))
      if (note !== (purchaseReturn?.note ?? '')) {
        await updatePurchaseReturnNote(id!, note)
      }
      return confirmPurchaseReturnWithAdminNotice(id!, {
        settlement: effectiveSettlement,
        refund_method:
          effectiveSettlement === 'refund_to_register'
            ? refundMethod
            : undefined,
      })
    },
    onSuccess: ({ negatives }) => {
      invalidateAll()
      setSettleOpen(false)
      setNoteDraft(null)
      toast.success(t('purchaseReturns.toastConfirmed'))
      if (negatives.length > 0) {
        toast.warning(
          t('purchaseReturns.toastNegativeStock', { count: negatives.length })
        )
      }
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const cancelMut = useMutation({
    mutationFn: () => cancelPurchaseReturn(id!),
    onSuccess: () => {
      invalidateAll()
      setCancelOpen(false)
      toast.success(t('purchaseReturns.toastCancelled'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  if (!id) return null

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !purchaseReturn) {
    return (
      <div className="p-6">
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
        <p className="mt-4 text-muted-foreground">{t('common.noResults')}</p>
      </div>
    )
  }

  const sourceOrderNumber =
    sourceNumbers?.get(purchaseReturn.source_purchase_order_id) ?? null
  const draftLines = selectedPurchaseReturnLines(rows)
  const draftTotal = purchaseReturnLinesTotal(rows)

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-10rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <PrintPurchaseReturnReceipt
        purchaseReturn={printReturn}
        sourceOrderNumber={sourceOrderNumber}
        printTrigger={printTrigger}
        personName={person?.name ?? null}
        personPhone={person?.phone ?? null}
        lang={lang}
        isRTL={isRTL}
        onPrinted={() => {}}
      />

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

      {isDraft ? (
        canConfirmReturn ? (
          <PurchaseReturnForm
            sourcePurchaseOrder={{
              id: purchaseReturn.source_purchase_order_id,
              order_number: sourceOrderNumber ?? 0,
              person_id: purchaseReturn.person_id,
              supplier_name: null,
              warehouse_id: purchaseReturn.warehouse_id,
              created_at: purchaseReturn.created_at,
            }}
            rows={rows}
            onRowsChange={setRows}
            people={people}
            warehouses={warehouses}
            lang={lang}
            isRTL={isRTL}
            formatCurrency={fc}
            linesLoading={linesLoading}
            canSave={draftLines.length > 0}
            saving={saveDraftMut.isPending || confirmMut.isPending}
            onSaveDraft={() => saveDraftMut.mutate()}
            onConfirm={() => setSettleOpen(true)}
            confirmLabel={t('purchaseReturns.confirmReturn')}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {t('control.disabled.editDraft')}
          </div>
        )
      ) : (
        <PurchaseReturnDetailReadOnly
          purchaseReturn={purchaseReturn}
          sourceOrderNumber={sourceOrderNumber}
          t={t}
          lang={lang}
          fc={fc}
          people={people}
          warehouses={warehouses}
          canPrint={canPrintReturn}
          canCancel={canCancelReturn && !purchaseReturn.is_historical_snapshot}
          canEditNote={canEditNote && !purchaseReturn.is_historical_snapshot}
          onPrint={() => {
            setPrintReturn(purchaseReturn)
            setPrintTrigger((n) => n + 1)
          }}
          onCancel={() => setCancelOpen(true)}
          noteMut={{
            mutateAsync: (p) => noteMut.mutateAsync(p),
            isPending: noteMut.isPending,
          }}
        />
      )}

      <PurchaseReturnSettlementModal
        open={settleOpen}
        onOpenChange={setSettleOpen}
        isRTL={isRTL}
        formatCurrency={fc}
        total={draftTotal}
        personName={person?.name ?? null}
        settlement={effectiveSettlement}
        setSettlement={setSettlement}
        refundMethod={refundMethod}
        setRefundMethod={setRefundMethod}
        note={note}
        setNote={setNoteDraft}
        negativeRows={rowsGoingNegative(rows)}
        canConfirm={draftLines.length > 0 && draftTotal > 0}
        confirming={confirmMut.isPending}
        onConfirm={() => confirmMut.mutate()}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('purchaseReturns.cancelConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-start text-muted-foreground">
                <p>
                  {t('purchaseReturns.cancelConfirmMessage', {
                    number: purchaseReturn.return_number,
                  })}
                </p>
                {purchaseReturn.status_flow === 'confirmed' && (
                  <p className="text-sm text-foreground">
                    {t('purchaseReturns.cancelConfirmedHint')}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMut.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              {cancelMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('purchaseReturns.cancelReturn')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
