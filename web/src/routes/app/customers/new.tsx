import { createFileRoute, useRouter } from '@tanstack/react-router'

import { CustomerForm } from '#/components/forms/customer-form'
import { RouteDialog } from '#/components/route-dialog'
import { customersListQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'
import { CustomersContent } from './index'

export const Route = createFileRoute('/app/customers/new')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(customersListQuery()),
  component: NewCustomerPage,
})

function NewCustomerPage() {
  const customers = Route.useLoaderData()
  const router = useRouter()
  const refresh = useRefresh()

  function close() {
    router.navigate({ to: '/app/customers' })
  }

  async function saved() {
    await refresh()
    close()
  }

  return (
    <CustomersContent customers={customers}>
      <RouteDialog title="Add customer" onClose={close}>
        <CustomerForm onCancel={close} onSaved={saved} />
      </RouteDialog>
    </CustomersContent>
  )
}
