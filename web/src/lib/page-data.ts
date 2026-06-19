import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getShopCtx } from './context'
import { _listCustomersCore } from './customers'
import { _listHeldSalesCore } from './held-sales'
import { _listSellableItemsCore } from './products'
import { _getSaleConfigCore, _listSalesCore } from './sales'

// Combined page-data server fns: resolve getShopCtx() ONCE, then run every
// underlying query in parallel. A loader that previously fired N server fns
// (N network round-trips, N context resolutions) now does one of each.

export const getSalesNewData = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ from: z.string().optional(), to: z.string().optional() }),
  )
  .handler(async ({ data }) => {
    const ctx = await getShopCtx(getRequest().headers)
    const [sales, sellable, customers, config, held] = await Promise.all([
      _listSalesCore(ctx, data),
      _listSellableItemsCore(ctx),
      _listCustomersCore(ctx, {}),
      _getSaleConfigCore(ctx),
      _listHeldSalesCore(ctx),
    ])
    return { sales, sellable, customers, config, held }
  })

export const getQuotesNewData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const ctx = await getShopCtx(getRequest().headers)
    const [sellable, customers] = await Promise.all([
      _listSellableItemsCore(ctx),
      _listCustomersCore(ctx, {}),
    ])
    return { sellable, customers }
  },
)
