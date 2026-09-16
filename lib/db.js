import { Pool } from 'pg'

// Enable TLS for remote databases (e.g. Supabase); skip it for local dev.
// Opt out with sslmode=disable in the connection string.
export function sslFor(connectionString) {
  try {
    const u = new URL(connectionString)
    const host = u.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return undefined
    if (/sslmode=disable/i.test(connectionString)) return undefined
    return { rejectUnauthorized: false }
  } catch {
    return undefined
  }
}

// Reuse a single pool across hot-reloads / serverless invocations.
const globalForPg = globalThis
export const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslFor(process.env.DATABASE_URL || ''),
  })
if (!globalForPg.__pgPool) globalForPg.__pgPool = pool
