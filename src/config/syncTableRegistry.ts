/**
 * Tables included in Admin → Data sync (local ↔ cloud).
 * Order respects FKs: parents before children. `profiles` references `auth.users(id)`; writes use
 * RPC `upsert_profile_for_data_sync` so rows apply only when the same user id exists in that DB's Auth.
 *
 * Parallel devices: orders use UUID `id` (no collision); `order_number` is kept on push when
 * free on cloud, else the DB assigns the next number. Cloud repair RPCs fix true duplicates.
 * Stock levels merge via `product_warehouse_stock.updated_at` in cloud-master mode
 * (see `dataSyncService` — PWS is not reference-only).
 */

export type SyncTimestampColumn = 'updated_at' | 'created_at' | 'recorded_at'

export type SyncTableDef = {
  name: string
  /** Single-column PK (default `id`). Ignored when `compositeKeys` is set. */
  primaryKey?: string
  /** Composite primary key (e.g. product_warehouse_stock). `onConflict` uses joined column names. */
  compositeKeys?: string[]
  /** Used for last-write-wins when both sides differ; null = equality / conflict only */
  timestampColumn: SyncTimestampColumn | null
  /** When true and timestamps differ, newer row wins without modal */
  preferNewer: boolean
}

/** Not deleted on “replace local with cloud” wipe — avoids orphaning auth.users without profiles. */
export const SYNC_TABLES_EXCLUDED_FROM_LOCAL_WIPE = new Set<string>(['profiles'])

export const SYNC_TABLES: SyncTableDef[] = [
  { name: 'brands', primaryKey: 'id', timestampColumn: 'created_at', preferNewer: true },
  { name: 'categories', primaryKey: 'id', timestampColumn: 'created_at', preferNewer: true },
  { name: 'warehouses', primaryKey: 'id', timestampColumn: 'updated_at', preferNewer: true },
  {
    name: 'profiles',
    primaryKey: 'id',
    timestampColumn: 'created_at',
    preferNewer: true,
  },
  { name: 'products', primaryKey: 'id', timestampColumn: 'updated_at', preferNewer: true },
  {
    name: 'product_warehouse_stock',
    compositeKeys: ['product_id', 'warehouse_id'],
    timestampColumn: 'updated_at',
    preferNewer: true,
  },
  {
    name: 'product_price_history',
    primaryKey: 'id',
    timestampColumn: 'recorded_at',
    preferNewer: true,
  },
  { name: 'people', primaryKey: 'id', timestampColumn: 'updated_at', preferNewer: true },
  { name: 'purchase_orders', primaryKey: 'id', timestampColumn: 'updated_at', preferNewer: true },
  {
    name: 'purchase_order_items',
    primaryKey: 'id',
    timestampColumn: 'created_at',
    preferNewer: true,
  },
  {
    name: 'purchase_order_payments',
    primaryKey: 'id',
    timestampColumn: 'created_at',
    preferNewer: true,
  },
  { name: 'orders', primaryKey: 'id', timestampColumn: 'updated_at', preferNewer: true },
  { name: 'order_items', primaryKey: 'id', timestampColumn: 'created_at', preferNewer: true },
  {
    name: 'payment_installments',
    primaryKey: 'id',
    timestampColumn: 'created_at',
    preferNewer: true,
  },
  { name: 'order_payments', primaryKey: 'id', timestampColumn: 'created_at', preferNewer: true },
  {
    name: 'stock_movements',
    primaryKey: 'id',
    timestampColumn: 'created_at',
    preferNewer: true,
  },
  {
    name: 'balance_transactions',
    primaryKey: 'id',
    timestampColumn: 'created_at',
    preferNewer: true,
  },
  {
    name: 'inventory_transfers',
    primaryKey: 'id',
    timestampColumn: 'updated_at',
    preferNewer: true,
  },
  {
    name: 'inventory_transfer_items',
    primaryKey: 'id',
    timestampColumn: null,
    preferNewer: false,
  },
]

export function syncRowKey(
  row: Record<string, unknown>,
  def: SyncTableDef
): string {
  if (def.compositeKeys?.length) {
    return def.compositeKeys.map((k) => String(row[k] ?? '')).join('::')
  }
  const pk = def.primaryKey ?? 'id'
  return String(row[pk] ?? '')
}

export function syncOnConflictColumns(def: SyncTableDef): string {
  if (def.compositeKeys?.length) {
    return def.compositeKeys.join(',')
  }
  return def.primaryKey ?? 'id'
}
