import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// DELETE /api/team/:id — remove a member (never the last owner).
export async function DELETE(_request, { params }) {
  const { id } = await params
  const memberId = Number(id)
  if (!Number.isInteger(memberId)) {
    return Response.json({ error: 'Invalid member id' }, { status: 400 })
  }

  const { rows } = await pool.query('SELECT role FROM team_members WHERE id = $1', [memberId])
  if (!rows.length) return Response.json({ error: 'Member not found' }, { status: 404 })

  if (rows[0].role === 'Owner') {
    const { rows: counts } = await pool.query(
      "SELECT count(*)::int AS n FROM team_members WHERE role = 'Owner'"
    )
    if (counts[0].n <= 1) {
      return Response.json({ error: 'The last owner cannot be removed' }, { status: 400 })
    }
  }

  await pool.query('DELETE FROM team_members WHERE id = $1', [memberId])
  return Response.json({ ok: true })
}
