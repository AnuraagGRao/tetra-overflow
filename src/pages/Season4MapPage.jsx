import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getStoryProgress } from '../firebase/db'
import { SEASON4_SECTORS, isSectorUnlocked, isS4LevelUnlocked, isS4Complete, isS4Unlocked } from '../logic/storyData_s4'
import { playTap, playBack } from '../audio/uiSfx'
import StoryMapHUD from '../components/StoryMapHUD'
import homeIconUrl from '../icons/home-button.png'

// ── Pseudo-random helpers ────────────────────────────────────────────────────
const pseudo = (n) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return v - Math.floor(v)
}

// Genesis code particles — flowing upward in the matrix
const CODE_PARTICLES = Array.from({ length: 60 }).map((_, i) => ({
  id: i,
  x: pseudo(i * 2) * 100,
  y: pseudo(i * 2 + 1) * 100,
  w: 0.3 + pseudo(i * 3) * 0.8,
  h: 1.2 + pseudo(i * 4) * 2.5,
  color: ['#ffffff', '#e0e7ff', '#c4d5ff', '#a8c8ff'][i % 4],
  o: 0.03 + pseudo(i * 5) * 0.12,
  dur: 2 + pseudo(i * 6) * 3,
  delay: pseudo(i * 8) * 4,
}))

// Animated sector connector with flow effect
function GenesisLines({ sectors }) {
  return (
    <>
      {sectors.slice(0, -1).map((sec, i) => {
        const next = sectors[i + 1]
        const midX = (sec.mapX + next.mapX) / 2 + (pseudo(i * 7) - 0.5) * 6
        const midY = (sec.mapY + next.mapY) / 2 + (pseudo(i * 7 + 1) - 0.5) * 6
        return (
          <g key={sec.id}>
            {/* Creation flow path */}
            <motion.polyline
              points={`${sec.mapX},${sec.mapY} ${midX},${midY} ${next.mapX},${next.mapY}`}
              fill="none"
              stroke={`${sec.color}44`}
              strokeWidth="0.5"
              strokeDasharray="2,1.5"
              animate={{ strokeDashoffset: [0, -8] }}
              transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, ease: 'linear' }}
            />
            {/* Energy flow dot */}
            <motion.g
              animate={{
                opacity: [0.3, 0.8, 0.3],
                x: [0, midX - sec.mapX, next.mapX - sec.mapX],
                y: [0, midY - sec.mapY, next.mapY - sec.mapY],
              }}
              transition={{ duration: 2.3 + i * 0.3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
            >
              <circle cx={sec.mapX} cy={sec.mapY} r="0.6" fill={sec.color} />
            </motion.g>
          </g>
        )
      })}
    </>
  )
}

