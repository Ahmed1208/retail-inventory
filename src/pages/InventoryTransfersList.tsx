import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { listInventoryTransfers } from '@/services/inventoryTransferService'
import { listWarehouses } from '@/services/warehouseService'
import { buttonVariants } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function InventoryTransfersList() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const hubList = useFeatureEnabled('inventoryTransfers.list')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['inventoryTransfers'],
    queryFn: listInventoryTransfers,
    enabled: hubList,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
    enabled: hubList,
  })

  const whName = useMemo(() => {
    const m = new Map<number, string>()
    for (const w of warehouses) m.set(w.id, w.name)
    return (id: number) => m.get(id) ?? `#${id}`
  }, [warehouses])

  useEffect(() => {
    document.title = `${t('inventoryTransfers.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  if (!hubList) {
    return (
      <div
        className={cn('flex min-h-0 flex-1 flex-col p-6', isRTL && 'rtl')}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
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
        <p className="mt-4 text-sm text-muted-foreground">
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
      <div className="flex flex-wrap items-center gap-2 border-b bg-background p-3">
        <Link
          to="/inventory-transfers"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('inventoryTransfers.backToTransfers')}
        </Link>
      </div>

      <div className="overflow-x-auto p-4">
        {isLoading ? (
          <LoadingSkeleton className="h-40" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('inventoryTransfers.emptyList')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-start">
                <th className="px-3 py-2 font-medium">
                  {t('inventoryTransfers.colNumber')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('inventoryTransfers.fromWarehouse')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('inventoryTransfers.toWarehouse')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('inventoryTransfers.colDate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  role="link"
                  tabIndex={0}
                  className={cn(
                    'border-b last:border-0 cursor-pointer transition-colors',
                    'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                  )}
                  onClick={() => navigate(`/inventory-transfers/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/inventory-transfers/${r.id}`)
                    }
                  }}
                  aria-label={t('inventoryTransfers.openTransferDetail', {
                    n: r.transfer_number,
                  })}
                >
                  <td className="px-3 py-2 font-mono font-medium">
                    #{r.transfer_number}
                  </td>
                  <td className="px-3 py-2">{whName(r.from_warehouse_id)}</td>
                  <td className="px-3 py-2">{whName(r.to_warehouse_id)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
