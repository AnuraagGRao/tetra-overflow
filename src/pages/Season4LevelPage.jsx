// ─── Season 4: The Genesis Protocol ───────────────────────────────────────────
// Gameplay page for Season 4 levels
// Structure mirrors Season3LevelPage but with S4-specific mechanics and story

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress } from '../firebase/db'
import SettingsPage from '../components/SettingsPage'
import { findS4Level, getNextS4Level, isS4LevelUnlocked, isS4Unlocked, SEASON4_SECTORS } from '../logic/storyData_s4'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../logic/tetrominoes'
import { TetrisEngine, GAME_MODE, ZONE_MIN_METER, ZONE_DURATION_MS } from '../logic/gameEngine'
import { setSfxVolume, setSfxDuck, playMoveSFX, playRotateSFX, playHoldSFX, playSoftDropSFX, playHardDropSFX, playLockSFX, playLineClearSFX, playTetrisSFX, playZoneActivateSFX } from '../audio/gameSfx'
import GameCanvas from '../components/GameCanvas'
import PieceMini from '../components/TetrominoMini'
import TouchControls from '../components/TouchControls'
import BackgroundCanvas from '../components/BackgroundCanvas'
import SynesthesiaMotionLayer from '../components/SynesthesiaMotionLayer'
import { Season4MusicManager } from '../audio/season4MusicManager'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import { useResponsiveHUD } from '../hooks/useResponsiveHUD'
import LandscapeGameLayout from '../components/LandscapeGameLayout'
import ZoomControl from '../components/ZoomControl'
import FocusMiniHud from '../components/FocusMiniHud'
import { GAME_CONFIG_KEY as CONFIG_KEY, readGameConfig as loadConfig } from '../logic/gameConfig'
import { useStoryProgress } from '../hooks/useStoryProgress'

const MAX_FRAME_MS = 34
const VISIBLE_ROWS = BOARD_HEIGHT - 2

const S4_BG_FALLBACKS = {
  pure_white_grid: 'classic',
  gold_wireframe: 'stellar',
  corrupted_white: 'geometry',
  void_purple: 'inferno',
  black_hole_swirl: 'inferno',
  upside_down_matrix: 'warp',
  fractal_madness: 'geometry',
  mirror_dimension: 'stellar',
  glitch_red: 'inferno',
  shattered_mirror: 'inferno',
  matrix_green_rain: 'stellar',
  obsidian_core: 'geometry',
  prismatic_void: 'warp',
}

const KEY_BINDINGS = {
  ArrowLeft: { held: 'left' },
  ArrowRight: { held: 'right' },
  ArrowDown: { held: 'softDrop' },
  ArrowUp: { action: 'rotateCW' },
  KeyZ: { action: 'rotateCCW' },
  Space: { action: 'hardDrop' },
  KeyX: { action: 'rotate180' },
  KeyC: { action: 'hold' },
  Escape: { action: 'pause' },
  KeyP: { action: 'pause' },
}

const PHASE = { STORY: 'story', LOADING: 'loading', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }

