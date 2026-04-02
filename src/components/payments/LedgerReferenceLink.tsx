import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { ledgerReferenceHref, type LedgerLinkRow } from '@/utils/ledgerLinks'

type Props = {
  row: LedgerLinkRow
  className?: string
  linkClassName?: string
}

export function LedgerReferenceLink({
  row,
  className,
  linkClassName,
}: Props) {
  const { t } = useTranslation()
  const ref = row.reference_number
  if (!ref) {
    return (
      <span className={className}>{t('people.emDash')}</span>
    )
  }
  const href = ledgerReferenceHref(row)
  if (!href) {
    return <span className={className}>{ref}</span>
  }
  const aria = href.includes('/payments/operations/')
    ? t('payments.openPaymentOperationReference', { ref })
    : href.startsWith('/purchase-orders/')
      ? t('payments.openPurchaseOrderReference', { ref })
      : t('payments.openOrderReference', { ref })
  return (
    <Link
      to={href}
      className={cn(
        'font-medium text-primary underline-offset-4 hover:underline',
        linkClassName
      )}
      aria-label={aria}
    >
      {ref}
    </Link>
  )
}
