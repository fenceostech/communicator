import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

const DEFAULT_KEY = 'default'

// GET /api/state?key=default — load the shared workspace state.
export async function GET(request) {
  const key = new URL(request.url).searchParams.get('key') || DEFAULT_KEY
  try {
    const { rows } = await pool.query('SELECT data, updated_at FROM app_state WHERE key = $1', [key])
    if (!rows.length) return Response.json({ data: null })
    return Response.json({ data: rows[0].data, updatedAt: rows[0].updated_at })
  } catch (e) {
    return Response.json({ error: 'state unavailable' }, { status: 503 })
  }
}

// PUT /api/state — upsert the shared workspace state (last write wins).
export async function PUT(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const key = (body.key || DEFAULT_KEY).toString().slice(0, 128)
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
