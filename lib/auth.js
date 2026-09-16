import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { signSession, verifySession } from '@/lib/session'

export const SESSION_COOKIE = 'fenceos_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

function secret() {
  return process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me'
}

export function hashPassword(password) {
  const salt = randomBytes(16)
  const dk = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const dk = scryptSync(password, salt, expected.length)
    return expected.length === dk.length && timingSafeEqual(expected, dk)
  } catch {
    return false
  }
}

export function cookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  }
}

export async function createSessionToken(user) {
  return signSession(
    {
      uid: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      initials: user.initials,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    },
    secret()
  )
}

export async function setSessionCookie(token) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, cookieOptions())
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', cookieOptions(0))
}

export async function getSessionUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySession(token, secret())
}

// Returns { user } when authorized, or { error: Response } to return directly.
export async function requireRole(roles) {
  const user = await getSessionUser()
  if (!user) return { error: Response.json({ error: 'Not authenticated' }, { status: 401 }) }
  if (roles && !roles.includes(user.role)) {
    return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export function initialsFor(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
