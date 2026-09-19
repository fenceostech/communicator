import { pool } from '@/lib/db'
import { getSessionUser, requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Single shared workspace. Everyone signed in can READ it; only the
// owner/admin can WRITE it. This is what enforces that invited (member)
// users cannot change subaccount fields, checklist marks, statuses,
// progress, config, etc. — all of that persists through this endpoint.
const KEY = 'workspace'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const { rows } = await pool.query('SELECT data, updated_at FROM app_state WHERE key = $1', [KEY])
    if (!rows.length) return Response.json({ data: null })
    return Response.json({ data: rows[0].data, updatedAt: rows[0].updated_at })
  } catch (e) {
    return Response.json({ error: 'state unavailable' }, { status: 503 })
  }
}

export async function PUT(request) {
  const { error } = await requireRole(['admin'])
  if (error) return error // 401/403 for members — backend-enforced, not just UI
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const data = body.data
  if (data == null || typeof data !== 'object') {
    return Response.json({ error: 'data object required' }, { status: 400 })
  }
  const baseUpdatedAt = body.baseUpdatedAt || null
  try {
    // Optimistic concurrency. If the caller based its edit on an older
    // revision than what's stored, reject with the current data so the
    // client can reconcile instead of silently overwriting a newer change.
    if (baseUpdatedAt) {
      const cur = await pool.query('SELECT data, updated_at FROM app_state WHERE key = $1', [KEY])
      if (
        cur.rows.length &&
        new Date(cur.rows[0].updated_at).getTime() !== new Date(baseUpdatedAt).getTime()
      ) {
        return Response.json(
          { conflict: true, data: cur.rows[0].data, updatedAt: cur.rows[0].updated_at },
          { status: 409 }
        )
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO app_state (key, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING updated_at`,
      [KEY, JSON.stringify(data)]
    )
    return Response.json({ ok: true, updatedAt: rows[0].updated_at })
  } catch (e) {
    return Response.json({ error: 'state unavailable' }, { status: 503 })
  }
}

export async function POST(request) {
  return PUT(request)
}
