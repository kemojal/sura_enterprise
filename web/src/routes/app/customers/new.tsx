import { createFileRoute, useRouter } from '@tanstack/react-router'

import { CustomerForm } from '#/components/forms/customer-form'
import { RouteDialog } from '#/components/route-dialog'
import { listCustomers } from '#/lib/customers'
import { CustomersContent } from './index'

export const Route = createFileRoute('/app/customers/new')({
  loader: () => listCustomers({ data: {} }),
  component: NewCustomerPage,
})

function NewCustomerPage() {
  const customers = Route.useLoaderData()
  const router = useRouter()

  function close() {
    router.navigate({ to: '/app/customers' })
  }

  return (
    <CustomersContent customers={customers}>
      <RouteDialog title="Add customer" onClose={close}>
        <CustomerForm onCancel={close} onSaved={close} />
      </RouteDialog>
    </CustomersContent>
  )
}
