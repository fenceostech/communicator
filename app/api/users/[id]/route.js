import { pool } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/users/:id — remove an account (admin only, never the last admin).
export async function DELETE(_request, { params }) {
  const { user, error } = await requireRole(['admin'])
  if (error) return error

  const { id } = await params
  const userId = Number(id)
  if (!Number.isInteger(userId)) {
    return Response.json({ error: 'Invalid user id' }, { status: 400 })
  }

  const { rows } = await pool.query('SELECT role FROM app_users WHERE id = $1', [userId])
  if (!rows.length) return Response.json({ error: 'User not found' }, { status: 404 })

  if (rows[0].role === 'admin') {
    const { rows: counts } = await pool.query(
      "SELECT count(*)::int AS n FROM app_users WHERE role = 'admin'"
    )
    if (counts[0].n <= 1) {
      return Response.json({ error: 'The last admin cannot be removed' }, { status: 400 })
    }
  }

  if (userId === Number(user.uid)) {
    return Response.json({ error: 'You cannot remove your own account' }, { status: 400 })
  }

  await pool.query('DELETE FROM app_users WHERE id = $1', [userId])
  return Response.json({ ok: true })
}
