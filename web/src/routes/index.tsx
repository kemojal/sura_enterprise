import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSession } from '#/lib/session'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session) {
      throw redirect({ to: '/app/dashboard' })
    }
    throw redirect({ to: '/login' })
  },
  component: () => null,
})
