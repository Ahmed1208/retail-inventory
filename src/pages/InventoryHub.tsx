import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, Package, Truck, Tag, Layers, Warehouse } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

const sections = [
  { to: '/products', icon: Package, key: 'nav.products', feature: 'inventory.hubProducts' },
  {
    to: '/purchase-orders',
    icon: Truck,
    key: 'nav.purchaseOrders',
    feature: 'inventory.hubPurchaseOrders',
  },
  { to: '/categories', icon: Tag, key: 'nav.categories', feature: 'inventory.hubCategories' },
  { to: '/brands', icon: Layers, key: 'nav.brands', feature: 'inventory.hubBrands' },
  {
    to: '/warehouses',
    icon: Warehouse,
    key: 'nav.warehouses',
    feature: 'inventory.hubWarehouses',
  },
  {
    to: '/inventory-transfers',
    icon: ArrowLeftRight,
    key: 'nav.inventoryTransfers',
    feature: 'inventory.hubTransfers',
  },
] as const

type HubSection = (typeof sections)[number]
type HubFeatureId = HubSection['feature']

export function InventoryHub() {
  const { t } = useTranslation()
  const hubProducts = useFeatureEnabled('inventory.hubProducts')
  const hubPo = useFeatureEnabled('inventory.hubPurchaseOrders')
  const hubCategories = useFeatureEnabled('inventory.hubCategories')
  const hubBrands = useFeatureEnabled('inventory.hubBrands')
  const hubWarehouses = useFeatureEnabled('inventory.hubWarehouses')
  const hubTransfers = useFeatureEnabled('inventory.hubTransfers')
  const hubFlags: Record<HubFeatureId, boolean> = {
    'inventory.hubProducts': hubProducts,
    'inventory.hubPurchaseOrders': hubPo,
    'inventory.hubCategories': hubCategories,
    'inventory.hubBrands': hubBrands,
    'inventory.hubWarehouses': hubWarehouses,
    'inventory.hubTransfers': hubTransfers,
  }
  const visibleSections = sections.filter((s) => hubFlags[s.feature])

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

      {visibleSections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.inventoryHubAllOff')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSections.map(({ to, icon: Icon, key }) => (
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
      )}
    </div>
  )
}
