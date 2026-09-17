import { pool } from '@/lib/db'
import { requireRole, hashPassword, initialsFor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/users — list accounts (admin only).
export async function GET() {
  const { error } = await requireRole(['admin'])
  if (error) return error

  const { rows } = await pool.query(
    `SELECT id, name, email, role, initials, created_at
       FROM app_users
      ORDER BY (role = 'admin') DESC, created_at ASC, id ASC`
  )
  return Response.json(rows)
}

// POST /api/users — create an account (admin only).
export async function POST(request) {
  const { error } = await requireRole(['admin'])
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  const role = body.role === 'admin' ? 'admin' : 'member'

  if (!name) return Response.json({ error: 'Name is required' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const dupe = await pool.query('SELECT 1 FROM app_users WHERE lower(email) = $1', [email])
  if (dupe.rowCount) {
    return Response.json({ error: 'An account with that email already exists' }, { status: 409 })
  }

  const { rows } = await pool.query(
    `INSERT INTO app_users (name, email, password_hash, role, initials)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, initials, created_at`,
    [name, email, hashPassword(password), role, initialsFor(name)]
  )
  return Response.json(rows[0], { status: 201 })
}
