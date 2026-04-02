import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import {
  isRetainedFromCancelledDocumentNote,
  ledgerReferenceHref,
  type LedgerLinkRow,
} from '@/utils/ledgerLinks'

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
  const isRetainedPayment =
    (row.type === 'payment_in' || row.type === 'payment_out') &&
    isRetainedFromCancelledDocumentNote(row.note)
  const op = row.ledger_operation_route_id
  const hasStandaloneRef =
    row.reference_number != null &&
    /^(PI|PY)-/i.test(row.reference_number)

  if (
    isRetainedPayment &&
    op &&
    !hasStandaloneRef
  ) {
    const href = `/payments/operations/${op}`
    const shortId = op.includes('-') ? op.split('-')[0]! : op.slice(0, 8)
    const label = t('payments.retainedStandalonePaymentRef', { id: shortId })
    return (
      <Link
        to={href}
        title={op}
        className={cn(
          'font-medium font-mono text-xs text-primary underline-offset-4 hover:underline',
          linkClassName
        )}
        aria-label={t('payments.openPaymentOperationReference', { ref: op })}
      >
        {label}
      </Link>
    )
  }

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
