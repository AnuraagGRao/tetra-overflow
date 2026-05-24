import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MainMenuPage from './pages/MainMenuPage'
import AuthPage from './pages/AuthPage'
import CasualGamePage from './pages/CasualGamePage'
import StatsPage from './pages/StatsPage'
import StorePage from './pages/StorePage'
import StoryMapPage from './pages/StoryMapPage'
import StoryLevelPage from './pages/StoryLevelPage'
import MultiplayerPage from './pages/MultiplayerPage'
import ThemePage from './pages/ThemePage'
import ArtworkPage from './pages/ArtworkPage'
import InfoPage from './pages/InfoPage'
import StoryLorePage from './pages/StoryLorePage'
import ZodiacMapPage from './pages/ZodiacMapPage'
import ZodiacLevelPage from './pages/ZodiacLevelPage'
import Season3MapPage from './pages/Season3MapPage'
import Season3LevelPage from './pages/Season3LevelPage'

function NowPlayingToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const [topOffset, setTopOffset] = useState(() => window.innerWidth < 500 ? 82 : 64)

  useEffect(() => {
    const onResize = () => setTopOffset(window.innerWidth < 500 ? 82 : 64)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      const name = e.detail?.name || ''
      if (!name) return
      setToast({ name, id: Date.now() })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setToast(null), 4500)
    }
    window.addEventListener('tetris:nowplaying', handler)
    return () => {
      window.removeEventListener('tetris:nowplaying', handler)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            position: 'fixed', top: topOffset, left: 14, right: 14,
            background: 'rgba(10,10,26,0.52)', backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14,
            padding: '10px 22px', zIndex: 9999, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: '"Courier New", monospace',
            boxShadow: '0 4px 32px rgba(0,0,0,0.28)',
            width: 'fit-content',
            maxWidth: 'min(560px, calc(100vw - 28px))',
          }}
        >
          <span style={{ fontSize: '1.25rem', opacity: 0.85 }}>🎵</span>
          <div>
            <div style={{ fontSize: '0.52rem', letterSpacing: '0.22em', color: 'rgba(200,210,255,0.55)', marginBottom: 3 }}>NOW PLAYING</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(226,232,240,0.88)', letterSpacing: '0.05em', maxWidth: 'min(470px, calc(100vw - 92px))', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.2 }}>
              {toast.name}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a14', color: '#00d4ff', fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.2em' }}>
      LOADING…
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [justCameBack, setJustCameBack] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const onOffline = () => { setOffline(true); setJustCameBack(false) }
    const onOnline  = () => {
      setOffline(false)
      setJustCameBack(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setJustCameBack(false), 3000)
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
    // Set initial state in case the page loaded offline
    if (!navigator.onLine) setOffline(true)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online',  onOnline)
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!offline && !justCameBack) return null
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
      padding: '8px 16px',
      background: offline ? 'rgba(30,10,10,0.94)' : 'rgba(10,28,10,0.94)',
      borderTop: `1px solid ${offline ? '#7f1d1d' : '#14532d'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontFamily: '"Courier New", monospace',
      fontSize: '0.65rem', letterSpacing: '0.14em',
      color: offline ? '#fca5a5' : '#86efac',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'none',
    }}>
      <span>{offline ? '📡' : '✅'}</span>
      <span>
        {offline
          ? 'OFFLINE — game continues; progress saves when you reconnect'
          : 'BACK ONLINE — syncing…'}
      </span>
    </div>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NowPlayingToast />
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/play" element={<CasualGamePage />} />
        <Route path="/story" element={<AuthRoute><StoryMapPage /></AuthRoute>} />
        <Route path="/story/:chapterId/:levelId" element={<AuthRoute><StoryLevelPage /></AuthRoute>} />
        <Route path="/stats" element={<AuthRoute><StatsPage /></AuthRoute>} />
        <Route path="/store" element={<AuthRoute><StorePage /></AuthRoute>} />
        <Route path="/multiplayer" element={<AuthRoute><MultiplayerPage /></AuthRoute>} />
        <Route path="/themes" element={<AuthRoute><ThemePage /></AuthRoute>} />
        <Route path="/lore" element={<AuthRoute><StoryLorePage /></AuthRoute>} />
        <Route path="/zodiac" element={<AuthRoute><ZodiacMapPage /></AuthRoute>} />
        <Route path="/zodiac/:bossId" element={<AuthRoute><ZodiacLevelPage /></AuthRoute>} />
        <Route path="/s3" element={<AuthRoute><Season3MapPage /></AuthRoute>} />
        <Route path="/s3/:epochId/:levelId" element={<AuthRoute><Season3LevelPage /></AuthRoute>} />
        <Route path="/artwork" element={<ArtworkPage />} />
        <Route path="/info" element={<InfoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
