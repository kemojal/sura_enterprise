import { createFileRoute, useRouter } from '@tanstack/react-router'

import { SupplierForm } from '#/components/forms/supplier-form'
import { RouteDialog } from '#/components/route-dialog'
import { listSuppliers } from '#/lib/suppliers'
import { SuppliersContent } from './index'

export const Route = createFileRoute('/app/suppliers/new')({
  loader: () => listSuppliers(),
  component: NewSupplierPage,
})

function NewSupplierPage() {
  const suppliers = Route.useLoaderData()
  const router = useRouter()

  function close() {
    router.navigate({ to: '/app/suppliers' })
  }

  return (
    <SuppliersContent suppliers={suppliers}>
      <RouteDialog title="Add supplier" onClose={close}>
        <SupplierForm onCancel={close} onSaved={close} />
      </RouteDialog>
    </SuppliersContent>
  )
}
