import { roundMoney } from '@/services/peopleService'
import type { ProductWithRelations } from '@/types'

const PRICE_EPS = 0.005

export type PoCostOverrideChoice = 'unset' | 'once' | 'catalog'

/** Purchase order line — grid model aligned with POS (incl. line discount %). */
export type POLineRow = {
  key: string
  product_id: string
  productIdInput: string
  name: string
  qty: number
  /** Editable cost for this PO line */
  costPrice: number
  /** Product catalog cost_price when line was resolved */
  listCostPrice: number
  listCustomerPrice: number
  listBusinessPrice: number
  costOverridden: boolean
  /** Line-level discount % (0–100), same as sales order line */
  discountPct: number
  stock: number
  /** When cost differs from catalog, optionally update product default cost on save (legacy checkbox path) */
  updateDefaultCostPrice: boolean
  /** When feature dialog is on: user must choose once vs catalog before submit */
  costOverrideChoice: PoCostOverrideChoice
  /** Target catalog retail/wholesale when choice === 'catalog' */
  catalogCustomerPrice: number | null
  catalogBusinessPrice: number | null
  lookupInvalid?: boolean
}

export function emptyPOLine(): POLineRow {
  return {
    key: crypto.randomUUID(),
    product_id: '',
    productIdInput: '',
    name: '',
    qty: 1,
    costPrice: 0,
    listCostPrice: 0,
    listCustomerPrice: 0,
    listBusinessPrice: 0,
    costOverridden: false,
    discountPct: 0,
    stock: 0,
    updateDefaultCostPrice: false,
    costOverrideChoice: 'unset',
    catalogCustomerPrice: null,
    catalogBusinessPrice: null,
  }
}

export function poLineTotal(l: POLineRow): number {
  if (!l.product_id) return 0
  const gross = l.qty * l.costPrice
  const d = Math.min(100, Math.max(0, l.discountPct))
  return roundMoney(gross * (1 - d / 100))
}

/** Subtotal after line discounts, then PO-level discount % (same shape as sales `computePreview`). */
export function computePoPreview(
  lines: POLineRow[],
  orderDiscountRate: number
): { subtotal: number; discountAmount: number; total: number } {
  const subtotal = roundMoney(lines.reduce((s, l) => s + poLineTotal(l), 0))
  const dr = Math.min(100, Math.max(0, orderDiscountRate))
  const discountAmount = roundMoney(subtotal * (dr / 100))
  const total = roundMoney(subtotal - discountAmount)
  return { subtotal, discountAmount, total }
}

export function costDiffersFromList(line: POLineRow): boolean {
  return (
    Boolean(line.product_id) &&
    Math.abs(line.costPrice - line.listCostPrice) > PRICE_EPS
  )
}

/** Amber cost warning: hide when user chose full catalog update (prices apply on PO receive). */
export function costCellShowsDiffWarning(
  line: POLineRow,
  useCostOverrideDialog: boolean
): boolean {
  if (!costDiffersFromList(line)) return false
  if (useCostOverrideDialog && line.costOverrideChoice === 'catalog') {
    return false
  }
  return true
}

/** Focusable cells: id, name, stock, qty, cost+btn, disc %, line total (7) */
export const PO_LINE_CELL_COLS = 7 as const

/** Grid: # · ID · name · stock · qty · cost+btn · % · total · delete */
export const PO_TABLE_GRID =
  'grid-cols-[2rem_7rem_minmax(0,1fr)_3rem_3.5rem_9rem_3.25rem_4.5rem_2.25rem]'

export function applyProductCostDefaults(
  p: ProductWithRelations,
  stockAtWarehouse?: number
): Pick<
  POLineRow,
  | 'product_id'
  | 'productIdInput'
  | 'name'
  | 'costPrice'
  | 'listCostPrice'
  | 'listCustomerPrice'
  | 'listBusinessPrice'
  | 'costOverridden'
  | 'stock'
  | 'lookupInvalid'
  | 'updateDefaultCostPrice'
  | 'costOverrideChoice'
  | 'catalogCustomerPrice'
  | 'catalogBusinessPrice'
> {
  const c = p.cost_price
  return {
    product_id: p.id,
    productIdInput: p.product_code,
    name: p.name,
    costPrice: c,
    listCostPrice: c,
    listCustomerPrice: p.customer_price,
    listBusinessPrice: p.business_price,
    costOverridden: false,
    stock:
      stockAtWarehouse !== undefined ? stockAtWarehouse : p.quantity,
    lookupInvalid: false,
    updateDefaultCostPrice: false,
    costOverrideChoice: 'unset',
    catalogCustomerPrice: null,
    catalogBusinessPrice: null,
  }
}

/** Partial patch applied when clearing product from line (lookup empty / not found). */
export function clearedProductLinePatch(): Pick<
  POLineRow,
  | 'product_id'
  | 'name'
  | 'costPrice'
  | 'listCostPrice'
  | 'listCustomerPrice'
  | 'listBusinessPrice'
  | 'costOverridden'
  | 'stock'
  | 'lookupInvalid'
  | 'updateDefaultCostPrice'
  | 'costOverrideChoice'
  | 'catalogCustomerPrice'
  | 'catalogBusinessPrice'
  | 'discountPct'
> {
  return {
    product_id: '',
    name: '',
    costPrice: 0,
    listCostPrice: 0,
    listCustomerPrice: 0,
    listBusinessPrice: 0,
    costOverridden: false,
    stock: 0,
    lookupInvalid: false,
    updateDefaultCostPrice: false,
    costOverrideChoice: 'unset',
    catalogCustomerPrice: null,
    catalogBusinessPrice: null,
    discountPct: 0,
  }
}
