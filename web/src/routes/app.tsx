import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Activity,
  Banknote,
  BarChart3,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  Target,
  Users,
  Wallet,
  X,
} from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { can } from '#/lib/permissions'
import { getAppContext } from '#/lib/shop'

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ location }) => {
    const ctx = await getAppContext()
    if (!ctx) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!ctx.shop && location.pathname !== '/app/setup') {
      throw redirect({ to: '/app/setup' })
    }
    return {
      session: ctx.session,
      shop: ctx.shop,
      role: ctx.role,
    }
  },
  component: AppLayout,
})

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, resource: 'dashboard' },
  { to: '/app/products', label: 'Products', icon: Package, resource: 'products' },
  { to: '/app/categories', label: 'Categories', icon: Tag, resource: 'categories' },
  { to: '/app/sales', label: 'Sales', icon: ShoppingCart, resource: 'sales' },
  { to: '/app/quotes', label: 'Quotes', icon: FileText, resource: 'sales' },
  { to: '/app/expenses', label: 'Expenses', icon: Wallet, resource: 'expenses' },
  { to: '/app/budgets', label: 'Budgets', icon: Target, resource: 'expenses' },
  { to: '/app/customers', label: 'Customers', icon: Users, resource: 'customers' },
  { to: '/app/suppliers', label: 'Suppliers', icon: Receipt, resource: 'suppliers' },
  { to: '/app/purchase-orders', label: 'Purchase Orders', icon: ClipboardList, resource: 'purchase_orders' },
  { to: '/app/cash', label: 'Cash', icon: Banknote, resource: 'cash' },
  { to: '/app/shifts', label: 'Shifts', icon: Clock, resource: 'sales' },
  { to: '/app/reports', label: 'Reports', icon: BarChart3, resource: 'reports' },
  { to: '/app/activity', label: 'Activity', icon: Activity, resource: 'activity' },
  { to: '/app/staff', label: 'Staff', icon: Users, resource: 'staff' },
  { to: '/app/settings', label: 'Settings', icon: Settings, resource: 'settings' },
] as const

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function AppLayout() {
  const { session, shop, role } = Route.useRouteContext()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [open, setOpen] = useState(false)

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  const visibleItems = navItems.filter(({ resource }) => can(role, resource))
  const current = visibleItems.find(
    ({ to }) => pathname === to || pathname.startsWith(to + '/'),
  )

  const SidebarBody = (
    <>
      <div className="px-5 pt-5 pb-4">
        <Link to="/app/dashboard" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-lagoon to-palm flex items-center justify-center text-white font-bold shadow-sm">
            S
          </div>
          <div className="min-w-0">
            <p className="display-title text-[15px] font-bold tracking-tight text-sea-ink leading-none">
              StoreFlow
            </p>
            {shop && (
              <p className="text-[11px] text-sea-ink-soft truncate mt-1 leading-none">{shop.name}</p>
            )}
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 pt-1 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + '/')
          return (
            <Link key={to} to={to} data-active={active} className="app-nav">
              <Icon size={17} className="shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-line">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-lagoon to-palm flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initials(session.user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-sea-ink truncate leading-tight">
              {session.user.name}
            </p>
            <p className="text-[11px] text-sea-ink-soft capitalize leading-tight">{role}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sea-ink-soft hover:text-sea-ink hover:bg-sea-ink/[0.05] transition-colors shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen app-bg text-sea-ink">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-line bg-white/70 backdrop-blur-xl">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-sea-ink/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 flex flex-col bg-white border-r border-line shadow-xl transition-transform duration-300 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sea-ink-soft hover:bg-sea-ink/[0.05]"
          >
            <X size={18} />
          </button>
          {SidebarBody}
        </aside>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 flex items-center gap-3 px-4 border-b border-line bg-white/80 backdrop-blur-xl sticky top-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 -ml-1.5 rounded-lg flex items-center justify-center text-sea-ink hover:bg-sea-ink/[0.05]"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sea-ink">{current?.label ?? 'StoreFlow'}</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
