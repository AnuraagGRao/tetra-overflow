/**
 * Dev Mode - Unlocks all seasons for testing
 * Only enabled on localhost
 */

export const isDevMode = () => {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

// Log dev mode status to console
if (typeof window !== 'undefined' && isDevMode()) {
  console.log('%c🛠️  DEV MODE ENABLED', 'color: #00ff00; font-size: 14px; font-weight: bold;')
  console.log('%cAll seasons unlocked for testing', 'color: #00ff00; font-size: 12px;')
}
