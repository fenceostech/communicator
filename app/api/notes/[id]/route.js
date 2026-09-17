import { pool } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Editing/deleting notes is an owner/admin action.
export async function PATCH(request, { params }) {
  const { error } = await requireRole(['admin'])
  if (error) return error
  const { id } = await params
  const noteId = Number(id)
  if (!Number.isInteger(noteId)) return Response.json({ error: 'Invalid id' }, { status: 400 })
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  let text = String(body.text || '').trim()
  if (!text) return Response.json({ error: 'Note text required' }, { status: 400 })
  if (text.length > 2000) text = text.slice(0, 2000)
  const { rowCount } = await pool.query('UPDATE notes SET text = $2 WHERE id = $1', [noteId, text])
  if (!rowCount) return Response.json({ error: 'Note not found' }, { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(_request, { params }) {
  const { error } = await requireRole(['admin'])
  if (error) return error
  const { id } = await params
  const noteId = Number(id)
  if (!Number.isInteger(noteId)) return Response.json({ error: 'Invalid id' }, { status: 400 })
  await pool.query('DELETE FROM notes WHERE id = $1', [noteId])
  return Response.json({ ok: true })
}
