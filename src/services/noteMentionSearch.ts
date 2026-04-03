import { supabase } from '@/lib/supabase'

const ORDERS = 'orders'
const PURCHASE_ORDERS = 'purchase_orders'
const PEOPLE = 'people'
const BALANCE_TX = 'balance_transactions'

export type MentionSearchItem =
  | {
      kind: 'order'
      id: string
      orderNumber: number
      label: string
      insertText: string
    }
  | {
      kind: 'purchase_order'
      id: string
      orderNumber: number
      label: string
      insertText: string
    }
  | {
      kind: 'payment'
      operationRouteId: string
      label: string
      insertText: string
    }
  | {
      kind: 'person'
      id: string
      name: string
      phone: string | null
      label: string
      insertText: string
    }

function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Recent cap when scanning in memory for numeric prefix match. */
const RECENT_CAP = 120

/**
 * Parallel capped searches for @-mention picker. `query` is text after `@` (may be empty).
 */
export async function searchNoteMentions(
  query: string
): Promise<MentionSearchItem[]> {
  const q = query.trim()
  const qLower = q.toLowerCase()
  const limitEach = 12

  const [ordersRes, poRes, peopleRes, payRes] = await Promise.all([
    supabase
      .from(ORDERS)
      .select('id, order_number')
      .order('created_at', { ascending: false })
      .limit(RECENT_CAP),
    supabase
      .from(PURCHASE_ORDERS)
      .select('id, order_number')
      .order('created_at', { ascending: false })
      .limit(RECENT_CAP),
    (async () => {
      const cap = q.length === 0 ? 8 : limitEach
      let pq = supabase
        .from(PEOPLE)
        .select('id, name, phone')
        .order('name', { ascending: true })
        .limit(cap)
      if (q.length > 0) {
        const esc = escapeIlike(q)
        pq = pq.or(`name.ilike.%${esc}%,phone.ilike.%${esc}%`)
      }
      return pq
    })(),
    (async () => {
      if (q.length === 0) {
        return supabase
          .from(BALANCE_TX)
          .select('id, reference_number, payment_group_id, type')
          .in('type', [
            'payment_in',
            'payment_out',
            'register_deposit',
            'register_withdraw',
          ])
          .order('created_at', { ascending: false })
          .limit(limitEach)
      }
      const esc = escapeIlike(q)
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          q
        )
      if (isUuid) {
        const byId = await supabase
          .from(BALANCE_TX)
          .select('id, reference_number, payment_group_id, type')
          .eq('id', q)
          .in('type', [
            'payment_in',
            'payment_out',
            'register_deposit',
            'register_withdraw',
          ])
          .limit(5)
        if (!byId.error && (byId.data?.length ?? 0) > 0) {
          return byId
        }
        const byGroup = await supabase
          .from(BALANCE_TX)
          .select('id, reference_number, payment_group_id, type')
          .eq('payment_group_id', q)
          .in('type', ['payment_in', 'payment_out'])
          .limit(5)
        return byGroup
      }
      return supabase
        .from(BALANCE_TX)
        .select('id, reference_number, payment_group_id, type')
        .in('type', [
          'payment_in',
          'payment_out',
          'register_deposit',
          'register_withdraw',
        ])
        .ilike('reference_number', `%${esc}%`)
        .order('created_at', { ascending: false })
        .limit(limitEach)
    })(),
  ])

  const out: MentionSearchItem[] = []

  if (!ordersRes.error && ordersRes.data) {
    const rows = ordersRes.data as { id: string; order_number: number }[]
    const digitsOnly = q.replace(/\D/g, '')
    const filtered =
      q.length === 0
        ? rows.slice(0, 8)
        : digitsOnly.length > 0
          ? rows.filter((r) => String(r.order_number).includes(digitsOnly))
          : rows.filter((r) =>
              `O-${r.order_number}`.toLowerCase().includes(qLower)
            )
    for (const r of filtered.slice(0, limitEach)) {
      const label = `O-${r.order_number}`
      out.push({
        kind: 'order',
        id: r.id,
        orderNumber: r.order_number,
        label,
        insertText: `${label} · doc:${r.id}`,
      })
    }
  }

  if (!poRes.error && poRes.data) {
    const rows = poRes.data as { id: string; order_number: number }[]
    const digitsOnly = q.replace(/\D/g, '')
    const filtered =
      q.length === 0
        ? rows.slice(0, 8)
        : digitsOnly.length > 0
          ? rows.filter((r) => String(r.order_number).includes(digitsOnly))
          : rows.filter((r) =>
              `PO-${r.order_number}`.toLowerCase().includes(qLower)
            )
    for (const r of filtered.slice(0, limitEach)) {
      const label = `PO-${r.order_number}`
      out.push({
        kind: 'purchase_order',
        id: r.id,
        orderNumber: r.order_number,
        label,
        insertText: `${label} · doc:${r.id}`,
      })
    }
  }

  if (!peopleRes.error && peopleRes.data) {
    for (const raw of peopleRes.data as {
      id: string
      name: string
      phone: string | null
    }[]) {
      const name = String(raw.name)
      const phone = raw.phone != null ? String(raw.phone) : null
      const label = phone ? `${name} · ${phone}` : name
      out.push({
        kind: 'person',
        id: raw.id,
        name,
        phone,
        label,
        insertText: `@[person:${raw.id}]`,
      })
    }
  }

  if (!payRes.error && payRes.data) {
    const seen = new Set<string>()
    for (const raw of payRes.data as {
      id: string
      reference_number: string | null
      payment_group_id: string | null
      type: string
    }[]) {
      const opId = raw.payment_group_id ?? raw.id
      if (seen.has(opId)) continue
      seen.add(opId)
      const ref = raw.reference_number?.trim() || raw.type
      const label = ref.length > 48 ? `${ref.slice(0, 45)}…` : ref
      out.push({
        kind: 'payment',
        operationRouteId: opId,
        label: `${label} (${opId.slice(0, 8)}…)`,
        insertText: `@[pay:${opId}]`,
      })
    }
  }

  const order = { order: 0, purchase_order: 1, payment: 2, person: 3 } as const
  out.sort((a, b) => order[a.kind] - order[b.kind])
  return out.slice(0, 40)
}
