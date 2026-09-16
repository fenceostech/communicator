// Reflects the signed-in user in the console rail and adds a log-out control.
// Also tags the <body> with the user's role so admin-only affordances can hide.
(function () {
  async function init() {
    let me
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      me = await res.json()
    } catch {
      return
    }

    document.body.setAttribute('data-role', me.role || 'member')

    const who = document.querySelector('.rail-foot .who')
    if (who) {
      const av = who.querySelector('.av')
      if (av && me.initials) av.textContent = me.initials
      const name = who.querySelector('div > div:first-child')
      const sub = who.querySelector('div > div:last-child')
      if (name && me.name) name.textContent = me.name
      if (sub) sub.textContent = me.role === 'admin' ? 'Admin' : 'Member'
    }

    const foot = document.querySelector('.rail-foot')
    if (foot && !document.getElementById('logoutLink')) {
      const a = document.createElement('a')
      a.id = 'logoutLink'
      a.href = '/api/auth/logout'
      a.textContent = 'Log out'
      a.style.cssText =
        'display:flex;align-items:center;gap:7px;padding:6px;margin-top:6px;font-size:12px;' +
        'color:var(--ink-3,#8aa);text-decoration:none;border-radius:6px'
      a.onmouseover = () => (a.style.color = 'var(--crit,#ff6b6b)')
      a.onmouseout = () => (a.style.color = 'var(--ink-3,#8aa)')
      foot.appendChild(a)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
