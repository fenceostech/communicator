import { pool } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Each signed-in user gets their own workspace row, keyed by their user id.
async function keyFor() {
  const user = await getSessionUser()
  if (!user) return null
  return 'user:' + user.uid
}

// GET /api/state — load the current user's workspace (401 if not signed in).
export async function GET() {
  const key = await keyFor()
  if (!key) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const { rows } = await pool.query('SELECT data, updated_at FROM app_state WHERE key = $1', [key])
    if (!rows.length) return Response.json({ data: null })
    return Response.json({ data: rows[0].data, updatedAt: rows[0].updated_at })
  } catch (e) {
    return Response.json({ error: 'state unavailable' }, { status: 503 })
  }
}

// PUT /api/state — upsert the current user's workspace (401 if not signed in).
export async function PUT(request) {
  const key = await keyFor()
  if (!key) return Response.json({ error: 'Not authenticated' }, { status: 401 })
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
  try {
    await pool.query(
      `INSERT INTO app_state (key, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [key, JSON.stringify(data)]
    )
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: 'state unavailable' }, { status: 503 })
  }
}

export async function POST(request) {
  return PUT(request)
}
