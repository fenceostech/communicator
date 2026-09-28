import { pool } from '@/lib/db'
import { getSessionUser, requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Vercel rejects request bodies over 4.5 MB, so cap the file below that.
const MAX_BYTES = 4 * 1024 * 1024
const KINDS = new Set(['ein', 'logo', 'contract', 'other'])
const ALLOWED = /^(application\/pdf|image\/(png|jpeg|webp|gif|svg\+xml)|text\/(plain|csv)|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel))$/

// GET /api/documents?accountId=… — file list for a subaccount (no contents).
export async function GET(request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  const accountId = new URL(request.url).searchParams.get('accountId') || ''
  if (!accountId) return Response.json({ error: 'accountId required' }, { status: 400 })
  try {
    const { rows } = await pool.query(
      `SELECT id, account_id, kind, name, mime, size, uploaded_by, created_at
       FROM documents WHERE account_id = $1 ORDER BY created_at DESC, id DESC`,
      [accountId]
    )
    return Response.json({ documents: rows })
  } catch (e) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}

// POST /api/documents — multipart upload (fields: accountId, kind, file). Owner/admin only.
export async function POST(request) {
  const { user, error } = await requireRole(['admin'])
  if (error) return error
  let form
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'File too large or invalid upload (max 4 MB)' }, { status: 400 })
  }
  const accountId = String(form.get('accountId') || '').trim()
  const kind = KINDS.has(String(form.get('kind'))) ? String(form.get('kind')) : 'other'
  const file = form.get('file')
  if (!accountId) return Response.json({ error: 'accountId required' }, { status: 400 })
  if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'file required' }, { status: 400 })
  if (!file.size) return Response.json({ error: 'The file is empty' }, { status: 400 })
  if (file.size > MAX_BYTES) return Response.json({ error: 'File is over 4 MB' }, { status: 413 })
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED.test(mime)) {
    return Response.json({ error: 'Use a PDF, image, Word, Excel, CSV or text file' }, { status: 415 })
  }
  const name = String(file.name || 'document').replace(/[\\/\r\n"]/g, '_').slice(0, 200)
  const data = Buffer.from(await file.arrayBuffer())
  try {
    const { rows } = await pool.query(
      `INSERT INTO documents (account_id, kind, name, mime, size, data, uploaded_by, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, account_id, kind, name, mime, size, uploaded_by, created_at`,
      [accountId, kind, name, mime, data.length, data, user.name || user.email || '', Number.isInteger(user.uid) ? user.uid : null]
    )
    return Response.json({ ok: true, document: rows[0] })
  } catch (e) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}
