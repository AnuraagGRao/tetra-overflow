import { useEffect } from 'react'

export const SYNESTHESIA_EVENT = {
  MOVE: 'MOVE',
  ROTATE: 'ROTATE',
  SOFT_DROP: 'SOFT_DROP',
  HARD_DROP: 'HARD_DROP',
  LINE_CLEAR: 'LINE_CLEAR',
  T_SPIN: 'T_SPIN',
}

const listeners = new Set()

export function emitSynesthesia(type, payload = {}) {
  const event = {
    type,
    payload,
    at: performance.now(),
  }
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // Keep gameplay safe if a visual listener fails.
    }
  })
}

export function subscribeSynesthesia(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSynesthesiaEvent(handler) {
  useEffect(() => {
    if (typeof handler !== 'function') return undefined
    return subscribeSynesthesia(handler)
  }, [handler])
}
