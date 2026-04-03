import { supabase } from '@/lib/supabase'
import {
  insertBalanceTransactionRow,
  mapTxRow,
  roundMoney,
} from '@/services/peopleService'
import type { BalanceTransaction, PaymentMethod } from '@/types'

const BALANCE_TX = 'balance_transactions'

/** Per-method running register balance (tender in drawer / accounts). */
export type RegisterBalances = Record<PaymentMethod, number> & {
  total: number
}

const ZERO_METHODS: Record<PaymentMethod, number> = {
  cash: 0,
  visa: 0,
  cheque: 0,
  instapay: 0,
}

function emptyBalances(): RegisterBalances {
  return { ...ZERO_METHODS, total: 0 }
}

function addToMethod(
  acc: Record<PaymentMethod, number>,
  method: PaymentMethod,
  delta: number
): void {
  acc[method] = roundMoney(acc[method] + delta)
}

/**
 * Ledger rows that affect the physical/electronic register:
 * - payment_in / payment_out (reversed rows excluded). Rows with null `payment_method`
 *   are attributed to **cash** so sales/purchases that used the legacy single-line
 *   ledger path still move the register balance.
 * - register_deposit (+) / register_withdraw (-), positive amount = magnitude; method required.
 */
export function registerEffectForRow(
  tx: BalanceTransaction
): { method: PaymentMethod; delta: number } | null {
  if (tx.reversed_at != null && String(tx.reversed_at).trim() !== '') {
    return null
  }

  if (tx.type === 'payment_in') {
    const delta = roundMoney(-tx.amount)
    if (Math.abs(delta) < 0.0001) return null
    const method = tx.payment_method ?? 'cash'
    return { method, delta }
  }
  if (tx.type === 'payment_out') {
    const delta = roundMoney(-tx.amount)
    if (Math.abs(delta) < 0.0001) return null
    const method = tx.payment_method ?? 'cash'
    return { method, delta }
  }
  if (tx.type === 'register_deposit') {
    if (!tx.payment_method) return null
    const delta = roundMoney(Math.abs(tx.amount))
    if (Math.abs(delta) < 0.0001) return null
    return { method: tx.payment_method, delta }
  }
  if (tx.type === 'register_withdraw') {
    if (!tx.payment_method) return null
    const delta = roundMoney(-Math.abs(tx.amount))
    if (Math.abs(delta) < 0.0001) return null
    return { method: tx.payment_method, delta }
  }
  return null
}

/** @deprecated use registerEffectForRow — kept for any external callers */
export function registerDeltaForRow(tx: BalanceTransaction): number | null {
  const e = registerEffectForRow(tx)
  return e ? e.delta : null
}

export function aggregateRegisterBalances(rows: BalanceTransaction[]): RegisterBalances {
  const out = emptyBalances()
  for (const tx of rows) {
    const eff = registerEffectForRow(tx)
    if (!eff) continue
    addToMethod(out, eff.method, eff.delta)
  }
  out.total = roundMoney(
    out.cash + out.visa + out.cheque + out.instapay
  )
  return out
}

export async function getRegisterBalances(): Promise<RegisterBalances> {
  let q = supabase
    .from(BALANCE_TX)
    .select('*')
    .is('reversed_at', null)
    .in('type', [
      'payment_in',
      'payment_out',
      'register_deposit',
      'register_withdraw',
    ])
    .order('created_at', { ascending: true })
    .limit(50_000)

  const { data, error } = await q
  if (error) throw error

  const txs = (data ?? []).map((r) => mapTxRow(r as Record<string, unknown>))
  const relevant = txs.filter(
    (tx) =>
      tx.type === 'payment_in' ||
      tx.type === 'payment_out' ||
      tx.type === 'register_deposit' ||
      tx.type === 'register_withdraw'
  )
  return aggregateRegisterBalances(relevant)
}

function nextRegisterRef(): string {
  const t = Date.now().toString(36).toUpperCase()
  const s = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `REG-${t}-${s}`
}

export async function depositToRegister(data: {
  payment_method: PaymentMethod
  amount: number
  note?: string
}): Promise<void> {
  const amt = roundMoney(data.amount)
  if (amt < 0.01) throw new Error('Amount must be at least 0.01')

  await insertBalanceTransactionRow({
    person_id: null,
    type: 'register_deposit',
    amount: amt,
    reference_id: null,
    reference_number: nextRegisterRef(),
    note: data.note?.trim() || null,
    payment_method: data.payment_method,
    payment_group_id: null,
    wallet_direction: null,
  })
}

export async function withdrawFromRegister(data: {
  payment_method: PaymentMethod
  amount: number
  note?: string
}): Promise<void> {
  const amt = roundMoney(data.amount)
  if (amt < 0.01) throw new Error('Amount must be at least 0.01')

  const balances = await getRegisterBalances()
  const available = roundMoney(balances[data.payment_method])
  if (roundMoney(amt) > roundMoney(available + 0.005)) {
    throw new Error(
      `Insufficient balance for ${data.payment_method}. Available: ${available.toFixed(2)}`
    )
  }

  await insertBalanceTransactionRow({
    person_id: null,
    type: 'register_withdraw',
    amount: amt,
    reference_id: null,
    reference_number: nextRegisterRef(),
    note: data.note?.trim() || null,
    payment_method: data.payment_method,
    payment_group_id: null,
    wallet_direction: null,
  })
}

export type RegisterActivityRow = BalanceTransaction & {
  registerEffect: number
}

/** Recent ledger lines that affect the register (newest first). */
export async function listRegisterActivity(
  limit = 80
): Promise<RegisterActivityRow[]> {
  let q = supabase
    .from(BALANCE_TX)
    .select('*')
    .is('reversed_at', null)
    .in('type', [
      'payment_in',
      'payment_out',
      'register_deposit',
      'register_withdraw',
    ])
    .order('created_at', { ascending: false })
    .limit(500)

  const { data, error } = await q
  if (error) throw error

  const txs = (data ?? []).map((r) => mapTxRow(r as Record<string, unknown>))
  const withEffect: RegisterActivityRow[] = []
  for (const tx of txs) {
    const eff = registerEffectForRow(tx)
    if (!eff) continue
    const displayMethod = tx.payment_method ?? eff.method
    withEffect.push({
      ...tx,
      payment_method: displayMethod,
      registerEffect: eff.delta,
    })
  }
  withEffect.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return withEffect.slice(0, limit)
}
