import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

/** Replay `stock_movements` into `product_warehouse_stock` for given products (or all if null). */
export async function recalculateStockFromMovements(
  productIds: string[] | null,
  client: SupabaseClient = supabase
): Promise<number> {
  const { data, error } = await client.rpc('recalculate_stock_from_movements', {
    p_product_ids:
      productIds && productIds.length > 0 ? productIds : (null as string[] | null),
  })
  if (error) throw error
  const n = typeof data === 'number' ? data : Number(data)
  return Number.isFinite(n) ? n : 0
}

/**
 * After merging transactional tables to cloud: replay movements (timestamp order in SQL),
 * then refresh aggregate product quantities. Caller may add negative-stock alerts next.
 */
export async function replayStockMovementsAndReconcileTotals(
  client: SupabaseClient
): Promise<void> {
  const { error: e1 } = await client.rpc('recalculate_stock_from_movements', {
    p_product_ids: null as string[] | null,
  })
  if (e1) throw e1
  const { error: e2 } = await client.rpc('reconcile_product_stock_totals')
  if (e2) throw e2
}
