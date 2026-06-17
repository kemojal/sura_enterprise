import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { ProductForm } from '#/components/product-form'
import { RouteDialog } from '#/components/route-dialog'
import { createProduct } from '#/lib/products'
import { productsGridQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'

import { can } from '#/lib/permissions'
import { ProductsContent } from './index'

export const Route = createFileRoute('/app/products/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write'))
      throw redirect({ to: '/app/products' })
  },
  validateSearch: z.object({ search: z.string().optional() }),
  loaderDeps: ({ search }) => ({ search: search.search }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(productsGridQuery({ search: deps.search })),
  component: NewProductPage,
})

function NewProductPage() {
  const data = Route.useLoaderData()
  const { search } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const refresh = useRefresh()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function close() {
    router.navigate({ to: '/app/products' })
  }

  return (
    <ProductsContent
      data={data}
      search={search}
      onSearch={(value) => navigate({ search: { search: value || undefined } })}
    >
      <RouteDialog title="Add product" onClose={close}>
        <ProductForm
          categories={data.categories}
          loading={loading}
          error={error}
          onCancel={close}
          onSubmit={async (values) => {
            setLoading(true)
            setError('')
            try {
              await createProduct({ data: values })
              await refresh()
              close()
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to save')
            } finally {
              setLoading(false)
            }
          }}
        />
      </RouteDialog>
    </ProductsContent>
  )
}
