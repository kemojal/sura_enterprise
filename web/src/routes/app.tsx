import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  Wallet,
} from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { can, type StaffRole } from '#/lib/permissions'
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
      role: ctx.role as StaffRole,
    }
  },
  component: AppLayout,
})

const navItems = [
  {
    to: '/app/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    resource: 'dashboard',
  },
  {
    to: '/app/products',
    label: 'Products',
    icon: Package,
    resource: 'products',
  },
  {
    to: '/app/categories',
    label: 'Categories',
    icon: Tag,
    resource: 'categories',
  },
  { to: '/app/sales', label: 'Sales', icon: ShoppingCart, resource: 'sales' },
  {
    to: '/app/expenses',
    label: 'Expenses',
    icon: Wallet,
    resource: 'expenses',
  },
  {
    to: '/app/customers',
    label: 'Customers',
    icon: Users,
    resource: 'customers',
  },
  {
    to: '/app/suppliers',
    label: 'Suppliers',
    icon: Receipt,
    resource: 'suppliers',
  },
  {
    to: '/app/purchase-orders',
    label: 'Purchase Orders',
    icon: ClipboardList,
    resource: 'purchase_orders',
  },
  {
    to: '/app/reports',
    label: 'Reports',
    icon: BarChart3,
    resource: 'reports',
  },
  {
    to: '/app/activity',
    label: 'Activity',
    icon: Activity,
    resource: 'activity',
  },
  { to: '/app/staff', label: 'Staff', icon: Users, resource: 'staff' },
  { to: '/app/settings', label: 'Settings', icon: Settings, resource: 'settings' },
] as const

function AppLayout() {
  const { session, shop, role } = Route.useRouteContext()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-60 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-900">StoreFlow</h1>
          {shop && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{shop.name}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems
            .filter(({ resource }) => can(role, resource))
            .map(({ to, label, icon: Icon }) => {
              const active = pathname === to || pathname.startsWith(to + '/')
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
        </nav>

        <div className="p-3 border-t">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{role}</p>
            </div>
            <button
              onClick={signOut}
              className="text-xs text-gray-400 hover:text-gray-700 ml-2 shrink-0"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
