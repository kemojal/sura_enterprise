import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { StaffForm } from '#/components/forms/staff-form'
import { RouteDialog } from '#/components/route-dialog'
import { can } from '#/lib/permissions'
import { staffListQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'
import { StaffContent } from './index'

export const Route = createFileRoute('/app/staff/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'staff')) throw redirect({ to: '/app/dashboard' })
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(staffListQuery()),
  component: NewStaffPage,
})

function NewStaffPage() {
  const staff = Route.useLoaderData()
  const router = useRouter()
  const refresh = useRefresh()

  function close() {
    router.navigate({ to: '/app/staff' })
  }

  async function saved() {
    await refresh()
    close()
  }

  return (
    <StaffContent staff={staff}>
      <RouteDialog title="Add staff" onClose={close}>
        <StaffForm onCancel={close} onSaved={saved} />
      </RouteDialog>
    </StaffContent>
  )
}
