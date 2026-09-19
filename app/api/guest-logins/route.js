import { pool } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/guest-logins — Owner/Admin ONLY. Returns guest sign-in history from
// the guest_sessions table. Guests and members are rejected with 403 (not just
// hidden in the UI); unauthenticated requests get 401. Guests can never read
// their own or others' login records through the app.
export async function GET() {
  const { error } = await requireRole(['admin'])
  if (error) return error // 401 (not signed in) or 403 (guest/member)
  try {
    const { rows } = await pool.query(
      `SELECT sid, name, created_at, last_seen_at
         FROM guest_sessions
        ORDER BY created_at DESC, sid DESC
        LIMIT 500`
    )
    return Response.json({ logins: rows })
  } catch (e) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}
