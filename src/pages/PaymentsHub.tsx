import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { List, PlusCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function PaymentsHub() {
  const { t } = useTranslation()
  const canList = useFeatureEnabled('payments.list')
  const canCreate = useFeatureEnabled('people.recordPayment')

  useEffect(() => {
    document.title = `${t('nav.payments')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const cards = [
    {
      to: '/payments/list',
      icon: List,
      titleKey: 'payments.allPayments',
      descKey: 'payments.allPaymentsDesc',
      show: canList,
    },
    {
      to: '/payments/new',
      icon: PlusCircle,
      titleKey: 'payments.newPayment',
      descKey: 'payments.newPaymentDesc',
      show: canCreate,
    },
  ].filter((c) => c.show)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('nav.payments')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('payments.hubIntro')}
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('payments.hubDisabled')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ to, icon: Icon, titleKey, descKey }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border border-border bg-card p-6 shadow-sm',
                  'transition-colors hover:border-primary/20 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-lg font-medium">{t(titleKey)}</span>
                </span>
                <span className="text-sm text-muted-foreground ps-[3.75rem]">
                  {t(descKey)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
