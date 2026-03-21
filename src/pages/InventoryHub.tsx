import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Package,
  Truck,
  ArrowLeftRight,
  Tag,
  Layers,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const sections = [
  { to: '/products', icon: Package, key: 'nav.products' },
  { to: '/purchase-orders', icon: Truck, key: 'nav.purchaseOrders' },
  { to: '/movements', icon: ArrowLeftRight, key: 'nav.stockMovements' },
  { to: '/categories', icon: Tag, key: 'nav.categories' },
  { to: '/brands', icon: Layers, key: 'nav.brands' },
] as const

export function InventoryHub() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = `${t('nav.inventory')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('nav.inventory')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('nav.inventoryHubDescription')}
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ to, icon: Icon, key }) => (
          <li key={to}>
            <Link
              to={to}
              className={cn(
                'flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm',
                'transition-colors hover:bg-muted/50 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="text-base font-medium">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
