import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getStoryProgress } from '../firebase/db'
import { ZODIAC_BOSSES, OPHIUCHUS, allZodiacBeaten, ophiuchusBeaten, getZodiacPositions } from '../logic/storyData_s2'
import { playTap, playZoomIn, playBack } from '../audio/uiSfx'
import homeIconUrl from '../icons/home-button.png'

// Stars for the background
const STARS = Array.from({ length: 130 }).map((_, i) => ({
  id: i,
  x: (Math.sin(i * 19.87 + 1.3) * 48 + 50),
  y: (Math.cos(i * 14.41 + 2.7) * 48 + 50),
  r: 0.06 + (i % 5) * 0.07,
  o: 0.10 + (i % 7) * 0.08,
  dur: 4 + (i % 8) * 1.1,
  delay: (i % 13) * 0.14,
}))

// Constellation line decorations between adjacent zodiac nodes (cosmetic)
function ConstellationLines({ positions }) {
  // Draw lines between neighboring signs for a star-map feel
  const lines = []
  for (let i = 0; i < positions.length; i++) {
    const next = positions[(i + 1) % positions.length]
    lines.push(
      <line
        key={i}
        x1={positions[i].x} y1={positions[i].y}
        x2={next.x} y2={next.y}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="0.35"
        strokeDasharray="1.4,1.4"
      />
    )
  }
  return <>{lines}</>
}

function BossCard({ boss, completed, onClose, onPlay }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      onClick={e => e.stopPropagation()}
      style={{
        background: '#0d0d1a',
        border: `1px solid ${boss.color}55`,
        boxShadow: `0 0 40px ${boss.color}33, 0 24px 80px rgba(0,0,0,0.6)`,
        borderRadius: 16,
        padding: '1.6rem',
        width: 'min(92vw, 340px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: '"Courier New", monospace',
      }}
    >
      {/* Boss header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          fontSize: '2.8rem',
          lineHeight: 1,
          filter: `drop-shadow(0 0 12px ${boss.color})`,
          flexShrink: 0,
        }}>
          {boss.glyph}
        </div>
        <div>
          <div style={{ fontSize: '0.5rem', color: boss.color, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 3 }}>
            Season 2 · Boss
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff' }}>
            {boss.name}
          </div>
          <div style={{ fontSize: '0.64rem', color: '#666', marginTop: 2 }}>
            {boss.subtitle}
          </div>
        </div>
        {completed && (
          <div style={{ marginLeft: 'auto', fontSize: '1.4rem', filter: `drop-shadow(0 0 8px ${boss.color})` }}>
            ✦
          </div>
        )}
      </div>

      {/* Story intro (first line) */}
      <p style={{ color: '#bbb', fontSize: '0.72rem', lineHeight: 1.65, letterSpacing: '0.03em', margin: 0, fontStyle: 'italic', borderLeft: `2px solid ${boss.color}55`, paddingLeft: 10 }}>
        "{boss.storyBefore.split('.')[0]}."
      </p>

      {/* Boss ability */}
      <div style={{
        background: `${boss.color}0d`,
        border: `1px solid ${boss.color}33`,
        borderRadius: 8,
        padding: '8px 12px',
      }}>
        <div style={{ fontSize: '0.5rem', color: boss.color, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>
          ⚡ {boss.abilityLabel}
        </div>
        <div style={{ fontSize: '0.66rem', color: '#999', lineHeight: 1.5 }}>
          {boss.abilityDesc}
        </div>
      </div>

      {/* Target */}
      <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: '0.14em' }}>
        CLEAR 40 LINES &nbsp;·&nbsp; EASY: 32 LINES
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => { playTap(); onPlay() }}
          style={{
            flex: 1,
            background: boss.color,
            border: 'none',
            color: '#000',
            borderRadius: 8,
            padding: '10px 0',
            fontSize: '0.8rem',
            fontWeight: 900,
            letterSpacing: '0.18em',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textTransform: 'uppercase',
          }}
        >
          {completed ? 'REMATCH' : 'CHALLENGE'}
        </motion.button>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#666',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontFamily: 'inherit',
          }}
        >
          ✕
        </button>
      </div>
    </motion.div>
  )
}

