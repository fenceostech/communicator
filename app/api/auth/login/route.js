import { pool } from '@/lib/db'
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/auth/login — verify credentials and start a session.
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  if (!email || !password) {
    return Response.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const { rows } = await pool.query(
    'SELECT id, name, email, role, initials, password_hash FROM app_users WHERE lower(email) = $1',
    [email]
  )
  const user = rows[0]
  if (!user || !verifyPassword(password, user.password_hash)) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await createSessionToken(user)
  await setSessionCookie(token)
  return Response.json({ id: user.id, name: user.name, email: user.email, role: user.role, initials: user.initials })
}