function LevelItem({ sector, level, levelIdx, progress, sectorUnlocked, onPlay }) {
  const key = `s4_${sector.id}_${level.id}`
  const completed = !!progress[`${key}_completed`]
  const bestLines = progress[`${key}_lines`] || 0
  const unlocked = sectorUnlocked && isS4LevelUnlocked(sector.id, level.id, progress)

  return (
    <button
      disabled={!unlocked}
      onClick={() => { if (unlocked) { playTap(); onPlay(sector.id, level.id) } }}
      style={{
        background: completed ? `${sector.color}14` : unlocked ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${completed ? sector.color : unlocked ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        color: unlocked ? '#fff' : '#444',
        cursor: unlocked ? 'pointer' : 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'inherit',
        textAlign: 'left',
        transition: 'all 0.15s',
        width: '100%',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>
        {completed ? '✦' : unlocked ? (level.isBoss ? '⚡' : '▶') : '🔒'}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {level.title}
        </div>
        <div style={{ fontSize: '0.6rem', color: '#666', marginTop: 2 }}>{level.subtitle}</div>
        {completed && bestLines > 0 && (
          <div style={{ fontSize: '0.6rem', color: sector.color, marginTop: 2 }}>Best: {bestLines} lines</div>
        )}
      </div>
      {level.isBoss && (
        <span
          style={{
            fontSize: '0.52rem',
            color: '#f97316',
            letterSpacing: '0.14em',
            border: '1px solid #f97316',
            borderRadius: 3,
            padding: '1px 5px',
            flexShrink: 0,
          }}
        >
          BOSS
        </span>
      )}
    </button>
  )
}

function SectorPanel({ sector, secIdx, progress, onSelectLevel, onClose }) {
  const sectorUnlocked = isSectorUnlocked(sector.id, progress)
  const sectorScore = Number(progress?.[`s4_${sector.id}_sector_score`] || 0)
  const sectorLines = Number(progress?.[`s4_${sector.id}_sector_lines`] || 0)
  const levelsDone = sector.levels.filter(l => !!progress[`s4_${sector.id}_${l.id}_completed`]).length

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      onClick={e => e.stopPropagation()}
      style={{
        background: 'linear-gradient(160deg, #0a0a12 0%, #050508 100%)',
        border: `1px solid ${sector.color}66`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.8), 0 0 40px ${sector.color}44, inset 0 0 60px rgba(0,0,0,0.5)`,
        borderRadius: 12,
        padding: '1.6rem',
        width: 'min(92vw, 360px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: '"Courier New", monospace',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Sector header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: '0.5rem',
              color: sector.color,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            Season 4 · Sector {secIdx + 1}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.1em', color: sector.color }}>
            {sector.title}
          </div>
          <div style={{ fontSize: '0.64rem', color: '#666', marginTop: 3 }}>{sector.subtitle}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#555',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {!sectorUnlocked && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: '0.66rem',
            color: '#555',
            letterSpacing: '0.1em',
          }}
        >
          🔒 Complete the previous Sector to unlock
        </div>
      )}

      {/* Stats */}
      {(sectorScore > 0 || sectorLines > 0) && (
        <div style={{ display: 'flex', gap: 14, fontSize: '0.6rem', color: '#888', letterSpacing: '0.08em' }}>
          <span>
            Score <strong style={{ color: sector.color }}>{sectorScore.toLocaleString()}</strong>
          </span>
          <span>
            Lines <strong style={{ color: '#ccc' }}>{sectorLines.toLocaleString()}</strong>
          </span>
          <span>
            Progress <strong style={{ color: '#ccc' }}>{levelsDone}/{sector.levels.length}</strong>
          </span>
        </div>
      )}

      {/* Level list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sector.levels.map((lv, lvIdx) => (
          <LevelItem
            key={lv.id}
            sector={sector}
            level={lv}
            levelIdx={lvIdx}
            progress={progress}
            sectorUnlocked={sectorUnlocked}
            onPlay={onSelectLevel}
          />
        ))}
      </div>
    </motion.div>
  )
}

export default function Season4MapPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const mapViewportRef = useRef(null)
  const gestureRef = useRef({ mode: 'none', lastX: 0, lastY: 0, startDist: 0, startZoom: 1 })
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [mapZoom, setMapZoom] = useState(1.0)
  const [userPan, setUserPan] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (!user) return
    getStoryProgress(user.uid).then(p => {
      setProgress(p || {})
      setLoading(false)
    })
  }, [user])

  const s4Unlocked = useMemo(() => isS4Unlocked(progress), [progress])
  const s4Complete = useMemo(() => isS4Complete(progress), [progress])

  const completedLevelCount = useMemo(() => {
    return SEASON4_SECTORS.reduce((sum, sector) => {
      return sum + sector.levels.filter(l => !!progress[`s4_${sector.id}_${l.id}_completed`]).length
    }, 0)
  }, [progress])
  const totalLevelCount = SEASON4_SECTORS.reduce((sum, sec) => sum + sec.levels.length, 0)

  const handleSelectLevel = (sectorId, levelId) => {
    navigate(`/s4/${sectorId}/${levelId}`)
  }

  // ── Zoom/pan helpers ─────────────────────────────────────────────────────
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
  const clampZoom = (z) => Math.max(0.8, Math.min(2.2, z))
  const clampPanByZoom = (pan, zoom) => {
    const maxX = Math.max(0, (zoom - 1) * 50)
    const maxY = Math.max(0, (zoom - 1) * 60)
    return { x: clamp(pan.x, -maxX, maxX), y: clamp(pan.y, -maxY, maxY) }
  }
  const zoomIn = () => setMapZoom(z => clampZoom(z + 0.1))
  const zoomOut = () => setMapZoom(z => clampZoom(z - 0.1))
  const resetZoom = () => {
    setSelected(null)
    setMapZoom(1.0)
    setUserPan({ x: 0, y: 0 })
  }

  useEffect(() => {
    setUserPan(p => clampPanByZoom(p, mapZoom))
  }, [mapZoom])

  // ── Gesture handlers ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = mapViewportRef.current
    if (!el) return

    const onPointerDown = (e) => {
      const touches = (e.currentTarget._activePointers = e.currentTarget._activePointers || new Map())
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 1) {
        gestureRef.current = { mode: 'pan', lastX: e.clientX, lastY: e.clientY, startDist: 0, startZoom: mapZoom }
      } else if (touches.size === 2) {
        const pts = [...touches.values()]
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        gestureRef.current = { mode: 'pinch', lastX: 0, lastY: 0, startDist: dist, startZoom: mapZoom }
      }
      el.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e) => {
      const touches = e.currentTarget._activePointers
      if (!touches) return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const g = gestureRef.current
      if (g.mode === 'pan' && touches.size === 1) {
        const dx = e.clientX - g.lastX
        const dy = e.clientY - g.lastY
        g.lastX = e.clientX
        g.lastY = e.clientY
        const rect = el.getBoundingClientRect()
        const panDx = (dx / Math.max(1, rect.width)) * 100
        const panDy = (dy / Math.max(1, rect.height)) * 100
        setUserPan(p => clampPanByZoom({ x: p.x + panDx, y: p.y + panDy }, mapZoom))
      } else if (g.mode === 'pinch' && touches.size === 2) {
        const pts = [...touches.values()]
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        const newZoom = clampZoom(g.startZoom * (dist / Math.max(1, g.startDist)))
        setMapZoom(newZoom)
      }
    }

    const onPointerUp = (e) => {
      const touches = e.currentTarget._activePointers
      if (touches) touches.delete(e.pointerId)
      gestureRef.current.mode = 'none'
      el.releasePointerCapture(e.pointerId)
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [mapZoom])

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.06 : 0.06
    setMapZoom(z => clampZoom(z + delta))
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: '#000000',
          color: '#00ff00',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          letterSpacing: '0.18em',
        }}
      >
        INITIALIZING GENESIS…
      </div>
    )
  }

  if (!s4Unlocked) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: '#000000',
          color: '#888',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          letterSpacing: '0.2em',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '1.4rem', marginBottom: '1rem', color: '#666' }}>⚠️ SEASON 4 LOCKED</div>
        <div>Beat Season 3: Absolute Overflow to unlock</div>
        <button
          onClick={() => { playBack(); navigate('/s3') }}
          style={{
            marginTop: '2rem',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#aaa',
            padding: '0.8rem 1.6rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            letterSpacing: '0.1em',
          }}
        >
          ← BACK TO S3
        </button>
      </div>
    )
  }

  return (
    <StoryMapHUD
      // Navigation
      onHome={() => { playBack(); navigate('/s1') }}
      onPreviousSeason={() => { playBack(); navigate('/s3') }}
      onNextSeason={null}
      previousSeasonName="S3"
      nextSeasonName=""
      
      // Header content
      seasonTitle="THE GENESIS PROTOCOL"
      seasonSubtitle="Season 4"
      seasonColor="#a78bfa"
      currentProgress={completedLevelCount}
      totalProgress={totalLevelCount}
      
      // Map controls
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onResetView={resetZoom}
      currentZoom={mapZoom}
    >
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000000',
        overflow: 'hidden',
        position: 'relative',
        color: '#fff',
        fontFamily: 'inherit',
      }}
    >
      {/* Map viewport */}
      <div
        ref={mapViewportRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000000',
          overflow: 'hidden',
          touchAction: 'none',
        }}
        onWheel={handleWheel}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: `translate(${userPan.x}px, ${userPan.y}px) scale(${mapZoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.08s ease-out',
          }}
        >
          {/* Background stars */}
          {Array.from({ length: 40 }).map((_, i) => (
            <circle
              key={`star-${i}`}
              cx={pseudo(i * 5) * 100}
              cy={pseudo(i * 5 + 1) * 100}
              r={0.15 + pseudo(i * 5 + 2) * 0.25}
              fill="#fff"
              opacity={0.1 + pseudo(i * 5 + 3) * 0.2}
            />
          ))}

          {/* Code particles */}
          {CODE_PARTICLES.map(dot => (
            <motion.rect
              key={`code-${dot.id}`}
              x={dot.x}
              y={dot.y}
              width={dot.w}
              height={dot.h}
              fill={dot.color}
              opacity={dot.o}
              animate={{ y: [dot.y, dot.y - 40] }}
              transition={{ duration: dot.dur, delay: dot.delay, repeat: Infinity, ease: 'linear' }}
            />
          ))}

          {/* Sector connector lines */}
          <GenesisLines sectors={SEASON4_SECTORS} />

          {/* Sector nodes */}
          {SEASON4_SECTORS.map((sector, i) => {
            const isUnlocked = isSectorUnlocked(sector.id, progress)
            const isDone = sector.levels.every(l => !!progress[`s4_${sector.id}_${l.id}_completed`])
            const isSelected = selected === sector.id

            return (
              <g key={sector.id}>
                {/* Glow ring */}
                <motion.g
                  animate={{
                    opacity: [isSelected ? 0.8 : 0.3, isSelected ? 1.0 : 0.5, isSelected ? 0.8 : 0.3],
                    scale: [1, 1.13, 1],
                  }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
                  style={{ transformOrigin: `${sector.mapX}px ${sector.mapY}px` }}
                >
                  <circle cx={sector.mapX} cy={sector.mapY} r={3.2} fill="none" stroke={sector.glowColor} strokeWidth="0.08" />
                </motion.g>

                {/* Sector node */}
                <motion.g
                  onClick={() => {
                    if (isUnlocked) {
                      setSelected(selected === sector.id ? null : sector.id)
                      playTap()
                    }
                  }}
                  whileHover={isUnlocked ? { scale: 1.125 } : {}}
                  whileTap={isUnlocked ? { scale: 0.875 } : {}}
                  animate={{
                    scale: isSelected ? 1.25 : isDone ? 1.06 : isUnlocked ? 1 : 0.875,
                  }}
                  style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed', transformOrigin: `${sector.mapX}px ${sector.mapY}px` }}
                >
                  <circle cx={sector.mapX} cy={sector.mapY} r="1.6" fill={sector.color} opacity={isDone ? 0.9 : isUnlocked ? 0.7 : 0.4} />
                </motion.g>

                {/* Completion indicator */}
                {isDone && (
                  <motion.g
                    animate={{ scale: [1, 1.33], opacity: [1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ transformOrigin: `${sector.mapX}px ${sector.mapY}px` }}
                  >
                    <circle cx={sector.mapX} cy={sector.mapY} r="1.8" fill="none" stroke={sector.color} strokeWidth="0.12" />
                  </motion.g>
                )}

                {/* Lock indicator */}
                {!isUnlocked && (
                  <text
                    x={sector.mapX}
                    y={sector.mapY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="1.2"
                    fill={sector.color}
                    opacity="0.6"
                  >
                    🔒
                  </text>
                )}

                {/* Sector label */}
                <text
                  x={sector.mapX}
                  y={sector.mapY + 5}
                  textAnchor="middle"
                  fontSize="0.5"
                  fill={sector.color}
                  opacity={isSelected ? 1 : 0.7}
                  fontWeight="bold"
                  letterSpacing="0.1"
                >
                  SEC {i + 1}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Sector panel modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              backdropFilter: 'blur(4px)',
            }}
          >
            {SEASON4_SECTORS.map((sector, idx) =>
              sector.id === selected ? (
                <SectorPanel
                  key={sector.id}
                  sector={sector}
                  secIdx={idx}
                  progress={progress}
                  onSelectLevel={handleSelectLevel}
                  onClose={() => setSelected(null)}
                />
              ) : null
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </StoryMapHUD>
  )
}
