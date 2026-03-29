import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { List, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

const cards = [
  {
    to: '/orders/list',
    icon: List,
    titleKey: 'orders.allOrders',
    subtitleKey: 'orders.allOrdersSubtitle',
  },
  {
    to: '/orders/new',
    icon: Plus,
    titleKey: 'orders.newOrder',
    subtitleKey: 'orders.newOrderSubtitle',
  },
] as const

export function OrdersHome() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = `${t('orders.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('orders.title')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('orders.subtitle')}
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ to, icon: Icon, titleKey, subtitleKey }) => (
          <li key={to}>
            <Link
              to={to}
              className={cn(
                'flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm',
                'transition-colors hover:bg-muted/50 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-medium">
                  {t(titleKey)}
                </span>
                <span className="text-muted-foreground mt-1 block text-sm">
                  {t(subtitleKey)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
