import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import type { QueryClient } from '@tanstack/react-query'

export type SyncQueueEvent = {
  id: string
  target_device_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
  processed_at: string | null
  last_error: string | null
}

function mapRow(row: Record<string, unknown>): SyncQueueEvent {
  return {
    id: String(row.id),
    target_device_id: String(row.target_device_id ?? ''),
    event_type: String(row.event_type ?? ''),
    payload:
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    created_at: String(row.created_at ?? ''),
    processed_at: row.processed_at != null ? String(row.processed_at) : null,
    last_error: row.last_error != null ? String(row.last_error) : null,
  }
}

export async function enqueueSyncEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
  targetDeviceId?: string
): Promise<string | null> {
  const device = targetDeviceId ?? getDeviceId()
  const { data, error } = await supabase.rpc('enqueue_sync_event', {
    p_target_device_id: device,
    p_event_type: eventType,
    p_payload: payload,
  })
  if (error) {
    if (error.code === '42883' || error.message?.includes('enqueue_sync_event')) {
      return null
    }
    throw error
  }
  return data != null ? String(data) : null
}

/**
 * Claims pending rows for this device and applies lightweight invalidations.
 */
export async function processPendingSyncEvents(
  queryClient: QueryClient,
  limit = 50
): Promise<number> {
  const device = getDeviceId()
  if (device === 'ssr') return 0

  const { data, error } = await supabase.rpc('claim_sync_events', {
    p_target_device_id: device,
    p_limit: limit,
  })

  if (error) {
    if (error.code === '42883' || error.message?.includes('claim_sync_events')) {
      return 0
    }
    throw error
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  let n = 0
  for (const raw of rows) {
    const row = mapRow(raw)
    n += 1
    const tables = row.payload.tables
    if (Array.isArray(tables)) {
      for (const t of tables) {
        if (t === 'products') void queryClient.invalidateQueries({ queryKey: ['products'] })
        if (t === 'lowStockProducts')
          void queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] })
        if (t === 'stockAlerts')
          void queryClient.invalidateQueries({ queryKey: ['stockAlerts'] })
        if (t === 'orders') void queryClient.invalidateQueries({ queryKey: ['orders'] })
        if (t === 'purchase_orders' || t === 'purchaseOrders') {
          void queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
          void queryClient.invalidateQueries({ queryKey: ['purchaseOrder'] })
        }
        if (t === 'stock_movements' || t === 'stockMovements') {
          void queryClient.invalidateQueries({ queryKey: ['stockMovements'] })
        }
        if (t === 'inventory_transfers' || t === 'inventoryTransfers') {
          void queryClient.invalidateQueries({ queryKey: ['inventoryTransfers'] })
          void queryClient.invalidateQueries({ queryKey: ['inventoryTransfer'] })
        }
        if (t === 'product_warehouse_stock' || t === 'allWarehouseStock') {
          void queryClient.invalidateQueries({ queryKey: ['allWarehouseStock'] })
          void queryClient.invalidateQueries({ queryKey: ['warehouseStock'] })
          void queryClient.invalidateQueries({ queryKey: ['productWhStock'] })
        }
        if (t === 'people') void queryClient.invalidateQueries({ queryKey: ['people'] })
        if (t === 'balance_transactions' || t === 'balanceTransactions') {
          void queryClient.invalidateQueries({ queryKey: ['balanceTransactions'] })
        }
        if (t === 'registerBalances' || t === 'register_tender_balances') {
          void queryClient.invalidateQueries({ queryKey: ['registerBalances'] })
          void queryClient.invalidateQueries({ queryKey: ['registerActivity'] })
        }
        if (t === 'payments') {
          void queryClient.invalidateQueries({ queryKey: ['payments'] })
        }
      }
    } else {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] })
      void queryClient.invalidateQueries({ queryKey: ['stockAlerts'] })
      void queryClient.invalidateQueries({ queryKey: ['people'] })
      void queryClient.invalidateQueries({ queryKey: ['registerBalances'] })
    }
  }
  return n
}
