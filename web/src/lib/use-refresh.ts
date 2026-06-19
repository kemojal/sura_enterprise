import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

/**
 * Returns a function that refreshes data after a mutation.
 *
 * Loaders read through react-query (ensureQueryData), so a router-only
 * invalidate would re-run a loader that just hands back still-fresh cached
 * data. Busting the query cache first forces the refetch; router.invalidate()
 * then re-runs active loaders to pull the fresh data into useLoaderData.
 */
export function useRefresh() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async () => {
    await queryClient.invalidateQueries()
    await router.invalidate()
  }
}
