import { createHash } from 'node:crypto'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/invite?token=... — validate an invite token (public).
export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || ''
  if (!token) return Response.json({ valid: false, error: 'Missing token' }, { status: 400 })
  const hash = createHash('sha256').update(token).digest('hex')
  try {
    const { rows } = await pool.query(
      'SELECT email, name, role, expires_at, accepted_at FROM app_invites WHERE token_hash = $1',
      [hash]
    )
    const inv = rows[0]
    if (!inv) return Response.json({ valid: false, error: 'This invite link is invalid.' }, { status: 404 })
    if (inv.accepted_at) return Response.json({ valid: false, error: 'This invite has already been used.' }, { status: 410 })
    if (new Date(inv.expires_at) < new Date()) return Response.json({ valid: false, error: 'This invite has expired.' }, { status: 410 })
    return Response.json({ valid: true, email: inv.email, name: inv.name })
  } catch (e) {
    return Response.json({ valid: false, error: 'Unavailable' }, { status: 503 })
  }
}
