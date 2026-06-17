import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const AppDevtools =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'
    ? lazy(async () => {
        const [
          { TanStackRouterDevtoolsPanel },
          { TanStackDevtools },
          { default: TanStackQueryDevtools },
        ] = await Promise.all([
          import('@tanstack/react-router-devtools'),
          import('@tanstack/react-devtools'),
          import('../integrations/tanstack-query/devtools'),
        ])

        return {
          default: function AppDevtoolsPanel() {
            return (
              <TanStackDevtools
                config={{
                  position: 'bottom-right',
                }}
                plugins={[
                  {
                    name: 'Tanstack Router',
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                  TanStackQueryDevtools,
                ]}
              />
            )
          },
        }
      })
    : null

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="portal" style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000 }} />
        {children}
        {AppDevtools && (
          <Suspense fallback={null}>
            <AppDevtools />
          </Suspense>
        )}
        <Scripts />
      </body>
    </html>
  )
}
