import { QueryClient } from '@tanstack/react-query'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Loaders share these queries across routes (e.g. a list page and
        // its `/new` dialog route). Keeping data fresh for 30s means the
        // dialog reuses the list already in cache instead of re-fetching.
        // Mutations call useRefresh() -> invalidateQueries() to bust this.
        staleTime: 30_000,
      },
    },
  })
  return { queryClient }
}
