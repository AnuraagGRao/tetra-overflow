/**
 * LandscapeLeftPanel - Left sidebar with Score, Level, Lines, Hold, Zone Meter
 * 
 * Vertically stacked layout:
 * 1. Score (large, prominent)
 * 2. Level
 * 3. Lines Progress
 * 4. Hold Piece (centered)
 * 5. Zone Meter (vertical bar or ring)
 */

import { motion } from 'framer-motion'
import { PIECES } from '../logic/tetrominoes'
import { PIECE_COLOR_MAPS } from './GameCanvas'
import { useTheme } from '../contexts/ThemeContext'
import { useRef, useEffect } from 'react'

// Mini piece preview component
function PieceMini({ type, pieceTheme, size = 12 }) {
  const canvasRef = useRef(null)
  const color = type ? (PIECE_COLOR_MAPS[pieceTheme]?.[type] ?? PIECES[type]?.color ?? '#888888') : '#333'
  const piece = type ? PIECES[type] : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!piece) return

    const { matrix } = piece
    const filled = matrix.filter(r => r.some(Boolean))
    if (!filled.length) return

    const colMin = Math.min(...filled.map(r => r.findIndex(Boolean)))
    const colMax = Math.max(...filled.map(r => r.length - 1 - [...r].reverse().findIndex(Boolean)))
    const tw = colMax - colMin + 1
    const th = filled.length
    const canvCols = Math.round(canvas.width / size)
    const canvRows = Math.round(canvas.height / size)
    const ox = Math.floor((canvCols - tw) / 2) * size
    const oy = Math.floor((canvRows - th) / 2) * size

    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 5
    filled.forEach((row, ry) => {
      for (let cx = colMin; cx <= colMax; cx++) {
        if (!row[cx]) continue
        ctx.fillRect(ox + (cx - colMin) * size + 1, oy + ry * size + 1, size - 2, size - 2)
      }
    })
  }, [type, color, size, piece])

  return <canvas ref={canvasRef} width={4 * size} height={2 * size} style={{ display: 'block' }} />
}

// Zone meter component (vertical bar with ring effect)
function ZoneMeter({ zoneMeter, zoneActive, zoneTimerMs, onActivate, epochColor }) {
  const meterHeight = 'clamp(60px, 15vh, 100px)'
  const meterFill = Math.max(0, Math.min(1, zoneMeter > 1 ? zoneMeter / 100 : zoneMeter))

  return (
    <motion.button
      whileHover={{ scale: !zoneActive && meterFill >= 1 ? 1.05 : 1 }}
      whileTap={{ scale: !zoneActive && meterFill >= 1 ? 0.95 : 1 }}
      onClick={onActivate}
      disabled={zoneActive || meterFill < 1}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        background: zoneActive ? 'rgba(0,229,255,0.12)' : meterFill >= 1 ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${zoneActive ? '#00e5ff' : meterFill >= 1 ? '#22d3ee' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8,
        padding: 8,
        cursor: zoneActive || meterFill < 1 ? 'default' : 'pointer',
        fontFamily: 'inherit',
        color: zoneActive ? '#00e5ff' : meterFill >= 1 ? '#80eaff' : '#555',
        transition: 'all 0.2s',
        width: '100%',
      }}
      title="Chrono-Stabilizer Zone Meter"
    >
      {/* Label */}
      <div style={{ fontSize: 'clamp(0.5rem, 1.2vmin, 0.65rem)', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
        ⏱ ZONE
      </div>

      {/* Vertical meter bar */}
      <div
        style={{
          width: '100%',
          height: meterHeight,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: zoneActive ? '#00ff88' : '#00e5ff',
            boxShadow: zoneActive ? '0 0 8px #00ff8844' : '0 0 8px #00e5ff88',
          }}
          animate={{ height: `${meterFill * 100}%` }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        />
      </div>

      {/* Timer or ready indicator */}
      {zoneActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            fontSize: 'clamp(0.5rem, 1.2vmin, 0.65rem)',
            letterSpacing: '0.1em',
            fontWeight: 600,
            color: '#00ff88',
          }}
        >
          {Math.ceil(zoneTimerMs / 1000)}s
        </motion.div>
      )}
      {!zoneActive && meterFill >= 1 && (
        <div style={{ fontSize: 'clamp(0.5rem, 1vmin, 0.55rem)', letterSpacing: '0.08em', color: '#80eaff' }}>
          READY
        </div>
      )}
    </motion.button>
  )
}

