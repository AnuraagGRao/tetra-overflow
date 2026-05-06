import { hardResetAndReload } from './hardReset'

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

async function fetchRemoteVersion() {
  const url = new URL(import.meta.env.BASE_URL + 'api/version.json', window.location.origin)
  // Cache-bust to bypass SW cached copies and proxies
  url.searchParams.set('t', String(Date.now()))
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Version fetch failed: ${res.status}`)
  const data = await res.json()
  return String(data?.version || '')
}

export function startVersionWatcher({ onMismatch } = {}) {
  let stopped = false
  const current = (typeof __APP_VERSION__ !== 'undefined') ? String(__APP_VERSION__) : 'dev'

  const check = async () => {
    try {
      const remote = await fetchRemoteVersion()
      if (!remote) return
      if (remote !== current) {
        if (typeof onMismatch === 'function') onMismatch({ current, remote })
        await hardResetAndReload()
      }
    } catch (e) {
      // Silently ignore network failures
    }
  }

  // Initial check soon after startup
  setTimeout(() => { if (!stopped) check() }, 3000)
  // Periodic checks thereafter
  const id = setInterval(() => { if (!stopped) check() }, CHECK_INTERVAL_MS)

  return () => { stopped = true; clearInterval(id) }
}
