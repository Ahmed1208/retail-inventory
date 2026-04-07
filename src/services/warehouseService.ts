import { supabase } from '@/lib/supabase'
import type { Warehouse } from '@/types'

const TABLE = 'warehouses'

export const DEFAULT_WAREHOUSE_ID = 1

function isRpcMissing(err: { message?: string; code?: string }): boolean {
  const m = (err.message ?? '').toLowerCase()
  return (
    err.code === '42883' ||
    err.code === 'PGRST202' ||
    (m.includes('function') && m.includes('not exist'))
  )
}

/**
 * Guarantees warehouse id 1 exists (name "default") and repairs common gaps:
 * no default flag, missing PWS rows for wh 1, orphan warehouse_id on documents.
 * Uses DB RPC when migration 024 is applied; if the RPC is missing, inserts row 1
 * only when the warehouses table is empty (fresh data wipe without re-migration).
 */
export async function ensureDefaultWarehouse(): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('ensure_default_warehouse')
  if (!rpcErr) return

  if (!isRpcMissing(rpcErr)) throw rpcErr

  const { count, error: cErr } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
  if (cErr) throw cErr

  if (count === 0) {
    const { error: insErr } = await supabase.from(TABLE).insert({
      id: 1,
      name: 'default',
      location: null,
      is_default: true,
      updated_at: new Date().toISOString(),
    })
    if (insErr) throw insErr
  }

  const { error: seqErr } = await supabase.rpc('refresh_warehouse_id_sequence')
  if (seqErr && !isRpcMissing(seqErr)) {
    /* optional RPC from migration 023 */
  }
}

export async function listWarehouses(): Promise<Warehouse[]> {
  await ensureDefaultWarehouse()

  let { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error

  if (!data?.length) {
    await ensureDefaultWarehouse()
    ;({ data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('id', { ascending: true }))
    if (error) throw error
  }

  return (data ?? []).map(mapRow)
}

function mapRow(row: Record<string, unknown>): Warehouse {
  return {
    id: Number(row.id),
    name: String(row.name),
    location: row.location != null ? String(row.location) : null,
    is_default: Boolean(row.is_default),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getDefaultWarehouseId(): Promise<number | null> {
  await ensureDefaultWarehouse()
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return Number((data as { id: number }).id)
}

export async function createWarehouse(input: {
  id: number
  name: string
  location?: string | null
}): Promise<Warehouse> {
  await ensureDefaultWarehouse()
  const id = Math.floor(Number(input.id))
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid warehouse id')
  }
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id,
      name,
      location: input.location?.trim() || null,
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error
  const { error: seqErr } = await supabase.rpc('refresh_warehouse_id_sequence')
  if (seqErr) throw seqErr
  return mapRow(data as Record<string, unknown>)
}

export async function updateWarehouse(
  id: number,
  input: { name: string; location?: string | null }
): Promise<Warehouse> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name,
      location: input.location?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

/** At most one warehouse may be default. Pass `null` to clear default on all. */
export async function setDefaultWarehouse(id: number | null): Promise<void> {
  await ensureDefaultWarehouse()
  const now = new Date().toISOString()
  const { error: clearErr } = await supabase
    .from(TABLE)
    .update({ is_default: false, updated_at: now })
    .gte('id', 1)
  if (clearErr) throw clearErr
  if (id == null) return
  const { error } = await supabase
    .from(TABLE)
    .update({ is_default: true, updated_at: now })
    .eq('id', id)
  if (error) throw error
}
