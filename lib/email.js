// Minimal transactional email via Resend. If RESEND_API_KEY is not configured,
// returns { sent: false } so callers can fall back to showing the invite link.
const FROM = process.env.INVITE_FROM_EMAIL || 'FenceOS <noreply@fenceos-updates.integratorssolutions.com>'

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

export async function sendInviteEmail({ to, name, acceptUrl, invitedBy }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, reason: 'no_api_key' }

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#101617">
    <h2 style="margin:0 0 12px">You're invited to FenceOS Communicator</h2>
    <p style="margin:0 0 12px">Hi ${esc(name || 'there')},</p>
    <p style="margin:0 0 12px">${esc(invitedBy || 'An owner')} invited you to the FenceOS Communicator console. Click below to set your password and sign in:</p>
    <p style="margin:0 0 20px"><a href="${esc(acceptUrl)}" style="background:#0F6F77;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600">Accept your invite</a></p>
    <p style="margin:0 0 6px;color:#4A5658;font-size:13px">Or paste this link into your browser:</p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all"><a href="${esc(acceptUrl)}">${esc(acceptUrl)}</a></p>
    <p style="color:#78888A;font-size:12px">This invite expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
  </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: 'Your FenceOS Communicator invite',
        html,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { sent: false, reason: 'send_failed', detail }
    }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: 'network_error' }
  }
}
