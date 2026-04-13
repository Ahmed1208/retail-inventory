import type { SupabaseClient } from '@supabase/supabase-js'

import {
  SYNC_TABLES,
  SYNC_TABLES_EXCLUDED_FROM_LOCAL_WIPE,
  syncOnConflictColumns,
  syncRowKey,
  type SyncTableDef,
} from '@/config/syncTableRegistry'
import { insertAlertsForProductsWithNegativeQuantity } from '@/services/stockAlertsService'
import { replayStockMovementsAndReconcileTotals } from '@/services/stockReconcileService'

const PAGE_SIZE = 500
const UPSERT_BATCH = 100

/** PostgREST expects a JSON body for RPC calls; use `{}` for zero-argument functions. */
const RPC_NO_ARGS = {}

function postPushRpcHint(err: { message?: string; code?: string }): string {
  const m = (err.message ?? '').toLowerCase()
  const c = String(err.code ?? '')
  if (
    m.includes('upsert_profile_for_data_sync') &&
    (m.includes('could not find') || m.includes('schema cache') || c === 'PGRST202')
  ) {
    return (
      ' Apply migration `supabase/migrations/20260427120000_upsert_profile_for_data_sync.sql` on both databases, ' +
      'then run: NOTIFY pgrst, \'reload schema\';'
    )
  }
  const msgHasPgrst = m.includes('pgrst202')
  if (
    c === 'PGRST202' ||
    msgHasPgrst ||
    m.includes('schema cache') ||
    (m.includes('could not find') && m.includes('function'))
  ) {
    return (
      ' On hosted Supabase: apply migration `supabase/migrations/20260411140001_sync_runs_and_reconcile.sql` ' +
      '(e.g. `supabase db push` or paste in SQL Editor), then run: NOTIFY pgrst, \'reload schema\';'
    )
  }
  return ''
}

/** After pushing merged rows to cloud: replay movements in timestamp order, reconcile totals, alert negatives. */
async function postCloudMergeStockReconcile(cloudClient: SupabaseClient): Promise<void> {
  await replayStockMovementsAndReconcileTotals(cloudClient)
  await insertAlertsForProductsWithNegativeQuantity(cloudClient, 'offline_sync')
}

export type SyncProgress = {
  phase: 'idle' | 'running' | 'done' | 'error'
  currentTable: string | null
  tableIndex: number
  tableTotal: number
  rowsPushedToCloud: number
  rowsPulledToLocal: number
  conflictsResolved: number
  message?: string
}

export type ConflictPayload = {
  table: string
  rowKey: string
  localRow: Record<string, unknown>
  cloudRow: Record<string, unknown>
}

export type SyncResult = {
  rowsPushedToCloud: number
  rowsPulledToLocal: number
  conflictsResolved: number
  skippedConflicts: number
  /**
   * Profile rows skipped during upsert because `auth.users` had no row with the same id on the target DB.
   * Typical when a member exists only on hosted Auth or only on local Auth.
   */
  profilesSkippedMissingAuth?: number
  error?: string
}

/**
 * Catalog-style reference rows: only keys missing on cloud are pushed from local.
 * Not listed: `product_warehouse_stock` — same (product_id, warehouse_id) is edited on every
 * sale on multiple devices; it uses transactional merge (newer `updated_at` wins on push).
 */
const CLOUD_MASTER_REFERENCE_TABLES = new Set<string>([
  'brands',
  'categories',
  'warehouses',
  'profiles',
  'products',
  'product_price_history',
  'people',
])

/** Where cloud-master sync stopped when `error` is set (recovery may clear `error`). */
export type CloudMasterSyncFailurePhase =
  | 'cloud_push'
  | 'cloud_post_push'
  | 'local_pull'
  | 'local_reconcile'

export type CloudMasterSyncResult = SyncResult & {
  ordersRenumbered?: number
  purchaseOrdersRenumbered?: number
  failurePhase?: CloudMasterSyncFailurePhase
  /** True if the hosted DB may have received only part of the push or post-push steps failed. */
  cloudWritesMayBePartial?: boolean
  /** Completed push tables before a cloud_push failure (0 = failed before any table finished). */
  cloudPushTablesCompleted?: number
  /** Local pull/reconcile failed once, then a full re-pull + reconcile from cloud succeeded. */
  recoveredFromLocalFailure?: boolean
  /** Original error message when `recoveredFromLocalFailure` is true (for UI). */
  originalErrorBeforeRecovery?: string
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  const o = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(o).sort()) {
    out[k] = sortKeysDeep(o[k])
  }
  return out
}

export function stableStringifyRow(row: Record<string, unknown>): string {
  return JSON.stringify(sortKeysDeep(row))
}

function getTimestampMs(
  row: Record<string, unknown>,
  col: SyncTableDef['timestampColumn']
): number | null {
  if (!col) return null
  const v = row[col]
  if (v == null) return null
  const t = new Date(String(v)).getTime()
  return Number.isNaN(t) ? null : t
}

