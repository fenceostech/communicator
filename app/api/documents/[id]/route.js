import { pool } from '@/lib/db'
import { getSessionUser, requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/documents/:id — download. Any signed-in user can read.
// Always served as an attachment so an uploaded SVG/HTML can't run on this origin.
export async function GET(_request, { params }) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  const docId = Number(id)
  if (!Number.isInteger(docId)) return Response.json({ error: 'Invalid id' }, { status: 400 })
  try {
    const { rows } = await pool.query('SELECT name, mime, data FROM documents WHERE id = $1', [docId])
    if (!rows.length) return Response.json({ error: 'Document not found' }, { status: 404 })
    const { name, mime, data } = rows[0]
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
    return new Response(data, {
      headers: {
        'Content-Type': mime || 'application/octet-stream',
        'Content-Length': String(data.length),
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}

// DELETE /api/documents/:id — owner/admin only.
export async function DELETE(_request, { params }) {
  const { error } = await requireRole(['admin'])
  if (error) return error
  const { id } = await params
  const docId = Number(id)
  if (!Number.isInteger(docId)) return Response.json({ error: 'Invalid id' }, { status: 400 })
  try {
    const { rowCount } = await pool.query('DELETE FROM documents WHERE id = $1', [docId])
    if (!rowCount) return Response.json({ error: 'Document not found' }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}