export default function LandscapeLeftPanel({
  hudSizing = {},
  state = {},
  epochColor = '#ff0000',
  zoneActive = false,
  zoneMeter = 0,
  zoneTimerMs = 0,
  onActivateZone = () => {},
  currentLevel = null,
  targetLines = 0,
  linesThisLevel = 0,
  abilityActive = false,
  abilityLabel = '',
  gameMode = 'solo',
}) {
  const { theme } = useTheme()
  const pieceTheme = theme || 'classic'
  const score = state.score || 0
  const level = state.level || 1
  const lines = state.lines || 0
  const hold = state.hold || null
  const combo = state.combo || 0

  const progressPct = targetLines > 0 ? Math.min(100, (linesThisLevel / targetLines) * 100) : 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(6px, 1.5vh, 12px)',
        padding: 'clamp(8px, 1vh, 12px)',
        background: 'rgba(0,0,0,0.4)',
        borderRadius: 8,
        border: `1px solid ${epochColor}22`,
        minHeight: 0,
        minWidth: 0,
        overflow: 'auto',
      }}
    >
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SCORE — Large, prominent */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: hudSizing.statsLabel || 'clamp(0.5rem, 1.2vmin, 0.7rem)',
            color: '#666',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Score
        </div>
        <motion.div
          key={score}
          initial={{ scale: 0.95, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize: hudSizing.statsValue || 'clamp(1.1rem, 3vmin, 1.6rem)',
            fontWeight: 900,
            color: '#00d4ff',
            letterSpacing: '0.05em',
            fontFamily: '"Courier New", monospace',
          }}
        >
          {score.toLocaleString()}
        </motion.div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* LEVEL & LINES ROW */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {/* Level */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 6,
            padding: 'clamp(4px, 1vh, 8px)',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ fontSize: 'clamp(0.5rem, 0.9vmin, 0.6rem)', color: '#666', letterSpacing: '0.1em', marginBottom: 2 }}>Lv</div>
          <motion.div
            key={level}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            style={{
              fontSize: 'clamp(1rem, 2.2vmin, 1.4rem)',
              fontWeight: 900,
              color: '#f59e0b',
            }}
          >
            {level}
          </motion.div>
        </div>

        {/* Lines (Story mode shows progress, Solo shows total) */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 6,
            padding: 'clamp(4px, 1vh, 8px)',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ fontSize: 'clamp(0.5rem, 0.9vmin, 0.6rem)', color: '#666', letterSpacing: '0.1em', marginBottom: 2 }}>Lines</div>
          <motion.div
            key={`${linesThisLevel}-${lines}`}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            style={{
              fontSize: 'clamp(1rem, 2.2vmin, 1.4rem)',
              fontWeight: 700,
              color: '#00e5ff',
              fontFamily: '"Courier New", monospace',
            }}
          >
            {gameMode === 'story' ? `${Math.min(linesThisLevel, targetLines)}/${targetLines}` : lines}
          </motion.div>
        </div>
      </div>

      {/* Progress bar for Story mode */}
      {gameMode === 'story' && targetLines > 0 && (
        <motion.div
          style={{
            width: '100%',
            height: 4,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <motion.div
            style={{
              height: '100%',
              background: `linear-gradient(90deg, ${epochColor}, ${epochColor}dd)`,
              boxShadow: `0 0 6px ${epochColor}88`,
            }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* COMBO BADGE (if active) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {combo > 1 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          style={{
            background: `${epochColor}22`,
            border: `1px solid ${epochColor}66`,
            borderRadius: 6,
            padding: '4px 8px',
            textAlign: 'center',
            color: epochColor,
            fontSize: 'clamp(0.55rem, 1.5vmin, 0.75rem)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}
        >
          {combo}x COMBO
        </motion.div>
      )}

      {/* Ability active indicator */}
      {abilityActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: `${epochColor}22`,
            border: `1px solid ${epochColor}88`,
            borderRadius: 6,
            padding: '4px 6px',
            textAlign: 'center',
            color: epochColor,
            fontSize: 'clamp(0.5rem, 1.2vmin, 0.65rem)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            flexShrink: 0,
          }}
        >
          ⚡ {abilityLabel}
        </motion.div>
      )}

      {/* Spacer to push zone meter to bottom */}
      <div style={{ flex: 1, minHeight: 0 }} />

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* HOLD PIECE */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 6,
          padding: 'clamp(6px, 1.2vh, 10px)',
          border: `1px solid ${epochColor}22`,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 'clamp(0.5rem, 1vmin, 0.6rem)', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
          Hold
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: '24px', minWidth: '100%' }}>
          <PieceMini type={hold} pieceTheme={pieceTheme} size={11} />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ZONE METER */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <ZoneMeter
        zoneMeter={zoneMeter}
        zoneActive={zoneActive}
        zoneTimerMs={zoneTimerMs}
        onActivate={onActivateZone}
        epochColor={epochColor}
      />
    </div>
  )
}
