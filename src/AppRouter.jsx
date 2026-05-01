import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
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

export default function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
        <Route path="/artwork" element={<ArtworkPage />} />
        <Route path="/info" element={<InfoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
