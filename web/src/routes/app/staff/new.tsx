import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { StaffForm } from '#/components/forms/staff-form'
import { RouteDialog } from '#/components/route-dialog'
import { can } from '#/lib/permissions'
import { listStaff } from '#/lib/staff'
import { StaffContent } from './index'

export const Route = createFileRoute('/app/staff/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'staff')) throw redirect({ to: '/app/dashboard' })
  },
  loader: () => listStaff(),
  component: NewStaffPage,
})

function NewStaffPage() {
  const staff = Route.useLoaderData()
  const router = useRouter()

  function close() {
    router.navigate({ to: '/app/staff' })
  }

  return (
    <StaffContent staff={staff}>
      <RouteDialog title="Add staff" onClose={close}>
        <StaffForm onCancel={close} onSaved={close} />
      </RouteDialog>
    </StaffContent>
  )
}
