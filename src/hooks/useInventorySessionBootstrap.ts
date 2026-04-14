import { useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import { useAuth } from '@/context/AuthContext'
import { processPendingSyncEvents } from '@/services/syncQueueService'
import { touchSyncDevice } from '@/services/syncDeviceService'

const CHANNEL = 'inventory-session-bootstrap-v1'

function invalidateForRealtimeTable(qc: QueryClient, table: string) {
  switch (table) {
    case 'products':
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['lowStockProducts'] })
      void qc.invalidateQueries({ queryKey: ['allWarehouseStock'] })
      void qc.invalidateQueries({ queryKey: ['dashboardStats'] })
      break
    case 'orders':
      void qc.invalidateQueries({ queryKey: ['orders'] })
      break
    case 'purchase_orders':
      void qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
      void qc.invalidateQueries({ queryKey: ['purchaseOrder'] })
      break
    case 'stock_movements':
      void qc.invalidateQueries({ queryKey: ['stockMovements'] })
      void qc.invalidateQueries({ queryKey: ['recentMovements'] })
      break
    case 'inventory_transfers':
      void qc.invalidateQueries({ queryKey: ['inventoryTransfers'] })
      void qc.invalidateQueries({ queryKey: ['inventoryTransfer'] })
      break
    case 'product_warehouse_stock':
      void qc.invalidateQueries({ queryKey: ['allWarehouseStock'] })
      void qc.invalidateQueries({ queryKey: ['warehouseStock'] })
      void qc.invalidateQueries({ queryKey: ['productWhStock'] })
      void qc.invalidateQueries({ queryKey: ['productStockByWarehouse'] })
      break
    case 'stock_alerts':
      void qc.invalidateQueries({ queryKey: ['stockAlerts'] })
      break
    case 'balance_transactions':
      void qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
      void qc.invalidateQueries({ queryKey: ['people'] })
      void qc.invalidateQueries({ queryKey: ['registerBalances'] })
      void qc.invalidateQueries({ queryKey: ['registerActivity'] })
      break
    case 'register_tender_balances':
      void qc.invalidateQueries({ queryKey: ['registerBalances'] })
      void qc.invalidateQueries({ queryKey: ['registerActivity'] })
      break
    case 'people':
      void qc.invalidateQueries({ queryKey: ['people'] })
      void qc.invalidateQueries({ queryKey: ['dashboardStats'] })
      break
    default:
      void qc.invalidateQueries({ queryKey: ['products'] })
  }
}

/**
 * First app load (authenticated): browser notification permission.
 * Realtime invalidations for inventory tables; sync queue on load, every 30s, and on tab focus.
 */
export function useInventorySessionBootstrap() {
  const qc = useQueryClient()
  const { session, isAdmin } = useAuth()

  useEffect(() => {
    if (!session) return

    void touchSyncDevice().catch(() => {
      /* optional migration */
    })

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission()
    }

    const runSync = () => {
      if (getDeviceId() === 'ssr') return
      void processPendingSyncEvents(qc).catch(() => {
        /* unmigrated or offline */
      })
    }

    runSync()
    const interval = window.setInterval(runSync, 30_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') runSync()
    }
    document.addEventListener('visibilitychange', onVis)

    const tables = [
      'products',
      'orders',
      'stock_movements',
      'stock_alerts',
      'purchase_orders',
      'inventory_transfers',
      'product_warehouse_stock',
      'balance_transactions',
      'register_tender_balances',
      'people',
    ] as const

    const ch = supabase.channel(CHANNEL)
    for (const table of tables) {
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          invalidateForRealtimeTable(qc, table)
          if (table === 'stock_alerts' && payload.eventType === 'INSERT') {
            const row = payload.new as Record<string, unknown>
            const title = String(row.title ?? '')
            const message = String(row.message ?? '')
            const alertType = String(row.alert_type ?? '')
            const rawMeta = row.meta
            const meta =
              rawMeta &&
              typeof rawMeta === 'object' &&
              !Array.isArray(rawMeta)
                ? (rawMeta as Record<string, unknown>)
                : null
            const adminOnly = meta?.admin_only === true
            if (adminOnly && !isAdmin) {
              /* operators must not see admin-only alerts */
            } else if (title) {
              toast.info(title, {
                description: message.slice(0, 240) || undefined,
              })
            }
            const cloneReplacementKind =
              meta?.kind === 'order_replacement_draft' ||
              meta?.kind === 'po_replacement_draft'
            const notifyBrowser =
              alertType === 'wallet_direction_changed' ||
              alertType === 'register_negative_balance' ||
              alertType === 'negative_stock_offline_sync' ||
              (adminOnly &&
                isAdmin &&
                alertType === 'info' &&
                cloneReplacementKind)
            if (
              notifyBrowser &&
              typeof document !== 'undefined' &&
              document.hidden &&
              'Notification' in window &&
              Notification.permission === 'granted' &&
              title
            ) {
              try {
                new Notification(title, {
                  body: message.slice(0, 240) || undefined,
                  tag: String(row.id ?? title),
                })
              } catch {
                /* ignore */
              }
            }
          }
        }
      )
    }

    ch.subscribe()

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(ch)
    }
  }, [session, qc, isAdmin])
}
