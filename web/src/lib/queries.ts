import { queryOptions } from '@tanstack/react-query'

import { listCustomers } from './customers'
import { listExpenses, listExpensesGrid } from './expenses'
import { listCategories, listProducts } from './products'
import { listSales } from './sales'
import { listStaff } from './staff'
import { listSuppliersGrid } from './suppliers'

// Shared query options so a list route and its sibling `/new` dialog route
// (distinct route ids, so router loader caches don't dedupe) reuse the same
// cache entry. The list page populates the cache; opening the dialog reads it.

export const customersListQuery = () =>
  queryOptions({
    queryKey: ['customers', 'list'],
    queryFn: () => listCustomers({ data: {} }),
  })

export const suppliersGridQuery = () =>
  queryOptions({
    queryKey: ['suppliers', 'grid'],
    queryFn: () => listSuppliersGrid(),
  })

export const staffListQuery = () =>
  queryOptions({
    queryKey: ['staff', 'list'],
    queryFn: () => listStaff(),
  })

export const expensesListQuery = (deps: { from?: string; to?: string }) =>
  queryOptions({
    queryKey: ['expenses', 'list', deps],
    queryFn: () => listExpenses({ data: deps }),
  })

export const expensesGridQuery = (deps: { from?: string; to?: string }) =>
  queryOptions({
    queryKey: ['expenses', 'grid', deps],
    queryFn: () => listExpensesGrid({ data: deps }),
  })

export const productsListQuery = (
  params: {
    search?: string
    categoryId?: string
  } = {},
) =>
  queryOptions({
    queryKey: [
      'products',
      'list',
      { search: params.search ?? null, categoryId: params.categoryId ?? null },
    ],
    queryFn: () =>
      listProducts({
        data: { search: params.search, categoryId: params.categoryId },
      }),
  })

export const categoriesListQuery = () =>
  queryOptions({
    queryKey: ['categories', 'list'],
    queryFn: () => listCategories(),
  })

export const salesListQuery = (deps: { from?: string; to?: string }) =>
  queryOptions({
    queryKey: ['sales', 'list', deps],
    queryFn: () => listSales({ data: deps }),
  })
