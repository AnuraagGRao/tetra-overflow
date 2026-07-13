/**
 * LandscapeRightPanel - Right sidebar with Next Queue, Mode Info, Boss HP
 * 
 * Vertically stacked layout:
 * 1. Boss HP Bar (if story mode)
 * 2. Next Pieces (up to 3)
 * 3. Mode Info / Opponent Info
 * 4. Control buttons (Pause, Settings, Zoom)
 */

import { motion } from 'framer-motion'
import { useTheme } from '../contexts/ThemeContext'
import PieceMini from './TetrominoMini'

// Boss HP Bar component (Story mode only)
function BossHPBar({ bossHpPct, epochColor }) {
  const safeHp = Math.max(0, Math.min(100, bossHpPct))
  const hpColor = safeHp > 60 ? epochColor : safeHp > 30 ? '#f59e0b' : '#ef4444'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 6,
        padding: 8,
        border: `1px solid ${epochColor}22`,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 'clamp(0.5rem, 1vmin, 0.6rem)', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
        Boss HP
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <motion.div
            style={{
              height: '100%',
              background: hpColor,
              boxShadow: `0 0 6px ${hpColor}88`,
            }}
            animate={{ width: `${safeHp}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div style={{ fontSize: 'clamp(0.5rem, 1vmin, 0.65rem)', fontWeight: 700, color: hpColor, minWidth: '28px', textAlign: 'right' }}>
          {Math.round(safeHp)}%
        </div>
      </div>
    </div>
  )
}

export default function LandscapeRightPanel({
  state = {},
  epochColor = '#ff0000',
  currentLevel = null,
  targetLines = 0,
  linesThisLevel = 0,
  bossHpPct = 100,
  gameMode = 'solo',
  opponentName = '',
  opponentLines = 0,
  garbageIncoming = 0,
  onPause = () => {},
  onSettings = () => {},
  onZoom = () => {},
  zoom = 1.0,
}) {
  const { theme } = useTheme()
  const pieceTheme = theme || 'classic'
  const queue = state.queue || []
  const nextPieces = queue.slice(0, 3)

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
      {/* BOSS HP BAR (Story mode only) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {gameMode === 'story' && <BossHPBar bossHpPct={bossHpPct} epochColor={epochColor} levelTitle={currentLevel?.title} />}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* NEXT PIECES QUEUE */}
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
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 'clamp(0.5rem, 1vmin, 0.6rem)', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, textAlign: 'center' }}>
          Next
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
          {nextPieces.map((type, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{
                padding: 4,
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 4,
                border: `1px solid ${epochColor}11`,
              }}
            >
              <PieceMini type={type} pieceTheme={pieceTheme} size={10} />
            </motion.div>
          ))}
          {nextPieces.length < 3 && (
            <>
              {Array.from({ length: 3 - nextPieces.length }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  style={{
                    width: 44,
                    height: 20,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 4,
                    border: '1px dashed rgba(255,255,255,0.08)',
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1, minHeight: 0 }} />

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODE INFO / OPPONENT INFO */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {gameMode === 'versus' ? (
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 6,
            padding: 8,
            border: `1px solid ${epochColor}22`,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 'clamp(0.5rem, 0.9vmin, 0.6rem)', color: '#666', letterSpacing: '0.1em', marginBottom: 4 }}>Opponent</div>
          <div style={{ fontSize: 'clamp(0.65rem, 1.5vmin, 0.85rem)', fontWeight: 700, color: '#80eaff', marginBottom: 4, wordBreak: 'break-word' }}>
            {opponentName || 'CPU'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 'clamp(0.5rem, 0.9vmin, 0.65rem)', color: '#888' }}>
            <div>
              <div style={{ color: '#666', marginBottom: 2 }}>Lines</div>
              <div style={{ color: '#00e5ff', fontWeight: 700 }}>{opponentLines}</div>
            </div>
            <div>
              <div style={{ color: '#666', marginBottom: 2 }}>Garbage</div>
              <div style={{ color: '#f59e0b', fontWeight: 700 }}>{garbageIncoming}</div>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 6,
            padding: 8,
            border: `1px solid ${epochColor}22`,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 'clamp(0.5rem, 0.9vmin, 0.6rem)', color: '#666', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>
            {gameMode === 'story' ? 'Mission Progress' : 'Status'}
          </div>
          {gameMode === 'story' ? (
            <>
              <div style={{ fontSize: 'clamp(0.7rem, 1.8vmin, 0.95rem)', fontWeight: 700, color: epochColor, marginBottom: 4 }}>
                {Math.round(progressPct)}%
              </div>
              <div style={{ fontSize: 'clamp(0.5rem, 0.9vmin, 0.65rem)', color: '#888' }}>
                {Math.min(linesThisLevel, targetLines)}/{targetLines}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 'clamp(0.7rem, 1.6vmin, 0.9rem)', fontWeight: 700, color: '#00d4ff' }}>
              Ready
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* CONTROL BUTTONS */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPause}
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: 'clamp(0.55rem, 1.3vmin, 0.75rem)',
            padding: '6px 8px',
            borderRadius: 4,
            fontFamily: 'inherit',
            fontWeight: 600,
            letterSpacing: '0.08em',
            transition: 'all 0.2s',
          }}
        >
          ⏸ PAUSE
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSettings}
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: 'clamp(0.55rem, 1.3vmin, 0.75rem)',
            padding: '6px 8px',
            borderRadius: 4,
            fontFamily: 'inherit',
            fontWeight: 600,
            letterSpacing: '0.08em',
            transition: 'all 0.2s',
          }}
        >
          ⚙ SETTINGS
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onZoom}
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: 'clamp(0.55rem, 1.3vmin, 0.75rem)',
            padding: '6px 8px',
            borderRadius: 4,
            fontFamily: 'inherit',
            fontWeight: 600,
            letterSpacing: '0.08em',
            transition: 'all 0.2s',
          }}
        >
          🔍 {Math.round(zoom * 100)}%
        </motion.button>
      </div>
    </div>
  )
}