export default function Season4LevelPage() {
  const { sectorId, levelId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // ── Lifecycle & Data ───────────────────────────────────────────────────────
  const levelData = useMemo(() => findS4Level(sectorId, levelId), [sectorId, levelId])
  const { sector, level } = levelData || {}
  const sectorColor = sector?.color ?? '#ffffff'
  const pieceTheme = useMemo(() => BG_TYPE_TO_PIECE_THEME[S4_BG_FALLBACKS[level?.bgType] ?? 'classic'] ?? 'classic', [level?.bgType])
  const { progress, loading: progressLoading } = useStoryProgress(user?.uid)

  const s4Unlocked = useMemo(() => isS4Unlocked(progress), [progress])
  const levelUnlocked = useMemo(() => isS4LevelUnlocked(sectorId, levelId, progress), [sectorId, levelId, progress])
  const bypassUnlock = !!(location.state && location.state.fromS4Complete)

  // ── Config & Game State ────────────────────────────────────────────────────
  const [config, setConfig] = useState(loadConfig)

  const [zoom, setZoom] = useState(() => {
    const saved = Number(localStorage.getItem('tetris-zoom') || 1)
    return saved >= 0.5 && saved <= 2.0 ? saved : 1
  })

  const engine = useMemo(() => new TetrisEngine(), [])
  const [phase, setPhase] = useState(PHASE.STORY)
  const [paused, setPaused] = useState(false)
  const [state, setState] = useState(engine.getState())
  const [linesThisLevel, setLinesThisLevel] = useState(0)
  const [easyMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [focus, setFocus] = useState(() => {
    try { return localStorage.getItem('focus-mode') === '1' } catch { return false }
  })
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)
  const hudSizing = useResponsiveHUD(isLandscape)

  const levelStartLinesRef = useRef(0)
  const pendingResetRef = useRef(true)
  const musicRef = useRef(null)
  const heldRef = useRef({ left: false, right: false, softDrop: false })
  const actionRef = useRef({})

  // ── Persist Config ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    } catch {}
  }, [config])

  useEffect(() => {
    try {
      engine.setSettings({ das: config.das, arr: config.arr })
    } catch {}
  }, [config.das, config.arr, engine])

  useEffect(() => {
    try {
      setSfxVolume(config.sfxVolume ?? 1.0)
    } catch {}
  }, [config.sfxVolume])

  useEffect(() => {
    try { localStorage.setItem('focus-mode', focus ? '1' : '0') } catch {}
  }, [focus])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.code === 'KeyF') setFocus(value => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Reset on level change
  useEffect(() => {
    pendingResetRef.current = true
    levelStartLinesRef.current = 0
    setPhase(PHASE.STORY)
  }, [sectorId, levelId])

  // ── Responsive Layout ──────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Engine Reset ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === PHASE.GAME && pendingResetRef.current) {
      pendingResetRef.current = false
      engine.reset(GAME_MODE.NORMAL)
      levelStartLinesRef.current = 0
      const targetLevel = Math.max(1, Math.round((level?.gravityMult ?? 1.0) * 5 + 1))
      engine.level = targetLevel
      engine.storyLevelOffset = targetLevel
      engine.storyLinesOffset = 0
    }
  }, [phase, engine, level])

  // ── Music Manager ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.GAME || !level || !sectorId) return
    const initMusic = async () => {
      try {
        if (!musicRef.current) {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
          if (audioCtx.state === 'suspended') await audioCtx.resume()
          musicRef.current = new Season4MusicManager(audioCtx)
        }
        musicRef.current.setPlaylist(sectorId)
        musicRef.current.setVolume(config.musicVolume ?? 1.0)
      } catch (e) {
        console.error('Music init failed:', e)
      }
    }
    initMusic()
    return () => {
      if (musicRef.current) {
        musicRef.current.stop()
      }
    }
  }, [phase, level, sectorId, config.musicVolume])

  // ── Game Loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.GAME || !level) return
    let lastTime = Date.now()
    const gameLoop = setInterval(() => {
      const now = Date.now()
      const delta = Math.min(now - lastTime, MAX_FRAME_MS)
      lastTime = now
      if (paused) return
      const actions = actionRef.current
      actionRef.current = {}
      engine.update(delta, heldRef.current, actions)
      setState(engine.getState())
      setLinesThisLevel(Math.max(0, engine.lines - levelStartLinesRef.current))
      const effectiveTarget = easyMode ? (level.easyTargetLines || level.targetLines) : level.targetLines
      if (engine.lines - levelStartLinesRef.current >= effectiveTarget) {
        setPhase(PHASE.COMPLETE)
      } else if (engine.gameOver) {
        setPhase(PHASE.FAIL)
      }
    }, MAX_FRAME_MS)
    return () => clearInterval(gameLoop)
  }, [phase, engine, level, paused, easyMode])

  // ── Input Handlers ────────────────────────────────────────────────────────
  const triggerAction = useCallback(
    name => {
      if (name === 'pause') {
        const nextPaused = !paused
        setPaused(nextPaused)
        engine.togglePause()
        if (nextPaused) musicRef.current?.pause?.()
        else musicRef.current?.resume?.()
        return
      }
      if (paused || phase !== PHASE.GAME) return
      switch (name) {
        case 'moveLeft':
          heldRef.current.left = true
          break
        case 'moveRight':
          heldRef.current.right = true
          break
        case 'softDrop':
          heldRef.current.softDrop = true
          break
        case 'rotateCW':
          playRotateSFX(pieceTheme)
          actionRef.current.rotateCW = true
          break
        case 'rotateCCW':
          playRotateSFX(pieceTheme)
          actionRef.current.rotateCCW = true
          break
        case 'rotate180':
          playRotateSFX(pieceTheme)
          actionRef.current.rotate180 = true
          break
        case 'hardDrop':
          playHardDropSFX()
          actionRef.current.hardDrop = true
          break
        case 'hold':
          playHoldSFX()
          actionRef.current.hold = true
          break
        case 'activateZone':
          if (state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive) {
            playZoneActivateSFX(pieceTheme)
            actionRef.current.activateZone = true
          }
          break
        case 'pause':
          setPaused(!paused)
          break
      }
    },
    [paused, phase, engine, state, pieceTheme]
  )

  const handlePress = (button, isHeld) => {
    if (isHeld) {
      if (button === 'left' || button === 'right' || button === 'softDrop') heldRef.current[button === 'softDrop' ? 'softDrop' : button] = true
      return
    }
    triggerAction(button)
  }

  const handleRelease = (button, isHeld) => {
    if (!isHeld) return
    if (button === 'left' || button === 'right' || button === 'softDrop') heldRef.current[button === 'softDrop' ? 'softDrop' : button] = false
  }

  const handleHardDrop = () => {
    triggerAction('hardDrop')
  }

  useEffect(() => {
    const bindings = {
      ArrowLeft: { held: 'left' }, ArrowRight: { held: 'right' }, ArrowDown: { held: 'softDrop' },
      ArrowUp: { action: 'rotateCW' }, KeyZ: { action: 'rotateCCW' }, KeyX: { action: 'rotate180' },
      KeyC: { action: 'hold' }, Space: { action: 'hardDrop' }, Escape: { action: 'pause' }, KeyP: { action: 'pause' },
    }
    const down = event => {
      const binding = bindings[event.code]
      if (!binding) return
      event.preventDefault()
      if (event.repeat) return
      if (binding.held) heldRef.current[binding.held] = true
      if (binding.action === 'pause') triggerAction('pause')
      else if (binding.action) triggerAction(binding.action)
    }
    const up = event => {
      const binding = bindings[event.code]
      if (!binding?.held) return
      event.preventDefault()
      heldRef.current[binding.held] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [triggerAction])

  useEffect(() => {
    const actionMap = { 12: 'hardDrop', 0: 'rotateCCW', 1: 'rotateCW', 2: 'rotateCCW', 3: 'rotate180', 4: 'hold', 5: 'hold', 6: 'activateZone', 7: 'activateZone', 9: 'pause' }
    const previousButtons = {}
    let frameId
    const poll = () => {
      for (const gamepad of navigator.getGamepads?.() || []) {
        if (!gamepad) continue
        for (const [button, action] of Object.entries(actionMap)) {
          const pressed = gamepad.buttons[button]?.pressed === true
          if (pressed && !previousButtons[button]) triggerAction(action)
          previousButtons[button] = pressed
        }
        heldRef.current.left = gamepad.buttons[14]?.pressed || gamepad.axes[2] < -0.35
        heldRef.current.right = gamepad.buttons[15]?.pressed || gamepad.axes[2] > 0.35
        heldRef.current.softDrop = gamepad.buttons[13]?.pressed || gamepad.axes[3] > 0.35
      }
      frameId = requestAnimationFrame(poll)
    }
    frameId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frameId)
  }, [triggerAction])

  const togglePause = () => {
    const nextPaused = !paused
    setPaused(nextPaused)
    engine.togglePause()
    if (nextPaused) musicRef.current?.pause?.()
    else musicRef.current?.resume?.()
  }

  // ── SFX ────────────────────────────────────────────────────────────────────
  const prevStateRef = useRef(null)
  useEffect(() => {
    if (phase !== PHASE.GAME) { prevStateRef.current = state; return }
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
  }, [state, phase, pieceTheme])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleComplete = () => {
    if (!user?.uid || !level) return
    const nextLevel = getNextS4Level(sectorId, levelId)
    const finalScore = state.score
    const finalLines = linesThisLevel
    saveStoryProgress(user.uid, `s4_${sectorId}`, levelId, finalScore, finalLines)
      .catch(e => console.error('Failed to save progress:', e))
    if (nextLevel) {
      navigate(`/s4/${nextLevel.sectorId}/${nextLevel.levelId}`, { state: { fromS4Complete: true } })
    } else {
      navigate('/s4', { state: { completed: true } })
    }
  }

  const handleBack = () => {
    navigate(`/s4`)
  }

  if (progressLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#000', color: '#0f0', fontFamily: 'monospace' }}>INITIALIZING…</div>
  }

  if (!s4Unlocked || (!levelUnlocked && !bypassUnlock)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#000', color: '#888', gap: '1rem' }}>
        <div>🔒 LEVEL LOCKED</div>
        <button onClick={handleBack} style={{ padding: '0.5rem 1rem', background: '#222', border: '1px solid #666', color: '#aaa', cursor: 'pointer' }}>
          ← Back
        </button>
      </div>
    )
  }

  // ── Start Game ─────────────────────────────────────────────────────────────
  if (phase === PHASE.STORY) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#000', color: '#fff', padding: '2rem', gap: '1.5rem', textAlign: 'center', fontFamily: 'monospace' }}>
        <div style={{ fontSize: '0.8rem', color: sectorColor, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          SECTOR {sectorId.toUpperCase()} • {sector?.title}
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>{level?.title}</div>
        <div style={{ fontSize: '0.9rem', color: '#888', maxWidth: 600, lineHeight: 1.6 }}>{level?.storyBefore}</div>
        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem' }}>Target: {easyMode ? level?.easyTargetLines : level?.targetLines} lines</div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button onClick={handleBack} style={{ padding: '0.6rem 1.2rem', background: '#222', border: '1px solid #666', color: '#aaa', cursor: 'pointer', borderRadius: 6 }}>
            ← BACK
          </button>
          <button
            onClick={() => {
              setPhase(PHASE.LOADING)
              pendingResetRef.current = true
              setTimeout(() => setPhase(PHASE.GAME), 300)
            }}
            style={{ padding: '0.6rem 1.2rem', background: sectorColor, border: `1px solid ${sectorColor}`, color: '#000', cursor: 'pointer', borderRadius: 6, fontWeight: 700 }}
          >
            START →
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Main Gameplay ──────────────────────────────────────────────────────────
  if (phase === PHASE.GAME || phase === PHASE.LOADING) {
    const effectiveTarget = easyMode ? (level?.easyTargetLines || level?.targetLines) : level?.targetLines

    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100dvh', background: '#000', color: '#fff', overflow: 'hidden', position: 'relative' }}>
        {isLandscape && <ZoomControl zoom={zoom} onChange={setZoom} />}
        <BackgroundCanvas bgType={S4_BG_FALLBACKS[level?.bgType] ?? 'pure_white_grid'} />

        {/* Story status — portrait mode only */}
        {!focus && !isLandscape && (
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: hudSizing.hudPadding, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.85rem', letterSpacing: '0.1em', flexShrink: 0, backdropFilter: 'blur(6px)', gap: 8, flexWrap: 'nowrap', minHeight: hudSizing.hudMinHeight }}>
            <span style={{ fontSize: hudSizing.statsLabel, color: sectorColor, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{level?.title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => triggerAction('activateZone')}
                disabled={state.zoneMeter < ZONE_MIN_METER || state.zoneActive}
                style={{ background: state.zoneActive ? 'rgba(0,229,255,0.18)' : state.zoneMeter >= ZONE_MIN_METER ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#22d3ee' : 'rgba(255,255,255,0.1)'}`, color: state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#80eaff' : '#555', cursor: state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive ? 'pointer' : 'default', fontSize: '0.6rem', padding: '2px 7px', borderRadius: 6, fontFamily: 'inherit' }}
              >
                {state.zoneActive ? `ZONE ${Math.ceil(state.zoneTimer / 1000)}s` : 'ZONE'}
              </button>
              <span style={{ color: '#555', fontSize: '0.62rem' }}>{Math.min(linesThisLevel, effectiveTarget)}/{effectiveTarget}</span>
              <button onClick={togglePause} aria-label="Pause" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', cursor: 'pointer', fontSize: '0.6rem', padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit' }}>⏸</button>
            </div>
          </div>
        )}

        {!isLandscape && (() => {
          const progressPct = Math.max(0, Math.min(100, 100 - (linesThisLevel / effectiveTarget) * 100))
          const progressColor = progressPct > 60 ? sectorColor : progressPct > 30 ? '#f59e0b' : '#ef4444'
          return (
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
              {[25, 50, 75].map(percent => (
                <div key={percent} style={{ position: 'absolute', top: 0, bottom: 0, left: `${percent}%`, width: 1, background: 'rgba(0,0,0,0.4)', zIndex: 2 }} />
              ))}
              <motion.div style={{ position: 'absolute', inset: '0 auto 0 0', background: progressColor, boxShadow: `0 0 6px ${progressColor}88` }} animate={{ width: `${progressPct}%`, background: progressColor }} transition={{ duration: 0.4, ease: 'easeOut' }} />
            </div>
          )
        })()}

        {/* Portrait HUD bar */}
        {!focus && !isLandscape && (
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'stretch', gap: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderBottom: `1px solid ${sectorColor}33`, width: '100%', flexShrink: 0, overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.3rem 0.45rem', borderRight: `1px solid ${sectorColor}33`, gap: '0.1rem', minWidth: 58 }}>
              <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Hold</div>
              <PieceMini type={state.hold} pieceTheme={pieceTheme} size={10} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.3rem 0.5rem', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>Lv</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{state.level}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>Lines</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                  {linesThisLevel}/{effectiveTarget}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>Score</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#00d4ff', lineHeight: 1.1 }}>{state.score.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.3rem 0.45rem', borderLeft: `1px solid ${sectorColor}33`, gap: '0.15rem', minWidth: 58 }}>
              <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Next</div>
              {state.queue.slice(0, 3).map((t, i) => (
                <PieceMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
              ))}
            </div>
          </div>
        )}

        {/* Zone meter bar */}
        {!focus && !isLandscape && (
          <div style={{ height: 4, width: '100%', background: 'rgba(20, 30, 70, 0.8)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, state.zoneActive ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100 : (state.zoneMeter || 0)))}%`,
                background: state.zoneActive ? 'linear-gradient(90deg, #8844ff, #00cfff)' : state.zoneMeter >= ZONE_MIN_METER ? 'linear-gradient(90deg, #00cfff, #fff)' : 'linear-gradient(90deg, #1e90ff, #00cfff)',
                transition: 'width 0.15s',
              }}
            />
          </div>
        )}

        {/* Canvas area */}
        {isLandscape && (
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
            targetLines={effectiveTarget}
            linesThisLevel={linesThisLevel}
            epochColor={sectorColor}
            onPause={togglePause}
            onZoom={() => {}}
            onSettings={() => setShowSettings(true)}
          >
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GameCanvas
                state={state}
                onTap={() => triggerAction('rotateCW')}
                onTwoFingerTap={() => triggerAction('activateZone')}
                onDragBegin={direction => {
                  if (direction === 'up') triggerAction('hold')
                  else if (direction === 'left' || direction === 'right' || direction === 'down') handlePress(direction === 'down' ? 'softDrop' : direction, true)
                }}
                onDragEnd={direction => handleRelease(direction === 'down' ? 'softDrop' : direction, direction !== 'up')}
                onHardDrop={handleHardDrop}
                onZoomGesture={scale => setZoom(value => Math.max(0.5, Math.min(2, value * scale)))}
                themeOverride={pieceTheme}
                screenShakeMultiplier={config.screenShakeMultiplier ?? 1.0}
              />
              </div>
            </div>
          </LandscapeGameLayout>
        )}

        {!isLandscape && (
          <SynesthesiaMotionLayer className="mobile-canvas-wrap" style={{ background: 'transparent', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingBottom: focus && config.showOnScreenControls ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' : 0 }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GameCanvas
                state={state}
                onTap={() => triggerAction('rotateCW')}
                onTwoFingerTap={() => triggerAction('activateZone')}
                onDragBegin={direction => {
                  if (direction === 'up') triggerAction('hold')
                  else if (direction === 'left' || direction === 'right' || direction === 'down') handlePress(direction === 'down' ? 'softDrop' : direction, true)
                }}
                onDragEnd={direction => handleRelease(direction === 'down' ? 'softDrop' : direction, direction !== 'up')}
                onHardDrop={handleHardDrop}
                onZoomGesture={scale => setZoom(value => Math.max(0.5, Math.min(2, value * scale)))}
                themeOverride={pieceTheme}
                screenShakeMultiplier={config.screenShakeMultiplier ?? 1.0}
              />
            </div>

            <button onClick={() => setFocus(value => !value)} className="ui-toggle-tab" title={focus ? 'Exit Focus' : 'Enter Focus'} aria-label={focus ? 'Exit Focus' : 'Enter Focus'} style={{ right: 0 }}>
              {focus ? '▲' : '▼'}
            </button>

            {focus && (
              <FocusMiniHud
                hold={state.hold}
                queue={state.queue}
                pieceTheme={pieceTheme}
                zoneMeter={state.zoneMeter}
                zoneActive={state.zoneActive}
                zoneTimer={state.zoneTimer}
                zoneDuration={state.zoneDuration}
                accentColor={sectorColor}
                header={(
                  <div style={{ width: '100%', padding: '4px 5px 0', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.38rem', color: '#555', letterSpacing: '0.1em', marginBottom: 2, textAlign: 'center' }}>PROGRESS</div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(0, 100 - Math.min(100, (linesThisLevel / effectiveTarget) * 100))}%`, background: sectorColor, borderRadius: 2 }} />
                    </div>
                  </div>
                )}
              />
            )}
          </SynesthesiaMotionLayer>
        )}

        {/* Touch controls */}
        {config.showOnScreenControls && !focus && (
          <TouchControls onPress={handlePress} onRelease={handleRelease} onHardDrop={handleHardDrop} haptic={config.hapticEnabled} />
        )}
        {config.showOnScreenControls && focus && !isLandscape && (
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, pointerEvents: 'auto' }}>
            <TouchControls onPress={handlePress} onRelease={handleRelease} onHardDrop={handleHardDrop} haptic={config.hapticEnabled} />
          </div>
        )}

        {/* Pause overlay */}
        {paused && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150 }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ textAlign: 'center', gap: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.18em' }}>PAUSED</div>
              <div style={{ fontSize: '0.65rem', color: sectorColor, letterSpacing: '0.12em' }}>SECTOR {sectorId?.toUpperCase()} › {level?.title}</div>
              <div style={{ fontSize: '0.58rem', color: '#777' }}>Lv {state.level} · {linesThisLevel} / {effectiveTarget} lines</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => musicRef.current?.prev?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', padding: '5px 12px', cursor: 'pointer' }}>⏮</button>
                <button type="button" onClick={() => musicRef.current?.pause?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', padding: '5px 12px', cursor: 'pointer' }}>⏸</button>
                <button type="button" onClick={() => musicRef.current?.resume?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', padding: '5px 12px', cursor: 'pointer' }}>▶</button>
                <button type="button" onClick={() => musicRef.current?.next?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', padding: '5px 12px', cursor: 'pointer' }}>⏭</button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6rem', color: '#888' }}>
                Vol
                <input type="range" min="0" max="1" step="0.01" value={config.musicVolume} onChange={e => { const value = +e.target.value; setConfig(prev => ({ ...prev, musicVolume: value })); musicRef.current?.setVolume?.(value) }} />
              </label>
              <button type="button" onClick={() => setShowSettings(true)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', padding: '6px 16px', cursor: 'pointer' }}>⚙ SETTINGS</button>
              <button type="button" onClick={togglePause} style={{ padding: '0.7rem 2rem', background: 'none', border: `1px solid ${sectorColor}`, color: sectorColor, fontWeight: 700, cursor: 'pointer', borderRadius: 6, fontSize: '0.9rem' }}>▶ RESUME</button>
              <button type="button" onClick={() => navigate('/s4')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#bbb', padding: '6px 16px', cursor: 'pointer' }}>← SEASON MAP</button>
              <button type="button" onClick={() => { togglePause(); pendingResetRef.current = true; setPhase(PHASE.GAME) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#777', padding: '6px 16px', cursor: 'pointer' }}>RESTART LEVEL</button>
            </motion.div>
          </div>
        )}

        {/* Settings modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem', overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <SettingsPage config={config} onConfig={setConfig} onClose={() => setShowSettings(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Complete Screen ───────────────────────────────────────────────────────
  if (phase === PHASE.COMPLETE) {
    const nextLevel = getNextS4Level(sectorId, levelId)
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#000', color: '#fff', padding: '2rem', gap: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 900 }}>✓ CLEARED</div>
        <div style={{ fontSize: '0.9rem', color: '#888', maxWidth: 600 }}>{level?.storyAfter}</div>
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Score: {state.score.toLocaleString()}</div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          {nextLevel ? (
            <button onClick={handleComplete} style={{ padding: '0.6rem 1.2rem', background: sectorColor, border: `1px solid ${sectorColor}`, color: '#000', cursor: 'pointer', borderRadius: 6, fontWeight: 700 }}>
              NEXT →
            </button>
          ) : (
            <button onClick={handleComplete} style={{ padding: '0.6rem 1.2rem', background: sectorColor, border: `1px solid ${sectorColor}`, color: '#000', cursor: 'pointer', borderRadius: 6, fontWeight: 700 }}>
              SEASON COMPLETE →
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // ── Fail Screen ────────────────────────────────────────────────────────────
  if (phase === PHASE.FAIL) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'radial-gradient(circle at 50% 42%, rgba(255,55,55,0.16), transparent 48%), #030006', color: '#fff', padding: '2rem', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,70,70,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,70,70,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)' }} />
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} style={{ position: 'relative', width: 'min(380px, 100%)', background: 'rgba(10,0,8,0.94)', border: `1px solid ${sectorColor}66`, borderRadius: 16, padding: '2rem', boxShadow: `0 0 48px ${sectorColor}22`, fontFamily: 'monospace' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>☠</div>
          <div style={{ fontSize: '0.52rem', color: '#ff5b66', letterSpacing: '0.3em', marginBottom: 8 }}>GENESIS COLLAPSE</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.1em', marginBottom: 6 }}>{level?.title}</div>
          <div style={{ fontSize: '0.64rem', color: '#999', lineHeight: 1.6, marginBottom: 18 }}>The structure exceeded its stability threshold. Recompile the tower and try again.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 18 }}>
            <div><div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.12em' }}>SCORE</div><div style={{ fontSize: '1rem', color: '#fff', fontWeight: 900 }}>{state.score.toLocaleString()}</div></div>
            <div><div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.12em' }}>LEVEL</div><div style={{ fontSize: '1rem', color: sectorColor, fontWeight: 900 }}>{state.level}</div></div>
            <div><div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.12em' }}>LINES</div><div style={{ fontSize: '1rem', color: '#fff', fontWeight: 900 }}>{linesThisLevel}</div></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => { pendingResetRef.current = true; setPhase(PHASE.STORY) }} style={{ background: '#ff5b66', border: 'none', color: '#160006', borderRadius: 8, padding: '11px 0', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', fontFamily: 'inherit' }}>RETRY LEVEL</button>
            <button onClick={handleBack} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.16)', color: '#aaa', borderRadius: 8, padding: '9px 0', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>← SEASON 4 MAP</button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return null
}
