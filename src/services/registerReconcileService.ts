import { supabase } from '@/lib/supabase'

/** Replay register-affecting balance_transactions into `register_tender_balances` for one warehouse. */
export async function recalculateRegisterFromLedger(
  registerWarehouseId: number
): Promise<void> {
  const { error } = await supabase.rpc('recalculate_register_from_balance_transactions', {
    p_register_warehouse_id: registerWarehouseId,
  })
  if (error) {
    if (error.code === '42883' || error.message?.includes('recalculate_register')) {
      return
    }
    throw error
  }
}

/** Replay all registers (warehouses with `has_register`). Returns warehouse count. */
export async function recalculateAllRegistersFromLedger(): Promise<number> {
  const { data, error } = await supabase.rpc('recalculate_all_register_balances')
  if (error) throw error
  const n = typeof data === 'number' ? data : Number(data)
  return Number.isFinite(n) ? n : 0
}
