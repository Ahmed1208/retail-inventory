import { roundMoney } from '@/services/peopleService'
import type {
  OrderStatusFlow,
  OrderType,
  PaymentMethod,
  Product,
  ProductWithRelations,
} from '@/types'
import type { PosOrderLineInput } from '@/services/orderService'

export type LineRow = {
  key: string
  product_id: string
  productIdInput: string
  name: string
  qty: number
  unitPrice: number
  /** Catalog price for current order type (retail / wholesale) */
  listUnitPrice: number
  /** User edited unit price away from list price */
  priceOverridden: boolean
  discountPct: number
  stock: number
  /** True after debounced lookup found no product for current input */
  lookupInvalid?: boolean
}

export function catalogPriceForOrderType(
  p: Pick<Product, 'customer_price' | 'business_price'>,
  orderType: OrderType
): number {
  return orderType === 'retail' ? p.customer_price : p.business_price
}

const PRICE_EPS = 0.005

export function unitPriceDiffersFromList(line: LineRow): boolean {
  return (
    Boolean(line.product_id) &&
    Math.abs(line.unitPrice - line.listUnitPrice) > PRICE_EPS
  )
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'card',
  'transfer',
  'other',
]

export function paymentLabel(
  method: PaymentMethod,
  t: (k: string) => string
): string {
  const map: Record<PaymentMethod, string> = {
    cash: 'orders.paymentCash',
    card: 'orders.paymentCard',
    transfer: 'orders.paymentTransfer',
    other: 'orders.paymentOther',
  }
  return t(map[method])
}

export function emptyLine(): LineRow {
  return {
    key: crypto.randomUUID(),
    product_id: '',
    productIdInput: '',
    name: '',
    qty: 1,
    unitPrice: 0,
    listUnitPrice: 0,
    priceOverridden: false,
    discountPct: 0,
    stock: 0,
  }
}

export function lineTotal(l: LineRow): number {
  if (!l.product_id) return 0
  const gross = l.qty * l.unitPrice
  return roundMoney(
    gross * (1 - Math.min(100, Math.max(0, l.discountPct)) / 100)
  )
}

export function computePreview(
  lines: LineRow[],
  orderDiscountRate: number
): {
  subtotal: number
  discountAmount: number
  total: number
} {
  const subtotal = roundMoney(lines.reduce((s, l) => s + lineTotal(l), 0))
  const dr = Math.min(100, Math.max(0, orderDiscountRate))
  const discountAmount = roundMoney(subtotal * (dr / 100))
  const total = roundMoney(subtotal - discountAmount)
  return { subtotal, discountAmount, total }
}

export function findProductByInput(
  products: ProductWithRelations[],
  raw: string
): ProductWithRelations | 'ambiguous' | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null

  const byCodeExact = products.filter(
    (p) => p.product_code.trim().toLowerCase() === t
  )
  if (byCodeExact.length === 1) return byCodeExact[0]
  if (byCodeExact.length > 1) return 'ambiguous'

  const byIdExact = products.filter((p) => p.id.toLowerCase() === t)
  if (byIdExact.length === 1) return byIdExact[0]
  if (byIdExact.length > 1) return 'ambiguous'

  const byCodePref = products.filter((p) =>
    p.product_code.trim().toLowerCase().startsWith(t)
  )
  const byIdPref = products.filter((p) => p.id.toLowerCase().startsWith(t))
  const pref = [...new Set([...byCodePref, ...byIdPref])]
  if (pref.length === 1) return pref[0]
  if (pref.length > 1) return 'ambiguous'
  return null
}

export function linesToPosInput(lines: LineRow[]): PosOrderLineInput[] {
  return lines
    .filter((l) => l.product_id && l.qty >= 1)
    .map((l) => ({
      product_id: l.product_id,
      quantity: l.qty,
      unit_price: l.unitPrice,
      line_discount_rate: l.discountPct,
    }))
}

export function statusFlowLabel(
  flow: OrderStatusFlow,
  t: (k: string) => string
): string {
  const m: Record<OrderStatusFlow, string> = {
    draft: 'orders.draft',
    confirmed: 'orders.confirmed',
    completed: 'orders.completed',
    cancelled: 'orders.cancelled',
  }
  return t(m[flow])
}

export function statusBadgeClass(flow: OrderStatusFlow): string {
  const map: Record<OrderStatusFlow, string> = {
    draft:
      'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    confirmed:
      'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
    completed:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    cancelled: 'bg-muted text-muted-foreground',
  }
  return map[flow]
}

/** Editable / focusable cells per row: id, name, qty, price, disc, total (6) */
/** Focusable grid cells per line (excludes row # and delete button) */
export const LINE_CELL_COLS = 7 as const

export type TFn = (k: string, opts?: Record<string, unknown>) => string
