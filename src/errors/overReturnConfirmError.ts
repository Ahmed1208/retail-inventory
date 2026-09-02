export type OverReturnViolation = {
  product_id: string
  product_name: string
  sold: number
  already_returned: number
  requested: number
}

/** Raised when confirming a return would take back more than the source order sold. */
export class OverReturnConfirmError extends Error {
  readonly violations: OverReturnViolation[]

  constructor(violations: OverReturnViolation[]) {
    super('OVER_RETURN_CONFIRM')
    this.name = 'OverReturnConfirmError'
    this.violations = violations
  }
}

export function isOverReturnConfirmError(
  e: unknown
): e is OverReturnConfirmError {
  return e instanceof OverReturnConfirmError
}
