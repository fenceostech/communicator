import { clearSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  await clearSessionCookie()
  return Response.json({ ok: true })
}

// GET allows a plain link to log out and land back on the login page.
export async function GET(request) {
  await clearSessionCookie()
  return Response.redirect(new URL('/login.html', request.url), 303)
}
