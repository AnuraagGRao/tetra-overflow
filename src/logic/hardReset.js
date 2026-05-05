export async function hardResetAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }

    try { localStorage.clear() } catch {}
    try { sessionStorage.clear() } catch {}

    if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
      try {
        const dbs = await indexedDB.databases()
        await Promise.all((dbs || []).map((db) => {
          if (!db?.name) return Promise.resolve()
          return new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(db.name)
            req.onsuccess = () => resolve()
            req.onerror = () => resolve()
            req.onblocked = () => resolve()
          })
        }))
      } catch {
        // Some browsers block database enumeration.
      }
    }

    clearAccessibleCookies()
  } catch (e) {
    console.warn('Hard reset failed:', e)
  } finally {
    window.location.reload()
  }
}

function clearAccessibleCookies() {
  const source = document.cookie
  if (!source) return

  const names = source
    .split(';')
    .map((entry) => entry.split('=')[0]?.trim())
    .filter(Boolean)

  if (!names.length) return

  const host = window.location.hostname
  const domains = ['']
  if (host && host.includes('.')) {
    const parts = host.split('.')
    for (let i = 0; i < parts.length - 1; i += 1) {
      domains.push(parts.slice(i).join('.'))
      domains.push(`.${parts.slice(i).join('.')}`)
    }
  }

  const pathParts = window.location.pathname.split('/').filter(Boolean)
  const paths = ['/']
  let running = ''
  for (const part of pathParts) {
    running += `/${part}`
    paths.push(running)
  }

  const expires = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'
  for (const name of names) {
    for (const path of paths) {
      document.cookie = `${name}=; ${expires}; path=${path}`
      for (const domain of domains) {
        if (!domain) continue
        document.cookie = `${name}=; ${expires}; path=${path}; domain=${domain}`
      }
    }
  }
}
