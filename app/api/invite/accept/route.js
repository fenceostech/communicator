import { createHash } from 'node:crypto'
import { pool } from '@/lib/db'
import { hashPassword, createSessionToken, setSessionCookie, initialsFor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/invite/accept — set the password for an invited user (public).
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const token = body.token || ''
  const password = body.password || ''
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })
  if (password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const hash = createHash('sha256').update(token).digest('hex')
  const { rows } = await pool.query('SELECT * FROM app_invites WHERE token_hash = $1', [hash])
  const inv = rows[0]
  if (!inv) return Response.json({ error: 'This invite link is invalid.' }, { status: 404 })
  if (inv.accepted_at) return Response.json({ error: 'This invite has already been used.' }, { status: 410 })
  if (new Date(inv.expires_at) < new Date()) return Response.json({ error: 'This invite has expired.' }, { status: 410 })

  const name = inv.name || inv.email
  const initials = initialsFor(name) || inv.email.slice(0, 2).toUpperCase()
  const { rows: urows } = await pool.query(
    `INSERT INTO app_users (name, email, password_hash, role, initials)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, name, email, role, initials`,
    [name, inv.email, hashPassword(password), inv.role, initials]
  )
  await pool.query('UPDATE app_invites SET accepted_at = now() WHERE id = $1', [inv.id])

  const user = urows[0]
  const jwt = await createSessionToken(user)
  await setSessionCookie(jwt)
  return Response.json({ ok: true, id: user.id, email: user.email, name: user.name })
}
