import { supabase } from '@/lib/supabase'
import type { InventoryTransfer, ProductWithRelations } from '@/types'

const TRANSFERS = 'inventory_transfers'
const ITEMS = 'inventory_transfer_items'

export type InventoryTransferLineInput = {
  product_id: string
  quantity: number
}

export type InventoryTransferItemWithProduct = {
  id: string
  transfer_id: string
  product_id: string
  quantity: number
  product: Pick<ProductWithRelations, 'id' | 'name' | 'product_code' | 'unit'>
}

export type InventoryTransferWithItems = InventoryTransfer & {
  items: InventoryTransferItemWithProduct[]
}

function mergeLineQuantities(
  lines: InventoryTransferLineInput[]
): InventoryTransferLineInput[] {
  const m = new Map<string, number>()
  for (const l of lines) {
    const q = Math.trunc(Number(l.quantity))
    if (!l.product_id || q < 1) continue
    m.set(l.product_id, (m.get(l.product_id) ?? 0) + q)
  }
  return [...m.entries()].map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }))
}

export async function createInventoryTransfer(data: {
  from_warehouse_id: number
  to_warehouse_id: number
  note?: string | null
  items: InventoryTransferLineInput[]
}): Promise<string> {
  const merged = mergeLineQuantities(data.items)
  if (merged.length === 0) {
    throw new Error('At least one product line with quantity ≥ 1 is required')
  }
  if (data.from_warehouse_id === data.to_warehouse_id) {
    throw new Error('Source and destination warehouse must be different')
  }

  const { data: id, error } = await supabase.rpc('create_inventory_transfer', {
    p_from_warehouse_id: data.from_warehouse_id,
    p_to_warehouse_id: data.to_warehouse_id,
    p_note: data.note?.trim() || null,
    p_items: merged,
  })

  if (error) throw new Error(error.message || 'Transfer failed')
  if (!id || typeof id !== 'string') {
    throw new Error('Transfer failed: no id returned')
  }
  return id
}

export async function listInventoryTransfers(): Promise<InventoryTransfer[]> {
  const { data, error } = await supabase
    .from(TRANSFERS)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapTransferRow)
}

function mapTransferRow(row: Record<string, unknown>): InventoryTransfer {
  return {
    id: String(row.id),
    transfer_number: Number(row.transfer_number),
    from_warehouse_id: Number(row.from_warehouse_id),
    to_warehouse_id: Number(row.to_warehouse_id),
    note: row.note != null ? String(row.note) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getInventoryTransferById(
  id: string
): Promise<InventoryTransferWithItems | null> {
  const { data: row, error: te } = await supabase
    .from(TRANSFERS)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (te) throw te
  if (!row) return null

  const { data: itemRows, error: ie } = await supabase
    .from(ITEMS)
    .select(
      `
      id,
      transfer_id,
      product_id,
      quantity,
      product:products(id, name, product_code, unit)
    `
    )
    .eq('transfer_id', id)
    .order('product_id')

  if (ie) throw ie

  const items: InventoryTransferItemWithProduct[] = (itemRows ?? []).map(
    (r) => {
      const x = r as Record<string, unknown>
      const pr = x.product as Record<string, unknown> | null
      return {
        id: String(x.id),
        transfer_id: String(x.transfer_id),
        product_id: String(x.product_id),
        quantity: Number(x.quantity),
        product: {
          id: String(pr?.id),
          name: String(pr?.name ?? ''),
          product_code: String(pr?.product_code ?? ''),
          unit: String(pr?.unit ?? ''),
        },
      }
    }
  )

  return { ...mapTransferRow(row as Record<string, unknown>), items }
}
