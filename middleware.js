import { NextResponse } from 'next/server'

// Self-contained session check (no imports beyond next/server) so the Edge
// middleware bundle can't fail on a transitive/relative import. Verifies the
// HMAC-signed cookie with Web Crypto and fails closed (redirect to login).
const SESSION_COOKIE = 'fenceos_session'

function bytesFromB64url(str) {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : ''
  const bin = atob(norm + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function isValidSession(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false
  const [body, sig] = token.split('.')
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  let got
  try {
    got = bytesFromB64url(sig)
  } catch {
    return false
  }
  if (expected.length !== got.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ got[i]
  if (diff !== 0) return false
  let payload
  try {
    payload = JSON.parse(new TextDecoder().decode(bytesFromB64url(body)))
  } catch {
    return false
  }
  if (payload.exp && Date.now() > payload.exp) return false
  return true
}

export async function middleware(request) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    const secret = process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me'
    if (token && (await isValidSession(token, secret))) return NextResponse.next()
  } catch {
    // fall through to login redirect (fail closed)
  }

  const url = request.nextUrl.clone()
  const original = request.nextUrl.pathname + request.nextUrl.search
  url.pathname = '/login.html'
  url.search = original && original !== '/' ? `?next=${encodeURIComponent(original)}` : ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/', '/index.html', '/blueprint', '/blueprint.html'],
}
