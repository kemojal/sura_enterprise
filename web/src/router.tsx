import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Keep preloaded data fresh long enough to cover hover->click.
    defaultPreloadStaleTime: 30_000,
    // Reuse loader data on revisits instead of re-running the server fn
    // (Neon HTTP round-trip) on every navigation. Mutations call
    // router.invalidate() to force a refetch when data actually changes.
    defaultStaleTime: 30_000,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
