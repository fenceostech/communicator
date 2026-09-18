import { pool } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const COLS = 'id, account_id, account_name, body, sender_name, sender_type, guest_sid, created_at'

// GET /api/messages — role-scoped so guests can only read their own thread.
//   admin  -> every message (the owner inbox)
//   guest  -> only messages from their own session (by guest_sid)
//   member -> only their own messages (by author_id)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    let rows
    if (user.role === 'admin') {
      ;({ rows } = await pool.query(`SELECT ${COLS} FROM messages ORDER BY created_at ASC, id ASC`))
    } else if (user.guest) {
      ;({ rows } = await pool.query(
        `SELECT ${COLS} FROM messages WHERE guest_sid = $1 ORDER BY created_at ASC, id ASC`,
        [user.sid || '']
      ))
    } else {
      ;({ rows } = await pool.query(
        `SELECT ${COLS} FROM messages WHERE author_id = $1 ORDER BY created_at ASC, id ASC`,
        [Number.isInteger(user.uid) ? user.uid : -1]
      ))
    }
    return Response.json({ messages: rows })
  } catch (e) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}

// POST /api/messages — any signed-in user (including guests) can send.
// Sender identity/type/session are taken from the verified session, so the
// client cannot spoof who sent the message. Content and the subaccount label
// are the only client-provided fields.
export async function POST(request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  let text = String(body.body || '').trim()
  if (!text) return Response.json({ error: 'Message text required' }, { status: 400 })
  if (text.length > 4000) text = text.slice(0, 4000)

  const accountId = body.accountId ? String(body.accountId).slice(0, 64) : null
  const accountName = body.accountName ? String(body.accountName).slice(0, 200) : null
  const senderType = user.role === 'admin' ? 'admin' : user.guest ? 'guest' : 'member'
  const senderName = user.name || user.email || 'Unknown'
  const guestSid = user.guest ? user.sid || null : null
  const authorId = Number.isInteger(user.uid) ? user.uid : null

  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (account_id, account_name, body, sender_name, sender_type, guest_sid, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLS}`,
      [accountId, accountName, text, senderName, senderType, guestSid, authorId]
    )
    if (user.guest && user.sid) {
      try {
        await pool.query('UPDATE guest_sessions SET last_seen_at = now() WHERE sid = $1', [user.sid])
      } catch (e) {}
    }
    return Response.json({ ok: true, message: rows[0] })
  } catch (e) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}