async function fetchAllRows(
  client: SupabaseClient,
  def: SyncTableDef,
  signal: AbortSignal
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>()
  let from = 0

  while (!signal.aborted) {
    let q = client.from(def.name).select('*')

    if (def.compositeKeys?.length) {
      const [a, b] = def.compositeKeys
      q = q.order(a, { ascending: true }).order(b, { ascending: true })
    } else {
      const pk = def.primaryKey ?? 'id'
      q = q.order(pk, { ascending: true })
    }

    const { data, error } = await q.range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`${def.name}: ${error.message}`)
    }
    if (!data?.length) break

    for (const row of data) {
      const rec = row as Record<string, unknown>
      map.set(syncRowKey(rec, def), rec)
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return map
}

/** Target DB must accept balance_transactions.register_warehouse_id (trigger: must be has_register). */
type RegisterWarehouseTargets = {
  allowedIds: Set<number>
  fallbackId: number | null
}

async function loadRegisterWarehouseTargets(
  client: SupabaseClient,
  signal: AbortSignal
): Promise<RegisterWarehouseTargets> {
  const { data, error } = await client
    .from('warehouses')
    .select('id, is_default')
    .eq('has_register', true)
    .order('is_default', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw new Error(`warehouses: ${error.message}`)
  if (signal.aborted) return { allowedIds: new Set(), fallbackId: null }
  const rows = data ?? []
  const allowedIds = new Set<number>()
  for (const r of rows) {
    const id = Number((r as { id: unknown }).id)
    if (Number.isFinite(id)) allowedIds.add(id)
  }
  const first = rows[0] as { id?: unknown } | undefined
  const fid = first != null ? Number(first.id) : NaN
  const fallbackId = Number.isFinite(fid) ? fid : null
  return { allowedIds, fallbackId }
}

/** Cleared before a full cloud→local mirror (FK-safe: children before parents). */
const SYNC_AUX_TABLES_DELETE_FIRST = ['stock_alerts', 'sync_event_queue'] as const

function normalizeBalanceTransactionsForUpsert(
  rows: Record<string, unknown>[],
  targets: RegisterWarehouseTargets
): Record<string, unknown>[] {
  const { allowedIds, fallbackId } = targets
  return rows.map((row) => {
    const rw = row.register_warehouse_id
    if (rw == null || rw === '') return row
    const id = typeof rw === 'number' ? rw : Number(rw)
    if (!Number.isFinite(id)) {
      if (fallbackId == null) return { ...row, register_warehouse_id: null }
      return { ...row, register_warehouse_id: fallbackId }
    }
    if (allowedIds.has(id)) return row
    if (fallbackId != null) return { ...row, register_warehouse_id: fallbackId }
    return { ...row, register_warehouse_id: null }
  })
}

export type ProfileSyncStats = {
  skippedMissingAuth: number
}

type UpsertBatchOptions = {
  registerTargets?: RegisterWarehouseTargets | null
  /** When upserting `profiles`, increments `skippedMissingAuth` for each RPC skip (no auth user). */
  profileSyncStats?: ProfileSyncStats | null
  /**
   * When pulling profiles into **local**, missing `auth.users` rows are created via Edge Function
   * `ensure-local-operator-auth` (admin-only), then the profile RPC is retried.
   */
  provisionLocalProfileAuthClient?: SupabaseClient | null
}

function warehouseIdsFromProfileRow(
  row: Record<string, unknown>
): number[] {
  const raw = row.allowed_warehouse_ids
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((n) => Number.isFinite(n))
  }
  return []
}

function featureOverridesJsonFromRow(row: Record<string, unknown>): Record<string, unknown> {
  const fo = row.feature_overrides
  if (fo != null && typeof fo === 'object' && !Array.isArray(fo)) {
    return fo as Record<string, unknown>
  }
  return {}
}

/** Same domain as `supabase/functions/create-member` (operator emails). */
const OPERATOR_MEMBER_DOMAIN = 'members.stockpilot.local'

function slugOperatorUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

/** Email used when mirroring a hosted profile to local Auth (must match Edge Function rules). */
function mirrorOperatorEmailFromProfileRow(row: Record<string, unknown>): string {
  const id = String(row.id ?? '')
  let slug = slugOperatorUsername(String(row.username ?? ''))
  if (slug.length < 2) {
    const tail = id.replace(/-/g, '').slice(0, 12)
    slug = tail.length >= 2 ? `u${tail}` : 'user'
  }
  return `${slug}@${OPERATOR_MEMBER_DOMAIN}`
}

async function rpcUpsertProfileRow(
  client: SupabaseClient,
  row: Record<string, unknown>
): Promise<'ok' | 'missing'> {
  const id = row.id
  if (typeof id !== 'string' || !id) {
    throw new Error('profiles upsert: missing id')
  }
  const createdRaw = row.created_at
  const pCreatedAt =
    createdRaw != null && createdRaw !== '' ? String(createdRaw) : null
  const { data, error } = await client.rpc('upsert_profile_for_data_sync', {
    p_id: id,
    p_username: String(row.username ?? ''),
    p_is_admin: Boolean(row.is_admin),
    p_feature_overrides: featureOverridesJsonFromRow(row),
    p_allowed_warehouse_ids: warehouseIdsFromProfileRow(row),
    p_created_at: pCreatedAt,
  })
  if (error) {
    throw new Error(`profiles upsert: ${error.message}${postPushRpcHint(error)}`)
  }
  const payload = data as { ok?: boolean; reason?: string } | null
  if (payload?.ok === true) return 'ok'
  if (payload?.ok === false && payload.reason === 'auth_user_missing') return 'missing'
  throw new Error(`profiles upsert: unexpected RPC result ${JSON.stringify(data)}`)
}

