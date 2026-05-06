
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { setDailyFavicon } from './rotateFavicon.js';
import { startVersionWatcher } from './logic/versionCheck.js'


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      .then((reg) => {
        // Listen for SW update messages and send custom event to show SW banner
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event?.data?.type === 'SW_UPDATED') {
            // Only prompt if this isn't the very first install
            if (!hadController) return;
            // Fire a custom event App can listen for
            window.dispatchEvent(new CustomEvent('showSWBanner', { detail: 'showSWBanner' }));
          }
        });
        // Periodically check for updates while the app is open
        setInterval(() => { try { reg.update() } catch {} }, 60_000);
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
  });
}


// Set the favicon based on the current day (icon rotates daily)
setDailyFavicon();

// Kick off a lightweight background version check; mismatches hard reset
startVersionWatcher()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
