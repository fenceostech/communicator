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
const url = process.env.DATABASE_URL
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

const pool = new Pool({ connectionString: url, ssl: sslFor(url) })
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

  console.log('[migrate] done')
} finally {
  await pool.end()
}
