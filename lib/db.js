import { Pool } from 'pg'

// DATABASE_URL wins. Otherwise fall back to the Supabase integration's pooled
// URL, which Vercel sets for every environment (previews have no DATABASE_URL).
export const databaseUrl = process.env.DATABASE_URL || process.env.communicator_POSTGRES_URL || ''

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

// pg treats sslmode=require in the URL as full certificate verification and
// lets it override the `ssl` option, which rejects Supabase's pooler cert.
// Drop the URL's SSL params so sslFor() decides.
export function withoutSslParams(connectionString) {
  try {
    const u = new URL(connectionString)
    for (const k of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return connectionString
  }
}

// Reuse a single pool across hot-reloads / serverless invocations.
const globalForPg = globalThis
export const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString: withoutSslParams(databaseUrl) || undefined,
    ssl: sslFor(databaseUrl),
  })
if (!globalForPg.__pgPool) globalForPg.__pgPool = pool
