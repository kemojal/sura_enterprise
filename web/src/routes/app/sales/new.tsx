import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { SaleForm } from '#/components/forms/sale-form'
import { RouteDialog } from '#/components/route-dialog'
import { listCustomers } from '#/lib/customers'
import { listProducts } from '#/lib/products'
import { getSaleConfig, listSales } from '#/lib/sales'
import { SalesContent } from './index'

export const Route = createFileRoute('/app/sales/new')({
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [sales, products, customers, config] = await Promise.all([
      listSales({ data: deps }),
      listProducts({ data: {} }),
      listCustomers({ data: {} }),
      getSaleConfig(),
    ])
    return { sales, products, customers, config }
  },
  component: NewSalePage,
})

function NewSalePage() {
  const { sales, products, customers, config } = Route.useLoaderData()
  const { from, to } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  function close() {
    router.navigate({ to: '/app/sales' })
  }

  return (
    <SalesContent
      sales={sales}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    >
      <RouteDialog title="New sale" onClose={close} className="max-w-5xl">
        <SaleForm
          products={products}
          customers={customers}
          taxRate={config.taxRate}
          taxInclusive={config.taxInclusive}
          onCancel={close}
          onSaved={(saleId) =>
            router.navigate({
              to: '/app/sales/$saleId/receipt',
              params: { saleId },
            })
          }
        />
      </RouteDialog>
    </SalesContent>
  )
}
