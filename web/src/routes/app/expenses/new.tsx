import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { ExpenseForm } from '#/components/forms/expense-form'
import { RouteDialog } from '#/components/route-dialog'
import { listExpenses } from '#/lib/expenses'

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
  loader: ({ deps }) => listExpenses({ data: deps }),
  component: NewExpensePage,
})

function NewExpensePage() {
  const expenses = Route.useLoaderData()
  const { from, to } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  function close() {
    router.navigate({ to: '/app/expenses' })
  }

  return (
    <ExpensesContent
      expenses={expenses}
      from={from}
      to={to}
      onFilter={(values) => navigate({ search: (s) => ({ ...s, ...values }) })}
    >
      <RouteDialog title="Add expense" onClose={close}>
        <ExpenseForm onCancel={close} onSaved={close} />
      </RouteDialog>
    </ExpensesContent>
  )
}
