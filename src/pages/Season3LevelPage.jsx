import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress, saveGameResult, markEasyModePlayed, setActiveBadge, getStoryProgress } from '../firebase/db'
import SettingsPage from '../components/SettingsPage'
import { findS3Level, getNextS3Level, isS3LevelUnlocked, isS3Unlocked, SEASON3_EPOCHS } from '../logic/storyData_s3'
import { PIECES, BOARD_WIDTH, BOARD_HEIGHT } from '../logic/tetrominoes'
import { TetrisEngine, GAME_MODE, ZONE_MIN_METER, ZONE_DURATION_MS } from '../logic/gameEngine'
import { setSfxVolume, setSfxDuck, playMoveSFX, playRotateSFX, playHoldSFX, playSoftDropSFX, playHardDropSFX, playLockSFX, playLineClearSFX, playTetrisSFX, playZoneActivateSFX } from '../audio/gameSfx'
import GameCanvas, { PIECE_COLOR_MAPS } from '../components/GameCanvas'
import TouchControls from '../components/TouchControls'
import BackgroundCanvas from '../components/BackgroundCanvas'
import SynesthesiaMotionLayer from '../components/SynesthesiaMotionLayer'
import { Season3MusicManager } from '../audio/season3MusicManager'
import { emitSynesthesia, SYNESTHESIA_EVENT } from '../logic/synesthesiaBus'
import { hardResetAndReload } from '../logic/hardReset'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import { useResponsiveHUD } from '../hooks/useResponsiveHUD'
import LandscapeGameLayout from '../components/LandscapeGameLayout'
import ZoomControl from '../components/ZoomControl'

const MAX_FRAME_MS = 34
const VISIBLE_ROWS = BOARD_HEIGHT - 2   // rows 2-21 visible (rows 0-1 are spawn buffer)

// bgType fallback mapping for themes that don't exist in BG_TYPE_TO_PIECE_THEME
const S3_BG_FALLBACKS = {
  glitch_light: 'geometry',
  glitch_med: 'geometry',
  matrix_distorted: 'geometry',
  error_cyan: 'stellar',
  crt_scanline: 'geometry',
  retro_grid: 'geometry',
  vhs_tracking: 'geometry',
  '8bit_dungeon': 'geometry',
  neon_wireframe: 'stellar',
  synthwave_city: 'stellar',
  ai_eye: 'warp',
  lightspeed_tunnel: 'warp',
  red_hex: 'inferno',
  corrupted_code: 'inferno',
  shattered_glass: 'inferno',
}

const KEY_BINDINGS = {
  ArrowLeft:  { held: 'left' },
  ArrowRight: { held: 'right' },
  ArrowDown:  { held: 'softDrop' },
  ArrowUp:    { action: 'rotateCW' },
  KeyZ:       { action: 'rotateCCW' },
  Space:      { action: 'hardDrop' },
  KeyX:       { action: 'rotate180' },
  KeyC:       { action: 'hold' },
  Escape:     { action: 'pause' },
  KeyP:       { action: 'pause' },
  KeyR:       { action: 'rewind' },    // keyboard shortcut for Rewind
}

const PHASE = { STORY: 'story', LOADING: 'loading', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }

// ─── Mini piece preview ────────────────────────────────────────────────────────
function getPieceColor(type, theme) {
  return (PIECE_COLOR_MAPS[theme]?.[type]) ?? PIECES[type]?.color ?? '#888888'
}

function PieceMini({ type, pieceTheme, size = 11 }) {
  const canvasRef = useRef(null)
  const color     = type ? getPieceColor(type, pieceTheme) : '#333'
  const piece     = type ? PIECES[type] : null
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx    = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!piece) return
    const { matrix } = piece
    const filled = matrix.filter(r => r.some(Boolean))
    if (!filled.length) return
    const colMin = Math.min(...filled.map(r => r.findIndex(Boolean)))
    const colMax = Math.max(...filled.map(r => r.length - 1 - [...r].reverse().findIndex(Boolean)))
    const tw = colMax - colMin + 1, th = filled.length
    const canvCols = Math.round(canvas.width / size)
    const canvRows = Math.round(canvas.height / size)
    const ox = Math.floor((canvCols - tw) / 2) * size
    const oy = Math.floor((canvRows - th) / 2) * size
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 5
    filled.forEach((row, ry) => {
      for (let cx = colMin; cx <= colMax; cx++) {
        if (!row[cx]) continue
        ctx.fillRect(ox + (cx - colMin) * size + 1, oy + ry * size + 1, size - 2, size - 2)
      }
    })
  }, [type, color, size, piece])
  return <canvas ref={canvasRef} width={4 * size} height={2 * size} style={{ display: 'block' }} />
}

// ─── Rewind Gauge ─────────────────────────────────────────────────────────────
// Visual component for the rewind gauge
function RewindGauge({ fill, ready, onActivate }) {
  return (
    <motion.button
      whileHover={{ scale: ready ? 1.05 : 1 }}
      whileTap={{ scale: ready ? 0.95 : 1 }}
      onClick={() => { if (ready) onActivate() }}
      disabled={!ready}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        background: ready ? 'rgba(100,180,255,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${ready ? '#64b4ff' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8, padding: '6px 10px',
        cursor: ready ? 'pointer' : 'default',
        fontFamily: 'inherit',
        boxShadow: ready ? '0 0 12px rgba(100,180,255,0.3)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: '0.48rem', letterSpacing: '0.18em', color: ready ? '#64b4ff' : '#555', fontWeight: 700 }}>
        ⏪ REWIND
      </div>
      <div style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 2, background: ready ? '#64b4ff' : '#335577' }}
          animate={{ width: `${Math.min(100, fill * 100)}%` }}
          transition={{ duration: 0.15 }}
        />
      </div>
    </motion.button>
  )
}

