import { roundMoney } from '@/services/peopleService'
import type { ProductWithRelations } from '@/types'

const PRICE_EPS = 0.005

/** Purchase order line — same grid model as POS (minus line discount %). */
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
  costOverridden: boolean
  stock: number
  /** When cost differs from catalog, optionally update product default cost on save */
  updateDefaultCostPrice: boolean
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
    costOverridden: false,
    stock: 0,
    updateDefaultCostPrice: false,
  }
}

export function poLineTotal(l: POLineRow): number {
  if (!l.product_id) return 0
  return roundMoney(l.qty * l.costPrice)
}

export function costDiffersFromList(line: POLineRow): boolean {
  return (
    Boolean(line.product_id) &&
    Math.abs(line.costPrice - line.listCostPrice) > PRICE_EPS
  )
}

/** Focusable cells: id, name, stock, qty, cost, line total (6) */
export const PO_LINE_CELL_COLS = 6 as const

/** Grid: # · ID · name · stock · qty · cost+btn · total · delete */
export const PO_TABLE_GRID =
  'grid-cols-[2rem_7rem_minmax(0,1fr)_3rem_3.5rem_9rem_4.5rem_2.25rem]'

export function applyProductCostDefaults(
  p: ProductWithRelations
): Pick<
  POLineRow,
  | 'product_id'
  | 'productIdInput'
  | 'name'
  | 'costPrice'
  | 'listCostPrice'
  | 'costOverridden'
  | 'stock'
  | 'lookupInvalid'
  | 'updateDefaultCostPrice'
> {
  const c = p.cost_price
  return {
    product_id: p.id,
    productIdInput: p.product_code,
    name: p.name,
    costPrice: c,
    listCostPrice: c,
    costOverridden: false,
    stock: p.quantity,
    lookupInvalid: false,
    updateDefaultCostPrice: false,
  }
}
