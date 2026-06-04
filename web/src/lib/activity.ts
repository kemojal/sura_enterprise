import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { activityLog, staffMembers } from '#/db/schema'
import { getShopCtxWithPermission } from './context'
import { nanoid } from './nanoid'

// Minimal executor shape shared by `db` and a transaction handle.
type Executor = Pick<typeof db, 'insert'>

export interface LogInput {
  shopId: string
  staffId?: string
  actorName?: string
  action: string
  entityType: string
  entityId?: string
  description: string
}

/**
 * Record an activity-log entry. Pass a transaction handle to log atomically
 * with the mutation, or the default `db` for fire-and-forget logging.
 * Never throws — logging must not break the underlying action.
 */
export async function logActivity(exec: Executor, input: LogInput): Promise<void> {
  try {
    await exec.insert(activityLog).values({
      id: nanoid(),
      shopId: input.shopId,
      staffId: input.staffId,
      actorName: input.actorName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
    })
  } catch {
    // swallow — audit logging is best-effort
  }
}

export const listActivity = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      entityType: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'activity')

    const conditions = [eq(activityLog.shopId, shopId)]
    if (data.entityType) {
      conditions.push(eq(activityLog.entityType, data.entityType))
    }

    return db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        description: activityLog.description,
        createdAt: activityLog.createdAt,
        actorName: activityLog.actorName,
        staffName: staffMembers.name,
      })
      .from(activityLog)
      .leftJoin(staffMembers, eq(activityLog.staffId, staffMembers.id))
      .where(and(...conditions))
      .orderBy(desc(activityLog.createdAt))
      .limit(200)
  })
