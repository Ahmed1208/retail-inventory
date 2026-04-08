import { supabase } from '@/lib/supabase'
import { roundMoney } from '@/services/peopleService'
import type { PaymentInstallment, PaymentMethod, PurchaseOrderPayment } from '@/types'
import { normalizePaymentMethod } from '@/utils/paymentMethod'

type LedgerTenderRow = {
  payment_method: PaymentMethod | string | null
  amount: number | string
  register_warehouse_id: number | string | null
}

function matchTendersToRegisters(
  txs: LedgerTenderRow[],
  payments: { payment_method: PaymentMethod; amount: number }[],
): (number | null)[] {
  const pool = [...txs]
  const out: (number | null)[] = []
  for (const p of payments) {
    const want = roundMoney(p.amount)
    const idx = pool.findIndex((t) => {
      const m = normalizePaymentMethod(t.payment_method) ?? 'cash'
      const a = roundMoney(Number(t.amount))
      return m === p.payment_method && Math.abs(a - want) < 0.02
    })
    if (idx < 0) {
      out.push(null)
      continue
    }
    const [row] = pool.splice(idx, 1)
    const rw = row.register_warehouse_id
    out.push(
      rw != null && rw !== '' && Number.isFinite(Number(rw))
        ? Math.trunc(Number(rw))
        : null,
    )
  }
  return out
}

/** Ledger payment_out rows for a PO (supplier payments at receive). */
export async function fetchRegisterIdsForPoPayments(
  purchaseOrderId: string,
  payments: PurchaseOrderPayment[],
): Promise<(number | null)[]> {
  if (!payments.length) return []
  const { data, error } = await supabase
    .from('balance_transactions')
    .select('payment_method, amount, register_warehouse_id')
    .eq('reference_id', purchaseOrderId)
    .eq('type', 'payment_out')
    .order('created_at', { ascending: true })
  if (error) throw error
  return matchTendersToRegisters((data ?? []) as LedgerTenderRow[], payments)
}

/** Ledger payment_in rows for a sales order. */
export async function fetchRegisterIdsForOrderPayments(
  orderId: string,
  installments: PaymentInstallment[],
): Promise<(number | null)[]> {
  if (!installments.length) return []
  const { data, error } = await supabase
    .from('balance_transactions')
    .select('payment_method, amount, register_warehouse_id')
    .eq('reference_id', orderId)
    .eq('type', 'payment_in')
    .order('created_at', { ascending: true })
  if (error) throw error
  const pays = installments.map((p) => ({
    payment_method: p.method,
    amount: p.amount,
  }))
  return matchTendersToRegisters((data ?? []) as LedgerTenderRow[], pays)
}
