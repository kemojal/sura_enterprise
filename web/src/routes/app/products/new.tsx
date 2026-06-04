import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { ProductForm } from '#/components/product-form'
import { RouteDialog } from '#/components/route-dialog'
import { createProduct, listCategories, listProducts } from '#/lib/products'

import { can } from '#/lib/permissions'
import { ProductsContent } from './index'

export const Route = createFileRoute('/app/products/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write'))
      throw redirect({ to: '/app/products' })
  },
  validateSearch: z.object({ search: z.string().optional() }),
  loaderDeps: ({ search }) => ({ search: search.search }),
  loader: async ({ deps }) => {
    const [products, categories] = await Promise.all([
      listProducts({ data: { search: deps.search } }),
      listCategories(),
    ])
    return { products, categories }
  },
  component: NewProductPage,
})

function NewProductPage() {
  const { products, categories } = Route.useLoaderData()
  const { search } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function close() {
    router.navigate({ to: '/app/products' })
  }

  return (
    <ProductsContent
      products={products}
      search={search}
      onSearch={(value) => navigate({ search: { search: value || undefined } })}
    >
      <RouteDialog title="Add product" onClose={close}>
        <ProductForm
          categories={categories}
          loading={loading}
          error={error}
          onCancel={close}
          onSubmit={async (values) => {
            setLoading(true)
            setError('')
            try {
              await createProduct({ data: values })
              await close()
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
