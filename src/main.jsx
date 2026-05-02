import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      .then((reg) => {
        // Listen for SW update messages and prompt reload
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event?.data?.type === 'SW_UPDATED') {
            // Only prompt if this isn't the very first install
            if (!hadController) return
            const ok = window.confirm('A new update is available. Reload now?')
            if (ok) window.location.reload()
          }
        })
        // Periodically check for updates while the app is open
        setInterval(() => { try { reg.update() } catch {} }, 60_000)
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error)
      })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
