// Portable migration + optional seed runner. Works anywhere Node + DATABASE_URL
// are available (local, a Vercel build step, or against Supabase directly):
//
//   DATABASE_URL=postgres://... pnpm migrate
//
// Schema migrations in db/migrations/ are always applied (idempotent).
// Demo seeds in db/seeds/ and a default admin are applied only for a local
// database, unless explicitly forced (SEED_DEMO=1 / SEED_ADMIN_PASSWORD).
import { Pool } from 'pg'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { scryptSync, randomBytes } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// DATABASE_URL wins; otherwise use the Supabase integration's direct URL
// (previews on Vercel have no DATABASE_URL). Keep in sync with lib/db.js.
const url =
  process.env.DATABASE_URL ||
  process.env.communicator_POSTGRES_URL_NON_POOLING ||
  process.env.communicator_POSTGRES_URL ||
  ''
if (!url) {
  // During a build (e.g. Vercel) without a database configured, skip gracefully
  // so the build still succeeds. Elsewhere, a missing URL is an error.
  const optional = process.env.VERCEL === '1' || process.env.MIGRATE_OPTIONAL === '1'
  if (optional) {
    console.log('[migrate] DATABASE_URL not set — skipping migrations (build will continue)')
    process.exit(0)
  }
  console.error('[migrate] DATABASE_URL is required')
  process.exit(1)
}

const isLocal = /(@|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)
const seedDemo = process.env.SEED_DEMO === '1' || isLocal
const adminPassword = process.env.SEED_ADMIN_PASSWORD || (isLocal ? 'admin1234' : '')

function sqlFiles(dir) {
  try {
    return readdirSync(join(root, dir))
      .filter((f) => f.endsWith('.sql'))
      .sort()
  } catch {
    return []
  }
}

function hashPassword(pw) {
  const salt = randomBytes(16)
  const dk = scryptSync(pw, salt, 64)
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`
}

function sslFor(cs) {
  try {
    const h = new URL(cs).hostname
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return undefined
    if (/sslmode=disable/i.test(cs)) return undefined
    return { rejectUnauthorized: false }
  } catch {
    return undefined
  }
}

// pg treats sslmode=require in the URL as full certificate verification and
// lets it override the `ssl` option; drop the URL's SSL params so sslFor() decides.
function withoutSslParams(cs) {
  try {
    const u = new URL(cs)
    for (const k of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return cs
  }
}

const pool = new Pool({ connectionString: withoutSslParams(url), ssl: sslFor(url) })
try {
  for (const f of sqlFiles('db/migrations')) {
    console.log('[migrate] apply', f)
    await pool.query(readFileSync(join(root, 'db/migrations', f), 'utf8'))
  }

  if (seedDemo) {
    for (const f of sqlFiles('db/seeds')) {
      console.log('[migrate] seed', f)
      await pool.query(readFileSync(join(root, 'db/seeds', f), 'utf8'))
    }
  } else {
    console.log('[migrate] skipping demo seeds (remote DB; set SEED_DEMO=1 to force)')
  }

  if (adminPassword) {
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@fenceos.io').toLowerCase()
    const name = process.env.SEED_ADMIN_NAME || 'FenceOS Admin'
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
    const res = await pool.query(
      `INSERT INTO app_users (name, email, password_hash, role, initials)
       VALUES ($1, $2, $3, 'admin', $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [name, email, hashPassword(adminPassword), initials]
    )
    console.log(res.rowCount ? `[migrate] created admin ${email}` : `[migrate] admin ${email} already exists`)
  } else {
    console.log('[migrate] skipping admin seed (set SEED_ADMIN_PASSWORD to create one)')
  }

  // Demo login users (the invited team). Seeded locally, or in prod when
  // SEED_USERS_PASSWORD is set. All share one demo password — change in prod.
  const demoUsersPassword = process.env.SEED_USERS_PASSWORD || (seedDemo ? 'fenceos123' : '')
  if (demoUsersPassword) {
    const users = [
      { name: 'Ryan Malaluan', email: 'ryan@example.com', role: 'admin', initials: 'RM' },
      { name: 'Alex Moreno', email: 'alex@example.com', role: 'member', initials: 'AM' },
      { name: 'Sam Okonkwo', email: 'sam@example.com', role: 'member', initials: 'SO' },
    ]
    for (const u of users) {
      const r = await pool.query(
        `INSERT INTO app_users (name, email, password_hash, role, initials)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [u.name, u.email.toLowerCase(), hashPassword(demoUsersPassword), u.role, u.initials]
      )
      console.log(r.rowCount ? `[migrate] created user ${u.email}` : `[migrate] user ${u.email} exists`)
    }
  } else {
    console.log('[migrate] skipping demo users (set SEED_USERS_PASSWORD to create them)')
  }

  // Ensure the primary owner/admin account on EVERY deploy so login access is
  // never lost. Driven by OWNER_EMAIL + OWNER_PASSWORD (set once in the host
  // env, e.g. Vercel). Idempotent: creates the account if missing and always
  // (re)sets the password + admin role so the owner can always sign in.
  const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase()
  const ownerPassword = process.env.OWNER_PASSWORD || ''
  if (ownerEmail && ownerPassword) {
    const ownerName = process.env.OWNER_NAME || 'Integrators Solutions'
    const ownerInitials =
      ownerName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'OW'
    const res = await pool.query(
      `INSERT INTO app_users (name, email, password_hash, role, initials)
       VALUES ($1, $2, $3, 'admin', $4)
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
       RETURNING (xmax = 0) AS created`,
      [ownerName, ownerEmail, hashPassword(ownerPassword), ownerInitials]
    )
    console.log(
      `[migrate] ensured owner admin ${ownerEmail} (${res.rows[0].created ? 'created' : 'password reset'})`
    )
  } else {
    console.log('[migrate] OWNER_EMAIL/OWNER_PASSWORD not set — skipping owner-admin ensure')
  }

  console.log('[migrate] done')
} catch (err) {
  // On a Vercel build, never break the deploy over a transient DB error;
  // log it and continue so the app still ships. Elsewhere, fail loudly.
  const optional = process.env.VERCEL === '1' || process.env.MIGRATE_OPTIONAL === '1'
  console.error('[migrate] error:', err && err.message ? err.message : err)
  if (!optional) {
    await pool.end().catch(() => {})
    process.exit(1)
  }
  console.warn('[migrate] continuing despite error (VERCEL/MIGRATE_OPTIONAL set).')
} finally {
  await pool.end().catch(() => {})
}
