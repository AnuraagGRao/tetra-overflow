import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getStoryProgress } from '../firebase/db'
import { STORY_CHAPTERS } from '../logic/storyData'
import { playTap, playZoomIn, playZoomOut, playBack } from '../audio/uiSfx'

// Returns true if a level is unlocked given progress data
function isLevelUnlocked(chIdx, lvIdx, progress) {
  if (chIdx === 0 && lvIdx === 0) return true
  const ch = STORY_CHAPTERS[chIdx]
  const prevLv = lvIdx > 0
    ? ch.levels[lvIdx - 1]
    : STORY_CHAPTERS[chIdx - 1]?.levels.at(-1)
  const prevCh = lvIdx > 0 ? ch : STORY_CHAPTERS[chIdx - 1]
  if (!prevCh || !prevLv) return false
  return !!progress[`${prevCh.id}_${prevLv.id}_completed`]
}

function ChapterPanel({ chapter, chIdx, progress, onSelectLevel }) {
  const levels = chapter.levels
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.94 }}
      onClick={e => e.stopPropagation()}
      style={{ background: '#10101c', border: `1px solid ${chapter.color}66`, boxShadow: `0 24px 80px ${chapter.color}44`, borderRadius: 14, padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 260, maxWidth: 340, width: 'min(92vw, 340px)' }}
    >
      <div>
        <div style={{ fontSize: '0.55rem', color: chapter.color, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 4 }}>Chapter {chIdx + 1}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff' }}>{chapter.title}</div>
        <div style={{ fontSize: '0.68rem', color: '#666', marginTop: 4, lineHeight: 1.4 }}>{chapter.subtitle}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {levels.map((lv, lvIdx) => {
          const unlocked = isLevelUnlocked(chIdx, lvIdx, progress)
          const completed = !!progress[`${chapter.id}_${lv.id}_completed`]
          const bestLines = progress[`${chapter.id}_${lv.id}_lines`] || 0
          return (
            <button
              key={lv.id}
              disabled={!unlocked}
              onClick={() => { if (unlocked) { playTap(); onSelectLevel(chapter.id, lv.id) } }}
              style={{
                background: completed ? `${chapter.color}14` : unlocked ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: `1px solid ${completed ? chapter.color : unlocked ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 8, padding: '10px 12px', color: unlocked ? '#fff' : '#444',
                cursor: unlocked ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                {completed ? '✦' : unlocked ? (lv.isBoss ? '⚡' : '▶') : '🔒'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lv.title}</div>
                <div style={{ fontSize: '0.6rem', color: '#666', marginTop: 2 }}>{lv.subtitle}</div>
                {completed && bestLines > 0 && (
                  <div style={{ fontSize: '0.6rem', color: chapter.color, marginTop: 2 }}>Best: {bestLines} lines</div>
                )}
              </div>
              {lv.isBoss && <span style={{ fontSize: '0.55rem', color: '#f97316', letterSpacing: '0.14em', border: '1px solid #f97316', borderRadius: 3, padding: '1px 5px' }}>BOSS</span>}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

export default function StoryMapPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [progress, setProgress] = useState({})
  const [selected, setSelected] = useState(null) // chIdx
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getStoryProgress(user.uid).then(p => { setProgress(p); setLoading(false) })
  }, [user])

  const handleSelectLevel = (chapterId, levelId) => {
    navigate(`/story/${chapterId}/${levelId}`)
  }

  const mapPoints = useMemo(() => {
    const N = STORY_CHAPTERS.length || 1
    const leftX = 34
    const rightX = 66
    const yTop = 7
    const yBot = 93
    const step = N > 1 ? (yBot - yTop) / (N - 1) : 0
    return STORY_CHAPTERS.map((_, i) => ({
      x: i % 2 === 0 ? leftX : rightX,
      y: yBot - i * step,
    }))
  }, [])

  const stars = useMemo(() => (
    Array.from({ length: 110 }).map((_, i) => {
      const x = (Math.sin(i * 21.73) * 47 + 50)
      const y = (Math.cos(i * 17.29) * 47 + 50)
      const base = 0.6 + (i % 5) * 0.18
      // Slightly different drift per axis for a gentle wander
      const driftX = base * (i % 2 === 0 ? 1 : 0.7)
      const driftY = base * (i % 3 === 0 ? 1.2 : 0.8)
      return {
        id: i,
        x,
        y,
        r: 0.08 + (i % 4) * 0.08,
        o: 0.14 + (i % 6) * 0.09,
        driftX,
        driftY,
        dur: 5 + (i % 7) * 1.35,
        delay: (i % 11) * 0.18,
      }
    })
  ), [])

  const selectedPoint = selected !== null ? mapPoints[selected] : null
  // Slightly zoomed-out default view to reveal more of the map
  const baseScale = 0.92
  const zoomScale = selectedPoint ? baseScale * 1.18 : baseScale
  const zoomX = selectedPoint ? (50 - selectedPoint.x) * 2.1 : 0
  const zoomY = selectedPoint ? (50 - selectedPoint.y) * 2.4 : 0

  // How many chapters unlocked
  const unlockedChapters = STORY_CHAPTERS.filter((_, i) => isLevelUnlocked(i, 0, progress))
  const completedChapters = STORY_CHAPTERS.filter(ch =>
    ch.levels.every(lv => !!progress[`${ch.id}_${lv.id}_completed`])
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a14', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace', color: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button onClick={() => { playBack(); navigate('/') }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.14em', fontFamily: 'inherit', padding: 0 }}>
          ← MENU
        </button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '0.2em', color: '#a855f7' }}>STORY MODE</h1>
        <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em' }}>
          {completedChapters.length}/{STORY_CHAPTERS.length} CHAPTERS
        </div>
      </header>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '0.8rem', letterSpacing: '0.2em' }}>LOADING…</div>
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <motion.div
            animate={{ scale: zoomScale, x: `${zoomX}%`, y: `${zoomY}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            style={{ position: 'absolute', inset: 0, transformOrigin: '50% 50%' }}
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid slice"
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
            >
              {stars.map(star => (
                <motion.circle
                  key={star.id}
                  cx={star.x}
                  cy={star.y}
                  r={star.r}
                  fill="white"
                  animate={{
                    opacity: [star.o, Math.min(1, star.o + 0.3), star.o],
                    cx: [star.x, star.x + star.driftX, star.x],
                    cy: [star.y, star.y - star.driftY, star.y],
                  }}
                  transition={{ duration: star.dur, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}

              <motion.path
                d={mapPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
                fill="none"
                strokeDasharray="2,2"
                animate={{ strokeDashoffset: [0, -12] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
              />

              {STORY_CHAPTERS.map((ch, i) => {
                const unlocked = isLevelUnlocked(i, 0, progress)
                const completed = ch.levels.every(lv => !!progress[`${ch.id}_${lv.id}_completed`])
                const isSelected = selected === i
                const p = mapPoints[i]
                // Place titles above nodes; clamp to a safe top margin to avoid clipping
                const MIN_TOP_Y = 3
                const titleY = Math.max(MIN_TOP_Y, p.y - 6)
                // Keep labels away from screen edges: nudge inward and switch textAnchor per side
                const isLeftSide = p.x < 50
                const titleX = isLeftSide ? p.x + 8 : p.x - 8
                const titleAnchor = isLeftSide ? 'start' : 'end'
                return (
                  <motion.g
                    key={ch.id}
                    onClick={() => { if (unlocked) { playZoomIn(); setSelected(i) } }}
                    style={{ cursor: unlocked ? 'pointer' : 'not-allowed' }}
                    animate={{ y: [0, -0.9, 0, 0.9, 0] }}
                    transition={{ duration: 2.8 + (i % 4) * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {/* Always show a soft halo using chapter color; dimmer when locked */}
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      r={isSelected ? 7.5 : 5.7}
                      fill="none"
                      stroke={ch.color}
                      strokeWidth="0.5"
                      animate={{ opacity: unlocked || completed ? (isSelected ? [0.5, 0.9, 0.5] : [0.2, 0.45, 0.2]) : [0.06, 0.14, 0.06] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    <circle cx={p.x} cy={p.y} r={3.6} fill={unlocked ? (completed ? ch.color : `${ch.color}88`) : '#1a1a2e'} stroke={unlocked ? ch.color : `${ch.color}55`} strokeWidth="0.6" />
                    <text x={p.x} y={p.y + 1.2} textAnchor="middle" fontSize="3" fill={unlocked ? '#fff' : '#444'}>
                      {completed ? '✦' : unlocked ? String(i + 1) : '🔒'}
                    </text>
                    <text x={titleX} y={titleY} textAnchor={titleAnchor} fontSize="2.2" fill={ch.color} opacity={unlocked ? 0.95 : 0.42} letterSpacing="0.3">
                      {ch.title}
                    </text>
                  </motion.g>
                )
              })}
            </svg>
          </motion.div>

          <AnimatePresence>
            {selected !== null && (
              <motion.div
                key="chapter-overlay"
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(3px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                transition={{ duration: 0.24 }}
                onClick={() => { playZoomOut(); setSelected(null) }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(4,6,18,0.46)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.92, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 210, damping: 16 }}
                >
                  <ChapterPanel
                    chapter={STORY_CHAPTERS[selected]}
                    chIdx={selected}
                    progress={progress}
                    onSelectLevel={handleSelectLevel}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selected === null && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.22 }}
                style={{ position: 'absolute', left: '50%', bottom: '1rem', transform: 'translateX(-50%)', fontSize: '0.7rem', color: '#59607d', letterSpacing: '0.12em', textAlign: 'center', margin: 0, padding: '0.5rem 0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}
              >
                TAP AN UNLOCKED CHAPTER
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
