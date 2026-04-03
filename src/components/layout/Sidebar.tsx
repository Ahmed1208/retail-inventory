import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Banknote,
  ShoppingCart,
  Shield,
  SlidersHorizontal,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

const INVENTORY_PATHS = [
  '/inventory',
  '/products',
  '/purchase-orders',
  '/categories',
  '/brands',
] as const

const ORDERS_PREFIX = '/orders'
const PAYMENTS_PREFIX = '/payments'
const REGISTER_PATH = '/register'

function pathMatchesOrders(pathname: string): boolean {
  return pathname === ORDERS_PREFIX || pathname.startsWith(`${ORDERS_PREFIX}/`)
}

function pathMatchesPayments(pathname: string): boolean {
  return (
    pathname === PAYMENTS_PREFIX || pathname.startsWith(`${PAYMENTS_PREFIX}/`)
  )
}

function pathMatchesRegister(pathname: string): boolean {
  return pathname === REGISTER_PATH
}

const afterInventoryNav = [
  { to: ORDERS_PREFIX, icon: ShoppingCart, key: 'nav.orders' },
  { to: '/people', icon: Users, key: 'nav.people' },
] as const

function pathMatchesInventory(pathname: string): boolean {
  return INVENTORY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-white/15 text-white'
      : 'text-white/80 hover:bg-white/10 hover:text-white'
  )

interface SidebarProps {
  isRTL: boolean
  /** When provided (e.g. in mobile sheet), called when a nav link is clicked to close the sheet */
  onNavigate?: () => void
  /** When true, render as inline content (no fixed positioning) for use inside Sheet */
  inline?: boolean
}

export function Sidebar({ isRTL, onNavigate, inline }: SidebarProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  const showControlNav = useFeatureEnabled('sidebar.control')
  const showInventoryNav = useFeatureEnabled('sidebar.inventory')
  const showOrdersNav = useFeatureEnabled('sidebar.orders')
  const showPeopleNav = useFeatureEnabled('sidebar.people')
  const showPaymentsNav = useFeatureEnabled('sidebar.payments')
  const showRegisterNav = useFeatureEnabled('sidebar.register')
  const showAdminGroup = useFeatureEnabled('sidebar.admin')
  const showDashboardNav = useFeatureEnabled('sidebar.dashboard')
  const showDocumentationNav = useFeatureEnabled('sidebar.documentation')
  const showReportsShortcut = useFeatureEnabled('sidebar.reports')
  const showHubMovements = useFeatureEnabled('inventory.hubMovements')

  const anyAdminChild =
    showDashboardNav ||
    showDocumentationNav ||
    showReportsShortcut ||
    showHubMovements
  const showAdminNav = showAdminGroup && anyAdminChild

  const content = (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-4">
        <span className="text-lg font-semibold tracking-tight">
          ستوك بايلوت | StockPilot
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
        {showControlNav && (
          <NavLink to="/control" end onClick={onNavigate} className={linkClass}>
            <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t('nav.control')}</span>
          </NavLink>
        )}

        {showAdminNav && (
          <NavLink
            to="/admin"
            end
            onClick={onNavigate}
            className={linkClass}
          >
            <Shield className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t('nav.admin')}</span>
          </NavLink>
        )}

        {showInventoryNav && (
          <NavLink
            to="/inventory"
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              linkClass({
                isActive: isActive || pathMatchesInventory(pathname),
              })
            }
          >
            <Warehouse className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t('nav.inventory')}</span>
          </NavLink>
        )}

        {afterInventoryNav.map(({ to, icon: Icon, key }) => {
          if (to === ORDERS_PREFIX && !showOrdersNav) return null
          if (to === '/people' && !showPeopleNav) return null
          return (
            <NavLink
              key={to}
              to={to}
              end={false}
              onClick={onNavigate}
              className={({ isActive }) =>
                linkClass({
                  isActive:
                    to === ORDERS_PREFIX
                      ? isActive || pathMatchesOrders(pathname)
                      : isActive,
                })
              }
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span>{t(key)}</span>
            </NavLink>
          )
        })}

        {showPaymentsNav && (
          <NavLink
            to={PAYMENTS_PREFIX}
            end={false}
            onClick={onNavigate}
            className={({ isActive }) =>
              linkClass({
                isActive: isActive || pathMatchesPayments(pathname),
              })
            }
          >
            <Banknote className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t('nav.payments')}</span>
          </NavLink>
        )}

        {showRegisterNav && (
          <NavLink
            to={REGISTER_PATH}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              linkClass({
                isActive: isActive || pathMatchesRegister(pathname),
              })
            }
          >
            <Wallet className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t('nav.register')}</span>
          </NavLink>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <p className="text-center text-xs text-white/50">v1.0.0</p>
      </div>
    </>
  )

  if (inline) {
    return (
      <div className="flex h-full w-[240px] flex-col bg-[#1a1a2e] text-white">
        {content}
      </div>
    )
  }

  return (
    <aside
      className={cn(
        'fixed top-0 z-40 h-screen w-[240px] flex flex-col bg-[#1a1a2e] text-white transition-[left,right] duration-300 ease-in-out',
        isRTL ? 'right-0' : 'left-0'
      )}
    >
      {content}
    </aside>
  )
}
