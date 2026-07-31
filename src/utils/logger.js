/**
 * Logger utility for conditional logging
 * Only logs in development mode unless explicitly enabled
 */

const isDev = import.meta.env.DEV

export const logger = {
  /**
   * Log general information (dev only)
   */
  log: (...args) => {
    if (isDev) console.log(...args)
  },

  /**
   * Log warnings (dev only)
   */
  warn: (...args) => {
    if (isDev) console.warn(...args)
  },

  /**
   * Log errors (always logged)
   */
  error: (...args) => {
    console.error(...args)
  },

  /**
   * Debug logging (dev mode or when __sfxDebug flag is set)
   */
  debug: (...args) => {
    if (isDev || (typeof window !== 'undefined' && window.__sfxDebug)) {
      console.log(...args)
    }
  },

  /**
   * Info logging with specific flag check
   */
  info: (flag, ...args) => {
    if (isDev || (typeof window !== 'undefined' && window[flag])) {
      console.log(...args)
    }
  }
}
