import { Pool } from 'pg'

// Reuse a single pool across hot-reloads / serverless invocations.
const globalForPg = globalThis
export const pool =
  globalForPg.__pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL })
if (!globalForPg.__pgPool) globalForPg.__pgPool = pool
