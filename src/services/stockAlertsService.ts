import type { SupabaseClient } from '@supabase/supabase-js'

import i18n from '@/lib/i18n'
import { supabase } from '@/lib/supabase'

export type StockAlertType =
  | 'negative_stock'
  | 'negative_stock_offline_sync'
  | 'low_stock'
  | 'order_number_repair'
  | 'sync_conflict'
  | 'info'
  | 'wallet_direction_changed'
  | 'register_negative_balance'

export type StockAlertRow = {
  id: string
  alert_type: StockAlertType
  title: string
  message: string
  product_id: string | null
  product_name: string | null
  quantity_after: number | null
  meta: Record<string, unknown>
  read_at: string | null
  resolved_at: string | null
  created_at: string
}

/** When true, only admin operators should see the alert in UI and toasts. */
export function stockAlertIsAdminOnly(
  meta: Record<string, unknown> | undefined | null
): boolean {
  return meta?.admin_only === true
}

type StockAlertRowRaw = Record<string, unknown> & {
  products?: { name?: string } | null
}

function mapRow(row: StockAlertRowRaw): StockAlertRow {
  const pn = row.products?.name
  return {
    id: String(row.id),
    alert_type: row.alert_type as StockAlertType,
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    product_id: row.product_id != null ? String(row.product_id) : null,
    product_name: pn != null && String(pn).length > 0 ? String(pn) : null,
    quantity_after:
      row.quantity_after != null && Number.isFinite(Number(row.quantity_after))
        ? Number(row.quantity_after)
        : null,
    meta:
      row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : {},
    read_at: row.read_at != null ? String(row.read_at) : null,
    resolved_at: row.resolved_at != null ? String(row.resolved_at) : null,
    created_at: String(row.created_at ?? ''),
  }
}

export async function listStockAlerts(
  limit = 100,
  opts?: { viewerIsAdmin?: boolean }
): Promise<StockAlertRow[]> {
  const fetchCap =
    opts?.viewerIsAdmin === false ? Math.min(Math.max(limit * 4, 80), 400) : limit
  const { data, error } = await supabase
    .from('stock_alerts')
    .select('*, products(name)')
    .order('created_at', { ascending: false })
    .limit(fetchCap)

  if (error) {
    if (error.code === '42P01' || error.message?.includes('stock_alerts')) {
      return []
    }
    throw error
  }
  let rows = (data ?? []).map((r) => mapRow(r as StockAlertRowRaw))
  if (opts?.viewerIsAdmin === false) {
    rows = rows.filter((r) => !stockAlertIsAdminOnly(r.meta))
  }
  return rows.slice(0, limit)
}

export async function countUnreadStockAlerts(opts?: {
  viewerIsAdmin?: boolean
}): Promise<number> {
  if (opts?.viewerIsAdmin === false) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select('meta')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(2500)

    if (error) {
      if (error.code === '42P01' || error.message?.includes('stock_alerts')) {
        return 0
      }
      throw error
    }
    return (data ?? []).filter((row) => {
      const m = row.meta
      const meta =
        m && typeof m === 'object' && !Array.isArray(m)
          ? (m as Record<string, unknown>)
          : null
      return !stockAlertIsAdminOnly(meta)
    }).length
  }

  const { count, error } = await supabase
    .from('stock_alerts')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) {
    if (error.code === '42P01' || error.message?.includes('stock_alerts')) {
      return 0
    }
    throw error
  }
  return count ?? 0
}

export async function markStockAlertRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('stock_alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markStockAlertResolved(id: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('stock_alerts')
    .update({ resolved_at: now, read_at: now })
    .eq('id', id)
  if (error) throw error
}

export async function insertStockAlert(
  input: {
    alert_type: StockAlertType
    title: string
    message: string
    product_id?: string | null
    quantity_after?: number | null
    meta?: Record<string, unknown>
  },
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.from('stock_alerts').insert({
    alert_type: input.alert_type,
    title: input.title,
    message: input.message,
    product_id: input.product_id ?? null,
    quantity_after: input.quantity_after ?? null,
    meta: input.meta ?? {},
  })
  if (error) throw error
}

/** After stock replay / reconcile: one alert per product with aggregate quantity &lt; 0. */
export async function insertAlertsForProductsWithNegativeQuantity(
  client: SupabaseClient,
  mode: 'manual_reconcile' | 'offline_sync'
): Promise<number> {
  const { data: rows, error } = await client
    .from('products')
    .select('id, name, quantity')
    .lt('quantity', 0)
  if (error) throw error
  const list = (rows ?? []) as { id: string; name: string | null; quantity: number }[]
  let n = 0
  for (const r of list) {
    const name = r.name?.trim() || String(r.id)
    const qty = Math.trunc(Number(r.quantity))
    if (mode === 'offline_sync') {
      await insertStockAlert(
        {
          alert_type: 'negative_stock_offline_sync',
          title: i18n.t('stockAlerts.offlineSyncNegativeTitle', { name }),
          message: i18n.t('stockAlerts.offlineSyncNegativeMessage', {
            name,
            qty,
          }),
          product_id: String(r.id),
          quantity_after: qty,
          meta: { source: 'offline_sync' },
        },
        client
      )
    } else {
      await insertStockAlert(
        {
          alert_type: 'negative_stock',
          title: i18n.t('stockAlerts.reconcileNegativeTitle', { name }),
          message: i18n.t('stockAlerts.reconcileNegativeMessage', {
            name,
            qty,
          }),
          product_id: String(r.id),
          quantity_after: qty,
          meta: { source: 'manual_reconcile' },
        },
        client
      )
    }
    n += 1
  }
  return n
}
