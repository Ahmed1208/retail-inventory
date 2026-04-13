export type OrderStockViolation = {
  product_id: string
  product_name: string
  available: number
  needed: number
}

export class InsufficientStockConfirmError extends Error {
  readonly violations: OrderStockViolation[]

  constructor(violations: OrderStockViolation[]) {
    super('INSUFFICIENT_STOCK_CONFIRM')
    this.name = 'InsufficientStockConfirmError'
    this.violations = violations
  }
}

export function isInsufficientStockConfirmError(
  e: unknown
): e is InsufficientStockConfirmError {
  return e instanceof InsufficientStockConfirmError
}
