import { supabase } from '@/lib/supabase'
import { getPeopleBalanceAggregates, roundMoney } from '@/services/peopleService'
import { DEFAULT_WAREHOUSE_ID } from '@/services/warehouseService'
import type {
  Product,
  ProductPriceHistory,
  ProductWithRelations,
  DashboardStats,
  StockMovementType,
  StockMovementWithProduct,
  StockMovementWithProductDetails,
} from '@/types'

const PRODUCTS = 'products'
const STOCK_MOVEMENTS = 'stock_movements'
const PRODUCT_WAREHOUSE_STOCK = 'product_warehouse_stock'
const PRODUCT_PRICE_HISTORY = 'product_price_history'

type PriceTriple = {
  customer_price: number
  business_price: number
  cost_price: number
}

function pricesDiffer(a: PriceTriple, b: PriceTriple): boolean {
  return (
    roundMoney(a.customer_price) !== roundMoney(b.customer_price) ||
    roundMoney(a.business_price) !== roundMoney(b.business_price) ||
    roundMoney(a.cost_price) !== roundMoney(b.cost_price)
  )
}

async function recordProductPriceSnapshot(
  productId: string,
  prices: PriceTriple
): Promise<void> {
  const { error } = await supabase.from(PRODUCT_PRICE_HISTORY).insert({
    product_id: productId,
    customer_price: prices.customer_price,
    business_price: prices.business_price,
    cost_price: prices.cost_price,
  })
  if (error) throw error
}

export async function getProductPriceHistory(
  productId: string
): Promise<ProductPriceHistory[]> {
  const { data, error } = await supabase
    .from(PRODUCT_PRICE_HISTORY)
    .select('*')
    .eq('product_id', productId)
    .order('recorded_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    product_id: row.product_id as string,
    recorded_at: String(row.recorded_at),
    customer_price: Number(row.customer_price),
    business_price: Number(row.business_price),
    cost_price: Number(row.cost_price ?? 0),
  }))
}

/** Human-readable id when the user leaves the field empty on create. */
export function generateProductCode(): string {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `P-${part}`
}

export type ProductCreateInput = Omit<
  Product,
  'id' | 'created_at' | 'updated_at' | 'product_code' | 'average_unit_cost'
> & { product_code?: string | null }

/**
 * Supabase returns a PostgrestError object, not an Error instance — always
 * rethrow as Error so callers can read `message` in catch blocks.
 */
function throwProductError(error: {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}): never {
  const text = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
  if (error.code === '23505') {
    const m = text.toLowerCase()
    if (m.includes('product_code')) {
      throw new Error('PRODUCT_CODE_TAKEN')
    }
    if (m.includes('products_name') || m.includes('name_lower')) {
      throw new Error('PRODUCT_NAME_TAKEN')
    }
    throw new Error(text.trim() || 'Duplicate record')
  }
  throw new Error(text.trim() || error.code || 'Request failed')
}

function toProductWithRelations(row: {
  id: string
  product_code?: string | null
  name: string
  brand_id: string | null
  category_id: string | null
  customer_price: number
  business_price: number
  cost_price: number
  average_unit_cost?: number | null
  quantity: number
  low_stock_threshold: number
  unit: string
  description: string | null
  created_at: string
  updated_at: string
  brand: unknown
  category: unknown
}): ProductWithRelations {
  const { brand, category, ...rest } = row
  const product_code =
    rest.product_code != null && String(rest.product_code).trim() !== ''
      ? String(rest.product_code).trim()
      : ''
  const ac = rest.average_unit_cost
  const average_unit_cost =
    ac != null && Number.isFinite(Number(ac)) ? Number(ac) : null
  return {
    ...rest,
    product_code,
    average_unit_cost,
    brand: (brand as ProductWithRelations['brand']) ?? null,
    category: (category as ProductWithRelations['category']) ?? null,
  }
}

export async function getAllProducts(): Promise<ProductWithRelations[]> {
  const { data, error } = await supabase
    .from(PRODUCTS)
    .select(
      `
      *,
      brand:brands(*),
      category:categories(*)
    `
    )
    .order('name')

  if (error) throw error
  return (data ?? []).map(toProductWithRelations)
}

