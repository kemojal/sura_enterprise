import { createFileRoute, useRouter } from '@tanstack/react-router'

import { SupplierForm } from '#/components/forms/supplier-form'
import { RouteDialog } from '#/components/route-dialog'
import { suppliersGridQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'
import { SuppliersContent } from './index'

export const Route = createFileRoute('/app/suppliers/new')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(suppliersGridQuery()),
  component: NewSupplierPage,
})

function NewSupplierPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const refresh = useRefresh()

  function close() {
    router.navigate({ to: '/app/suppliers' })
  }

  async function saved() {
    await refresh()
    close()
  }

  return (
    <SuppliersContent data={data}>
      <RouteDialog title="Add supplier" onClose={close}>
        <SupplierForm onCancel={close} onSaved={saved} />
      </RouteDialog>
    </SuppliersContent>
  )
}
