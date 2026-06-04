import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { useState } from 'react'

import { ProductForm } from '#/components/product-form'
import { db } from '#/db/index'
import { products } from '#/db/schema'
import { listCategories, updateProduct } from '#/lib/products'

import { can } from '#/lib/permissions'

export const Route = createFileRoute('/app/products/$productId/edit')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'products:write')) throw redirect({ to: '/app/products' })
  },
  loader: async ({ params }) => {
    const [product, cats] = await Promise.all([
      (async () => {
        const [p] = await db
          .select()
          .from(products)
          .where(eq(products.id, params.productId))
          .limit(1)
        return p
      })(),
      listCategories(),
    ])
    if (!product) throw new Error('Product not found')
    return { product, categories: cats }
  },
  component: EditProductPage,
})

function EditProductPage() {
  const { product, categories } = Route.useLoaderData()
  const { productId } = Route.useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Edit product</h2>
      <ProductForm
        categories={categories}
        loading={loading}
        error={error}
        defaultValues={{
          name: product.name,
          categoryId: product.categoryId ?? undefined,
          buyingPrice: product.buyingPrice,
          sellingPrice: product.sellingPrice,
          stockQty: product.stockQty,
          lowStockThreshold: product.lowStockThreshold,
          expiryDate: product.expiryDate?.toISOString().slice(0, 10),
          imageUrl: product.imageUrl ?? undefined,
          barcode: product.barcode ?? undefined,
        }}
        onCancel={() => router.navigate({ to: '/app/products' })}
        onSubmit={async (values) => {
          setLoading(true)
          setError('')
          try {
            await updateProduct({ data: { id: productId, ...values } })
            await router.navigate({ to: '/app/products' })
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save')
          } finally {
            setLoading(false)
          }
        }}
      />
    </div>
  )
}
