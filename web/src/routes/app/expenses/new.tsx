import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { ExpenseForm } from '#/components/forms/expense-form'
import { RouteDialog } from '#/components/route-dialog'
import { expensesGridQuery } from '#/lib/queries'
import { useRefresh } from '#/lib/use-refresh'

import { can } from '#/lib/permissions'
import { ExpensesContent } from './index'

export const Route = createFileRoute('/app/expenses/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.role, 'expenses')) throw redirect({ to: '/app/dashboard' })
  },
  validateSearch: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(expensesGridQuery(deps)),
  component: NewExpensePage,
})

function NewExpensePage() {
  const data = Route.useLoaderData()
  const { from, to } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const refresh = useRefresh()

  function close() {
    router.navigate({ to: '/app/expenses' })
  }

  async function saved() {
    await refresh()
    close()
  }

  return (
    <ExpensesContent
      data={data}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    >
      <RouteDialog title="Add expense" onClose={close}>
        <ExpenseForm onCancel={close} onSaved={saved} />
      </RouteDialog>
    </ExpensesContent>
  )
}
