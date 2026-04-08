import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'

import {
  getInventoryTransferById,
  type InventoryTransferWithItems,
} from '@/services/inventoryTransferService'
import { listWarehouses } from '@/services/warehouseService'
import { Button, buttonVariants } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { PrintInventoryTransfer } from '@/components/inventoryTransfers/PrintInventoryTransfer'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function InventoryTransferDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const hubList = useFeatureEnabled('inventoryTransfers.list')

  const { data, isLoading } = useQuery({
    queryKey: ['inventoryTransfer', id],
    queryFn: () => getInventoryTransferById(id!),
    enabled: Boolean(id) && hubList,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
    enabled: hubList && Boolean(id),
  })

  const fromName =
    warehouses.find((w) => w.id === data?.from_warehouse_id)?.name ?? null
  const toName =
    warehouses.find((w) => w.id === data?.to_warehouse_id)?.name ?? null

  const [printTransfer, setPrintTransfer] =
    useState<InventoryTransferWithItems | null>(null)
  const [printTrigger, setPrintTrigger] = useState(0)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  const handlePrint = () => {
    if (!data) return
    setPrintTransfer(data)
    setPrintTrigger((n) => n + 1)
  }

  const clearPrintTransfer = useCallback(() => setPrintTransfer(null), [])

  useEffect(() => {
    if (data) {
      document.title = `${t('inventoryTransfers.detailTitle', { n: data.transfer_number })} | StockPilot`
    }
    return () => {
      document.title = 'StockPilot'
    }
  }, [t, data])

  if (!hubList) {
    return (
      <div className={cn('space-y-4 p-4', isRTL && 'rtl')} dir={isRTL ? 'rtl' : 'ltr'}>
        <Link
          to="/inventory-transfers"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2 w-fit'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('inventoryTransfers.backToTransfers')}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.inventoryTransfersList')}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', isRTL && 'rtl')}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <PrintInventoryTransfer
        transfer={printTransfer}
        fromWarehouseName={
          fromName ?? (data ? `#${data.from_warehouse_id}` : '')
        }
        toWarehouseName={toName ?? (data ? `#${data.to_warehouse_id}` : '')}
        printTrigger={printTrigger}
        onPrinted={clearPrintTransfer}
      />

      <div className="flex flex-wrap items-center gap-2 border-b bg-background p-3">
        <Link
          to="/inventory-transfers/list"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('inventoryTransfers.backToList')}
        </Link>
        {data ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ms-auto"
            onClick={handlePrint}
          >
            <Printer className="me-2 h-4 w-4" />
            {t('inventoryTransfers.print')}
          </Button>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        {isLoading || !id ? (
          <LoadingSkeleton className="h-32" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            {t('inventoryTransfers.notFound')}
          </p>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {t('inventoryTransfers.detailHeading', {
                  n: data.transfer_number,
                })}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatDate(data.created_at)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {fromName ?? `#${data.from_warehouse_id}`} →{' '}
                {toName ?? `#${data.to_warehouse_id}`}
              </p>
              {data.note ? (
                <p className="mt-2 text-sm border-l-2 border-border ps-3">
                  {data.note}
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-start">
                    <th className="px-3 py-2 font-medium">
                      {t('inventoryTransfers.colProduct')}
                    </th>
                    <th className="px-3 py-2 font-medium w-28">
                      {t('common.quantity')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <span className="font-medium">{it.product.name}</span>
                        <span className="text-muted-foreground ms-2 font-mono text-xs">
                          {it.product.product_code}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {it.quantity} {it.product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
