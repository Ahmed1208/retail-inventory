import { supabase } from '@/lib/supabase'
import {
  insertOrderPaymentInstallments,
  insertOrderPaymentsRows,
} from '@/services/paymentInstallmentInserts'
import {
  insertBalanceTransactionRow,
  roundMoney,
  supabaseErrorMessage,
} from '@/services/peopleService'
import {
  assertWarehouseHasRegister,
  DEFAULT_WAREHOUSE_ID,
  resolveRegisterWarehouseForPoPayment,
} from '@/services/warehouseService'
import type { OrderWithItemsAndPayments, PaymentMethod, WalletDirection } from '@/types'

/** Thrown when splits exceed order/PO total but no person is linked for wallet credit. */
export const OVERPAYMENT_REQUIRES_PERSON =
  'Select a person to apply overpayment to their wallet'

export type OrderPaymentSplit = { payment_method: PaymentMethod; amount: number }

/**
 * Apply one payment installment to an order (possibly with overpayment → wallet row).
 * Caller must validate order status and load order with installments.
 */
export async function createOrderPayment(params: {
  order: OrderWithItemsAndPayments
  method: PaymentMethod
  amount: number
  note?: string | null
}): Promise<{ orderId: string; remainingAmount: number }> {
  const order = params.order
  const amt = roundMoney(params.amount)
  if (amt < 0.01) throw new Error('Amount must be at least 0.01')

  const rem = roundMoney(order.remaining_amount)
  const towardOrder = roundMoney(Math.min(amt, rem))
  const over = roundMoney(amt - towardOrder)

  if (over > 0.01 && !order.person_id) {
    throw new Error(OVERPAYMENT_REQUIRES_PERSON)
  }

  await insertOrderPaymentInstallments([
    {
      order_id: order.id,
      method: params.method,
      amount: amt,
      note: params.note?.trim() || null,
    },
  ])

  try {
    await insertOrderPaymentsRows([
      {
        order_id: order.id,
        payment_method: params.method,
        amount: amt,
      },
    ])
  } catch (opErr: unknown) {
    const msg = supabaseErrorMessage(opErr).toLowerCase()
    const code =
      typeof opErr === 'object' && opErr !== null && 'code' in opErr
        ? String((opErr as { code: unknown }).code)
        : ''
    if (
      !msg.includes('does not exist') &&
      !msg.includes('relation') &&
      code !== '42P01'
    ) {
      throw opErr
    }
  }

  const newPaid = roundMoney(order.paid_amount + towardOrder)
  const newRem = roundMoney(order.remaining_amount - towardOrder)

  const { error: upErr } = await supabase
    .from('orders')
    .update({
      paid_amount: newPaid,
      remaining_amount: newRem,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (upErr) throw upErr

  const registerWh =
    order.warehouse_id != null && Number.isFinite(Number(order.warehouse_id))
      ? Math.trunc(Number(order.warehouse_id))
      : DEFAULT_WAREHOUSE_ID

  if (order.person_id) {
    const gid =
      towardOrder > 0.01 && over > 0.01 ? crypto.randomUUID() : null

    if (towardOrder > 0.01) {
      await assertWarehouseHasRegister(registerWh)
      await insertBalanceTransactionRow({
        person_id: order.person_id,
        type: 'payment_in',
        amount: roundMoney(-towardOrder),
        reference_id: order.id,
        reference_number: `O-${order.order_number}`,
        note: params.note?.trim() || 'Order payment',
        payment_method: params.method,
        payment_group_id: gid,
        wallet_direction: null,
        register_warehouse_id: registerWh,
      })
    }

    if (over > 0.01) {
      const note = `Overpayment from Order #${order.order_number} — EGP ${over} added to wallet`
      await insertBalanceTransactionRow({
        person_id: order.person_id,
        type: 'wallet',
        amount: roundMoney(-over),
        reference_id: order.id,
        reference_number: `O-${order.order_number}`,
        note,
        payment_method: null,
        payment_group_id: gid,
        wallet_direction: 'out' as WalletDirection,
      })
    }
  }

  return { orderId: order.id, remainingAmount: newRem }
}

export type PurchaseOrderPaymentInput = {
  payment_method: PaymentMethod
  amount: number
}

/**
 * Ledger + balance for PO creation: FIFO allocate payment splits to liability; excess → wallet (in).
 */
export async function createPurchaseOrderPayment(params: {
  personId: string
  purchaseOrderId: string
  orderNumber: number
  totalAmount: number
  payments: PurchaseOrderPaymentInput[]
  poWarehouseId: number
  /** Required when `poWarehouseId` warehouse has no register. */
  registerWarehouseId?: number | null
}): Promise<{ balance: number }> {
  const payments = params.payments.filter((p) => roundMoney(p.amount) > 0.01)
  const sum = roundMoney(payments.reduce((s, p) => s + roundMoney(p.amount), 0))
  const total = roundMoney(params.totalAmount)
  const over = roundMoney(sum - total)

  if (over > 0.01) {
    if (!params.personId) {
      throw new Error(OVERPAYMENT_REQUIRES_PERSON)
    }
  }

  const registerWh =
    sum >= 0.01
      ? await resolveRegisterWarehouseForPoPayment(
          params.poWarehouseId,
          params.registerWarehouseId
        )
      : null

  const liability = roundMoney(-total)
  await insertBalanceTransactionRow({
    person_id: params.personId,
    type: 'purchase_order',
    amount: liability,
    reference_id: params.purchaseOrderId,
    reference_number: `PO-${params.orderNumber}`,
    payment_method: null,
    payment_group_id: null,
    wallet_direction: null,
  })

  if (sum < 0.01) {
    const { data: row, error: re } = await supabase
      .from('people')
      .select('balance')
      .eq('id', params.personId)
      .single()
    if (re) throw re
    return { balance: roundMoney(Number((row as { balance: number }).balance)) }
  }

  let remainingLiability = total
  const payLines = payments.filter((p) => roundMoney(p.amount) > 0.01)
  const paymentGroupId =
    payLines.length > 1 ? crypto.randomUUID() : null

  for (const p of payments) {
    const a = roundMoney(p.amount)
    if (a < 0.01) continue
    const toward = roundMoney(Math.min(a, remainingLiability))
    const walletPart = roundMoney(a - toward)

    if (toward > 0.01) {
      if (registerWh == null) {
        throw new Error('Register warehouse is required for PO payments')
      }
      await insertBalanceTransactionRow({
        person_id: params.personId,
        type: 'payment_out',
        amount: roundMoney(toward),
        reference_id: params.purchaseOrderId,
        reference_number: `PO-${params.orderNumber}`,
        note: 'Payment at purchase order',
        payment_method: p.payment_method,
        payment_group_id: paymentGroupId,
        wallet_direction: null,
        register_warehouse_id: registerWh,
      })
      remainingLiability = roundMoney(remainingLiability - toward)
    }

    if (walletPart > 0.01) {
      const note = `Overpayment from PO #${params.orderNumber} — EGP ${walletPart} added to wallet`
      await insertBalanceTransactionRow({
        person_id: params.personId,
        type: 'wallet',
        amount: roundMoney(walletPart),
        reference_id: params.purchaseOrderId,
        reference_number: `PO-${params.orderNumber}`,
        note,
        payment_method: null,
        payment_group_id: paymentGroupId,
        wallet_direction: 'in' as WalletDirection,
      })
    }
  }

  const { data: row, error: re } = await supabase
    .from('people')
    .select('balance')
    .eq('id', params.personId)
    .single()
  if (re) throw re
  return { balance: roundMoney(Number((row as { balance: number }).balance)) }
}
