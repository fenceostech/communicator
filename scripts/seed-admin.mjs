// Idempotently ensure an initial admin account exists.
// Dev defaults are used only when SEED_ADMIN_* are unset; override in production.
import { Pool } from 'pg'
import { scryptSync, randomBytes } from 'node:crypto'

const email = (process.env.SEED_ADMIN_EMAIL || 'admin@fenceos.io').toLowerCase()
const password = process.env.SEED_ADMIN_PASSWORD || 'admin1234'
const name = process.env.SEED_ADMIN_NAME || 'FenceOS Admin'

function hashPassword(pw) {
  const salt = randomBytes(16)
  const dk = scryptSync(pw, salt, 64)
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`
}

const initials = name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((w) => w[0])
  .join('')
  .toUpperCase()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const res = await pool.query(
    `INSERT INTO app_users (name, email, password_hash, role, initials)
     VALUES ($1, $2, $3, 'admin', $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, hashPassword(password), initials]
  )
  console.log(res.rowCount ? `[seed] created admin ${email}` : `[seed] admin ${email} already exists`)
} finally {
  await pool.end()
}
