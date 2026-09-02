import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { createAdminMentionNotificationIfNeeded } from '@/services/adminNotificationService'
import { getAllPeople } from '@/services/peopleService'
import {
  cancelReturn,
  confirmReturn,
  getReturnById,
  getReturnableLinesForOrder,
  getSourceOrderNumbers,
  updateReturnItems,
  updateReturnNote,
} from '@/services/returnService'
import { listWarehouses } from '@/services/warehouseService'
import type {
  PaymentMethod,
  ReturnSettlement,
  ReturnWithItems,
  ReturnableLine,
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
import { PrintReturnReceipt } from '@/components/returns/PrintReturnReceipt'
import { ReturnDetailReadOnly } from '@/components/returns/ReturnDetailReadOnly'
import { ReturnForm } from '@/components/returns/ReturnForm'
import { ReturnSettlementModal } from '@/components/returns/ReturnSettlementModal'
import {
  buildReturnRows,
  returnLinesTotal,
  selectedReturnLines,
  type ReturnLineRow,
} from '@/components/returns/returnsShared'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { useNoteFocusFromSearchParams } from '@/hooks/useNoteFocusFromSearchParams'

export function ReturnDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const qc = useQueryClient()
  const fc = (n: number) => formatCurrency(n, lang)

  const canConfirmReturn = useFeatureEnabled('orders.returnConfirm')
  const canCancelReturn = useFeatureEnabled('orders.returnCancel')
  const canPrintReturn = useFeatureEnabled('orders.returnPrint')
  const canEditNote = useFeatureEnabled('orders.returnEditNote')

  const [rows, setRows] = useState<ReturnLineRow[]>([])
  const [rowsBuiltFrom, setRowsBuiltFrom] = useState<
    ReturnableLine[] | undefined
  >(undefined)
  const [printTrigger, setPrintTrigger] = useState(0)
  const [printReturn, setPrintReturn] = useState<ReturnWithItems | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settlement, setSettlement] =
    useState<ReturnSettlement>('refund_to_register')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash')
  /** Null until the user types, so the saved note stays authoritative after a refetch. */
  const [noteDraft, setNoteDraft] = useState<string | null>(null)

  const {
    data: salesReturn,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['return', id],
    queryFn: () => getReturnById(id!),
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
    queryKey: ['returnSourceOrderNumbers', salesReturn?.source_order_id],
    queryFn: () => getSourceOrderNumbers([salesReturn!.source_order_id]),
    enabled: !!salesReturn,
  })

  const isDraft = salesReturn?.status_flow === 'draft'

  const { data: returnableLines, isFetching: linesLoading } = useQuery({
    queryKey: ['returnableLines', salesReturn?.source_order_id, id],
    queryFn: () =>
      getReturnableLinesForOrder(salesReturn!.source_order_id, {
        excludeReturnId: id,
      }),
    enabled: !!salesReturn && isDraft,
  })

  /** Pre-tick the rows this draft already holds so editing starts from its current state. */
  const draftQuantities = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of salesReturn?.items ?? []) {
      m.set(it.source_order_item_id, it.quantity)
    }
    return m
  }, [salesReturn])

  /** Rebuild the editable rows whenever a new set of returnable lines arrives. */
  if (returnableLines !== rowsBuiltFrom) {
    setRowsBuiltFrom(returnableLines)
    setRows(
      returnableLines ? buildReturnRows(returnableLines, draftQuantities) : []
    )
  }

  useEffect(() => {
    document.title = salesReturn
      ? `${t('returns.returnDetailTitle', { number: salesReturn.return_number })} | StockPilot`
      : `${t('returns.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [salesReturn, t])

  useNoteFocusFromSearchParams(
    salesReturn && !isDraft ? `return-note-${salesReturn.id}` : null
  )

  const person = salesReturn?.person_id
    ? (people.find((p) => p.id === salesReturn.person_id) ?? null)
    : null

  /** A walk-in return has no account to credit, so the register is the only option. */
  const effectiveSettlement: ReturnSettlement = person
    ? settlement
    : 'refund_to_register'
  const note = noteDraft ?? salesReturn?.note ?? ''

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['returns'] })
    qc.invalidateQueries({ queryKey: ['return'] })
    qc.invalidateQueries({ queryKey: ['returnableLines'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
  }

  const noteMut = useMutation({
    mutationFn: async ({ id: rid, text }: { id: string; text: string }) => {
      await updateReturnNote(rid, text)
      const num = salesReturn?.return_number
      await createAdminMentionNotificationIfNeeded({
        noteText: text,
        title: t('notifications.mentionTitleReturnNote', {
          number: num != null ? String(num) : rid.slice(0, 8),
        }),
        redirectBasePath: `/orders/returns/${rid}`,
        sourceType: 'return_note',
        sourceEntityId: rid,
      })
    },
    onSuccess: () => invalidateAll(),
  })

  const saveDraftMut = useMutation({
    mutationFn: () => updateReturnItems(id!, selectedReturnLines(rows)),
    onSuccess: () => {
      invalidateAll()
      toast.success(t('returns.toastDraftSaved'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const confirmMut = useMutation({
    mutationFn: async () => {
      await updateReturnItems(id!, selectedReturnLines(rows))
      if (note !== (salesReturn?.note ?? '')) {
        await updateReturnNote(id!, note)
      }
      return confirmReturn(id!, {
        settlement: effectiveSettlement,
        refund_method:
          effectiveSettlement === 'refund_to_register'
            ? refundMethod
            : undefined,
      })
    },
    onSuccess: () => {
      invalidateAll()
      setSettleOpen(false)
      setNoteDraft(null)
      toast.success(t('returns.toastConfirmed'))
    },
    onError: (e: Error) => toast.error(e.message || t('orders.toastError')),
  })

  const cancelMut = useMutation({
    mutationFn: () => cancelReturn(id!),
    onSuccess: () => {
      invalidateAll()
      setCancelOpen(false)
      toast.success(t('returns.toastCancelled'))
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

  if (error || !salesReturn) {
    return (
      <div className="p-6">
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
        <p className="mt-4 text-muted-foreground">{t('common.noResults')}</p>
      </div>
    )
  }

  const sourceOrderNumber =
    sourceNumbers?.get(salesReturn.source_order_id) ?? null
  const draftLines = selectedReturnLines(rows)
  const draftTotal = returnLinesTotal(rows)

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-10rem)] min-h-0 flex-1 flex-col',
        isRTL && 'rtl'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <PrintReturnReceipt
        salesReturn={printReturn}
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

      {isDraft ? (
        canConfirmReturn ? (
          <ReturnForm
            sourceOrder={{
              id: salesReturn.source_order_id,
              order_number: sourceOrderNumber ?? 0,
              person_id: salesReturn.person_id,
              warehouse_id: salesReturn.warehouse_id,
              created_at: salesReturn.created_at,
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
            confirmLabel={t('returns.confirmReturn')}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {t('control.disabled.editDraft')}
          </div>
        )
      ) : (
        <ReturnDetailReadOnly
          salesReturn={salesReturn}
          sourceOrderNumber={sourceOrderNumber}
          t={t}
          lang={lang}
          fc={fc}
          people={people}
          warehouses={warehouses}
          canPrint={canPrintReturn}
          canCancel={canCancelReturn && !salesReturn.is_historical_snapshot}
          canEditNote={canEditNote && !salesReturn.is_historical_snapshot}
          onPrint={() => {
            setPrintReturn(salesReturn)
            setPrintTrigger((n) => n + 1)
          }}
          onCancel={() => setCancelOpen(true)}
          noteMut={{
            mutateAsync: (p) => noteMut.mutateAsync(p),
            isPending: noteMut.isPending,
          }}
        />
      )}

      <ReturnSettlementModal
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
        canConfirm={draftLines.length > 0 && draftTotal > 0}
        confirming={confirmMut.isPending}
        onConfirm={() => confirmMut.mutate()}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('returns.cancelConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-start text-muted-foreground">
                <p>
                  {t('returns.cancelConfirmMessage', {
                    number: salesReturn.return_number,
                  })}
                </p>
                {salesReturn.status_flow === 'confirmed' && (
                  <p className="text-sm text-foreground">
                    {t('returns.cancelConfirmedHint')}
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
                t('returns.cancelReturn')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