export default function ZodiacMapPage() {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const [progress, setProgress] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)   // boss id string

  useEffect(() => {
    if (!user) return
    getStoryProgress(user.uid).then(p => { setProgress(p); setLoading(false) })
  }, [user])

  const positions   = useMemo(() => getZodiacPositions(50, 50, 34), [])
  const allBeaten   = useMemo(() => allZodiacBeaten(progress), [progress])
  const ophiuchus13 = useMemo(() => ophiuchusBeaten(progress), [progress])

  const selectedBoss = selected
    ? (selected === 'ophiuchus' ? OPHIUCHUS : ZODIAC_BOSSES.find(b => b.id === selected))
    : null

  const defeatedCount = ZODIAC_BOSSES.filter(b => !!progress[`zodiac_${b.id}_completed`]).length

  return (
    <div
      style={{ minHeight: '100dvh', background: '#070710', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace', color: '#fff', overflow: 'hidden' }}
      onClick={() => setSelected(null)}
    >
      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, zIndex: 10, position: 'relative' }}>
        <button
          onClick={e => { e.stopPropagation(); playBack(); navigate('/story') }}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.14em', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <img src={homeIconUrl} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          <span>SEASON 1</span>
        </button>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.22em', background: 'linear-gradient(135deg, #a855f7, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            THE ZODIAC ARC
          </h1>
          <div style={{ fontSize: '0.52rem', color: '#555', letterSpacing: '0.18em', marginTop: 2 }}>
            SEASON 2
          </div>
        </div>

        <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em' }}>
          {defeatedCount}/12
          {ophiuchus13 && <span style={{ color: '#00ff99', marginLeft: 4 }}>+⛎</span>}
        </div>
      </header>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '0.8rem', letterSpacing: '0.2em' }}>
          LOADING…
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* ── SVG star-wheel ── */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          >
            {/* Starfield */}
            {STARS.map(star => (
              <motion.circle
                key={star.id}
                cx={star.x} cy={star.y} r={star.r}
                fill="white"
                animate={{ opacity: [star.o, Math.min(1, star.o + 0.25), star.o] }}
                transition={{ duration: star.dur, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

            {/* Outer ring */}
            <circle
              cx="50" cy="50" r="34"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.4"
              strokeDasharray="2.5,2.5"
            />

            {/* Constellation lines */}
            <ConstellationLines positions={positions} />

            {/* Zodiac nodes */}
            {ZODIAC_BOSSES.map((boss, i) => {
              const p   = positions[i]
              const done = !!progress[`zodiac_${boss.id}_completed`]
              const isSel = selected === boss.id
              return (
                <motion.g
                  key={boss.id}
                  onClick={e => { e.stopPropagation(); playZoomIn(); setSelected(boss.id) }}
                  style={{ cursor: 'pointer' }}
                  animate={{ scale: isSel ? 1.18 : 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                  transformOrigin={`${p.x}px ${p.y}px`}
                >
                  {/* Glow halo */}
                  <motion.circle
                    cx={p.x} cy={p.y} r={done ? 4.8 : 3.8}
                    fill={boss.color}
                    opacity={done ? 0.18 : 0.08}
                    animate={{ r: [done ? 4.8 : 3.8, done ? 6 : 5, done ? 4.8 : 3.8] }}
                    transition={{ duration: 2.4 + (i % 5) * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  {/* Node circle */}
                  <circle
                    cx={p.x} cy={p.y} r="3.2"
                    fill={done ? boss.color : '#0d0d1a'}
                    stroke={boss.color}
                    strokeWidth={isSel ? '0.6' : '0.35'}
                    opacity={isSel ? 1 : 0.85}
                  />
                  {/* Glyph */}
                  <text
                    x={p.x} y={p.y + 0.9}
                    textAnchor="middle"
                    fontSize="3.2"
                    fill={done ? '#000' : boss.color}
                    style={{ pointerEvents: 'none', fontFamily: 'serif' }}
                  >
                    {boss.glyph}
                  </text>
                  {/* Name label */}
                  <text
                    x={p.x}
                    y={p.y + (p.y > 50 ? 7.2 : -4.5)}
                    textAnchor="middle"
                    fontSize="2.1"
                    fill={done ? boss.color : 'rgba(255,255,255,0.5)'}
                    letterSpacing="0.3"
                    style={{ pointerEvents: 'none', fontFamily: '"Courier New", monospace' }}
                  >
                    {boss.name.toUpperCase()}
                  </text>
                </motion.g>
              )
            })}

            {/* ── Center: Ophiuchus ── */}
            <motion.g
              onClick={e => {
                e.stopPropagation()
                if (allBeaten) { playZoomIn(); setSelected('ophiuchus') }
              }}
              style={{ cursor: allBeaten ? 'pointer' : 'not-allowed' }}
            >
              {/* Pulsing ring */}
              <motion.circle
                cx="50" cy="50" r="10"
                fill="none"
                stroke={allBeaten ? '#00ff99' : 'rgba(255,255,255,0.08)'}
                strokeWidth="0.35"
                strokeDasharray="2,2"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: '50px 50px' }}
              />
              {/* Center glow */}
              {allBeaten && (
                <motion.circle
                  cx="50" cy="50" r="7.5"
                  fill="#00ff99"
                  opacity={0.07}
                  animate={{ r: [7.5, 10, 7.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* Center circle */}
              <circle
                cx="50" cy="50" r="6"
                fill={ophiuchus13 ? '#00ff99' : allBeaten ? '#0a1a10' : '#08080f'}
                stroke={allBeaten ? '#00ff99' : 'rgba(255,255,255,0.12)'}
                strokeWidth="0.5"
              />
              {/* Glyph */}
              <text
                x="50" y="51.5"
                textAnchor="middle"
                fontSize="5.5"
                fill={allBeaten ? (ophiuchus13 ? '#000' : '#00ff99') : 'rgba(255,255,255,0.18)'}
                style={{ pointerEvents: 'none', fontFamily: 'serif' }}
              >
                {allBeaten ? '⛎' : '🔒'}
              </text>
              {/* Label */}
              <text
                x="50" y="60"
                textAnchor="middle"
                fontSize="2.2"
                fill={allBeaten ? '#00ff99' : 'rgba(255,255,255,0.2)'}
                letterSpacing="0.3"
                style={{ pointerEvents: 'none', fontFamily: '"Courier New", monospace' }}
              >
                {allBeaten ? 'OPHIUCHUS' : 'DEFEAT ALL 12'}
              </text>
            </motion.g>
          </svg>

          {/* ── Boss card overlay ── */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: selected ? 'auto' : 'none' }}>
            <AnimatePresence>
              {selectedBoss && (
                <BossCard
                  key={selectedBoss.id}
                  boss={selectedBoss}
                  completed={!!progress[`zodiac_${selectedBoss.id}_completed`]}
                  onClose={() => setSelected(null)}
                  onPlay={() => navigate(`/zodiac/${selectedBoss.id}`)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* ── Progress bar ── */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.8rem 1.4rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 5 }}>
            <div style={{ fontSize: '0.55rem', color: '#555', letterSpacing: '0.14em', flexShrink: 0 }}>
              ZODIAC SEALS
            </div>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #a855f7, #00d4ff)' }}
                animate={{ width: `${(defeatedCount / 12) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div style={{ fontSize: '0.6rem', color: '#a855f7', letterSpacing: '0.1em', fontWeight: 700, flexShrink: 0 }}>
              {defeatedCount}/12
            </div>
            {allBeaten && (
              <div style={{ fontSize: '0.55rem', color: '#00ff99', letterSpacing: '0.14em', flexShrink: 0 }}>
                ⛎ {ophiuchus13 ? 'CYCLE BROKEN' : 'UNLOCKED'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
