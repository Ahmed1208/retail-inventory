import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ShoppingCart, Users, Warehouse } from 'lucide-react'

import { cn } from '@/lib/utils'

const INVENTORY_PATHS = [
  '/inventory',
  '/products',
  '/purchase-orders',
  '/movements',
  '/categories',
  '/brands',
] as const

const afterInventoryNav = [
  { to: '/orders', icon: ShoppingCart, key: 'nav.orders' },
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

  const content = (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-4">
        <span className="text-lg font-semibold tracking-tight">
          ستوك بايلوت | StockPilot
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
        <NavLink to="/" end onClick={onNavigate} className={linkClass}>
          <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />
          <span>{t('nav.dashboard')}</span>
        </NavLink>

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

        {afterInventoryNav.map(({ to, icon: Icon, key }) => (
          <NavLink key={to} to={to} onClick={onNavigate} className={linkClass}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t(key)}</span>
          </NavLink>
        ))}
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
