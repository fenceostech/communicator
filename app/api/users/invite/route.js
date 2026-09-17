import { randomBytes, createHash } from 'node:crypto'
import { pool } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { sendInviteEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST /api/users/invite — owner invites a teammate by email (admin only).
export async function POST(request) {
  const { user, error } = await requireRole(['admin'])
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const name = (body.name || '').trim()
  const role = body.role === 'admin' ? 'admin' : 'member'
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  const existing = await pool.query('SELECT 1 FROM app_users WHERE lower(email) = $1', [email])
  if (existing.rowCount) {
    return Response.json({ error: 'That email already has an account' }, { status: 409 })
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const invitedBy = user.name || user.email || 'An owner'

  // Replace any prior unaccepted invite for this email.
  await pool.query('DELETE FROM app_invites WHERE lower(email) = $1 AND accepted_at IS NULL', [email])
  await pool.query(
    `INSERT INTO app_invites (email, name, role, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [email, name, role, tokenHash, invitedBy, expiresAt]
  )

  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '')
  const acceptUrl = `${base}/accept-invite?token=${token}`
  const emailResult = await sendInviteEmail({ to: email, name, acceptUrl, invitedBy })

  // If email isn't configured/verified yet, return the link so the owner can share it.
  return Response.json({ ok: true, email, emailed: emailResult.sent, acceptUrl: emailResult.sent ? undefined : acceptUrl })
}