async function formatEdgeFunctionInvokeError(err: unknown): Promise<string> {
  if (!err || typeof err !== 'object') return String(err)
  const e = err as { name?: string; message?: string; context?: unknown }
  if (e.name === 'FunctionsHttpError' && e.context instanceof Response) {
    try {
      const res = e.context
      const txt = await res.clone().text()
      const status = res.status
      try {
        const j = JSON.parse(txt) as { error?: string }
        if (typeof j?.error === 'string' && j.error) {
          return `HTTP ${status}: ${j.error}`
        }
      } catch {
        /* not JSON */
      }
      const snippet = txt.replace(/\s+/g, ' ').trim().slice(0, 400)
      return snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}`
    } catch {
      return e.message ?? 'FunctionsHttpError'
    }
  }
  return e.message ?? String(err)
}

async function invokeEnsureLocalOperatorAuth(
  invokeClient: SupabaseClient,
  row: Record<string, unknown>,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return
  const id = row.id
  if (typeof id !== 'string' || !id) {
    throw new Error('profiles provision: missing id')
  }
  const email = mirrorOperatorEmailFromProfileRow(row)
  const slug = slugOperatorUsername(String(row.username ?? ''))
  const user_metadata: Record<string, unknown> = {
    username: slug.length >= 2 ? slug : (email.split('@')[0] ?? 'user'),
    is_admin: Boolean(row.is_admin),
    feature_overrides: featureOverridesJsonFromRow(row),
    allowed_warehouse_ids: warehouseIdsFromProfileRow(row),
  }

  const { data, error } = await invokeClient.functions.invoke(
    'ensure-local-operator-auth',
    {
      body: {
        user_id: id,
        email,
        user_metadata,
      },
    }
  )

  if (error) {
    const detail = await formatEdgeFunctionInvokeError(error)
    const hint =
      detail.includes('HTTP 404') ||
      (error as { message?: string }).message?.includes('Failed to send')
        ? ' If the status was 404, restart `npx supabase start` (or deploy `ensure-local-operator-auth` on hosted).'
        : ''
    throw new Error(`profiles: ensure-local-operator-auth: ${detail}${hint}`)
  }

  const res = data as { ok?: boolean; error?: string } | null
  if (res && typeof res.error === 'string') {
    throw new Error(`profiles: ensure-local-operator-auth: ${res.error}`)
  }
  if (!res?.ok) {
    throw new Error(
      `profiles: ensure-local-operator-auth: unexpected response ${JSON.stringify(data)}`
    )
  }
}

async function upsertBatch(
  client: SupabaseClient,
  def: SyncTableDef,
  rows: Record<string, unknown>[],
  signal: AbortSignal,
  options?: UpsertBatchOptions
): Promise<void> {
  const registerTargets = options?.registerTargets ?? null
  const profileSyncStats = options?.profileSyncStats ?? null
  const provisionLocalProfileAuthClient =
    options?.provisionLocalProfileAuthClient ?? null

  if (rows.length === 0 || signal.aborted) return
  const onConflict = syncOnConflictColumns(def)
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    if (signal.aborted) return
    let chunk = rows.slice(i, i + UPSERT_BATCH)
    if (def.name === 'balance_transactions' && registerTargets) {
      chunk = normalizeBalanceTransactionsForUpsert(chunk, registerTargets)
    }
    if (def.name === 'profiles') {
      for (const row of chunk) {
        if (signal.aborted) return
        let outcome = await rpcUpsertProfileRow(client, row)
        if (outcome === 'missing' && provisionLocalProfileAuthClient) {
          await invokeEnsureLocalOperatorAuth(
            provisionLocalProfileAuthClient,
            row,
            signal
          )
          if (signal.aborted) return
          outcome = await rpcUpsertProfileRow(client, row)
        }
        if (outcome === 'missing') {
          if (profileSyncStats) profileSyncStats.skippedMissingAuth += 1
          continue
        }
      }
      continue
    }
    if (def.name === 'orders' || def.name === 'purchase_orders') {
      // One row per request so each INSERT runs document-number triggers separately
      // (avoids rare bulk-upsert + per-row trigger interactions on some Postgres builds).
      for (const row of chunk) {
        if (signal.aborted) return
        const { error } = await client.from(def.name).upsert([row], {
          onConflict,
        })
        if (error) {
          throw new Error(`${def.name} upsert: ${error.message}`)
        }
      }
      continue
    }
    const { error } = await client.from(def.name).upsert(chunk, {
      onConflict,
    })
    if (error) {
      throw new Error(`${def.name} upsert: ${error.message}`)
    }
  }
}

async function reconcileLocalProductStock(
  localClient: SupabaseClient,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return
  const { error: eRecLocal0 } = await localClient.rpc(
    'recalculate_stock_from_movements',
    { p_product_ids: null as string[] | null }
  )
  if (eRecLocal0) {
    throw new Error(
      `recalculate_stock_from_movements (local): ${eRecLocal0.message}${postPushRpcHint(eRecLocal0)}`
    )
  }
  const { error: eRecLocal } = await localClient.rpc(
    'reconcile_product_stock_totals',
    RPC_NO_ARGS
  )
  if (eRecLocal) {
    throw new Error(
      `reconcile_product_stock_totals (local): ${eRecLocal.message}${postPushRpcHint(eRecLocal)}`
    )
  }
}

/** Full cloud snapshot into local (SYNC_TABLES order). Returns total rows upserted. */
async function pullCloudTablesIntoLocal(
  localClient: SupabaseClient,
  cloudClient: SupabaseClient,
  localRegisterTargets: RegisterWarehouseTargets,
  signal: AbortSignal,
  onProgress: (p: SyncProgress) => void,
  ctx: {
    tableTotal: number
    rowsPushedToCloud: number
    /** Appended to progress label, e.g. " · recovery". */
    pullLabelSuffix: string
    profileSyncStats?: ProfileSyncStats | null
  }
): Promise<number> {
  let rowsPulledToLocal = 0
  for (let ti = 0; ti < SYNC_TABLES.length; ti++) {
    if (signal.aborted) break
    const def = SYNC_TABLES[ti]
    onProgress({
      phase: 'running',
      currentTable: `${def.name} (pull${ctx.pullLabelSuffix})`,
      tableIndex: ti,
      tableTotal: ctx.tableTotal,
      rowsPushedToCloud: ctx.rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
    })
    const cloudMap = await fetchAllRows(cloudClient, def, signal)
    const toLocal = [...cloudMap.values()]
    rowsPulledToLocal += toLocal.length
    await upsertBatch(localClient, def, toLocal, signal, {
      registerTargets: localRegisterTargets,
      profileSyncStats: ctx.profileSyncStats ?? null,
      provisionLocalProfileAuthClient: localClient,
    })
  }
  return rowsPulledToLocal
}

async function deleteAllRowsInNamedTableWithIdPk(
  client: SupabaseClient,
  tableName: string,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return
  const { error } = await client.from(tableName).delete().not('id', 'is', null)
  if (error) {
    const low = error.message.toLowerCase()
    if (
      low.includes('relation') &&
      (low.includes('does not exist') || low.includes('not found'))
    ) {
      return
    }
    throw new Error(`${tableName} delete: ${error.message}`)
  }
}

async function deleteAllRowsInSyncedTable(
  client: SupabaseClient,
  def: SyncTableDef,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return
  if (def.compositeKeys?.length) {
    const k0 = def.compositeKeys[0]!
    const { error } = await client.from(def.name).delete().not(k0, 'is', null)
    if (error) throw new Error(`${def.name} delete: ${error.message}`)
    return
  }
  const pk = def.primaryKey ?? 'id'
  const { error } = await client.from(def.name).delete().not(pk, 'is', null)
  if (error) throw new Error(`${def.name} delete: ${error.message}`)
}

/**
 * FK-safe: aux tables first, then synced tables children → parents.
 * `profiles` is skipped (see `SYNC_TABLES_EXCLUDED_FROM_LOCAL_WIPE`) so local Auth users keep their profile rows.
 */
async function wipeLocalSyncedMirrorTables(
  localClient: SupabaseClient,
  signal: AbortSignal
): Promise<void> {
  for (const name of SYNC_AUX_TABLES_DELETE_FIRST) {
    await deleteAllRowsInNamedTableWithIdPk(localClient, name, signal)
  }
  for (const def of [...SYNC_TABLES].reverse()) {
    if (SYNC_TABLES_EXCLUDED_FROM_LOCAL_WIPE.has(def.name)) continue
    await deleteAllRowsInSyncedTable(localClient, def, signal)
  }
}

function classifyRowPair(
  def: SyncTableDef,
  localRow: Record<string, unknown> | undefined,
  cloudRow: Record<string, unknown> | undefined
):
  | { kind: 'skip' }
  | { kind: 'pushCloud'; row: Record<string, unknown> }
  | { kind: 'pushLocal'; row: Record<string, unknown> }
  | { kind: 'autoCloudFromLocal'; row: Record<string, unknown> }
  | { kind: 'autoLocalFromCloud'; row: Record<string, unknown> }
  | {
      kind: 'conflict'
      localRow: Record<string, unknown>
      cloudRow: Record<string, unknown>
    } {
  if (!localRow && !cloudRow) return { kind: 'skip' }
  if (localRow && !cloudRow) return { kind: 'pushCloud', row: localRow }
  if (!localRow && cloudRow) return { kind: 'pushLocal', row: cloudRow }
  if (localRow && cloudRow) {
    if (stableStringifyRow(localRow) === stableStringifyRow(cloudRow)) {
      return { kind: 'skip' }
    }
    const col = def.timestampColumn
    if (col && def.preferNewer) {
      const tL = getTimestampMs(localRow, col)
      const tC = getTimestampMs(cloudRow, col)
      if (tL != null && tC != null && tL !== tC) {
        if (tL > tC) return { kind: 'autoCloudFromLocal', row: localRow }
        if (tC > tL) return { kind: 'autoLocalFromCloud', row: cloudRow }
      }
    }
    return { kind: 'conflict', localRow, cloudRow }
  }
  return { kind: 'skip' }
}

/**
 * Cloud-master push for transactional tables: union(local, cloud) keys; upsert only when the
 * chosen row differs from what cloud already has (newer side wins; ties keep cloud — no push).
 * Parallel orders (different UUIDs) all push; same-row edits use `preferNewer` timestamps.
 */
function pickRowForCloudMasterPush(
  def: SyncTableDef,
  localRow: Record<string, unknown> | undefined,
  cloudRow: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!localRow && !cloudRow) return null
  if (localRow && !cloudRow) return localRow
  if (!localRow && cloudRow) return null

  const d = classifyRowPair(def, localRow, cloudRow)
  switch (d.kind) {
    case 'skip':
      return null
    case 'pushCloud':
      return localRow ?? null
    case 'pushLocal':
      return null
    case 'autoCloudFromLocal':
      return d.row
    case 'autoLocalFromCloud':
      return null
    case 'conflict':
      return null
    default:
      return null
  }
}

export async function runBidirectionalSync({
  localClient,
  cloudClient,
  onProgress,
  onConflict,
  signal,
}: {
  localClient: SupabaseClient
  cloudClient: SupabaseClient
  onProgress: (p: SyncProgress) => void
  onConflict: (c: ConflictPayload) => Promise<'local' | 'cloud' | 'skip'>
  signal: AbortSignal
}): Promise<SyncResult> {
  let rowsPushedToCloud = 0
  let rowsPulledToLocal = 0
  let conflictsResolved = 0
  let skippedConflicts = 0
  const profileLocalStats: ProfileSyncStats = { skippedMissingAuth: 0 }

  const tableTotal = SYNC_TABLES.length

  try {
    const cloudRegisterTargets = await loadRegisterWarehouseTargets(cloudClient, signal)
    const localRegisterTargets = await loadRegisterWarehouseTargets(localClient, signal)

    for (let ti = 0; ti < SYNC_TABLES.length; ti++) {
      if (signal.aborted) break
      const def = SYNC_TABLES[ti]
      onProgress({
        phase: 'running',
        currentTable: def.name,
        tableIndex: ti,
        tableTotal,
        rowsPushedToCloud,
        rowsPulledToLocal,
        conflictsResolved,
      })

      const localMap = await fetchAllRows(localClient, def, signal)
      const cloudMap = await fetchAllRows(cloudClient, def, signal)

      const allKeys = new Set([...localMap.keys(), ...cloudMap.keys()])

      const toCloud: Record<string, unknown>[] = []
      const toLocal: Record<string, unknown>[] = []
      const conflicts: {
        rowKey: string
        localRow: Record<string, unknown>
        cloudRow: Record<string, unknown>
      }[] = []

      for (const rowKey of allKeys) {
        if (signal.aborted) break
        const localRow = localMap.get(rowKey)
        const cloudRow = cloudMap.get(rowKey)
        const decision = classifyRowPair(def, localRow, cloudRow)

        switch (decision.kind) {
          case 'skip':
            break
          case 'pushCloud':
            toCloud.push(decision.row)
            rowsPushedToCloud += 1
            break
          case 'pushLocal':
            toLocal.push(decision.row)
            rowsPulledToLocal += 1
            break
          case 'autoCloudFromLocal':
            toCloud.push(decision.row)
            rowsPushedToCloud += 1
            break
          case 'autoLocalFromCloud':
            toLocal.push(decision.row)
            rowsPulledToLocal += 1
            break
          case 'conflict':
            conflicts.push({
              rowKey,
              localRow: decision.localRow,
              cloudRow: decision.cloudRow,
            })
            break
          default:
            break
        }
      }

      await upsertBatch(cloudClient, def, toCloud, signal, {
        registerTargets: cloudRegisterTargets,
      })
      await upsertBatch(localClient, def, toLocal, signal, {
        registerTargets: localRegisterTargets,
        profileSyncStats: profileLocalStats,
        provisionLocalProfileAuthClient: localClient,
      })

      for (const c of conflicts) {
        if (signal.aborted) break
        const choice = await onConflict({
          table: def.name,
          rowKey: c.rowKey,
          localRow: c.localRow,
          cloudRow: c.cloudRow,
        })

        if (choice === 'skip') {
          skippedConflicts += 1
          continue
        }

        conflictsResolved += 1
        if (choice === 'local') {
          await upsertBatch(cloudClient, def, [c.localRow], signal, {
            registerTargets: cloudRegisterTargets,
          })
          rowsPushedToCloud += 1
        } else {
          await upsertBatch(localClient, def, [c.cloudRow], signal, {
            registerTargets: localRegisterTargets,
            profileSyncStats: profileLocalStats,
            provisionLocalProfileAuthClient: localClient,
          })
          rowsPulledToLocal += 1
        }
      }
    }

    if (!signal.aborted && rowsPushedToCloud > 0) {
      try {
        await postCloudMergeStockReconcile(cloudClient)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        onProgress({
          phase: 'error',
          currentTable: null,
          tableIndex: 0,
          tableTotal,
          rowsPushedToCloud,
          rowsPulledToLocal,
          conflictsResolved,
          message: msg,
        })
        return {
          rowsPushedToCloud,
          rowsPulledToLocal,
          conflictsResolved,
          skippedConflicts,
          profilesSkippedMissingAuth: profileLocalStats.skippedMissingAuth,
          error: msg,
        }
      }
    }

    if (!signal.aborted) {
      try {
        localStorage.setItem('stockpilot.sync.lastRunAt', new Date().toISOString())
      } catch {
        /* ignore quota / private mode */
      }
    }

    onProgress({
      phase: signal.aborted ? 'idle' : 'done',
      currentTable: null,
      tableIndex: tableTotal,
      tableTotal,
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved,
    })

    return {
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved,
      skippedConflicts,
      profilesSkippedMissingAuth: profileLocalStats.skippedMissingAuth,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onProgress({
      phase: 'error',
      currentTable: null,
      tableIndex: 0,
      tableTotal,
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved,
      message: msg,
    })
    return {
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved,
      skippedConflicts,
      profilesSkippedMissingAuth: profileLocalStats.skippedMissingAuth,
      error: msg,
    }
  }
}

/**
 * Cloud-master sync for multi-device / parallel work:
 * 1. Reference tables (catalog): push local rows whose keys are missing on cloud only.
 * 2. Transactional tables (orders, PWS, ledger, …): union(local, cloud) keys; push the row with
 *    the newer sync timestamp (`preferNewer`); ties skip push (cloud row kept). New UUIDs on each
 *    device therefore all merge onto cloud. Sales/PO `order_number` is sent as-is; DB keeps it if
 *    unused on cloud, otherwise assigns the next free number.
 * 3. Cloud: repair duplicate `order_number` / PO numbers, reconcile `products.quantity` from PWS.
 * 4. Pull full cloud snapshot into local, then reconcile quantities on local.
 *
 * Hosted and local are separate databases: a full atomic transaction across both is not
 * possible from the browser. If the pull or local reconcile step fails, this run **retries**
 * once with a full re-pull from cloud plus local reconcile so the device matches cloud after a
 * successful push. If cloud push or cloud post-push fails, the hosted DB may be partially
 * updated — see `cloudWritesMayBePartial` on the result (no automatic cloud rollback).
 *
 * Same Supabase project used by many users in parallel is supported at DB level (RLS + PKs);
 * sync is a periodic merge — avoid two offline copies editing the **same** row without syncing
 * for a long time if you need strict OT semantics.
 */
export async function runCloudMasterSync({
  localClient,
  cloudClient,
  onProgress,
  signal,
}: {
  localClient: SupabaseClient
  cloudClient: SupabaseClient
  onProgress: (p: SyncProgress) => void
  signal: AbortSignal
}): Promise<CloudMasterSyncResult> {
  let rowsPushedToCloud = 0
  let rowsPulledToLocal = 0
  let ordersRenumbered = 0
  let purchaseOrdersRenumbered = 0
  let profilesSkippedMissingAuth = 0
  const tableTotal = SYNC_TABLES.length

  let failurePhase: CloudMasterSyncFailurePhase | undefined
  let cloudPushTablesCompleted = 0
  let localRegisterTargets: RegisterWarehouseTargets = {
    allowedIds: new Set(),
    fallbackId: null,
  }

  try {
    const cloudRegisterTargets = await loadRegisterWarehouseTargets(cloudClient, signal)
    localRegisterTargets = await loadRegisterWarehouseTargets(localClient, signal)

    failurePhase = 'cloud_push'
    for (let ti = 0; ti < SYNC_TABLES.length; ti++) {
      if (signal.aborted) break
      const def = SYNC_TABLES[ti]
      const isRef = CLOUD_MASTER_REFERENCE_TABLES.has(def.name)

      onProgress({
        phase: 'running',
        currentTable: `${def.name} (push)`,
        tableIndex: ti,
        tableTotal,
        rowsPushedToCloud,
        rowsPulledToLocal,
        conflictsResolved: 0,
      })

      const localMap = await fetchAllRows(localClient, def, signal)
      const cloudMap = await fetchAllRows(cloudClient, def, signal)

      const toCloud: Record<string, unknown>[] = []

      if (isRef) {
        for (const rowKey of localMap.keys()) {
          if (signal.aborted) break
          if (!cloudMap.has(rowKey)) {
            const row = localMap.get(rowKey)
            if (row) {
              toCloud.push(row)
              rowsPushedToCloud += 1
            }
          }
        }
      } else {
        const allKeys = new Set([...localMap.keys(), ...cloudMap.keys()])
        for (const rowKey of allKeys) {
          if (signal.aborted) break
          const picked = pickRowForCloudMasterPush(
            def,
            localMap.get(rowKey),
            cloudMap.get(rowKey)
          )
          if (picked) {
            toCloud.push(picked)
            rowsPushedToCloud += 1
          }
        }
      }

      await upsertBatch(cloudClient, def, toCloud, signal, {
        registerTargets: cloudRegisterTargets,
      })
      cloudPushTablesCompleted += 1
    }

    if (!signal.aborted) {
      failurePhase = 'cloud_post_push'
      const { data: nOrd, error: eOrd } = await cloudClient.rpc(
        'repair_duplicate_order_numbers',
        RPC_NO_ARGS
      )
      if (eOrd) {
        throw new Error(
          `repair_duplicate_order_numbers: ${eOrd.message}${postPushRpcHint(eOrd)}`
        )
      }
      ordersRenumbered = typeof nOrd === 'number' ? nOrd : Number(nOrd) || 0

      const { data: nPo, error: ePo } = await cloudClient.rpc(
        'repair_duplicate_purchase_order_numbers',
        RPC_NO_ARGS
      )
      if (ePo) {
        throw new Error(
          `repair_duplicate_purchase_order_numbers: ${ePo.message}${postPushRpcHint(ePo)}`
        )
      }
      purchaseOrdersRenumbered = typeof nPo === 'number' ? nPo : Number(nPo) || 0

      if (rowsPushedToCloud > 0) {
        await postCloudMergeStockReconcile(cloudClient)
      } else {
        const { error: eRec } = await cloudClient.rpc(
          'reconcile_product_stock_totals',
          RPC_NO_ARGS
        )
        if (eRec) {
          throw new Error(
            `reconcile_product_stock_totals: ${eRec.message}${postPushRpcHint(eRec)}`
          )
        }
      }
    }

    failurePhase = 'local_pull'
    const profilePullStats: ProfileSyncStats = { skippedMissingAuth: 0 }
    rowsPulledToLocal = await pullCloudTablesIntoLocal(
      localClient,
      cloudClient,
      localRegisterTargets,
      signal,
      onProgress,
      {
        tableTotal,
        rowsPushedToCloud,
        pullLabelSuffix: '',
        profileSyncStats: profilePullStats,
      }
    )
    profilesSkippedMissingAuth = profilePullStats.skippedMissingAuth

    failurePhase = 'local_reconcile'
    await reconcileLocalProductStock(localClient, signal)

    if (!signal.aborted) {
      try {
        localStorage.setItem('stockpilot.sync.lastRunAt', new Date().toISOString())
      } catch {
        /* ignore */
      }
    }

    onProgress({
      phase: signal.aborted ? 'idle' : 'done',
      currentTable: null,
      tableIndex: tableTotal,
      tableTotal,
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
    })

    return {
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
      skippedConflicts: 0,
      ordersRenumbered,
      purchaseOrdersRenumbered,
      profilesSkippedMissingAuth,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const recoverable =
      (failurePhase === 'local_pull' || failurePhase === 'local_reconcile') && !signal.aborted

    if (recoverable) {
      try {
        onProgress({
          phase: 'running',
          currentTable: 'local (recovery: full pull from cloud)',
          tableIndex: 0,
          tableTotal,
          rowsPushedToCloud,
          rowsPulledToLocal: 0,
          conflictsResolved: 0,
        })
        const profilePullStatsRecovery: ProfileSyncStats = { skippedMissingAuth: 0 }
        rowsPulledToLocal = await pullCloudTablesIntoLocal(
          localClient,
          cloudClient,
          localRegisterTargets,
          signal,
          onProgress,
          {
            tableTotal,
            rowsPushedToCloud,
            pullLabelSuffix: ' · recovery',
            profileSyncStats: profilePullStatsRecovery,
          }
        )
        profilesSkippedMissingAuth = profilePullStatsRecovery.skippedMissingAuth
        await reconcileLocalProductStock(localClient, signal)

        if (!signal.aborted) {
          try {
            localStorage.setItem('stockpilot.sync.lastRunAt', new Date().toISOString())
          } catch {
            /* ignore */
          }
        }

        onProgress({
          phase: signal.aborted ? 'idle' : 'done',
          currentTable: null,
          tableIndex: tableTotal,
          tableTotal,
          rowsPushedToCloud,
          rowsPulledToLocal,
          conflictsResolved: 0,
        })

        return {
          rowsPushedToCloud,
          rowsPulledToLocal,
          conflictsResolved: 0,
          skippedConflicts: 0,
          ordersRenumbered,
          purchaseOrdersRenumbered,
          profilesSkippedMissingAuth,
          recoveredFromLocalFailure: true,
          originalErrorBeforeRecovery: msg,
        }
      } catch (re) {
        const rmsg = re instanceof Error ? re.message : String(re)
        const combined = `${msg}\n\nLocal recovery failed: ${rmsg}`
        const cloudWritesMayBePartial =
          failurePhase === 'cloud_post_push' ||
          (failurePhase === 'cloud_push' && cloudPushTablesCompleted > 0)

        onProgress({
          phase: 'error',
          currentTable: null,
          tableIndex: 0,
          tableTotal,
          rowsPushedToCloud,
          rowsPulledToLocal,
          conflictsResolved: 0,
          message: combined,
        })
        return {
          rowsPushedToCloud,
          rowsPulledToLocal,
          conflictsResolved: 0,
          skippedConflicts: 0,
          ordersRenumbered,
          purchaseOrdersRenumbered,
          profilesSkippedMissingAuth,
          failurePhase,
          cloudWritesMayBePartial,
          cloudPushTablesCompleted,
          error: combined,
        }
      }
    }

    const cloudWritesMayBePartial =
      failurePhase === 'cloud_post_push' ||
      (failurePhase === 'cloud_push' && cloudPushTablesCompleted > 0)

    onProgress({
      phase: 'error',
      currentTable: null,
      tableIndex: 0,
      tableTotal,
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
      message: msg,
    })
    return {
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
      skippedConflicts: 0,
      ordersRenumbered,
      purchaseOrdersRenumbered,
      profilesSkippedMissingAuth,
      failurePhase,
      cloudWritesMayBePartial,
      cloudPushTablesCompleted,
      error: msg,
    }
  }
}

/**
 * Wipes mirrored business data on **local** Supabase (synced tables + stock_alerts +
 * sync_event_queue), optionally repairs document numbers on **cloud**, then pulls the full
 * cloud snapshot into local. Does not push local rows to cloud. Use when local is corrupt
 * or out of sync and you want a clean copy of hosted data.
 */
export async function runResetLocalFromCloud({
  localClient,
  cloudClient,
  onProgress,
  signal,
}: {
  localClient: SupabaseClient
  cloudClient: SupabaseClient
  onProgress: (p: SyncProgress) => void
  signal: AbortSignal
}): Promise<CloudMasterSyncResult> {
  let rowsPushedToCloud = 0
  let rowsPulledToLocal = 0
  let ordersRenumbered = 0
  let purchaseOrdersRenumbered = 0
  let profilesSkippedMissingAuth = 0
  const tableTotal = SYNC_TABLES.length

  try {
    const localRegisterTargets = await loadRegisterWarehouseTargets(localClient, signal)

    onProgress({
      phase: 'running',
      currentTable: 'local (clearing mirrored tables)',
      tableIndex: 0,
      tableTotal,
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
    })
    await wipeLocalSyncedMirrorTables(localClient, signal)

    if (!signal.aborted) {
      onProgress({
        phase: 'running',
        currentTable: 'cloud (repair document numbers)',
        tableIndex: 0,
        tableTotal,
        rowsPushedToCloud,
        rowsPulledToLocal,
        conflictsResolved: 0,
      })
      const { data: nOrd, error: eOrd } = await cloudClient.rpc(
        'repair_duplicate_order_numbers',
        RPC_NO_ARGS
      )
      if (eOrd) {
        throw new Error(
          `repair_duplicate_order_numbers: ${eOrd.message}${postPushRpcHint(eOrd)}`
        )
      }
      ordersRenumbered = typeof nOrd === 'number' ? nOrd : Number(nOrd) || 0

      const { data: nPo, error: ePo } = await cloudClient.rpc(
        'repair_duplicate_purchase_order_numbers',
        RPC_NO_ARGS
      )
      if (ePo) {
        throw new Error(
          `repair_duplicate_purchase_order_numbers: ${ePo.message}${postPushRpcHint(ePo)}`
        )
      }
      purchaseOrdersRenumbered = typeof nPo === 'number' ? nPo : Number(nPo) || 0

      const { error: eRec } = await cloudClient.rpc(
        'reconcile_product_stock_totals',
        RPC_NO_ARGS
      )
      if (eRec) {
        throw new Error(
          `reconcile_product_stock_totals: ${eRec.message}${postPushRpcHint(eRec)}`
        )
      }
    }

    const profilePullStatsReset: ProfileSyncStats = { skippedMissingAuth: 0 }
    rowsPulledToLocal = await pullCloudTablesIntoLocal(
      localClient,
      cloudClient,
      localRegisterTargets,
      signal,
      onProgress,
      {
        tableTotal,
        rowsPushedToCloud,
        pullLabelSuffix: '',
        profileSyncStats: profilePullStatsReset,
      }
    )
    profilesSkippedMissingAuth = profilePullStatsReset.skippedMissingAuth

    await reconcileLocalProductStock(localClient, signal)

    if (!signal.aborted) {
      try {
        localStorage.setItem('stockpilot.sync.lastRunAt', new Date().toISOString())
      } catch {
        /* ignore */
      }
    }

    onProgress({
      phase: signal.aborted ? 'idle' : 'done',
      currentTable: null,
      tableIndex: tableTotal,
      tableTotal,
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
    })

    return {
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
      skippedConflicts: 0,
      ordersRenumbered,
      purchaseOrdersRenumbered,
      profilesSkippedMissingAuth,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onProgress({
      phase: 'error',
      currentTable: null,
      tableIndex: 0,
      tableTotal,
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
      message: msg,
    })
    return {
      rowsPushedToCloud,
      rowsPulledToLocal,
      conflictsResolved: 0,
      skippedConflicts: 0,
      ordersRenumbered,
      purchaseOrdersRenumbered,
      profilesSkippedMissingAuth,
      error: msg,
    }
  }
}

export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return (
      u.hostname === '127.0.0.1' ||
      u.hostname === 'localhost' ||
      u.hostname.endsWith('.local')
    )
  } catch {
    return false
  }
}
