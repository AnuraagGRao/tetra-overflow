import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import BackgroundCanvas from '../components/BackgroundCanvas'
import { useAuth } from '../contexts/AuthContext'
import { getLatestUnlockedStorySeason, getStorySeasons } from '../logic/storySeasons'
import { useStoryProgress } from '../hooks/useStoryProgress'

function LoadingState({ label = 'READING THE ARCHIVE' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#05060a', color: '#9ca3af', fontFamily: '"Courier New", monospace', letterSpacing: '0.2em', fontSize: '0.7rem' }}>
      <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.2, repeat: Infinity }}>{label}</motion.span>
    </div>
  )
}

export function StoryEntryRedirect() {
  const { user } = useAuth()
  const { progress, loading } = useStoryProgress(user?.uid)

  if (loading) return <LoadingState label="FINDING YOUR PLACE IN THE STORY" />
  return <Navigate to={getLatestUnlockedStorySeason(progress).route} replace />
}

export default function StorySeasonSelectPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { progress, loading } = useStoryProgress(user?.uid)
  const seasons = useMemo(() => getStorySeasons(progress), [progress])
  const latestSeason = useMemo(() => getLatestUnlockedStorySeason(progress), [progress])

  if (loading) return <LoadingState />

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#05060a', color: '#fff', fontFamily: '"Courier New", monospace' }}>
      <BackgroundCanvas bgType="stellar" />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'linear-gradient(to bottom, black, transparent 86%)' }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, minHeight: 58, padding: 'calc(10px + env(safe-area-inset-top, 0px)) clamp(14px, 4vw, 32px) 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(5,6,10,0.84)', backdropFilter: 'blur(14px)' }}>
        <button onClick={() => navigate('/')} aria-label="Back to main menu" title="Main menu" style={{ justifySelf: 'start', width: 36, height: 36, display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#ddd', cursor: 'pointer', font: 'inherit', fontSize: '1rem' }}>←</button>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ color: '#777', fontSize: '0.5rem', letterSpacing: '0.28em' }}>STORY ARCHIVE</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 'clamp(0.9rem, 3vw, 1.15rem)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>SELECT SEASON</h1>
        </div>
        <button onClick={() => navigate(latestSeason.route)} style={{ justifySelf: 'end', minHeight: 36, border: `1px solid ${latestSeason.color}88`, borderRadius: 6, padding: '0 12px', background: `${latestSeason.color}14`, color: latestSeason.color, cursor: 'pointer', font: 'inherit', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em' }}>
          CONTINUE S{latestSeason.number} →
        </button>
      </header>

      <main style={{ position: 'relative', zIndex: 2, width: 'min(1120px, 100%)', margin: '0 auto', padding: 'clamp(28px, 6vh, 64px) clamp(16px, 4vw, 36px) calc(32px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: latestSeason.color, fontSize: '0.58rem', letterSpacing: '0.24em', marginBottom: 6 }}>CURRENT FRONTIER · SEASON {latestSeason.number}</div>
          <div style={{ fontSize: 'clamp(1.35rem, 5vw, 2.4rem)', fontWeight: 900, letterSpacing: '0.04em' }}>{latestSeason.title}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 205px), 1fr))', gap: 12 }}>
          {seasons.map((season, index) => {
            const selectable = season.unlocked && !season.comingSoon
            const status = season.comingSoon ? 'COMING SOON' : season.complete ? 'COMPLETE' : season.unlocked ? 'UNLOCKED' : 'LOCKED'
            return (
              <motion.button
                key={season.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07, duration: 0.35 }}
                whileHover={selectable ? { y: -3 } : undefined}
                whileTap={selectable ? { scale: 0.985 } : undefined}
                onClick={() => selectable && navigate(season.route)}
                disabled={!selectable}
                style={{ position: 'relative', minHeight: 216, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between', padding: 18, overflow: 'hidden', border: `1px solid ${selectable ? `${season.color}66` : 'rgba(255,255,255,0.09)'}`, borderRadius: 8, background: selectable ? `linear-gradient(155deg, ${season.color}18, rgba(8,9,14,0.92) 48%)` : 'rgba(8,9,14,0.78)', color: selectable ? '#fff' : '#747780', cursor: selectable ? 'pointer' : 'default', textAlign: 'left', font: 'inherit', opacity: season.comingSoon ? 0.82 : season.unlocked ? 1 : 0.58 }}
              >
                <span aria-hidden="true" style={{ position: 'absolute', right: -8, bottom: -32, color: selectable || season.comingSoon ? season.color : '#333640', fontSize: '7rem', lineHeight: 1, opacity: 0.1, pointerEvents: 'none' }}>{season.glyph}</span>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: selectable || season.comingSoon ? season.color : '#555861', fontSize: '1.45rem', lineHeight: 1 }}>{season.glyph}</span>
                    <span style={{ border: `1px solid ${selectable || season.comingSoon ? `${season.color}66` : 'rgba(255,255,255,0.1)'}`, borderRadius: 999, padding: '3px 7px', color: selectable || season.comingSoon ? season.color : '#555861', fontSize: '0.45rem', fontWeight: 700, letterSpacing: '0.12em' }}>{status}</span>
                  </div>
                  <div style={{ marginTop: 30, color: selectable || season.comingSoon ? season.color : '#555861', fontSize: '0.52rem', letterSpacing: '0.22em' }}>SEASON {season.number}</div>
                  <div style={{ marginTop: 6, color: selectable ? '#f6f7fb' : season.comingSoon ? '#d8cba8' : '#777a83', fontSize: '0.94rem', fontWeight: 900, lineHeight: 1.22 }}>{season.title}</div>
                </div>
                <div style={{ position: 'relative', color: selectable ? '#8f949f' : '#5c5f68', fontSize: '0.58rem', lineHeight: 1.5, letterSpacing: '0.05em' }}>{season.subtitle}</div>
              </motion.button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