// ─── S3 mechanics hook ─────────────────────────────────────────────────────────
function useS3Mechanics({ level, epoch, engine, state, linesThisLevel, isActive, zoneActive }) {
  const mechanic = level?.mechanic ?? null
  const ability  = level?.ability  ?? null

  // ── Rewind state ────────────────────────────────────────────────────────────
  const [rewindGauge,    setRewindGauge]    = useState(0)       // 0.0 – 1.0
  const [rewindActive,   setRewindActive]   = useState(false)   // rewind animation playing
  const boardSnapshotsRef = useRef([])                          // circular buffer of board snapshots
  const prevLinesRef      = useRef(0)
  const SNAPSHOT_MAX = 5
  const REWIND_GAUGE_PER_LINE = 0.25  // 4 lines fills gauge

  const hasRewind = ['rewind_intro', 'rewind_heavy', 'all_mechanics_mixed'].includes(mechanic)

  // ── Time-Dilation state ─────────────────────────────────────────────────────
  const [dilationRows, setDilationRows] = useState([])  // [{row, type: 'fast'|'slow', pct}]
  const dilationOverrideRef = useRef(null)  // { until: timestamp, type }
  const [dilationFlash, setDilationFlash] = useState(null)  // 'fast' | 'slow' | null

  const hasDilation = ['time_dilation_intro', 'time_dilation_zones', 'all_mechanics_mixed'].includes(mechanic)

  // ── Phantom Blocks state ────────────────────────────────────────────────────
  const [phantoms, setPhantoms] = useState([])  // [{id, cells:[{row,col}], solidifyAt, countdown}]
  const phantomIdRef = useRef(0)
  const phantomTimerRef = useRef(null)

  const hasPhantoms = ['phantom_blocks_intro', 'phantom_blocks_heavy', 'all_mechanics_mixed'].includes(mechanic)

  // ── Boss ability state ──────────────────────────────────────────────────────
  const [abilityActive, setAbilityActive] = useState(false)
  const [abilityLabel,  setAbilityLabel]  = useState('')
  const [abilityToast,  setAbilityToast]  = useState(null)
  const [toastId,       setToastId]       = useState(0)
  const [hoverGarbage,  setHoverGarbage]  = useState([])  // [{id, rows, solidifyAt}]
  const [hideQueue,     setHideQueue]     = useState(false)
  const [stickyDelay,   setStickyDelay]   = useState(0)   // ms of input lag
  const [clearLagRows,  setClearLagRows]  = useState([])  // ghost rows still showing
  const [stoneCells,    setStoneCells]    = useState(() => new Set())
  const [shrinkRows,    setShrinkRows]    = useState(0)   // number of rows consumed from top
  const prevClearRef = useRef(null)
  const stickyZoneRef = useRef(false)

  // Internal timers
  const hoverTimerRef   = useRef(null)
  const petrifyTimerRef = useRef(null)
  const shrinkTimerRef  = useRef(null)
  const lagTimerRef     = useRef([])

  // ── Cleanup on unmount / level change ──────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(hoverTimerRef.current)
      clearInterval(petrifyTimerRef.current)
      clearInterval(shrinkTimerRef.current)
      clearTimeout(phantomTimerRef.current)
      lagTimerRef.current.forEach(t => clearTimeout(t))
    }
  }, [level?.id])

  // ── Reset mechanics when entering GAME phase ───────────────────────────────
  const resetMechanics = useCallback(() => {
    setRewindGauge(0)
    setRewindActive(false)
    boardSnapshotsRef.current = []
    prevLinesRef.current = 0

    // Generate dilation rows
    if (hasDilation) {
      const count = mechanic === 'time_dilation_intro' ? 2
                  : mechanic === 'all_mechanics_mixed' ? 4 : 3
      const rows = []
      const used = new Set()
      for (let i = 0; i < count; i++) {
        let r
        do { r = 4 + Math.floor(Math.random() * (VISIBLE_ROWS - 8)) } while (used.has(r))
        used.add(r)
        rows.push({ row: r, type: i % 2 === 0 ? 'fast' : 'slow', pct: r / VISIBLE_ROWS })
      }
      setDilationRows(rows)
    } else {
      setDilationRows([])
    }

    setPhantoms([])
    setHoverGarbage([])
    setHideQueue(false)
    setStickyDelay(0)
    setClearLagRows([])
    setStoneCells(new Set())
    setShrinkRows(0)
    setAbilityActive(false)
    setAbilityLabel('')
  }, [mechanic, hasDilation])

  // ── Snapshot engine board every time a piece locks ─────────────────────────
  const prevLockRef = useRef(false)
  useEffect(() => {
    if (!hasRewind || !isActive) return
    if (state.pieceLocked && !prevLockRef.current) {
      const snap = {
        board:    engine.board.map(row => [...row]),
        queue:    [...(engine.queue || [])],
        hold:     engine.hold,
        score:    engine.score,
        lines:    engine.lines,
      }
      const snaps = boardSnapshotsRef.current
      snaps.push(snap)
      if (snaps.length > SNAPSHOT_MAX) snaps.shift()
    }
    prevLockRef.current = state.pieceLocked
  }, [hasRewind, isActive, state.pieceLocked, engine])

  // ── Fill rewind gauge on line clears ──────────────────────────────────────
  useEffect(() => {
    if (!hasRewind) return
    const diff = linesThisLevel - prevLinesRef.current
    if (diff > 0) {
      setRewindGauge(g => Math.min(1, g + diff * REWIND_GAUGE_PER_LINE))
      prevLinesRef.current = linesThisLevel
    }
  }, [hasRewind, linesThisLevel])

  // ── Activate rewind ────────────────────────────────────────────────────────
  const activateRewind = useCallback(() => {
    const snaps = boardSnapshotsRef.current
    if (!snaps.length || rewindGauge < 1) return
    const snap = snaps.pop()
    try {
      engine.board  = snap.board.map(row => [...row])
      engine.queue  = [...snap.queue]
      engine.hold   = snap.hold
      engine.score  = snap.score
      engine.lines  = snap.lines
      engine._spawnPiece?.()   // try to respawn if method exists, ignore if not
    } catch {}
    setRewindGauge(0)
    setRewindActive(true)
    setTimeout(() => setRewindActive(false), 400)
  }, [rewindGauge, engine])

  // ── Time-dilation: gravity override based on piece row ─────────────────────
  const engineLevelSavedRef = useRef(null)
  useEffect(() => {
    if (!hasDilation || !isActive || dilationRows.length === 0) return

    // Zone freezes all anomalies
    if (zoneActive) {
      if (engineLevelSavedRef.current !== null) {
        engine.level = engineLevelSavedRef.current
        engine.storyLevelOffset = engineLevelSavedRef.current
        engineLevelSavedRef.current = null
      }
      dilationOverrideRef.current = null
      setDilationFlash(null)
      return
    }

    const curY = state.current?.y
    if (curY == null) return

    // Visible row = curY - 2 (subtract hidden rows)
    const visRow = curY - 2
    const match = dilationRows.find(d => Math.abs(visRow - d.row) <= 1)

    const prevOverride = dilationOverrideRef.current
    if (match) {
      if (!prevOverride) {
        // Save original level
        engineLevelSavedRef.current = engine.level
        const newLevel = match.type === 'fast'
          ? Math.min(20, engine.level + 8)
          : Math.max(1, engine.level - 5)
        engine.level = newLevel
        engine.storyLevelOffset = newLevel
        dilationOverrideRef.current = { type: match.type, until: Date.now() + 1500 }
        setDilationFlash(match.type)
        setTimeout(() => setDilationFlash(null), 600)
      }
    } else if (prevOverride && Date.now() > prevOverride.until) {
      engine.level = engineLevelSavedRef.current ?? engine.level
      engine.storyLevelOffset = engine.level
      engineLevelSavedRef.current = null
      dilationOverrideRef.current = null
    }
  }, [hasDilation, isActive, zoneActive, state.current?.y, dilationRows, engine])

  // ── Phantom blocks: spawn new phantom every N seconds ─────────────────────
  useEffect(() => {
    if (!hasPhantoms || !isActive) { clearTimeout(phantomTimerRef.current); return }
    const INTERVAL = mechanic === 'phantom_blocks_heavy' ? 8000
                   : mechanic === 'all_mechanics_mixed'  ? 6000 : 12000
    const spawnPhantom = () => {
      if (!isActive || zoneActive) { phantomTimerRef.current = setTimeout(spawnPhantom, INTERVAL); return }
      const col = Math.floor(Math.random() * (BOARD_WIDTH - 3))
      const row = 4 + Math.floor(Math.random() * (VISIBLE_ROWS - 8))
      const cells = [
        { row, col }, { row, col: col + 1 }, { row, col: col + 2 },
        { row: row + 1, col: col + 1 },
      ]
      const id = ++phantomIdRef.current
      const solidifyAt = Date.now() + 10000
      setPhantoms(prev => [...prev.slice(-4), { id, cells, solidifyAt }])
      phantomTimerRef.current = setTimeout(spawnPhantom, INTERVAL)
    }
    phantomTimerRef.current = setTimeout(spawnPhantom, INTERVAL * 0.5)
    return () => clearTimeout(phantomTimerRef.current)
  }, [hasPhantoms, isActive, mechanic]) // eslint-disable-line

  // ── Phantom block solidification ───────────────────────────────────────────
  const [, forceRender] = useState(0)
  useEffect(() => {
    if (!hasPhantoms || !phantoms.length) return
    const id = setInterval(() => {
      const now = Date.now()
      setPhantoms(prev => {
        const remaining = []
        prev.forEach(ph => {
          if (now >= ph.solidifyAt) {
            // Solidify: add garbage rows for each row in the phantom
            try {
              engine.pendingGarbage = (engine.pendingGarbage ?? 0) + 1
            } catch {}
          } else {
            remaining.push(ph)
          }
        })
        return remaining
      })
      forceRender(n => n + 1)
    }, 500)
    return () => clearInterval(id)
  }, [hasPhantoms, phantoms.length, engine])

  // ── Hover garbage (boss ability: hover_garbage) ───────────────────────────
  const queueGarbage = useCallback((lines) => {
    try {
      engine.pendingGarbage = (engine.pendingGarbage ?? 0) + lines
    } catch {}
  }, [engine])

  const showToast = useCallback((text) => {
    setAbilityToast(text)
    setToastId(n => n + 1)
    setTimeout(() => setAbilityToast(null), 2000)
  }, [])

  useEffect(() => {
    if (ability !== 'hover_garbage' || !isActive) return
    clearInterval(hoverTimerRef.current)
    hoverTimerRef.current = setInterval(() => {
      if (!isActive || zoneActive) return
      const id = ++phantomIdRef.current
      const rows = Math.floor(Math.random() * 2) + 1
      setHoverGarbage(prev => [...prev.slice(-3), { id, rows, solidifyAt: Date.now() + 5000 }])
      setAbilityActive(true); setAbilityLabel('HOVER GARBAGE')
      showToast('⚠ INCOMING')
      setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1500)
    }, 12000)
    return () => clearInterval(hoverTimerRef.current)
  }, [ability, isActive, zoneActive, queueGarbage, showToast])

  // Solidify hover garbage
  useEffect(() => {
    if (!hoverGarbage.length) return
    const id = setInterval(() => {
      const now = Date.now()
      setHoverGarbage(prev => {
        const remaining = []
        prev.forEach(hg => {
          if (now >= hg.solidifyAt && !zoneActive) {
            queueGarbage(hg.rows)
          } else {
            remaining.push(hg)
          }
        })
        return remaining
      })
    }, 500)
    return () => clearInterval(id)
  }, [hoverGarbage.length, zoneActive, queueGarbage])

  // ── Blind queue (boss: buffer_overrun) ─────────────────────────────────────
  useEffect(() => {
    if (ability !== 'blind_queue') return
    setHideQueue(!zoneActive)
  }, [ability, zoneActive])

  // ── Undo clear (boss: rollback) ─────────────────────────────────────────────
  useEffect(() => {
    if (ability !== 'undo_clear' || !isActive) return
    const cur = state.lastClear
    if (cur && cur !== prevClearRef.current && cur.lines > 0) {
      prevClearRef.current = cur
      if (Math.random() < 0.15) {
        queueGarbage(cur.lines)
        setAbilityActive(true); setAbilityLabel('FALSE CLEAR')
        showToast('⚠ ROLLBACK')
        setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1500)
      }
    }
  }, [ability, isActive, state.lastClear, queueGarbage, showToast])

  // ── Sticky inputs (boss: legacy_constraint) ────────────────────────────────
  useEffect(() => {
    if (ability !== 'sticky_inputs') return
    stickyZoneRef.current = zoneActive
    setStickyDelay(zoneActive ? 0 : 80)  // 80ms lag when not in Zone
    if (zoneActive) {
      setAbilityActive(true); setAbilityLabel('ZONE: CRISP INPUTS')
    } else {
      setAbilityActive(true); setAbilityLabel('HARDWARE LAG')
    }
  }, [ability, zoneActive])

  // ── Worst piece (boss: predictor) ──────────────────────────────────────────
  // Bias the queue toward S/Z pieces every 6th piece
  const worstPieceCountRef = useRef(0)
  const prevQueueLenRef    = useRef(0)
  useEffect(() => {
    if (ability !== 'worst_piece' || !isActive || zoneActive) return
    const curLen = (engine.queue || []).length
    if (curLen !== prevQueueLenRef.current) {
      prevQueueLenRef.current = curLen
      worstPieceCountRef.current++
      if (worstPieceCountRef.current % 5 === 0) {
        // Every 5th piece, sabotage: swap next piece with S or Z
        try {
          const bad = Math.random() < 0.5 ? 'S' : 'Z'
          if (engine.queue && engine.queue.length > 0) {
            engine.queue[0] = bad
            setAbilityActive(true); setAbilityLabel('SABOTAGE RNG')
            showToast('⚠ SABOTAGE')
            setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1200)
          }
        } catch {}
      }
    }
  }, [ability, isActive, zoneActive, state.queue?.length, engine, showToast])

  // ── Clear lag (boss: race_condition) ──────────────────────────────────────
  useEffect(() => {
    if (ability !== 'clear_lag' || !isActive || zoneActive) return
    const cur = state.lastClear
    if (cur && cur !== prevClearRef.current && cur.lines > 0) {
      prevClearRef.current = cur
      const lagRows = Array.from({ length: cur.lines }).map((_, i) => ({ id: Date.now() + i }))
      setClearLagRows(prev => [...prev, ...lagRows])
      const t = setTimeout(() => {
        setClearLagRows(prev => prev.filter(r => !lagRows.find(lr => lr.id === r.id)))
      }, 3000)
      lagTimerRef.current.push(t)
      setAbilityActive(true); setAbilityLabel('CLEAR LAG')
      setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1200)
    }
  }, [ability, isActive, zoneActive, state.lastClear, showToast])

  // ── Petrification (final boss) ─────────────────────────────────────────────
  useEffect(() => {
    if (ability !== 'petrification' || !isActive) return
    petrifyTimerRef.current = setInterval(() => {
      if (!isActive) return
      if (zoneActive) {
        // Zone cleanses all stone cells
        setStoneCells(new Set())
        setAbilityActive(true); setAbilityLabel('CHRONO-CLEANSE')
        showToast('✦ BOARD CLEANSED')
        setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 2000)
        return
      }
      try {
        const board = engine.board
        if (!board) return
        const occupied = []
        for (let r = 2; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) {
            if (board[r][c]) occupied.push(`${r},${c}`)
          }
        }
        if (occupied.length === 0) return
        const pick = occupied[Math.floor(Math.random() * occupied.length)]
        setStoneCells(prev => new Set([...prev, pick]))
        setAbilityActive(true); setAbilityLabel('PETRIFY')
        showToast('☠ PETRIFIED')
        setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1500)
      } catch {}
    }, 15000)
    return () => clearInterval(petrifyTimerRef.current)
  }, [ability, isActive, engine, showToast]) // eslint-disable-line

  // When Zone activates during petrification, cleanse
  useEffect(() => {
    if (ability !== 'petrification') return
    if (zoneActive && stoneCells.size > 0) {
      setStoneCells(new Set())
      showToast('✦ BOARD CLEANSED')
    }
  }, [ability, zoneActive]) // eslint-disable-line

  // ── Shrinking board (e4 l2) ────────────────────────────────────────────────
  const shrinkLines = useRef(0)
  useEffect(() => {
    if (mechanic !== 'shrinking_board' || !isActive) return
    shrinkTimerRef.current = setInterval(() => {
      if (!isActive || zoneActive) return
      setShrinkRows(r => Math.min(8, r + 1))
      setAbilityActive(true); setAbilityLabel('CEILING LOWERING')
      setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1200)
    }, 18000)
    return () => clearInterval(shrinkTimerRef.current)
  }, [mechanic, isActive, zoneActive])

  // Combo reduces shrink
  useEffect(() => {
    if (mechanic !== 'shrinking_board') return
    if (state.combo >= 3) {
      setShrinkRows(r => Math.max(0, r - 1))
      shrinkLines.current++
    }
  }, [mechanic, state.combo])

  return {
    // Rewind
    rewindGauge, rewindActive, activateRewind, hasRewind,
    // Time dilation
    dilationRows, dilationFlash, hasDilation,
    // Phantom blocks
    phantoms, hasPhantoms,
    // Boss abilities
    abilityActive, abilityLabel, abilityToast, toastId,
    hideQueue,
    hoverGarbage,
    stickyDelay,
    clearLagRows,
    stoneCells,
    shrinkRows,
    // Control
    resetMechanics,
  }
}