export async function getProductById(
  id: string
): Promise<ProductWithRelations | null> {
  const { data, error } = await supabase
    .from(PRODUCTS)
    .select(
      `
      *,
      brand:brands(*),
      category:categories(*)
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return toProductWithRelations(data as Parameters<typeof toProductWithRelations>[0])
}

/** Current WAC per product id (for person-level gross profit across many products). */
export async function getAverageUnitCostsByProductIds(
  ids: string[]
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return out

  const { data, error } = await supabase
    .from(PRODUCTS)
    .select('id, average_unit_cost')
    .in('id', uniq)

  if (error) throw error
  for (const row of data ?? []) {
    const id = String((row as { id: string }).id)
    const raw = (row as { average_unit_cost: number | null }).average_unit_cost
    const v =
      raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null
    out.set(id, v)
  }
  return out
}

export async function createProduct(
  data: ProductCreateInput
): Promise<Product> {
  const { product_code: providedCode, ...row } = data
  const code =
    providedCode?.trim() ? providedCode.trim() : generateProductCode()
  const payload = {
    ...row,
    name: row.name.trim(),
    product_code: code,
  }
  const { data: inserted, error } = await supabase
    .from(PRODUCTS)
    .insert(payload)
    .select()
    .single()

  if (error) throwProductError(error)
  const product = inserted as Product
  await recordProductPriceSnapshot(product.id, {
    customer_price: Number(product.customer_price),
    business_price: Number(product.business_price),
    cost_price: Number(product.cost_price ?? 0),
  })
  return product
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, 'id' | 'created_at'>>
): Promise<Product> {
  const { data: beforeRow, error: beforeErr } = await supabase
    .from(PRODUCTS)
    .select('customer_price, business_price, cost_price')
    .eq('id', id)
    .single()

  if (beforeErr) throwProductError(beforeErr)

  const beforePrices: PriceTriple = {
    customer_price: Number(beforeRow.customer_price),
    business_price: Number(beforeRow.business_price),
    cost_price: Number(beforeRow.cost_price ?? 0),
  }

  const payload: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  }
  if (typeof payload.name === 'string') {
    payload.name = payload.name.trim()
  }
  if (typeof payload.product_code === 'string') {
    payload.product_code = payload.product_code.trim()
  }
  const { data: updated, error } = await supabase
    .from(PRODUCTS)
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throwProductError(error)
  const product = updated as Product
  const afterPrices: PriceTriple = {
    customer_price: Number(product.customer_price),
    business_price: Number(product.business_price),
    cost_price: Number(product.cost_price ?? 0),
  }
  if (pricesDiffer(beforePrices, afterPrices)) {
    await recordProductPriceSnapshot(id, afterPrices)
  }
  return product
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from(PRODUCTS).delete().eq('id', id)
  if (error) throw error
}

export type AdjustStockOptions = {
  /** On stock-in, blend this unit cost into `average_unit_cost` (weighted average). */
  inboundUnitCost?: number
  /** Stock location; defaults to warehouse 1. */
  warehouseId?: number
}

export async function getProductQuantitiesByWarehouse(
  warehouseId: number
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from(PRODUCT_WAREHOUSE_STOCK)
    .select('product_id, quantity')
    .eq('warehouse_id', warehouseId)
  if (error) throw error
  const m = new Map<string, number>()
  for (const row of data ?? []) {
    const r = row as { product_id: string; quantity: number }
    m.set(String(r.product_id), Number(r.quantity))
  }
  return m
}

export async function getProductQuantityInWarehouse(
  productId: string,
  warehouseId: number
): Promise<number> {
  const { data, error } = await supabase
    .from(PRODUCT_WAREHOUSE_STOCK)
    .select('quantity')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle()
  if (error) throw error
  if (!data) return 0
  return Number((data as { quantity: number }).quantity)
}

export async function adjustStock(
  productId: string,
  type: StockMovementType,
  quantity: number,
  note?: string,
  opts?: AdjustStockOptions
): Promise<void> {
  const warehouseId = opts?.warehouseId ?? DEFAULT_WAREHOUSE_ID
  const qtyDelta = Math.trunc(Number(quantity))
  if (!Number.isFinite(qtyDelta)) {
    throw new Error('Invalid quantity')
  }

  const { data: product, error: fetchError } = await supabase
    .from(PRODUCTS)
    .select('average_unit_cost, cost_price')
    .eq('id', productId)
    .single()

  if (fetchError) throw fetchError
  if (!product) throw new Error('Product not found')

  const acRaw = product.average_unit_cost
  const currentAvg =
    acRaw != null && Number.isFinite(Number(acRaw)) ? Number(acRaw) : null
  const costPrice = Number(product.cost_price ?? 0)

  const { data: pwsRows, error: pwsReadErr } = await supabase
    .from(PRODUCT_WAREHOUSE_STOCK)
    .select('warehouse_id, quantity')
    .eq('product_id', productId)

  if (pwsReadErr) throw pwsReadErr

  const rows = (pwsRows ?? []) as { warehouse_id: number; quantity: number }[]
  const whQty = Math.trunc(
    Number(rows.find((r) => Number(r.warehouse_id) === warehouseId)?.quantity ?? 0)
  )
  const currentTotal = rows.reduce(
    (s, r) => s + Math.trunc(Number(r.quantity)),
    0
  )

  let newWhQty: number
  switch (type) {
    case 'in':
      newWhQty = whQty + qtyDelta
      break
    case 'out':
      newWhQty = whQty - qtyDelta
      if (newWhQty < 0) {
        throw new Error('Insufficient stock: result would be negative')
      }
      break
    case 'adjustment':
      newWhQty = qtyDelta
      if (newWhQty < 0) {
        throw new Error('Adjustment quantity cannot be negative')
      }
      break
    default:
      throw new Error(`Unknown movement type: ${type}`)
  }

  const totalAfter = currentTotal + (newWhQty - whQty)

  const movementQuantity =
    type === 'adjustment' ? newWhQty : Math.abs(qtyDelta)

  const movementPayload = {
    product_id: productId,
    warehouse_id: warehouseId,
    type,
    quantity: movementQuantity,
    note: note ?? null,
  }

  const { error: insertError } = await supabase
    .from(STOCK_MOVEMENTS)
    .insert(movementPayload)

  if (insertError) throw insertError

  const { error: upsertErr } = await supabase
    .from(PRODUCT_WAREHOUSE_STOCK)
    .upsert(
      {
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: newWhQty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id,warehouse_id' }
    )

  if (upsertErr) throw upsertErr

  const updatePayload: Record<string, unknown> = {}

  if (totalAfter === 0) {
    updatePayload.average_unit_cost = null
  } else if (
    type === 'in' &&
    opts?.inboundUnitCost !== undefined &&
    !Number.isNaN(Number(opts.inboundUnitCost))
  ) {
    const unitCost = roundMoney(Number(opts.inboundUnitCost))
    const qtyIn = qtyDelta
    let newAvg: number
    if (currentTotal <= 0) {
      newAvg = unitCost
    } else {
      const avgForBlend = currentAvg != null ? currentAvg : costPrice
      newAvg = roundMoney(
        (currentTotal * avgForBlend + qtyIn * unitCost) /
          (currentTotal + qtyIn)
      )
    }
    updatePayload.average_unit_cost = newAvg
  }

  if (Object.keys(updatePayload).length > 0) {
    updatePayload.updated_at = new Date().toISOString()
    const { error: updateError } = await supabase
      .from(PRODUCTS)
      .update(updatePayload)
      .eq('id', productId)
    if (updateError) throw updateError
  }
}

export async function getLowStockProducts(): Promise<ProductWithRelations[]> {
  const { data, error } = await supabase
    .from(PRODUCTS)
    .select(
      `
      *,
      brand:brands(*),
      category:categories(*)
    `
    )
    .order('name')

  if (error) throw error

  const rows = (data ?? []).filter(
    (row: { quantity: number; low_stock_threshold: number }) =>
      row.quantity <= row.low_stock_threshold
  )
  return rows.map((r: Parameters<typeof toProductWithRelations>[0]) =>
    toProductWithRelations(r)
  )
}

export type StockMovementFilters = {
  type?: StockMovementType
  from?: string
  to?: string
  search?: string
  /** When set, only movements for this product */
  productId?: string
  /** Max rows (applied after filters); omit for no limit */
  limit?: number
}

function toMovementWithDetails(row: {
  id: string
  product_id: string
  warehouse_id?: number | string | null
  type: StockMovementType
  quantity: number
  note: string | null
  created_at: string
  product: Product & { brand: { id: string; name: string; created_at: string } | null }
}): StockMovementWithProductDetails {
  const { product, warehouse_id: whRaw, ...rest } = row
  const warehouse_id =
    whRaw != null && whRaw !== '' && Number.isFinite(Number(whRaw))
      ? Number(whRaw)
      : DEFAULT_WAREHOUSE_ID
  return {
    ...rest,
    warehouse_id,
    product: {
      ...product,
      brand: product.brand ?? null,
    },
  }
}

export async function getStockMovements(
  filters?: StockMovementFilters
): Promise<StockMovementWithProductDetails[]> {
  let query = supabase
    .from(STOCK_MOVEMENTS)
    .select(
      `
      *,
      product:products(*, brand:brands(*))
    `
    )
    .order('created_at', { ascending: false })

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }
  if (filters?.productId) {
    query = query.eq('product_id', filters.productId)
  }
  if (filters?.from) {
    query = query.gte('created_at', filters.from)
  }
  if (filters?.to) {
    const toEnd = new Date(filters.to)
    toEnd.setHours(23, 59, 59, 999)
    query = query.lte('created_at', toEnd.toISOString())
  }
  if (filters?.limit != null && filters.limit > 0) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw error

  let rows = (data ?? []).map(toMovementWithDetails)

  if (filters?.search?.trim()) {
    const search = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (m) =>
        m.product.name.toLowerCase().includes(search) ||
        m.product.product_code.toLowerCase().includes(search)
    )
  }

  return rows
}

export async function getRecentMovements(
  limit = 10
): Promise<StockMovementWithProduct[]> {
  const { data, error } = await supabase
    .from(STOCK_MOVEMENTS)
    .select(
      `
      *,
      product:products(*)
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row: { product: unknown; [key: string]: unknown }) => ({
    ...row,
    product: row.product as Product,
  })) as StockMovementWithProduct[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStartIso = todayStart.toISOString()

  const [
    { count: totalProducts, error: countError },
    { data: productsForValue, error: valueError },
    { data: lowStockData, error: lowStockError },
    { count: todayMovements, error: movementsError },
    { count: totalPurchasesToday, error: purchasesError },
    peopleBalances,
  ] = await Promise.all([
    supabase.from(PRODUCTS).select('*', { count: 'exact', head: true }),
    supabase.from(PRODUCTS).select('quantity, cost_price'),
    supabase.from(PRODUCTS).select('id, quantity, low_stock_threshold'),
    supabase
      .from(STOCK_MOVEMENTS)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStartIso),
    supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStartIso),
    getPeopleBalanceAggregates(),
  ])

  if (countError) throw countError
  if (valueError) throw valueError
  if (lowStockError) throw lowStockError
  if (movementsError) throw movementsError
  if (purchasesError) throw purchasesError

  const totalValue = (productsForValue ?? []).reduce(
    (sum: number, p: { quantity: number; cost_price: number }) =>
      sum + p.quantity * p.cost_price,
    0
  )

  const lowStockCount = (lowStockData ?? []).filter(
    (p: { quantity: number; low_stock_threshold: number }) =>
      p.quantity <= p.low_stock_threshold
  ).length

  return {
    totalProducts: totalProducts ?? 0,
    totalValue,
    lowStockCount,
    todayMovements: todayMovements ?? 0,
    totalPurchasesToday: totalPurchasesToday ?? 0,
    totalReceivables: peopleBalances.totalReceivables,
    totalPayables: peopleBalances.totalPayables,
  }
}
