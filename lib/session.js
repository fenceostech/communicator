// Edge- and Node-compatible signed session tokens (HMAC-SHA256 over Web Crypto).
// Used by both the Next.js middleware (Edge) and route handlers (Node).

const encoder = new TextEncoder()

function b64urlFromBytes(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function bytesFromB64url(str) {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : ''
  const bin = atob(norm + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

export async function signSession(payload, secret) {
  const body = b64urlFromBytes(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  return `${body}.${b64urlFromBytes(sig)}`
}

export async function verifySession(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const key = await hmacKey(secret)
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  let got
  try {
    got = bytesFromB64url(sig)
  } catch {
    return null
  }
  if (expected.length !== got.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ got[i]
  if (diff !== 0) return null
  let payload
  try {
    payload = JSON.parse(new TextDecoder().decode(bytesFromB64url(body)))
  } catch {
    return null
  }
  if (payload.exp && Date.now() > payload.exp) return null
  return payload
}
