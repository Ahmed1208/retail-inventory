import { useIsMutating } from '@tanstack/react-query'
import { useLocation, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Menu } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useInventorySessionBootstrap } from '@/hooks/useInventorySessionBootstrap'
import { StockAlertsBell } from '@/components/alerts/StockAlertsBell'
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
  '/control': 'control.title',
  '/inventory': 'nav.inventory',
  '/products': 'products.title',
  '/people': 'people.title',
  '/payments': 'nav.payments',
  '/register': 'register.title',
  '/payments/list': 'payments.allPayments',
  '/payments/new': 'payments.newPayment',
  '/categories': 'categories.title',
  '/brands': 'brands.title',
  '/warehouses': 'warehouses.title',
  '/purchase-orders': 'purchaseOrders.title',
}

export function AppLayout() {
  const { isRTL, currentLanguage, toggleLanguage } = useLanguage()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { signOut, session } = useAuth()
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const isMutating = useIsMutating() > 0
  useInventorySessionBootstrap()

  const pageTitle =
    pathname === '/admin' || pathname === '/admin/'
      ? 'nav.admin'
      : pathname === '/admin/dashboard'
        ? 'dashboard.title'
      : pathname === '/admin/reports'
        ? 'reports.title'
      : pathname === '/admin/documentation'
        ? 'documentation.title'
      : pathname === '/admin/migration'
        ? 'migrationGuide.title'
      : pathname === '/admin/movements'
        ? 'stockMovements.title'
      : pathname === '/admin/members/new'
        ? 'members.newTitle'
      : pathname === '/admin/members'
        ? 'members.listTitle'
      : pathname.startsWith('/products/')
        ? 'products.detailTitle'
      : /^\/people\/[^/]+$/.test(pathname)
        ? 'people.detailTitle'
      : pathname === '/orders/new'
        ? 'orders.newOrder'
        : pathname.startsWith('/orders')
          ? 'orders.title'
    : pathname === '/purchase-orders/new'
      ? 'purchaseOrders.newPurchaseOrder'
      : pathname.startsWith('/purchase-orders')
        ? 'purchaseOrders.title'
        : pathname.startsWith('/payments')
          ? (pathToTitleKey[pathname] ?? 'nav.payments')
          : pathname === '/register'
            ? 'register.title'
            : (pathToTitleKey[pathname] ?? 'dashboard.title')
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
            {session && <StockAlertsBell />}

            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {currentLanguage === 'en' ? 'العربية' : 'English'}
            </button>

            {session && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                {t('auth.logout')}
              </button>
            )}
          </div>
        </header>

        <main className="p-4 md:p-6 relative">
          <Outlet />
        </main>

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