// ─── Game loop hook ────────────────────────────────────────────────────────────
function useS3GameLoop(engine, targetLines, levelStartLinesRef, levelKey, onComplete, musicRef, beatRef, active, stickyDelayRef) {
  const heldRef   = useRef({ left: false, right: false, softDrop: false })
  const actionRef = useRef({})
  const [state,   setState]   = useState(() => engine.getState())
  const [paused,  setPaused]  = useState(false)
  const pausedRef = useRef(false)
  const prevGameOverRef = useRef(false)

  const triggerAction = useCallback((action) => {
    actionRef.current[action] = true
  }, [])

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    engine.togglePause()
    if (pausedRef.current) musicRef?.current?.pause()
    else musicRef?.current?.resume()
  }, [engine, musicRef])

  const handlePress = useCallback((key, isHeld) => {
    const delay = stickyDelayRef.current
    const dispatch = () => {
      if (isHeld) heldRef.current[key] = true
      else triggerAction(key)
    }
    if (delay > 0) setTimeout(dispatch, delay)
    else dispatch()
  }, [triggerAction, stickyDelayRef])

  const handleRelease = useCallback((key) => {
    heldRef.current[key] = false
  }, [])

  useEffect(() => {
    const down = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b) return
      ev.preventDefault(); if (ev.repeat) return
      if (b.action === 'pause') { togglePause(); return }
      if (b.action === 'rewind') {
        try { window.dispatchEvent(new CustomEvent('s3-rewind', { detail: { action: 'rewind', source: 'keyboard' } })) } catch {}
        return
      }
      if (b.held) {
        const delay = stickyDelayRef.current
        const dispatch = () => {
          heldRef.current[b.held] = true
          if (b.held === 'left' || b.held === 'right') emitSynesthesia(SYNESTHESIA_EVENT.MOVE, { intensity: 0.9, source: 's3-kb' })
          if (b.held === 'softDrop') emitSynesthesia(SYNESTHESIA_EVENT.SOFT_DROP, { intensity: 0.82, source: 's3-kb' })
          try { window.dispatchEvent(new Event('bg-beat')) } catch {}
        }
        if (delay > 0) { setTimeout(dispatch, delay) } else { dispatch() }
      }
      if (b.action) {
        actionRef.current[b.action] = true
        if (b.action === 'rotateCW' || b.action === 'rotateCCW' || b.action === 'rotate180') emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 's3-kb' })
        if (b.action === 'hardDrop') emitSynesthesia(SYNESTHESIA_EVENT.HARD_DROP, { intensity: 1.22, source: 's3-kb' })
        try { window.dispatchEvent(new Event('bg-beat')) } catch {}
      }
    }
    const up = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b?.held) return
      ev.preventDefault()
      heldRef.current[b.held] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [togglePause, stickyDelayRef])

  // Gamepad
  useEffect(() => {
    const AXIS_DEAD = 0.35
    const GP_HELD_MAP = { 13: 'softDrop', 14: 'left', 15: 'right' }
    const GP_ACTION_MAP = {
      12: 'hardDrop', 0: 'rotateCCW', 1: 'rotateCW', 2: 'rotateCCW',
      3: 'rotate180', 4: 'hold', 5: 'hold', 6: 'activateZone',
      7: 'activateZone', 9: 'pause'
    }
    const prevButtons = {}
    let gpHeldRef = { left: false, right: false, softDrop: false }
    let rafId
    const poll = () => {
      const gamepads = navigator.getGamepads?.()
      if (gamepads) {
        for (const gp of gamepads) {
          if (!gp) continue
          for (const [btn, action] of Object.entries(GP_ACTION_MAP)) {
            const pressed = gp.buttons[btn]?.pressed
            const wasPressed = prevButtons[btn]
            if (pressed && !wasPressed) {
              if (action === 'pause') {
                togglePause()
              } else if (action === 'rewind') {
                try { window.dispatchEvent(new CustomEvent('s3-rewind', { detail: { action: 'rewind', source: 'gamepad' } })) } catch {}
              } else {
                const delay = stickyDelayRef.current
                const dispatch = () => { actionRef.current[action] = true }
                if (delay > 0) { setTimeout(dispatch, delay) } else { dispatch() }
              }
              try { window.dispatchEvent(new Event('bg-beat')) } catch {}
            }
            prevButtons[btn] = pressed
          }
          for (const [btn, held] of Object.entries(GP_HELD_MAP)) {
            const pressed = gp.buttons[btn]?.pressed
            heldRef.current[held] = pressed
          }
          if (gp.axes.length >= 4) {
            const hAxis = gp.axes[2], vAxis = gp.axes[3]
            gpHeldRef.left = Math.abs(hAxis) > AXIS_DEAD && hAxis < 0
            gpHeldRef.right = Math.abs(hAxis) > AXIS_DEAD && hAxis > 0
            gpHeldRef.softDrop = Math.abs(vAxis) > AXIS_DEAD && vAxis > 0
            heldRef.current.left = heldRef.current.left || gpHeldRef.left
            heldRef.current.right = heldRef.current.right || gpHeldRef.right
            heldRef.current.softDrop = heldRef.current.softDrop || gpHeldRef.softDrop
          }
        }
      }
      rafId = requestAnimationFrame(poll)
    }
    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [togglePause, stickyDelayRef])

  useEffect(() => {
    prevGameOverRef.current = false
    let frameId, lastTime = performance.now()
    const frame = (now) => {
      if (!active) {
        setState(engine.getState())
        frameId = requestAnimationFrame(frame)
        return
      }
      const dt = Math.min(now - lastTime, MAX_FRAME_MS); lastTime = now
      const actions = actionRef.current; actionRef.current = {}
      engine.update(dt, heldRef.current, actions)
      const ns = engine.getState()
      if (ns.lastClear?.lines > 0) emitSynesthesia(SYNESTHESIA_EVENT.LINE_CLEAR, { intensity: Math.min(1.5, 0.9 + ns.lastClear.lines * 0.2), lines: ns.lastClear.lines })
      if (beatRef) beatRef.current = musicRef?.current?.getBeatEnergy() ?? 0
      const linesThisLevel = ns.lines - (levelStartLinesRef?.current ?? 0)
      const levelComplete  = targetLines > 0 && linesThisLevel >= targetLines
      if ((ns.gameOver || levelComplete) && !prevGameOverRef.current) {
        prevGameOverRef.current = true
        onComplete({ score: ns.score, lines: ns.lines, linesThisLevel, gameOver: ns.gameOver })
      }
      setState(ns)
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [engine, targetLines, levelKey, onComplete, active]) // eslint-disable-line

  return { state, paused, triggerAction, handlePress, handleRelease, togglePause }
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Season3LevelPage() {
  const { epochId, levelId } = useParams()
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user }   = useAuth()

  const levelData = useMemo(() => findS3Level(epochId, levelId), [epochId, levelId])

  const [phase,        setPhase]        = useState(PHASE.STORY)
  const [finalLines,   setFinalLines]   = useState(0)
  const [finalScore,   setFinalScore]   = useState(0)
  const [saving,       setSaving]       = useState(false)
  const [storyCountdown, setStoryCountdown] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [easyMode,   setEasyMode]   = useState(() => { try { return localStorage.getItem('story-easy') === '1' } catch { return false } })
  const [focus,      setFocus]      = useState(() => { try { return localStorage.getItem('focus-mode') === '1' } catch { return false } })
  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth < 768)
  const [isLandscape, setIsLandscape] = useState(() => {
    return window.innerWidth > window.innerHeight
  })
  
  // Get responsive HUD sizing that matches SOLO mode
  const hudSizing = useResponsiveHUD(isLandscape)
  
  const [zoom,       setZoom]       = useState(() => {
    const saved = Number(localStorage.getItem('tetris-zoom') || 1)
    // Clamp to 0.5–2.0 (50%–200%)
    return saved >= 0.5 && saved <= 2.0 ? saved : 1
  })
  const engine = useMemo(() => new TetrisEngine(), [])

  const levelStartLinesRef = useRef(0)
  const pendingResetRef    = useRef(true)
  const musicRef           = useRef(null)
  const beatRef            = useRef(0)
  const stickyDelayRef     = useRef(0)

  const [progress, setProgress] = useState({})
  const [progressLoading, setProgressLoading] = useState(true)
  useEffect(() => {
    if (!user?.uid) {
      setProgress({})
      setProgressLoading(false)
      return
    }
    setProgressLoading(true)
    getStoryProgress(user.uid)
      .then(p => setProgress(p || {}))
      .catch(() => setProgress({}))
      .finally(() => setProgressLoading(false))
  }, [user])

  const s3Unlocked = useMemo(() => isS3Unlocked(progress), [progress])
  const levelUnlocked = useMemo(() => isS3LevelUnlocked(epochId, levelId, progress), [epochId, levelId, progress])
  const bypassUnlock = !!(location.state && location.state.fromS3Complete)

  const CONFIG_KEY = 'tetris-config'
  const DEFAULT_CONFIG = { sfxEnabled: true, hapticEnabled: true, musicVolume: 1.0, sfxVolume: 2.0, das: 110, arr: 25, showOnScreenControls: false, renderQuality: 'balanced', screenShakeMultiplier: 1.0 }
  const loadConfig = () => { try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') } } catch { return { ...DEFAULT_CONFIG } } }
  const [config, setConfig] = useState(loadConfig)

  const epoch = levelData?.epoch
  const level = levelData?.level
  const bgTypeFallback = S3_BG_FALLBACKS[level?.bgType] ?? 'geometry'
  const pieceTheme = useMemo(() => BG_TYPE_TO_PIECE_THEME[bgTypeFallback] ?? 'classic', [bgTypeFallback])

  useEffect(() => { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) } catch {} }, [config])
  useEffect(() => { try { engine.setSettings({ das: config.das, arr: config.arr }) } catch {} }, [config.das, config.arr, engine])
  useEffect(() => { try { musicRef.current?.setVolume?.(config.musicVolume) } catch {} }, [config.musicVolume])
  useEffect(() => { setSfxVolume(config.sfxVolume ?? 1.0) }, [config.sfxVolume])
  useEffect(() => { try { localStorage.setItem('focus-mode', focus ? '1' : '0') } catch {} }, [focus])
  useEffect(() => { try { localStorage.setItem('story-easy', easyMode ? '1' : '0') } catch {} }, [easyMode])

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768)
      setIsLandscape(window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'KeyF') setFocus(f => !f) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Reset on level change
  useEffect(() => {
    pendingResetRef.current = true
    levelStartLinesRef.current = 0
    setFinalLines(0)
    setFinalScore(0)
    setStoryCountdown(null)
    setPhase(PHASE.STORY)
  }, [epochId, levelId])

  // Music
  useEffect(() => {
    if (phase === PHASE.LOADING || phase === PHASE.GAME) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx && !musicRef.current) musicRef.current = new Season3MusicManager(new Ctx())
      musicRef.current?.playForEpoch(epochId)
      musicRef.current?.setLevelBpm?.(level?.bpm || 120)
    } else if (phase === PHASE.FAIL || phase === PHASE.COMPLETE) {
      musicRef.current?.stop()
    }
  }, [phase, epochId, level])
  useEffect(() => () => { musicRef.current?.stop() }, [])

  // Engine reset
  useEffect(() => {
    if (phase === PHASE.GAME && pendingResetRef.current) {
      pendingResetRef.current = false
      engine.reset(GAME_MODE.NORMAL)
      levelStartLinesRef.current = 0
      const gm = level?.gravityMult ?? 1.0
      const gravFactor = easyMode ? 0.6 : 1.0
      const targetLevel = Math.max(1, Math.round(gm * gravFactor * 5 + 1))
      engine.level = targetLevel
      engine.storyLevelOffset = targetLevel
      engine.storyLinesOffset = 0
    }
  }, [phase, engine, level, easyMode])

  // Story auto-begin
  useEffect(() => {
    if (phase !== PHASE.STORY) { setStoryCountdown(null); return }
    setStoryCountdown(13)
    let remaining = 13
    const id = setInterval(() => {
      remaining -= 1
      setStoryCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        pendingResetRef.current = true
        setPhase(PHASE.LOADING)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, epochId, levelId])

  useEffect(() => {
    if (phase !== PHASE.LOADING) return
    const id = setTimeout(() => {
      pendingResetRef.current = true
      setPhase(PHASE.GAME)
    }, 650)
    return () => clearTimeout(id)
  }, [phase, epochId, levelId])

  const effectiveTargetLines = easyMode ? (level?.easyTargetLines ?? 30) : (level?.targetLines ?? 40)
  const levelKey = `s3-${epochId}-${levelId}`

  const handleComplete = useCallback(({ score, lines, linesThisLevel: ltl, gameOver }) => {
    const lt = ltl ?? lines
    setFinalScore(score)
    setFinalLines(lt)
    if (gameOver) { setPhase(PHASE.FAIL); return }
    if (user) {
      setSaving(true)
      const scoreThisLevel = Math.max(0, score)
      const tasks = [
        saveStoryProgress(user.uid, `s3_${epochId}`, levelId, scoreThisLevel, lt),
        saveGameResult(user.uid, 'story', score, { lines: lt, level: engine.getState().level || 1 }).catch(() => {}),
      ]
      if (easyMode) {
        tasks.push(markEasyModePlayed(user.uid).catch(() => {}))
        tasks.push(setActiveBadge(user.uid, 'badge_noob').catch(() => {}))
      }
      Promise.all(tasks).finally(() => setSaving(false))
    }
    setPhase(PHASE.COMPLETE)
  }, [user, epochId, levelId, easyMode, engine])

  const loopActive = phase === PHASE.GAME

  const {
    state, paused,
    triggerAction, handlePress, handleRelease, togglePause,
  } = useS3GameLoop(engine, effectiveTargetLines, levelStartLinesRef, levelKey, handleComplete, musicRef, beatRef, loopActive, stickyDelayRef)

  const linesThisLevel = state.lines - levelStartLinesRef.current

  const {
    rewindGauge, rewindActive, activateRewind, hasRewind,
    dilationRows, dilationFlash, hasDilation,
    phantoms, hasPhantoms,
    abilityActive, abilityLabel, abilityToast, toastId,
    hideQueue,
    hoverGarbage,
    stickyDelay,
    clearLagRows,
    stoneCells,
    shrinkRows,
    resetMechanics,
  } = useS3Mechanics({
    level, epoch, engine, state, linesThisLevel,
    isActive: loopActive && !paused,
    zoneActive: state.zoneActive ?? false,
  })

  // Keep stickyDelayRef in sync
  stickyDelayRef.current = stickyDelay

  // Call resetMechanics when entering GAME
  const mechResetRef = useRef(false)
  useEffect(() => {
    if (phase === PHASE.GAME && !mechResetRef.current) {
      mechResetRef.current = true
      resetMechanics()
    } else if (phase !== PHASE.GAME) {
      mechResetRef.current = false
    }
  }, [phase, resetMechanics])

  // Rewind action from game loop
  useEffect(() => {
    if (!hasRewind || !loopActive) return
    const listener = (e) => {
      if (e.detail?.action === 'rewind' || e.type === 'rewind') activateRewind()
    }
    window.addEventListener('s3-rewind', listener)
    return () => window.removeEventListener('s3-rewind', listener)
  }, [hasRewind, loopActive, activateRewind])

  // SFX
  const prevStateRef = useRef(null)
  useEffect(() => {
    if (!config.sfxEnabled || phase !== PHASE.GAME) { prevStateRef.current = state; return }
    const prev = prevStateRef.current
    if (prev) {
      const th = pieceTheme || 'classic'
      if (state.hardDropped) playHardDropSFX(th)
      else if (state.pieceLocked) playLockSFX(th)
      if (state.lastClear?.lines > 0) {
        if (state.lastClear.lines >= 4) playTetrisSFX(th)
        else playLineClearSFX(th, state.combo ?? 0)
      }
      if (state.pieceHeld) playHoldSFX(th)
      if (prev.zoneActive !== state.zoneActive) {
        if (state.zoneActive) {
          playZoneActivateSFX(th)
          setSfxDuck(1.5)
          try { musicRef.current?.setZoneFx?.(true) } catch {}
        } else {
          setSfxDuck(1.0)
          try { musicRef.current?.setZoneFx?.(false) } catch {}
        }
      }
      if (prev.current?.type === state.current?.type) {
        if (state.current?.x !== prev.current?.x) playMoveSFX(th)
        else if (state.current?.rotation !== prev.current?.rotation) playRotateSFX(th)
      }
    }
    prevStateRef.current = state
  }, [state, config.sfxEnabled, phase, pieceTheme])

  const handleHardRefresh = useCallback(() => hardResetAndReload(), [])

  const handleDragBegin = useCallback((dir) => {
    if (dir === 'left' || dir === 'right') {
      if (config?.sfxEnabled && !paused) try { playMoveSFX(pieceTheme || 'classic') } catch {}
      emitSynesthesia(SYNESTHESIA_EVENT.MOVE, { intensity: 1.03, source: 's3-drag' })
      handlePress(dir, true)
    } else if (dir === 'down') {
      if (config?.sfxEnabled && !paused) try { playSoftDropSFX(pieceTheme || 'classic') } catch {}
      emitSynesthesia(SYNESTHESIA_EVENT.SOFT_DROP, { intensity: 0.95, source: 's3-drag' })
      handlePress('softDrop', true)
    } else if (dir === 'up') {
      if (config?.sfxEnabled && !paused) try { playHoldSFX(pieceTheme || 'classic') } catch {}
      triggerAction('hold')
    }
    try { window.dispatchEvent(new Event('bg-beat')) } catch {}
  }, [handlePress, triggerAction, config?.sfxEnabled, paused, pieceTheme])

  const handleDragEnd = useCallback((dir) => {
    if (dir === 'left' || dir === 'right') handleRelease(dir)
    else if (dir === 'down') handleRelease('softDrop')
  }, [handleRelease])

  const handleHardDrop = useCallback(() => {
    if (config?.sfxEnabled && !paused) try { playHardDropSFX(pieceTheme || 'classic') } catch {}
    handleRelease('softDrop')
    emitSynesthesia(SYNESTHESIA_EVENT.HARD_DROP, { intensity: 1.24, source: 's3-gesture' })
    triggerAction('hardDrop')
    try { window.dispatchEvent(new Event('bg-beat')) } catch {}
  }, [handleRelease, triggerAction, config?.sfxEnabled, paused, pieceTheme])

  const showOnScreenControls = (() => {
    try { return JSON.parse(localStorage.getItem('tetris-config') ?? '{}').showOnScreenControls ?? false }
    catch { return false }
  })()

  const beatEnergy = beatRef.current
  const boardAlpha = phase === PHASE.GAME ? Math.max(0.28, 0.46 - beatEnergy * 0.18) : undefined

  const nextLevel = useMemo(() => getNextS3Level(epochId, levelId), [epochId, levelId])

  const epochColor  = epoch?.color  ?? '#ff0000'
  const epochTitle  = epoch?.title  ?? 'TEMPORAL FRACTURE'

  if (!levelData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0008', color: '#f87171', fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '0.15em' }}>
        LEVEL NOT FOUND —
        <button onClick={() => navigate('/s3')} style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', marginLeft: 8 }}>← S3 Map</button>
      </div>
    )
  }

  if (progressLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#06000a', color: '#ff3355', fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '0.18em' }}>
        SYNCING STORY DATA…
      </div>
    )
  }

  if (!s3Unlocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#06000a', color: '#ff3355', fontFamily: 'monospace', gap: 12, textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: '1.1rem', letterSpacing: '0.16em', fontWeight: 900 }}>SEASON 3 LOCKED</div>
        <div style={{ fontSize: '0.68rem', color: '#8b8b8b', maxWidth: 360, lineHeight: 1.5 }}>
          Beat Ophiuchus in the Zodiac arc to open Temporal Fracture.
        </div>
        <button onClick={() => navigate('/zodiac', { replace: true })} style={{ background: 'none', border: '1px solid rgba(255,70,90,0.4)', color: '#ff6677', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', letterSpacing: '0.12em' }}>
          ← Zodiac Map
        </button>
      </div>
    )
  }

  if (!levelUnlocked && !bypassUnlock) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#06000a', color: '#ff3355', fontFamily: 'monospace', gap: 12, textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: '1.1rem', letterSpacing: '0.16em', fontWeight: 900 }}>LEVEL LOCKED</div>
        <div style={{ fontSize: '0.68rem', color: '#8b8b8b', maxWidth: 360, lineHeight: 1.5 }}>
          Complete earlier levels in this epoch to unlock this mission.
        </div>
        <button onClick={() => navigate('/s3', { replace: true })} style={{ background: 'none', border: '1px solid rgba(255,70,90,0.4)', color: '#ff6677', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', letterSpacing: '0.12em' }}>
          ← Season 3 Map
        </button>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: '"Courier New", monospace' }}>
      {/* Background — fallback to a known bgType since S3 bgTypes may not exist in BackgroundCanvas */}
      <BackgroundCanvas
        bgType={bgTypeFallback}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        beatRef={beatRef}
        bpm={level?.bpm || 130}
        comboStreak={state.combo ?? 0}
      />
      {/* Tinted overlay for temporal fracture aesthetic */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,0.28)`, pointerEvents: 'none' }} />
      {/* Glitch vignette when rewind activating */}
      <AnimatePresence>
        {rewindActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0.4, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 99, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center, rgba(100,180,255,0.35) 0%, transparent 70%)',
              mixBlendMode: 'screen',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Story intro ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === PHASE.STORY && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
              style={{ textAlign: 'center', maxWidth: 480 }}
            >
              {/* Epoch tag */}
              <div style={{ fontSize: '0.48rem', color: epochColor, letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 6 }}>
                Season 3 · {epochTitle}
              </div>
              {/* Level title */}
              <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.14em', color: '#fff', marginBottom: 4 }}>
                {level.title}
              </div>
              <div style={{ fontSize: '0.66rem', color: '#555', letterSpacing: '0.2em', marginBottom: '1.4rem' }}>
                {level.subtitle}
              </div>

              {/* Story text */}
              <div style={{ background: `${epochColor}0d`, border: `1px solid ${epochColor}33`, borderRadius: 10, padding: '1rem 1.2rem', marginBottom: '1.2rem', textAlign: 'left' }}>
                <p style={{ color: '#ddd', fontSize: '0.88rem', lineHeight: 1.75, letterSpacing: '0.03em', margin: 0 }}>
                  {level.storyBefore}
                </p>
              </div>

              {/* Mechanic or ability preview */}
              {level.ability && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', marginBottom: '1.2rem', fontSize: '0.64rem', color: '#777', textAlign: 'left' }}>
                  <span style={{ color: epochColor, fontWeight: 700 }}>⚡ {level.abilityLabel}:</span>
                  {' '}{level.abilityDesc}
                </div>
              )}
              {level.mechanic && !level.ability && (() => {
                const descriptions = {
                  time_dilation_intro:  'Time-Dilation Rows will alter piece speed. Red rows accelerate. Blue rows slow.',
                  time_dilation_zones:  'Multiple Dilation Rows active. Manage your timing carefully.',
                  phantom_blocks_intro: 'Phantom Blocks haunt the board. They solidify in 10 seconds — plan around them.',
                  phantom_blocks_heavy: 'Phantoms spawn frequently. Do not build over their predicted locations.',
                  rewind_intro:         'The Rewind Gauge charges as you clear lines. When full, press R or two-finger swipe ← (or tap ⏪) to undo your last piece placement.',
                  rewind_heavy:         'The drops are relentless. Rewind is your lifeline — use it. Gesture: two-finger swipe ←.',
                  all_mechanics_mixed:  'All temporal anomalies active simultaneously. Time-Dilation Rows, Phantom Blocks, and Rewind.',
                  shrinking_board:      'The ceiling is falling. Massive combos push it back. Survive.',
                }
                return (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', marginBottom: '1.2rem', fontSize: '0.64rem', color: '#777', textAlign: 'left' }}>
                    <span style={{ color: epochColor, fontWeight: 700 }}>⏱ MECHANIC:</span>
                    {' '}{descriptions[level.mechanic] ?? level.mechanic}
                  </div>
                )
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '0.14em', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 14px' }}>
                  CLEAR {effectiveTargetLines} LINES
                </div>
                <button
                  onClick={() => setEasyMode(m => !m)}
                  style={{ background: easyMode ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${easyMode ? '#a855f7' : 'rgba(255,255,255,0.12)'}`, color: easyMode ? '#a855f7' : '#555', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: '0.62rem', letterSpacing: '0.16em', fontFamily: 'inherit', textTransform: 'uppercase' }}
                >
                  🐣 {easyMode ? 'Easy Mode ON' : 'Easy Mode'}
                </button>
                {storyCountdown !== null && storyCountdown > 0 && (
                  <div style={{ width: 200, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: epochColor, borderRadius: 2, transition: 'width 0.9s linear', width: `${((13 - storyCountdown) / 13) * 100}%` }} />
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { pendingResetRef.current = true; setPhase(PHASE.LOADING) }}
                  style={{ background: epochColor, border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.2em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}
                >
                  {storyCountdown !== null && storyCountdown > 0 ? `BEGIN (${storyCountdown}s)` : 'BEGIN'}
                </motion.button>
                <button
                  onClick={() => navigate('/s3', { replace: true })}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.12em', fontFamily: 'inherit', marginTop: 4 }}
                >
                  ← Temporal Fracture Map
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      <AnimatePresence>
        {phase === PHASE.LOADING && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 105, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.56rem', letterSpacing: '0.24em', color: epochColor, marginBottom: 12 }}>INITIALIZING TEMPORAL SEQUENCE</div>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                style={{ width: 36, height: 36, margin: '0 auto 10px', borderRadius: '50%', border: `2px solid ${epochColor}55`, borderTopColor: epochColor }}
              />
              <div style={{ fontSize: '0.62rem', color: '#9ca3af', letterSpacing: '0.12em' }}>{epoch.title}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game phase ─────────────────────────────────────────────────────── */}
      {phase === PHASE.GAME && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column' }}>
          {isLandscape && <ZoomControl zoom={zoom} onChange={setZoom} />}
          {/* HUD — Portrait mode only */}
          {!focus && !isLandscape && (
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: hudSizing.hudPadding, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: hudSizing.isMobile ? (isLandscape ? '0.8rem' : '0.85rem') : '0.85rem', letterSpacing: '0.1em', flexShrink: 0, backdropFilter: 'blur(6px)', gap: 8, flexWrap: 'nowrap', minHeight: hudSizing.hudMinHeight }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: hudSizing.statsLabel, color: epochColor, fontWeight: 700 }}>{level.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {abilityActive && (
                  <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ fontSize: '0.52rem', color: epochColor, letterSpacing: '0.14em', border: `1px solid ${epochColor}88`, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
                    ⚡ {abilityLabel}
                  </motion.span>
                )}
                {dilationFlash && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.6 }}
                    style={{ fontSize: '0.52rem', color: dilationFlash === 'fast' ? '#ff4444' : '#4488ff', letterSpacing: '0.12em' }}>
                    {dilationFlash === 'fast' ? '⚡ FAST' : '❄ SLOW'}
                  </motion.span>
                )}
                {/* Rewind gauge */}
                {hasRewind && (
                  <RewindGauge
                    fill={rewindGauge}
                    ready={rewindGauge >= 1}
                    onActivate={activateRewind}
                  />
                )}
                {/* Zone button */}
                <button
                  onClick={() => triggerAction('activateZone')}
                  disabled={state.zoneMeter < ZONE_MIN_METER || state.zoneActive}
                  style={{
                    background: state.zoneActive ? 'rgba(0,229,255,0.18)' : state.zoneMeter >= ZONE_MIN_METER ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#22d3ee' : 'rgba(255,255,255,0.1)'}`,
                    color: state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#80eaff' : '#555',
                    cursor: state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive ? 'pointer' : 'default',
                    fontSize: '0.6rem', padding: '2px 7px', borderRadius: 6, fontFamily: 'inherit',
                  }}
                  title="Chrono-Stabilizer"
                >
                  {state.zoneActive ? `⏱ ${Math.ceil(state.zoneTimer / 1000)}s` : '⏱ ZONE'}
                </button>
                <span style={{ color: '#555', fontSize: '0.62rem' }}>
                  {Math.min(linesThisLevel, effectiveTargetLines)}/{effectiveTargetLines}
                </span>
                {state.combo > 1 && <span style={{ color: '#f59e0b', fontSize: '0.62rem', fontWeight: 700 }}>×{state.combo}</span>}
                <span style={{ color: '#00d4ff', fontWeight: 700 }}>{state.score.toLocaleString()}</span>
                <button onClick={togglePause}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', cursor: 'pointer', fontSize: '0.6rem', padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit' }}>
                  {paused ? '▶' : '⏸'}
                </button>
                {false && (
                  <div>
                    <button onClick={() => setZoomInputOpen(true)}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', cursor: 'pointer', fontSize: '0.6rem', padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit' }}>
                      🔍 {Math.round(zoom * 100)}%
                    </button>
                    {zoomInputOpen && (
                      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setZoomInputOpen(false); setZoomInput(''); }}>
                        <form onSubmit={handleZoomInput} onClick={e => e.stopPropagation()} style={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200, backdropFilter: 'blur(8px)' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ccc' }}>Set Zoom Level</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              min="50"
                              max="200"
                              step="1"
                              value={zoomInput || Math.round(zoom * 100)}
                              onChange={e => setZoomInput(e.target.value)}
                              autoFocus
                              onFocus={e => e.target.select()}
                              style={{ flex: 1, padding: '6px 8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: '#fff', fontFamily: 'inherit', fontSize: '0.95rem' }}
                            />
                            <span style={{ color: '#888' }}>%</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>Range: 50% — 200%</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="submit" style={{ flex: 1, background: 'rgba(100, 200, 255, 0.2)', border: '1px solid rgba(100, 200, 255, 0.4)', color: '#64c8ff', borderRadius: 4, padding: '6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Apply</button>
                            <button type="button" onClick={() => { setZoomInputOpen(false); setZoomInput(''); }} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', borderRadius: 4, padding: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Level HP bar — Portrait mode only */}
          {!isLandscape && (() => {
            const hpPct  = Math.max(0, Math.min(100, 100 - (linesThisLevel / effectiveTargetLines) * 100))
            const hpColor = hpPct > 60 ? epochColor : hpPct > 30 ? '#f59e0b' : '#ef4444'
            return (
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                {[25, 50, 75].map(pct => (
                  <div key={pct} style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, width: 1, background: 'rgba(0,0,0,0.4)', zIndex: 2 }} />
                ))}
                <motion.div
                  style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: hpColor, boxShadow: `0 0 6px ${hpColor}88` }}
                  animate={{ width: `${hpPct}%`, background: hpColor }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            )
          })()}

          {/* Canvas area — Landscape vs Portrait */}
          {isLandscape ? (
            <LandscapeGameLayout
              isLandscape={isLandscape}
              gameMode="story"
              state={state}
              paused={paused}
              phase={phase}
              hudSizing={hudSizing}
              zoom={zoom}
              zoneActive={state.zoneActive}
              zoneMeter={state.zoneMeter}
              zoneTimerMs={state.zoneTimer}
              onActivateZone={() => triggerAction('activateZone')}
              currentLevel={level}
              targetLines={effectiveTargetLines}
              linesThisLevel={linesThisLevel}
              abilityActive={abilityActive}
              abilityLabel={abilityLabel}
              bossHpPct={Math.max(0, Math.min(100, 100 - (linesThisLevel / effectiveTargetLines) * 100))}
              epochColor={epochColor}
              onPause={togglePause}
              onZoom={() => setZoomInputOpen(true)}
              onSettings={() => setShowSettings(true)}
            >
              <SynesthesiaMotionLayer
                className="mobile-canvas-wrap"
                style={{
                  background: 'transparent',
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'visible',
                  position: 'relative',
                }}
              >
                {/* Board container wrapper - constrains overlays to board bounds */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    overflow: 'visible',
                  }}
                >
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GameCanvas
                        state={{ ...state, queue: hideQueue && !state.zoneActive ? [] : state.queue }}
                        onTap={() => { if (config?.sfxEnabled && !paused) try { playRotateSFX(pieceTheme || 'classic') } catch {}; emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 's3-tap' }); triggerAction('rotateCW'); try { window.dispatchEvent(new Event('bg-beat')) } catch {} }}
                        onTwoFingerTap={() => { if (config?.sfxEnabled && !paused) try { playZoneActivateSFX(pieceTheme || 'classic') } catch {}; triggerAction('activateZone'); try { window.dispatchEvent(new Event('bg-beat')) } catch {} }}
                        onDragBegin={handleDragBegin}
                        onDragEnd={handleDragEnd}
                        onHardDrop={handleHardDrop}
                        onZoomGesture={scale => setZoom(value => Math.max(0.5, Math.min(2, value * scale)))}
                        onRewindGesture={activateRewind}
                        themeOverride={pieceTheme}
                        boardAlpha={boardAlpha}
                        screenShakeMultiplier={config?.screenShakeMultiplier ?? 1.0}
                      />
                  </div>

                  {/* Overlays — constrained to board bounds */}
                  {hasDilation && dilationRows.map(dr => (
                    <div key={`dil-${dr.row}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(dr.row / VISIBLE_ROWS) * 100}%`, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: dr.type === 'fast' ? 'rgba(255,60,60,0.18)' : 'rgba(60,120,255,0.18)', borderTop: `1px solid ${dr.type === 'fast' ? 'rgba(255,60,60,0.6)' : 'rgba(60,120,255,0.6)'}`, borderBottom: `1px solid ${dr.type === 'fast' ? 'rgba(255,60,60,0.3)' : 'rgba(60,120,255,0.3)'}`, pointerEvents: 'none', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                      <span style={{ fontSize: '0.42rem', color: dr.type === 'fast' ? '#ff6666' : '#6699ff', letterSpacing: '0.1em', opacity: 0.8 }}>{dr.type === 'fast' ? '⚡' : '❄'}</span>
                    </div>
                  ))}

                  {hasPhantoms && phantoms.map(ph => {
                    const secondsLeft = Math.max(0, (ph.solidifyAt - Date.now()) / 1000)
                    const urgency = 1 - secondsLeft / 10
                  return ph.cells.map((cell, ci) => (
                    <div key={`ph-${ph.id}-${ci}`} style={{ position: 'absolute', left: `${(cell.col / BOARD_WIDTH) * 100}%`, top: `${((cell.row) / VISIBLE_ROWS) * 100}%`, width: `${(1 / BOARD_WIDTH) * 100}%`, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: `rgba(200,150,255,${0.12 + urgency * 0.25})`, border: `1px solid rgba(200,150,255,${0.3 + urgency * 0.5})`, pointerEvents: 'none', zIndex: 4, boxSizing: 'border-box' }} />
                  ))
                })}

                {hasPhantoms && phantoms.map(ph => {
                  const secsLeft = Math.max(0, Math.ceil((ph.solidifyAt - Date.now()) / 1000))
                  const topRow = Math.min(...ph.cells.map(c => c.row))
                  const leftCol = Math.min(...ph.cells.map(c => c.col))
                  return (
                    <div key={`ph-label-${ph.id}`} style={{ position: 'absolute', left: `${(leftCol / BOARD_WIDTH) * 100}%`, top: `${((topRow) / VISIBLE_ROWS) * 100 - 4}%`, fontSize: '0.45rem', color: secsLeft <= 3 ? '#ff8888' : '#cc99ff', fontWeight: 700, pointerEvents: 'none', zIndex: 5, letterSpacing: '0.06em', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                      {secsLeft}s
                    </div>
                  )
                })}

                {hoverGarbage.map(hg => {
                  const secsLeft = Math.max(0, (hg.solidifyAt - Date.now()) / 1000)
                  return (
                    <motion.div key={`hg-${hg.id}`} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(hg.rows / VISIBLE_ROWS) * 100}%`, background: 'rgba(255,80,80,0.12)', border: '2px dashed rgba(255,80,80,0.5)', pointerEvents: 'none', zIndex: 4 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      <div style={{ position: 'absolute', top: 4, right: 8, fontSize: '0.5rem', color: '#ff8888', fontWeight: 700 }}>{secsLeft > 0 ? `⚠ ${Math.ceil(secsLeft)}s` : 'INCOMING'}</div>
                    </motion.div>
                  )
                })}

                {clearLagRows.map((r, i) => (
                  <div key={`lag-${r.id}`} style={{ position: 'absolute', bottom: `${(i / VISIBLE_ROWS) * 100}%`, left: 0, right: 0, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: 'rgba(255,200,100,0.14)', borderTop: '1px solid rgba(255,200,100,0.4)', pointerEvents: 'none', zIndex: 4 }} />
                ))}

                {shrinkRows > 0 && (
                  <motion.div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${(shrinkRows / VISIBLE_ROWS) * 100}%`, background: 'rgba(255,0,0,0.22)', borderBottom: '2px solid rgba(255,0,0,0.7)', pointerEvents: 'none', zIndex: 6, display: 'flex', alignItems: 'flex-end', paddingBottom: 3, justifyContent: 'center' }} animate={{ height: `${(shrinkRows / VISIBLE_ROWS) * 100}%` }} transition={{ duration: 0.5, ease: 'easeInOut' }}>
                    <span style={{ fontSize: '0.42rem', color: '#ff6666', letterSpacing: '0.14em' }}>CEILING ▼</span>
                  </motion.div>
                )}

                {[...stoneCells].map(key => {
                  const [r, c] = key.split(',').map(Number)
                  return (
                    <div key={`stone-${key}`} style={{ position: 'absolute', left: `${(c / BOARD_WIDTH) * 100}%`, top: `${((r - 2) / VISIBLE_ROWS) * 100}%`, width: `${(1 / BOARD_WIDTH) * 100}%`, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: 'rgba(120,120,120,0.6)', border: '1px solid rgba(180,180,180,0.7)', pointerEvents: 'none', zIndex: 5, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.4rem' }}>⬛</div>
                  )
                })}

                <AnimatePresence>
                  {abilityToast && (
                    <motion.div key={toastId} initial={{ opacity: 0, y: 8, scale: 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.94 }} transition={{ duration: 0.22 }} style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.88)', border: `1px solid ${epochColor}cc`, borderRadius: 8, padding: '6px 16px', fontSize: '0.72rem', color: epochColor, letterSpacing: '0.2em', fontWeight: 900, whiteSpace: 'nowrap', zIndex: 25, pointerEvents: 'none', boxShadow: `0 0 18px ${epochColor}55` }}>
                      {abilityToast}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* End: Board container wrapper */}
                </div>

                <button onClick={() => setFocus(f => !f)} className="ui-toggle-tab" title={focus ? 'Exit Focus' : 'Enter Focus'} aria-label={focus ? 'Exit Focus' : 'Enter Focus'} style={{ right: 0 }}>
                  {focus ? '▲' : '▼'}
                </button>

                {focus && (() => {
                  const zoneReady = state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive
                  const zoneFillPct = Math.max(0, Math.min(100, state.zoneActive ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100 : (state.zoneMeter || 0)))
                  const hpPct = Math.max(0, 100 - Math.min(100, (linesThisLevel / effectiveTargetLines) * 100))
                  return (
                    <div className="fullscreen-mini-hud" style={{ right: 0 }}>
                      <div style={{ width: '100%', padding: '4px 5px 0', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: '0.38rem', color: '#555', letterSpacing: '0.1em', marginBottom: 2, textAlign: 'center' }}>PROGRESS</div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                          <motion.div style={{ height: '100%', background: epochColor, borderRadius: 2 }} animate={{ width: `${hpPct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
                        </div>
                      </div>
                      <div className="fmh-hold">
                        <div className="fmh-label">Hold</div>
                        <PieceMini type={state.hold} pieceTheme={pieceTheme} size={8} />
                      </div>
                      <div className="fmh-zone-wrap">
                        <div className={`fmh-zone-bar${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`} style={{ height: `${zoneFillPct}%` }} />
                      </div>
                      <div className="fmh-next">
                        <div className="fmh-label">Next</div>
                        {(hideQueue && !state.zoneActive ? [] : (state.queue ?? [])).slice(0, 3).map((t, i) => (
                          <PieceMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
                        ))}
                        {hideQueue && !state.zoneActive && <div style={{ fontSize: '0.7rem', color: epochColor }}>?</div>}
                      </div>
                      {hasRewind && (
                        <div style={{ padding: '4px 5px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                          <div style={{ fontSize: '0.38rem', color: '#555', marginBottom: 2, letterSpacing: '0.08em' }}>REWIND</div>
                          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rewindGauge * 100}%`, background: rewindGauge >= 1 ? '#64b4ff' : '#335577', borderRadius: 2 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {paused && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.2em', color: '#fff' }}>PAUSED</div>
                    <div style={{ fontSize: '0.6rem', color: epochColor, letterSpacing: '0.2em' }}>{epoch.title} — {level.title}</div>
                    <div style={{ fontSize: '0.56rem', color: '#555', letterSpacing: '0.14em' }}>{linesThisLevel} / {effectiveTargetLines} lines</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => musicRef.current?.prev?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
                      <button type="button" onClick={() => musicRef.current?.pause?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏸</button>
                      <button type="button" onClick={() => musicRef.current?.resume?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>▶</button>
                      <button type="button" onClick={() => musicRef.current?.next?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏭</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.60rem', color: '#777' }}>Vol</span>
                      <input type="range" min={0} max={1} step={0.01} value={config.musicVolume} onChange={e => { const v = parseFloat(e.target.value); setConfig(p => ({ ...p, musicVolume: v })); musicRef.current?.setVolume?.(v) }} style={{ width: 140 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>⚙ Settings</button>
                    </div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={togglePause} style={{ background: 'none', border: `1px solid ${epochColor}`, color: epochColor, borderRadius: 6, padding: '8px 22px', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.16em', fontFamily: 'inherit', fontWeight: 700 }}>▶ RESUME</motion.button>
                    <button onClick={() => navigate('/s3', { replace: true })} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#bbb', borderRadius: 6, padding: '7px 18px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>← S3 MAP</button>
                    <button onClick={() => { togglePause(); pendingResetRef.current = true; setPhase(PHASE.STORY) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#555', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>RESTART</button>
                  </div>
                )}
              </SynesthesiaMotionLayer>
            </LandscapeGameLayout>
          ) : (
            <>
              {/* PORTRAIT MODE: Clean HUD + Canvas layout (matches Solo Mode) */}
              {!focus && (
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '100%', flexShrink: 0, overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                  {/* Hold */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.3rem 0.45rem', borderRight: `1px solid ${epochColor}33`, gap: '0.1rem', minWidth: 58 }}>
                    <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Hold</div>
                    <PieceMini type={state.hold} pieceTheme={pieceTheme} size={10} />
                  </div>
                  {/* Center stats */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.3rem 0.5rem', gap: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>Lv</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{state.level}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>Lines</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{linesThisLevel}/{effectiveTargetLines}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>Score</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#00d4ff', lineHeight: 1.1 }}>{state.score.toLocaleString()}</div>
                    </div>
                  </div>
                  {/* Next */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.3rem 0.45rem', borderLeft: `1px solid ${epochColor}33`, gap: '0.15rem', minWidth: 58 }}>
                    <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Next</div>
                    {(hideQueue && !state.zoneActive ? [] : state.queue).slice(0, 3).map((t, i) => (
                      <PieceMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
                    ))}
                    {hideQueue && !state.zoneActive && <div style={{ fontSize: '0.9rem', color: epochColor }}>?</div>}
                  </div>
                </div>
              )}

              {/* Zone bar (portrait only, below HUD) */}
              {!focus && (
                <div style={{ height: 4, width: '100%', background: 'rgba(20, 30, 70, 0.8)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, state.zoneActive ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100 : (state.zoneMeter || 0)))}%`, background: state.zoneActive ? 'linear-gradient(90deg, #8844ff, #00cfff)' : state.zoneMeter >= ZONE_MIN_METER ? 'linear-gradient(90deg, #00cfff, #fff)' : 'linear-gradient(90deg, #1e90ff, #00cfff)', transition: 'width 0.15s' }} />
                </div>
              )}

              <SynesthesiaMotionLayer
                className="mobile-canvas-wrap"
                style={{
                  background: 'transparent',
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  paddingBottom: focus && showOnScreenControls ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' : 0,
                }}
              >
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GameCanvas
                      state={{ ...state, queue: hideQueue && !state.zoneActive ? [] : state.queue }}
                      onTap={() => { if (config?.sfxEnabled && !paused) try { playRotateSFX(pieceTheme || 'classic') } catch {}; emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 's3-tap' }); triggerAction('rotateCW'); try { window.dispatchEvent(new Event('bg-beat')) } catch {} }}
                      onTwoFingerTap={() => { if (config?.sfxEnabled && !paused) try { playZoneActivateSFX(pieceTheme || 'classic') } catch {}; triggerAction('activateZone'); try { window.dispatchEvent(new Event('bg-beat')) } catch {} }}
                      onDragBegin={handleDragBegin}
                      onDragEnd={handleDragEnd}
                      onHardDrop={handleHardDrop}
                      onZoomGesture={scale => setZoom(value => Math.max(0.5, Math.min(2, value * scale)))}
                      onRewindGesture={activateRewind}
                      themeOverride={pieceTheme}
                      boardAlpha={boardAlpha}
                    />
                </div>

                {/* Overlays for portrait mode */}
                {hasDilation && dilationRows.map(dr => (
                  <div key={`dil-${dr.row}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(dr.row / VISIBLE_ROWS) * 100}%`, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: dr.type === 'fast' ? 'rgba(255,60,60,0.18)' : 'rgba(60,120,255,0.18)', borderTop: `1px solid ${dr.type === 'fast' ? 'rgba(255,60,60,0.6)' : 'rgba(60,120,255,0.6)'}`, borderBottom: `1px solid ${dr.type === 'fast' ? 'rgba(255,60,60,0.3)' : 'rgba(60,120,255,0.3)'}`, pointerEvents: 'none', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                    <span style={{ fontSize: '0.42rem', color: dr.type === 'fast' ? '#ff6666' : '#6699ff', letterSpacing: '0.1em', opacity: 0.8 }}>{dr.type === 'fast' ? '⚡' : '❄'}</span>
                  </div>
                ))}

                {hasPhantoms && phantoms.map(ph => {
                  const secondsLeft = Math.max(0, (ph.solidifyAt - Date.now()) / 1000)
                  const urgency = 1 - secondsLeft / 10
                  return ph.cells.map((cell, ci) => (
                    <div key={`ph-${ph.id}-${ci}`} style={{ position: 'absolute', left: `${(cell.col / BOARD_WIDTH) * 100}%`, top: `${((cell.row) / VISIBLE_ROWS) * 100}%`, width: `${(1 / BOARD_WIDTH) * 100}%`, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: `rgba(200,150,255,${0.12 + urgency * 0.25})`, border: `1px solid rgba(200,150,255,${0.3 + urgency * 0.5})`, pointerEvents: 'none', zIndex: 4, boxSizing: 'border-box' }} />
                  ))
                })}

                {hasPhantoms && phantoms.map(ph => {
                  const secsLeft = Math.max(0, Math.ceil((ph.solidifyAt - Date.now()) / 1000))
                  const topRow = Math.min(...ph.cells.map(c => c.row))
                  const leftCol = Math.min(...ph.cells.map(c => c.col))
                  return (
                    <div key={`ph-label-${ph.id}`} style={{ position: 'absolute', left: `${(leftCol / BOARD_WIDTH) * 100}%`, top: `${((topRow) / VISIBLE_ROWS) * 100 - 4}%`, fontSize: '0.45rem', color: secsLeft <= 3 ? '#ff8888' : '#cc99ff', fontWeight: 700, pointerEvents: 'none', zIndex: 5, letterSpacing: '0.06em', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                      {secsLeft}s
                    </div>
                  )
                })}

                {hoverGarbage.map(hg => {
                  const secsLeft = Math.max(0, (hg.solidifyAt - Date.now()) / 1000)
                  return (
                    <motion.div key={`hg-${hg.id}`} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(hg.rows / VISIBLE_ROWS) * 100}%`, background: 'rgba(255,80,80,0.12)', border: '2px dashed rgba(255,80,80,0.5)', pointerEvents: 'none', zIndex: 4 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      <div style={{ position: 'absolute', top: 4, right: 8, fontSize: '0.5rem', color: '#ff8888', fontWeight: 700 }}>{secsLeft > 0 ? `⚠ ${Math.ceil(secsLeft)}s` : 'INCOMING'}</div>
                    </motion.div>
                  )
                })}

                {clearLagRows.map((r, i) => (
                  <div key={`lag-${r.id}`} style={{ position: 'absolute', bottom: `${(i / VISIBLE_ROWS) * 100}%`, left: 0, right: 0, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: 'rgba(255,200,100,0.14)', borderTop: '1px solid rgba(255,200,100,0.4)', pointerEvents: 'none', zIndex: 4 }} />
                ))}

                {shrinkRows > 0 && (
                  <motion.div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${(shrinkRows / VISIBLE_ROWS) * 100}%`, background: 'rgba(255,0,0,0.22)', borderBottom: '2px solid rgba(255,0,0,0.7)', pointerEvents: 'none', zIndex: 6, display: 'flex', alignItems: 'flex-end', paddingBottom: 3, justifyContent: 'center' }} animate={{ height: `${(shrinkRows / VISIBLE_ROWS) * 100}%` }} transition={{ duration: 0.5, ease: 'easeInOut' }}>
                    <span style={{ fontSize: '0.42rem', color: '#ff6666', letterSpacing: '0.14em' }}>CEILING ▼</span>
                  </motion.div>
                )}

                {[...stoneCells].map(key => {
                  const [r, c] = key.split(',').map(Number)
                  return (
                    <div key={`stone-${key}`} style={{ position: 'absolute', left: `${(c / BOARD_WIDTH) * 100}%`, top: `${((r - 2) / VISIBLE_ROWS) * 100}%`, width: `${(1 / BOARD_WIDTH) * 100}%`, height: `${(1 / VISIBLE_ROWS) * 100}%`, background: 'rgba(120,120,120,0.6)', border: '1px solid rgba(180,180,180,0.7)', pointerEvents: 'none', zIndex: 5, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.4rem' }}>⬛</div>
                  )
                })}

                <AnimatePresence>
                  {abilityToast && (
                    <motion.div key={toastId} initial={{ opacity: 0, y: 8, scale: 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.94 }} transition={{ duration: 0.22 }} style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.88)', border: `1px solid ${epochColor}cc`, borderRadius: 8, padding: '6px 16px', fontSize: '0.72rem', color: epochColor, letterSpacing: '0.2em', fontWeight: 900, whiteSpace: 'nowrap', zIndex: 25, pointerEvents: 'none', boxShadow: `0 0 18px ${epochColor}55` }}>
                      {abilityToast}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button onClick={() => setFocus(f => !f)} className="ui-toggle-tab" title={focus ? 'Exit Focus' : 'Enter Focus'} aria-label={focus ? 'Exit Focus' : 'Enter Focus'} style={{ right: 0 }}>
                  {focus ? '▲' : '▼'}
                </button>

                {focus && (() => {
                  const zoneReady = state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive
                  const zoneFillPct = Math.max(0, Math.min(100, state.zoneActive ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100 : (state.zoneMeter || 0)))
                  const hpPct = Math.max(0, 100 - Math.min(100, (linesThisLevel / effectiveTargetLines) * 100))
                  return (
                    <div className="fullscreen-mini-hud" style={{ right: 0 }}>
                      <div style={{ width: '100%', padding: '4px 5px 0', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: '0.38rem', color: '#555', letterSpacing: '0.1em', marginBottom: 2, textAlign: 'center' }}>PROGRESS</div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                          <motion.div style={{ height: '100%', background: epochColor, borderRadius: 2 }} animate={{ width: `${hpPct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
                        </div>
                      </div>
                      <div className="fmh-hold">
                        <div className="fmh-label">Hold</div>
                        <PieceMini type={state.hold} pieceTheme={pieceTheme} size={8} />
                      </div>
                      <div className="fmh-zone-wrap">
                        <div className={`fmh-zone-bar${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`} style={{ height: `${zoneFillPct}%` }} />
                      </div>
                      <div className="fmh-next">
                        <div className="fmh-label">Next</div>
                        {(hideQueue && !state.zoneActive ? [] : (state.queue ?? [])).slice(0, 3).map((t, i) => (
                          <PieceMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
                        ))}
                        {hideQueue && !state.zoneActive && <div style={{ fontSize: '0.7rem', color: epochColor }}>?</div>}
                      </div>
                      {hasRewind && (
                        <div style={{ padding: '4px 5px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                          <div style={{ fontSize: '0.38rem', color: '#555', marginBottom: 2, letterSpacing: '0.08em' }}>REWIND</div>
                          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rewindGauge * 100}%`, background: rewindGauge >= 1 ? '#64b4ff' : '#335577', borderRadius: 2 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {paused && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.2em', color: '#fff' }}>PAUSED</div>
                    <div style={{ fontSize: '0.6rem', color: epochColor, letterSpacing: '0.2em' }}>{epoch.title} — {level.title}</div>
                    <div style={{ fontSize: '0.56rem', color: '#555', letterSpacing: '0.14em' }}>{linesThisLevel} / {effectiveTargetLines} lines</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => musicRef.current?.prev?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
                      <button type="button" onClick={() => musicRef.current?.pause?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏸</button>
                      <button type="button" onClick={() => musicRef.current?.resume?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>▶</button>
                      <button type="button" onClick={() => musicRef.current?.next?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏭</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.60rem', color: '#777' }}>Vol</span>
                      <input type="range" min={0} max={1} step={0.01} value={config.musicVolume} onChange={e => { const v = parseFloat(e.target.value); setConfig(p => ({ ...p, musicVolume: v })); musicRef.current?.setVolume?.(v) }} style={{ width: 140 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>⚙ Settings</button>
                    </div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={togglePause} style={{ background: 'none', border: `1px solid ${epochColor}`, color: epochColor, borderRadius: 6, padding: '8px 22px', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.16em', fontFamily: 'inherit', fontWeight: 700 }}>▶ RESUME</motion.button>
                    <button onClick={() => navigate('/s3', { replace: true })} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#bbb', borderRadius: 6, padding: '7px 18px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>← S3 MAP</button>
                    <button onClick={() => { togglePause(); pendingResetRef.current = true; setPhase(PHASE.STORY) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#555', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>RESTART</button>
                  </div>
                )}
              </SynesthesiaMotionLayer>
            </>
          )}

          {showOnScreenControls && !focus && !isLandscape && (
            <TouchControls
              onPress={handlePress}
              onRelease={handleRelease}
              onHardDrop={handleHardDrop}
              haptic={config.hapticEnabled}
            />
          )}

          {showOnScreenControls && focus && !isLandscape && (
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, pointerEvents: 'auto' }}>
              <TouchControls
                onPress={handlePress}
                onRelease={handleRelease}
                onHardDrop={handleHardDrop}
                haptic={config.hapticEnabled}
              />
            </div>
          )}
        </div>
      )}

      {/* Settings overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SettingsPage config={config} onConfigChange={setConfig} onClose={() => setShowSettings(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Complete screen ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === PHASE.COMPLETE && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
              style={{ textAlign: 'center', background: 'rgba(5,0,8,0.95)', border: `1px solid ${epochColor}66`, borderRadius: 16, padding: '2rem', maxWidth: 400, width: '100%', backdropFilter: 'blur(12px)' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: 8, filter: `drop-shadow(0 0 16px ${epochColor})` }}>✦</div>
              <div style={{ fontSize: '0.5rem', color: epochColor, letterSpacing: '0.3em', marginBottom: 6, textTransform: 'uppercase' }}>
                Sequence Stabilized
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '0.1em', marginBottom: 4 }}>
                {level.title}
              </div>
              <div style={{ fontSize: '0.64rem', color: '#888', letterSpacing: '0.12em', marginBottom: 16 }}>
                {level.storyAfter}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 18 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.14em' }}>SCORE</div>
                  <div style={{ fontSize: '1.2rem', color: epochColor, fontWeight: 900 }}>{finalScore.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.14em' }}>LINES</div>
                  <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 900 }}>{finalLines}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nextLevel && (
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/s3/${nextLevel.epochId}/${nextLevel.levelId}`, { replace: true, state: { fromS3Complete: true } })}
                    style={{ background: epochColor, border: 'none', color: '#000', borderRadius: 8, padding: '11px 0', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>
                    NEXT LEVEL →
                  </motion.button>
                )}
                {!nextLevel && (
                  <div style={{ padding: '10px 0', fontSize: '0.75rem', color: epochColor, letterSpacing: '0.2em', fontWeight: 900 }}>
                    SEASON 3 COMPLETE ✦
                  </div>
                )}
                <button onClick={() => { pendingResetRef.current = true; setPhase(PHASE.STORY) }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#ccc', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontSize: '0.76rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>
                  RETRY
                </button>
                <button onClick={() => navigate('/s3', { replace: true })}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#666', borderRadius: 8, padding: '9px 0', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>
                  ← Season 3 Map
                </button>
              </div>
              {saving && <div style={{ marginTop: 10, fontSize: '0.55rem', color: '#555', letterSpacing: '0.12em' }}>Saving…</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fail screen ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === PHASE.FAIL && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              style={{ textAlign: 'center', background: 'rgba(5,0,8,0.95)', border: '1px solid #ef444466', borderRadius: 16, padding: '2rem', maxWidth: 380, width: '100%' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>☠</div>
              <div style={{ fontSize: '0.5rem', color: '#ef4444', letterSpacing: '0.3em', marginBottom: 6, textTransform: 'uppercase' }}>SYSTEM OVERFLOW</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.12em', marginBottom: 4 }}>{level.title}</div>
              <div style={{ fontSize: '0.64rem', color: '#888', marginBottom: 20 }}>The fracture consumed you.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { pendingResetRef.current = true; setPhase(PHASE.STORY) }}
                  style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '11px 0', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>
                  RETRY
                </motion.button>
                <button onClick={() => navigate('/s3', { replace: true })}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#666', borderRadius: 8, padding: '9px 0', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>
                  ← Season 3 Map
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
