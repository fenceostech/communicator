import { NextResponse } from 'next/server'
import { verifySession } from './lib/session.js'

const SESSION_COOKIE = 'fenceos_session'

function secret() {
  return process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me'
}

// Gate the console behind a valid session; unauthenticated users go to /login.html.
export async function middleware(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token, secret()) : null
  if (session) return NextResponse.next()

  const url = request.nextUrl.clone()
  const original = request.nextUrl.pathname + request.nextUrl.search
  url.pathname = '/login.html'
  url.search = original && original !== '/' ? `?next=${encodeURIComponent(original)}` : ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/', '/index.html', '/blueprint', '/blueprint.html'],
}
