import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/auth/me — current session user, or 401.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  return Response.json({
    id: user.uid,
    email: user.email,
    role: user.role,
    name: user.name,
    initials: user.initials,
  })
}
