import { randomBytes } from 'node:crypto'
import { pool } from '@/lib/db'
import { createGuestSessionToken, setSessionCookie, initialsFor, GUEST_TTL_SECONDS } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/auth/guest — start a restricted, name-only guest session.
// No account, email, password, or email verification is required. The guest
// receives role 'guest' (member-level: read + add notes), which is enforced
// on the backend by requireRole — guests cannot reach any admin-only mutation.
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Require a name; trim, collapse whitespace, strip control chars, cap length.
  let name = String(body.name || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) return Response.json({ error: 'Please enter your name to continue' }, { status: 400 })
  if (name.length < 2) return Response.json({ error: 'Please enter your full name' }, { status: 400 })
  if (name.length > 60) name = name.slice(0, 60)

  const sid = randomBytes(12).toString('hex')
  const token = await createGuestSessionToken({ name, sid })
  await setSessionCookie(token, GUEST_TTL_SECONDS)

  // Best-effort audit row so the owner can see who accessed the shared URL.
  // Never block guest entry if the database is momentarily unavailable.
  try {
    await pool.query(
      `INSERT INTO guest_sessions (sid, name) VALUES ($1, $2)
       ON CONFLICT (sid) DO NOTHING`,
      [sid, name]
    )
  } catch (e) {}

  return Response.json({ ok: true, name, role: 'guest', guest: true, initials: initialsFor(name) || 'G', sid })
}
