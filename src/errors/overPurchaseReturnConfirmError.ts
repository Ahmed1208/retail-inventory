export type OverPurchaseReturnViolation = {
  product_id: string
  product_name: string
  received: number
  already_returned: number
  requested: number
}

/** Raised when confirming a purchase return would send back more than the PO received. */
export class OverPurchaseReturnConfirmError extends Error {
  readonly violations: OverPurchaseReturnViolation[]

  constructor(violations: OverPurchaseReturnViolation[]) {
    super('OVER_PURCHASE_RETURN_CONFIRM')
    this.name = 'OverPurchaseReturnConfirmError'
    this.violations = violations
  }
}

export function isOverPurchaseReturnConfirmError(
  e: unknown
): e is OverPurchaseReturnConfirmError {
  return e instanceof OverPurchaseReturnConfirmError
}
