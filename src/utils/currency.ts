/**
 * Format a number as Egyptian Pound (EGP) using the active language.
 * - English: "EGP 1,250.00" (locale en-EG)
 * - Arabic: "١٬٢٥٠٫٠٠ ج.م" (locale ar-EG)
 */
export function formatCurrency(amount: number, language: 'en' | 'ar'): string {
  const locale = language === 'ar' ? 'ar-EG' : 'en-EG'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
