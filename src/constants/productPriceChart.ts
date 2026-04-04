/**
 * Stroke colors for product price history charts. Use the same mapping on every
 * product page so business / cost / customer lines are always identifiable.
 */
export const PRODUCT_PRICE_CHART_STROKES = {
  /** Customer (retail) price — blue on all products */
  customer: '#2563eb',
  /** Cost price — green on all products */
  cost: '#16a34a',
  /** Business (wholesale) — near-black in light theme */
  businessLight: '#171717',
  /** Business (wholesale) — light stroke for dark theme cards */
  businessDark: '#e5e5e5',
} as const
