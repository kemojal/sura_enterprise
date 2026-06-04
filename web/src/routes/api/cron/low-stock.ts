import { createFileRoute } from '@tanstack/react-router'

import { runLowStockDigest } from '#/lib/digests'

// Daily low-stock digest endpoint. Protect with a shared secret so only your
// scheduler can trigger it. Set CRON_SECRET in the environment and have the
// scheduler send it as `Authorization: Bearer <secret>` or `?secret=<secret>`.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    )
  }

  const url = new URL(request.url)
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const provided =
    bearer ||
    request.headers.get('x-cron-secret') ||
    url.searchParams.get('secret') ||
    ''

  if (provided !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runLowStockDigest()
  return Response.json({ ok: true, ...result })
}

export const Route = createFileRoute('/api/cron/low-stock')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
