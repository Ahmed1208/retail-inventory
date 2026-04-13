import { supabase } from '@/lib/supabase'

/** Replay all balance_transactions into `people.balance` for one person (DB). */
export async function recalculateWalletFromBalanceTransactions(
  personId: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc('recalculate_wallet_from_balance_transactions', {
    p_person_id: personId,
  })
  if (error) {
    if (error.code === '42883' || error.message?.includes('recalculate_wallet')) {
      return null
    }
    throw error
  }
  if (data == null) return null
  const n = typeof data === 'number' ? data : Number(data)
  return Number.isFinite(n) ? n : null
}

/** Replay wallets for every person (DB). Returns count of people processed. */
export async function recalculateAllWalletsFromLedger(): Promise<number> {
  const { data, error } = await supabase.rpc('recalculate_wallets_for_all_people')
  if (error) throw error
  const n = typeof data === 'number' ? data : Number(data)
  return Number.isFinite(n) ? n : 0
}
