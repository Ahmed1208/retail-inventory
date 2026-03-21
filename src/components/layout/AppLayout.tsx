import { useQuery, useIsMutating } from '@tanstack/react-query'
import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, Menu } from 'lucide-react'

import { useLanguage } from '@/hooks/useLanguage'
import { useIsMobile } from '@/hooks/useIsMobile'
import { getLowStockProducts } from '@/services/productService'
import { Sidebar } from './Sidebar'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const pathToTitleKey: Record<string, string> = {
  '/': 'dashboard.title',
  '/inventory': 'nav.inventory',
  '/products': 'products.title',
  '/movements': 'stockMovements.title',
  '/orders': 'orders.title',
  '/categories': 'categories.title',
  '/brands': 'brands.title',
  '/reports': 'reports.title',
  '/purchase-orders': 'purchaseOrders.title',
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isRTL, currentLanguage, toggleLanguage } = useLanguage()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const isMutating = useIsMutating() > 0

  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ['lowStockProducts'],
    queryFn: getLowStockProducts,
  })
  const lowStockCount = lowStockProducts.length
  const pageTitle = pathToTitleKey[pathname] ?? 'dashboard.title'
  const lowStockHref = '/products?lowStock=1'

  return (
    <div
      className="min-h-screen bg-white transition-[padding] duration-300 ease-in-out"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {!isMobile && <Sidebar isRTL={isRTL} />}

      <div
        className={cn(
          'min-h-screen transition-[margin] duration-300 ease-in-out',
          !isMobile && (isRTL ? 'mr-[240px]' : 'ml-[240px]')
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-white px-4 md:px-6">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side={isRTL ? 'right' : 'left'}
                  className="p-0 w-[240px]"
                >
                  <SheetTitle className="sr-only">{t('nav.dashboard')}</SheetTitle>
                  <Sidebar
                    isRTL={isRTL}
                    inline
                    onNavigate={() => setSheetOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            )}
            <h1 className="text-lg font-semibold text-foreground">
              {t(pageTitle)}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative">
              <Link
                to={lowStockHref}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground inline-flex"
                aria-label={t('common.lowStock')}
              >
                <Bell className="h-5 w-5" />
              </Link>
              {lowStockCount > 0 && (
                <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                  {lowStockCount > 99 ? '99+' : lowStockCount}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {currentLanguage === 'en' ? 'العربية' : 'English'}
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6 relative">{children}</main>

        {/* Global mutation loading indicator */}
        {isMutating && (
          <div
            className="fixed bottom-4 end-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            aria-hidden
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  )
}
