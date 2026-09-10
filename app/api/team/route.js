import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/team — list members, owners first, then oldest-added.
export async function GET() {
  const { rows } = await pool.query(
    `SELECT id, name, title, email, role, initials, owns
     FROM team_members
     ORDER BY (role = 'Owner') DESC, created_at ASC, id ASC`
  )
  return Response.json(rows)
}

// POST /api/team — add a member.
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  const title = (body.title || '').trim() || 'Communication Specialist'
  const email = (body.email || '').trim()

  if (!name) return Response.json({ error: 'Name is required' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const { rows } = await pool.query(
    `INSERT INTO team_members (name, title, email, role, initials, owns)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, title, email, role, initials, owns`,
    [name, title, email, 'Specialist', initials, 'Subaccount builds']
  )

  return Response.json(rows[0], { status: 201 })
}
