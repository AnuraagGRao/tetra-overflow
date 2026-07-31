/**
 * Async localStorage wrapper to prevent main thread blocking
 * All operations return Promises that resolve after the next frame
 */

const asyncStorageQueue = []
let processing = false

const processQueue = () => {
  if (processing || asyncStorageQueue.length === 0) return
  processing = true
  
  requestIdleCallback(() => {
    const task = asyncStorageQueue.shift()
    if (task) {
      try {
        const result = task.fn()
        task.resolve(result)
      } catch (error) {
        task.reject(error)
      }
    }
    processing = false
    processQueue()
  }, { timeout: 100 })
}

const enqueue = (fn) => {
  return new Promise((resolve, reject) => {
    asyncStorageQueue.push({ fn, resolve, reject })
    processQueue()
  })
}

export const asyncStorage = {
  getItem: (key) => enqueue(() => localStorage.getItem(key)),
  setItem: (key, value) => enqueue(() => localStorage.setItem(key, value)),
  removeItem: (key) => enqueue(() => localStorage.removeItem(key)),
  clear: () => enqueue(() => localStorage.clear()),
  
  // Synchronous fallbacks for critical reads (use sparingly)
  getItemSync: (key) => localStorage.getItem(key),
  setItemSync: (key, value) => localStorage.setItem(key, value),
}
