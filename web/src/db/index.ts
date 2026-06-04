import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'

import * as schema from './schema.ts'

// DATABASE_URL is server-only. On client this module loads but db is null.
// All db access is wrapped in createServerFn handlers which only run server-side.
const url = typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined

export const db = url
  ? drizzle(new Pool({ connectionString: url }), { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>)
