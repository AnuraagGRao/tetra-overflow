import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress, unlockItem, saveGameResult, markEasyModePlayed, setActiveBadge, awardStoryChapterMilestone } from '../firebase/db'
import SettingsPage from '../components/SettingsPage'
import { findLevel, getNextLevel } from '../logic/storyData'
import { PIECES } from '../logic/tetrominoes'
import { TetrisEngine, GAME_MODE, ZONE_MIN_METER, ZONE_DURATION_MS } from '../logic/gameEngine'
import { setSfxVolume, setSfxDuck, playMoveSFX, playRotateSFX, playHoldSFX, playSoftDropSFX, playHardDropSFX, playLockSFX, playLineClearSFX, playTetrisSFX, playZoneActivateSFX } from '../audio/gameSfx'
import GameCanvas, { PIECE_COLOR_MAPS } from '../components/GameCanvas'
import FocusHud from '../components/FocusHud'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import TouchControls from '../components/TouchControls'
import BackgroundCanvas from '../components/BackgroundCanvas'
import SynesthesiaMotionLayer from '../components/SynesthesiaMotionLayer'
import { StoryMusicManager } from '../audio/storyMusicManager'
import { emitSynesthesia, SYNESTHESIA_EVENT } from '../logic/synesthesiaBus'
import { hardResetAndReload } from '../logic/hardReset'
import GlitchOverlay from '../components/GlitchOverlay'

// Uses shared mapping in logic/themeMappings.js

// Get piece color for a given type + piece theme
function getPieceColor(type, theme) {
  return (PIECE_COLOR_MAPS[theme]?.[type]) ?? PIECES[type]?.color ?? '#888888'
}

// (SFX volume is managed inside the component via config effects)

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
}

const MAX_FRAME_MS = 34

// ─── Mini piece preview canvas ────────────────────────────────────────────────
function PieceMini({ type, pieceTheme, size = 11 }) {
  const canvasRef = useRef(null)
  const color = type ? getPieceColor(type, pieceTheme) : '#333'
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
    const tw = colMax - colMin + 1, th = filled.length
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

// ─── Minimal game loop hook ────────────────────────────────────────────────────
// levelStartLinesRef: ref to the engine line count when this level started
// levelKey: changes whenever the level advances — resets the completion guard
function useStoryGameLoop(engine, targetLines, levelStartLinesRef, levelKey, onComplete, storyMusicRef, beatRef, active = true) {
  const heldRef   = useRef({ left: false, right: false, softDrop: false })
  const actionRef = useRef({})
  const [state, setState] = useState(() => engine.getState())
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const prevGameOverRef = useRef(false)
  const tSpinsRef = useRef(0)
  const iPieceLinesRef = useRef(0)
  const piecesPlacedRef = useRef(0)
  const holdUsesRef = useRef(0)
  const tetrisClearsRef = useRef(0)
  const hardDropsRef = useRef(0)
  const prevPieceTypeRef = useRef(null)

  const triggerAction = useCallback((action) => {
    actionRef.current[action] = true
  }, [])

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    engine.togglePause()
    if (pausedRef.current) storyMusicRef?.current?.pause()
    else storyMusicRef?.current?.resume()
  }, [engine, storyMusicRef])

  const handlePress = useCallback((key, isHeld) => {
    if (isHeld) { heldRef.current[key] = true }
    else triggerAction(key)
  }, [triggerAction])

  const handleRelease = useCallback((key) => {
    heldRef.current[key] = false
  }, [])

  // Keyboard
  useEffect(() => {
    const down = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b) return
      ev.preventDefault(); if (ev.repeat) return
      if (b.held) {
        heldRef.current[b.held] = true
        if (b.held === 'left' || b.held === 'right') emitSynesthesia(SYNESTHESIA_EVENT.MOVE, { intensity: 0.9, source: 'story-keyboard' })
        if (b.held === 'softDrop') emitSynesthesia(SYNESTHESIA_EVENT.SOFT_DROP, { intensity: 0.82, source: 'story-keyboard' })
        try { window.dispatchEvent(new Event('bg-beat')) } catch {}
      }
      if (b.action) {
        if (b.action === 'pause') {
          togglePause()
        } else {
          actionRef.current[b.action] = true
          if (b.action === 'rotateCW' || b.action === 'rotateCCW' || b.action === 'rotate180') emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 'story-keyboard' })
          if (b.action === 'hardDrop') emitSynesthesia(SYNESTHESIA_EVENT.HARD_DROP, { intensity: 1.22, source: 'story-keyboard' })
          try { window.dispatchEvent(new Event('bg-beat')) } catch {}
        }
      }
    }
    const up = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b?.held) return
      ev.preventDefault(); heldRef.current[b.held] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [engine, togglePause])

  // rAF loop — levelKey in deps resets prevGameOverRef for each new level
  useEffect(() => {
    prevGameOverRef.current = false // reset completion guard for this level/attempt
    tSpinsRef.current = 0
    iPieceLinesRef.current = 0
    piecesPlacedRef.current = 0
    holdUsesRef.current = 0
    tetrisClearsRef.current = 0
    hardDropsRef.current = 0
    prevPieceTypeRef.current = null
    let frameId, lastTime = performance.now()
    const frame = (now) => {
      if (!active) {
        setState(engine.getState())
        frameId = requestAnimationFrame(frame)
        return
      }

      const dt = Math.min(now - lastTime, MAX_FRAME_MS); lastTime = now

      const actions = actionRef.current
      actionRef.current = {}

      engine.update(dt, heldRef.current, actions)

      const ns = engine.getState()
      if (ns.lastClear) {
        const spinType = ns.lastClear.spinType
        const lines = ns.lastClear.lines || 0
        const isSpin = spinType === 'tSpin' || spinType === 'allSpin' || spinType === 'tSpinMini'
        if (isSpin) emitSynesthesia(SYNESTHESIA_EVENT.T_SPIN, { intensity: lines >= 2 ? 1.45 : 1.18, lines })
        else if (lines > 0) emitSynesthesia(SYNESTHESIA_EVENT.LINE_CLEAR, { intensity: Math.min(1.5, 0.9 + lines * 0.2), lines })
        if (spinType === 'tSpin' || spinType === 'tSpinMini') tSpinsRef.current += 1
        if (lines > 0 && prevPieceTypeRef.current === 'I') iPieceLinesRef.current += lines
        if (lines === 4) tetrisClearsRef.current += 1
      }
      if (ns.pieceLocked) piecesPlacedRef.current += 1
      if (ns.pieceHeld) holdUsesRef.current += 1
      if (ns.hardDropped) hardDropsRef.current += 1
      if (beatRef) beatRef.current = storyMusicRef?.current?.getBeatEnergy() ?? 0

      const linesThisLevel = ns.lines - (levelStartLinesRef?.current ?? 0)
      const levelComplete  = targetLines > 0 && linesThisLevel >= targetLines

      if ((ns.gameOver || levelComplete) && !prevGameOverRef.current) {
        prevGameOverRef.current = true
        onComplete({
          score: ns.score,
          lines: ns.lines,
          linesThisLevel,
          gameOver: ns.gameOver,
          gameOverReason: ns.gameOverReason,
          tSpins: tSpinsRef.current,
          iPieceLines: iPieceLinesRef.current,
          piecesPlaced: piecesPlacedRef.current,
          holdUses: holdUsesRef.current,
          tetrisClears: tetrisClearsRef.current,
          hardDrops: hardDropsRef.current,
        })
      }

      prevPieceTypeRef.current = ns.current?.type ?? prevPieceTypeRef.current
      setState(ns)
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [engine, targetLines, levelKey, onComplete, active]) // eslint-disable-line

  return { state, paused, triggerAction, handlePress, handleRelease, togglePause }
}

// ─── Page ──────────────────────────────────────────────────────────────────────
const PHASE = { STORY: 'story', LOADING: 'loading', GAME: 'game', TRANSITION: 'transition', COMPLETE: 'complete', FAIL: 'fail', ENDING: 'ending', MATRIX_ASCENT: 'matrix-ascent', MATRIX_END: 'matrix-end' }

function MediaControls({ storyMusicRef, chapterColor }) {
  const [_bump, setBump] = useState(0)
  const m = storyMusicRef?.current
  const now = m?.getNowPlaying?.()
  const shuffle = m?.getShuffleEachLoop?.() ?? true
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', minWidth: 260 }}>
      <div style={{ fontSize: '0.62rem', color: '#bbb', letterSpacing: '0.12em', textAlign: 'center', maxWidth: 320 }}>
        Now Playing: <span style={{ color: chapterColor, fontWeight: 700 }}>{now?.title || '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => { m?.prev?.(); setBump(x=>x+1) }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
        <button onClick={() => m?.pause?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏸</button>
        <button onClick={() => m?.resume?.()} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>▶</button>
        <button onClick={() => { m?.next?.(); setBump(x=>x+1) }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏭</button>
        <button onClick={() => { const on = !(m?.getShuffleEachLoop?.()); m?.setShuffleEachLoop?.(on); setBump(x=>x+1) }} style={{ background: shuffle ? 'rgba(0,212,255,0.10)' : 'rgba(255,255,255,0.07)', border: shuffle?`1px solid ${chapterColor}`:'1px solid rgba(255,255,255,0.18)', color: shuffle?chapterColor:'#ccc', borderRadius: 6, padding: '6px 10px', fontSize: '0.70rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em' }}>
          🔀 {shuffle ? 'Shuffle On' : 'Shuffle Off'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: '0.60rem', color: '#777' }}>Xfade</span>
        <input type="range" min={0.5} max={4} step={0.1}
          onChange={(e) => m?.setCrossfadeSeconds?.(parseFloat(e.target.value))}
          defaultValue={1.6}
          style={{ width: 160 }} />
      </div>
    </div>
  )
}

export default function StoryLevelPage() {
  const { chapterId, levelId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Current level — starts from URL params, advances on seamless transitions
  const [currentChapterId, setCurrentChapterId] = useState(chapterId)
  const [currentLevelId,   setCurrentLevelId]   = useState(levelId)

  const found     = useMemo(() => findLevel(currentChapterId, currentLevelId), [currentChapterId, currentLevelId])
  const nextLevel = useMemo(() => getNextLevel(currentChapterId, currentLevelId), [currentChapterId, currentLevelId])
  // Compute piece theme early so effects and callbacks can safely reference it
  const pieceTheme = currentChapterId === 'ch8'
    ? 'terminal'
    : (BG_TYPE_TO_PIECE_THEME[found?.level?.bgType] ?? 'classic')

  const [phase,      setPhase]      = useState(PHASE.STORY)
  const [finalLines, setFinalLines] = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [finalReadyToTopOut, setFinalReadyToTopOut] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [storyCountdown, setStoryCountdown] = useState(null) // auto-begin countdown
  const [transitionCountdown, setTransitionCountdown] = useState(null) // countdown to auto-advance
  const [matrixCountdown, setMatrixCountdown] = useState(null)
  const [glitchActive, setGlitchActive] = useState(false) // glitch effect when lines >= 40 in Ch7L5
  const transitionAdvanceRef = useRef(null) // stores the advance fn so CONTINUE button can call it
  const [focus, setFocus] = useState(() => { try { return localStorage.getItem('focus-mode') === '1' } catch { return false } })
  const [easyMode, setEasyMode] = useState(() => { try { return localStorage.getItem('story-easy') === '1' } catch { return false } })
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [zoom, setZoom] = useState(() => {
    const saved = Number(localStorage.getItem('tetris-zoom') || 1)
    return saved >= 1 && saved <= 1.5 ? saved : 1
  })
  const cycleZoom = useCallback(() => setZoom((z) => {
    const next = z >= 1.5 ? 1 : z >= 1.25 ? 1.5 : 1.25
    localStorage.setItem('tetris-zoom', next)
    return next
  }), [])

  // Engine persists across seamless level transitions — never reset between levels
  const engine = useMemo(() => new TetrisEngine(), [])  

  // Line baseline: how many lines were cleared when the current level started
  const levelStartLinesRef = useRef(0)
  const levelStartScoreRef = useRef(0)
  // When true, engine.reset() will fire on the next GAME phase entry (fresh start / retry)
  const pendingResetRef    = useRef(true)

  const storyMusicRef = useRef(null)
  const beatRef       = useRef(0)
  const [_musicTick, _setMusicTick] = useState(0) // force UI refresh on media actions
  const [storyMuted, setStoryMuted] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const finalClearSavedRef = useRef(false)
  const isFinalConvergence = currentChapterId === 'ch7' && currentLevelId === 'l5'
  const CONFIG_KEY = 'tetris-config'
  const DEFAULT_CONFIG = { sfxEnabled: true, hapticEnabled: true, musicVolume: 1.0, sfxVolume: 2.0, das: 110, arr: 25, showOnScreenControls: false }
  const loadConfig = () => { try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') } } catch { return { ...DEFAULT_CONFIG } } }
  const [config, setConfig] = useState(loadConfig)

  // Persist + apply settings
  useEffect(() => { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) } catch {} }, [config])
  useEffect(() => { try { engine.setSettings({ das: config.das, arr: config.arr }) } catch {} }, [config.das, config.arr, engine])
  useEffect(() => { try { storyMusicRef.current?.setVolume?.(config.musicVolume) } catch {} }, [config.musicVolume])
  useEffect(() => { setSfxVolume(config.sfxVolume ?? 1.0) }, [config.sfxVolume])

  // Apply DAS / ARR config
  useEffect(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('tetris-config') ?? '{}')
      engine.setSettings({ das: cfg.das ?? 110, arr: cfg.arr ?? 25 })
    } catch { /* use engine defaults */ }
  }, [engine])

  // Music: warm up in LOADING, keep through GAME/TRANSITION, stop on FAIL / COMPLETE
  useEffect(() => {
    if (phase === PHASE.LOADING || phase === PHASE.GAME) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx && !storyMusicRef.current) storyMusicRef.current = new StoryMusicManager(new Ctx())
      storyMusicRef.current?.playForLevelContinuous(currentChapterId, currentLevelId)
      storyMusicRef.current?.setLevelBpm?.(found?.level?.bpm || 120)
    } else if (phase === PHASE.FAIL || phase === PHASE.COMPLETE) {
      storyMusicRef.current?.stop()
    }
    // TRANSITION and STORY: music keeps playing — intentional no-op
  }, [phase, currentChapterId, currentLevelId, found?.level?.bpm])

  // Cleanup music on unmount
  useEffect(() => () => { storyMusicRef.current?.stop() }, [])

  // Persist focus mode and hotkey (F)
  useEffect(() => { try { localStorage.setItem('focus-mode', focus ? '1' : '0') } catch {} }, [focus])
  useEffect(() => {
    const onKey = (e) => { if (e.code === 'KeyF') setFocus(f => !f) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Persist easy mode toggle
  useEffect(() => { try { localStorage.setItem('story-easy', easyMode ? '1' : '0') } catch {} }, [easyMode])

  useEffect(() => {
    setFinalReadyToTopOut(false)
    finalClearSavedRef.current = false
    setMatrixCountdown(null)
  }, [currentChapterId, currentLevelId])

  // Engine reset — only for fresh starts and explicit retries (not seamless transitions)
  useEffect(() => {
    if (phase === PHASE.GAME && pendingResetRef.current) {
      pendingResetRef.current = false
      engine.reset(GAME_MODE.NORMAL)
      levelStartLinesRef.current = 0
      levelStartScoreRef.current = 0
      const gm = found?.level?.gravityMult ?? 1.0
      const gravFactor = easyMode ? 0.6 : 1.0
      const targetLevel = Math.max(1, Math.round(gm * gravFactor * 5 + 1))
      engine.level = targetLevel
      engine.storyLevelOffset = targetLevel
      engine.storyLinesOffset = 0
    }
  }, [phase, engine, found, easyMode])

  // Story auto-begin: count down from 13 s and auto-start the game
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
  }, [phase, currentChapterId, currentLevelId]) // reset timer on each new level story screen

  useEffect(() => {
    if (phase !== PHASE.LOADING) return
    const id = setTimeout(() => {
      pendingResetRef.current = true
      setPhase(PHASE.GAME)
    }, 650)
    return () => clearTimeout(id)
  }, [phase, currentChapterId, currentLevelId])

  // Seamless transition: pause to let the player read storyAfter text, then advance
  useEffect(() => {
    if (phase !== PHASE.TRANSITION) { setTransitionCountdown(null); return }
    const next = getNextLevel(currentChapterId, currentLevelId)
    if (!next) return

    // Boss levels get more reading time
    const isBossLevel = found?.level?.isBoss
    const delay = isBossLevel ? 9 : 7 // seconds

    setTransitionCountdown(delay)
    let remaining = delay

    const doAdvance = () => {
      const nextFound = findLevel(next.chapterId, next.levelId)
      const gm = nextFound?.level?.gravityMult ?? 1.0
        const gravFactor = easyMode ? 0.6 : 1.0
        const targetLevel = Math.max(1, Math.round(gm * gravFactor * 5 + 1))
        engine.level = targetLevel
        engine.storyLevelOffset = targetLevel
        engine.storyLinesOffset = engine.getState().lines
      levelStartLinesRef.current = engine.getState().lines
      levelStartScoreRef.current = engine.getState().score
      engine.togglePause()  // resume
      setCurrentChapterId(next.chapterId)
      setCurrentLevelId(next.levelId)
      setPhase(PHASE.GAME)
    }

    // Store so CONTINUE button can call it immediately
    transitionAdvanceRef.current = doAdvance

    const id = setInterval(() => {
      remaining -= 1
      setTransitionCountdown(remaining)
      if (remaining <= 0) { clearInterval(id); doAdvance() }
    }, 1000)

    return () => { clearInterval(id); transitionAdvanceRef.current = null }
  }, [phase, currentChapterId, currentLevelId, engine]) // eslint-disable-line

  useEffect(() => {
    if (phase !== PHASE.MATRIX_ASCENT) { setMatrixCountdown(null); return }

    setMatrixCountdown(6)
    let remaining = 6
    const id = setInterval(() => {
      remaining -= 1
      setMatrixCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        pendingResetRef.current = true
        setCurrentChapterId('ch8')
        setCurrentLevelId('l1')
        setPhase(PHASE.STORY)
        navigate('/story/ch8/l1', { replace: true })
      }
    }, 1000)

    return () => clearInterval(id)
  }, [phase, navigate])

  const showOnScreenControls = (() => {
    try { return JSON.parse(localStorage.getItem('tetris-config') ?? '{}').showOnScreenControls ?? false }
    catch { return false }
  })()

  const persistLevelCompletion = useCallback(({ score, linesThisLevel, tSpins = 0, iPieceLines = 0, piecesPlaced = 0, holdUses = 0, tetrisClears = 0, hardDrops = 0 }) => {
    const lt = Number(linesThisLevel || 0)
    const scoreThisLevel = Math.max(0, Number(score || 0) - Number(levelStartScoreRef.current || 0))

    if (user && easyMode) {
      markEasyModePlayed(user.uid).catch(() => {})
      setActiveBadge(user.uid, 'badge_noob').catch(() => {})
    }
    if (user && found) {
      setSaving(true)
      const isChapterComplete = found.chapter.levels[found.chapter.levels.length - 1]?.id === currentLevelId
      const unlocks = [
        saveStoryProgress(user.uid, currentChapterId, currentLevelId, scoreThisLevel, lt),
        unlockItem(user.uid, `bg_${found.level.bgType}`),
      ]
      if (found.level.themeUnlock) {
        const unlockThemes = Array.isArray(found.level.themeUnlock)
          ? found.level.themeUnlock
          : [found.level.themeUnlock]
        unlockThemes.filter(Boolean).forEach((id) => unlocks.push(unlockItem(user.uid, id)))
      }
      try {
        const lv = engine.getState().level || 1
        const survivalMs = Math.max(0, Number(engine.getState().elapsedTime || 0))
        unlocks.push(saveGameResult(user.uid, 'story', score, {
          lines: lt,
          level: lv,
          survivalMs,
          tSpins,
          iPieceLines,
          piecesPlaced,
          holdUses,
          tetrisClears,
          hardDrops,
        }))
      } catch {}
      if (isChapterComplete) {
        unlocks.push(awardStoryChapterMilestone(user.uid, currentChapterId))
      }
      Promise.all(unlocks).finally(() => setSaving(false))
    }
  }, [user, easyMode, found, currentChapterId, currentLevelId, engine])

  const handleComplete = useCallback(async ({ score, lines, linesThisLevel: ltl, gameOver, gameOverReason, tSpins = 0, iPieceLines = 0, piecesPlaced = 0, holdUses = 0, tetrisClears = 0, hardDrops = 0 }) => {
    const lt = ltl ?? lines
    setFinalScore(score)
    setFinalLines(lt)

    if (gameOver) {
      if (isFinalConvergence && finalReadyToTopOut && gameOverReason === 'topout') {
        if (!finalClearSavedRef.current) {
          finalClearSavedRef.current = true
          persistLevelCompletion({ score, linesThisLevel: lt, tSpins, iPieceLines, piecesPlaced, holdUses, tetrisClears, hardDrops })
        }
        // Show "CONVERGENCE MASTERED" ending; player can then choose to enter ch8
        setPhase(PHASE.ENDING)
        return
      }
      setPhase(PHASE.FAIL)
      return
    }

    persistLevelCompletion({ score, linesThisLevel: lt, tSpins, iPieceLines, piecesPlaced, holdUses, tetrisClears, hardDrops })

    const next = getNextLevel(currentChapterId, currentLevelId)
    if (next) {
      engine.togglePause()   // freeze board during cinematic overlay
      setPhase(PHASE.TRANSITION)
    } else if (currentChapterId === 'ch8' && currentLevelId === 'l1') {
      // Secret final level complete — true ending
      engine.togglePause()
      setPhase(PHASE.MATRIX_END)
    } else {
      engine.togglePause()   // freeze on last level too
      setPhase(PHASE.COMPLETE)
    }
  }, [currentChapterId, currentLevelId, engine, isFinalConvergence, finalReadyToTopOut, persistLevelCompletion])

  const levelKey = `${currentChapterId}-${currentLevelId}`

  const effectiveTargetLines = (() => {
    const tl = found?.level?.targetLines || 0
    if (!easyMode || tl <= 0) return tl
    const easyOverride = found?.level?.easyTargetLines
    return typeof easyOverride === 'number' ? easyOverride : Math.round(tl * 0.75)
  })()

  const loopTargetLines = isFinalConvergence ? 0 : effectiveTargetLines

  const loopActive = phase === PHASE.GAME

  const { state, paused, triggerAction, handlePress, handleRelease, togglePause } = useStoryGameLoop(
    engine,
    loopTargetLines,
    levelStartLinesRef,
    levelKey,
    handleComplete,
    storyMusicRef,
    beatRef,
    loopActive,
  )

  const linesThisLevel = state.lines - levelStartLinesRef.current

  useEffect(() => {
    if (!isFinalConvergence || phase !== PHASE.GAME || finalReadyToTopOut) return
    if (effectiveTargetLines <= 0 || linesThisLevel < effectiveTargetLines) return

    setFinalReadyToTopOut(true)
    setFinalLines(linesThisLevel)
    setFinalScore(state.score)
    if (!finalClearSavedRef.current) {
      finalClearSavedRef.current = true
      persistLevelCompletion({ score: state.score, linesThisLevel })
    }
  }, [isFinalConvergence, phase, finalReadyToTopOut, effectiveTargetLines, linesThisLevel, state.score, persistLevelCompletion])

  // Trigger glitch effect when lines reach 40 in Chapter 7 Level 5
  useEffect(() => {
    if (isFinalConvergence && phase === PHASE.GAME && linesThisLevel >= 40) {
      setGlitchActive(true)
    } else if (!isFinalConvergence || phase !== PHASE.GAME) {
      setGlitchActive(false)
    }
  }, [isFinalConvergence, phase, linesThisLevel])

  const handleHardRefresh = useCallback(async () => {
    await hardResetAndReload()
  }, [])

  const handleDragBegin = useCallback((dir) => {
    if (dir === 'left' || dir === 'right') {
      if (config?.sfxEnabled && !paused) try { playMoveSFX(pieceTheme || 'classic') } catch {}
      emitSynesthesia(SYNESTHESIA_EVENT.MOVE, { intensity: 1.03, source: 'story-drag' })
      handlePress(dir, true)
      try { window.dispatchEvent(new Event('bg-beat')) } catch {}
    } else if (dir === 'down') {
      if (config?.sfxEnabled && !paused) try { playSoftDropSFX(pieceTheme || 'classic') } catch {}
      emitSynesthesia(SYNESTHESIA_EVENT.SOFT_DROP, { intensity: 0.95, source: 'story-drag' })
      handlePress('softDrop', true)
      try { window.dispatchEvent(new Event('bg-beat')) } catch {}
    } else if (dir === 'up') {
      if (config?.sfxEnabled && !paused) try { playHoldSFX(pieceTheme || 'classic') } catch {}
      triggerAction('hold')
      try { window.dispatchEvent(new Event('bg-beat')) } catch {}
    }
  }, [handlePress, triggerAction, config?.sfxEnabled, paused, pieceTheme])

  const handleDragEnd = useCallback((dir) => {
    if (dir === 'left' || dir === 'right') handleRelease(dir)
    else if (dir === 'down') handleRelease('softDrop')
  }, [handleRelease])

  const handleHardDrop = useCallback(() => {
    if (config?.sfxEnabled && !paused) try { playHardDropSFX(pieceTheme || 'classic') } catch {}
    handleRelease('softDrop')
    emitSynesthesia(SYNESTHESIA_EVENT.HARD_DROP, { intensity: 1.24, source: 'story-gesture' })
    triggerAction('hardDrop')
    try { window.dispatchEvent(new Event('bg-beat')) } catch {}
  }, [handleRelease, triggerAction, config?.sfxEnabled, paused, pieceTheme])

  

  // Immediate SFX parity with Solo on keydown (in addition to state-driven SFX)
  useEffect(() => {
    const onKeySfx = (ev) => {
      if (ev.repeat) return
      try {
        if (!config?.sfxEnabled || paused) return
        const b = KEY_BINDINGS[ev.code]; if (!b) return
        const th = pieceTheme || 'classic'
        if (b.held === 'left' || b.held === 'right') playMoveSFX(th)
        if (b.held === 'softDrop') playSoftDropSFX(th)
        if (b.action === 'rotateCW' || b.action === 'rotateCCW' || b.action === 'rotate180') playRotateSFX(th)
        if (b.action === 'hardDrop') playHardDropSFX(th)
        if (b.action === 'hold')     playHoldSFX(th)
        if (b.action === 'activateZone') playZoneActivateSFX(th)
      } catch {}
    }
    window.addEventListener('keydown', onKeySfx)
    return () => window.removeEventListener('keydown', onKeySfx)
  }, [config?.sfxEnabled, pieceTheme, paused])

  // ── SFX triggers (edge-detected) ───────────────────────────────────────────
  const prevStateRef = useRef(null)
  useEffect(() => {
    if (!config.sfxEnabled) { prevStateRef.current = state; return }
    const prev = prevStateRef.current
    if (prev) {
      const theme = pieceTheme || 'classic'
      if (state.hardDropped)               playHardDropSFX(theme)
      else if (state.pieceLocked)          playLockSFX(theme)
      if (state.lastClear?.lines > 0) {
        if (state.lastClear.lines >= 4) playTetrisSFX(theme)
        else playLineClearSFX(theme, state.combo ?? 0)
      }
      if (state.pieceHeld)                 playHoldSFX(theme)
      if (prev.zoneActive !== state.zoneActive) {
        if (state.zoneActive) {
          playZoneActivateSFX(theme)
          // Boost SFX volume during Zone and apply low-pass duck to story BGM
          setSfxDuck(1.5)
          try { storyMusicRef.current?.setZoneFx?.(true) } catch { /* audio errors must not break gameplay */ }
        } else {
          // Restore normal SFX level and BGM when Zone ends
          setSfxDuck(1.0)
          try { storyMusicRef.current?.setZoneFx?.(false) } catch { /* audio errors must not break gameplay */ }
        }
      }
      // Move / rotate only when the same piece is active
      if (prev.current?.type === state.current?.type) {
        if (state.current?.x !== prev.current?.x)          playMoveSFX(theme)
        else if (state.current?.rotation !== prev.current?.rotation) playRotateSFX(theme)
      }
    }
    prevStateRef.current = state
  }, [state, config.sfxEnabled])

  if (!found) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a14', color: '#f87171', fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '0.15em' }}>
        LEVEL NOT FOUND — <button onClick={() => navigate('/story')} style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', marginLeft: 8 }}>← Back</button>
      </div>
    )
  }

  const { chapter, level } = found

  // Board alpha syncs to bass beat energy — pulses more transparent on heavy hits
  // so the background animations show through the matrix
  const beatEnergy = beatRef.current
  const boardAlpha = (phase === PHASE.GAME || phase === PHASE.TRANSITION)
    ? Math.max(0.28, 0.46 - beatEnergy * 0.18)
    : undefined

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: '"Courier New", monospace' }}>
      {/* Dynamic background — always visible behind the semi-transparent board */}
      <BackgroundCanvas
        bgType={found?.level?.bgType || 'stars'}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        beatRef={beatRef}
        bpm={found?.level?.bpm || 120}
        comboStreak={state.combo ?? 0}
      />

      {/* Subtle darkening overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.26)', pointerEvents: 'none' }} />

      {/* ── Story intro ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === PHASE.STORY && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ textAlign: 'center', maxWidth: 440 }}
            >
              <div style={{ fontSize: '0.55rem', letterSpacing: '0.4em', color: chapter.color, marginBottom: 8, textTransform: 'uppercase' }}>
                {chapter.title} / {level.title}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#888', letterSpacing: '0.18em', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
                {level.subtitle}
              </div>
              <p style={{ color: '#ddd', fontSize: '0.9rem', lineHeight: 1.7, letterSpacing: '0.04em', margin: '0 0 2rem' }}>
                {level.storyBefore}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                {level.targetLines > 0 && (
                  <div style={{ fontSize: '0.65rem', color: '#666', letterSpacing: '0.14em', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 14px' }}>
                    CLEAR {effectiveTargetLines} LINES
                  </div>
                )}
                {/* Easy mode toggle */}
                <button
                  onClick={() => setEasyMode(m => !m)}
                  style={{ background: easyMode ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${easyMode ? '#a855f7' : 'rgba(255,255,255,0.12)'}`, color: easyMode ? '#a855f7' : '#555', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: '0.62rem', letterSpacing: '0.16em', fontFamily: 'inherit', textTransform: 'uppercase', transition: 'all 0.2s' }}
                >
                  🐣 {easyMode ? 'Easy Mode ON' : 'Easy Mode'}
                </button>
                {easyMode && <div style={{ fontSize: '0.55rem', color: '#a855f7', letterSpacing: '0.1em', opacity: 0.8 }}>🐣 NOOB badge will be equipped</div>}
                {/* Auto-begin progress bar */}
                {storyCountdown !== null && storyCountdown > 0 && (
                  <div style={{ width: 200, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                    <div style={{ height: '100%', background: chapter.color, borderRadius: 2, transition: 'width 0.9s linear', width: `${((13 - storyCountdown) / 13) * 100}%` }} />
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { pendingResetRef.current = true; setPhase(PHASE.LOADING) }}
                  style={{ background: chapter.color, border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.2em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}
                >
                  {storyCountdown !== null && storyCountdown > 0 ? `BEGIN (${storyCountdown}s)` : 'BEGIN'}
                </motion.button>
                <button onClick={() => navigate('/story', { replace: true })} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.12em', fontFamily: 'inherit', marginTop: 4 }}>
                  ← Back to map
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === PHASE.LOADING && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 105, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: '0.56rem', letterSpacing: '0.24em', color: chapter.color, marginBottom: 12 }}>
                PREPARING BATTLE
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                style={{ width: 36, height: 36, margin: '0 auto 10px', borderRadius: '50%', border: `2px solid ${chapter.color}55`, borderTopColor: chapter.color }}
              />
              <div style={{ fontSize: '0.62rem', color: '#9ca3af', letterSpacing: '0.12em' }}>
                Loading music and matrix...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game board (visible during GAME and TRANSITION) ─────────────── */}
      {(phase === PHASE.GAME || phase === PHASE.TRANSITION) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', pointerEvents: phase === PHASE.TRANSITION ? 'none' : 'auto' }}>
          {/* HUD bar */}
          {!focus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.72rem', letterSpacing: '0.1em', flexShrink: 0, backdropFilter: 'blur(6px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.5rem', letterSpacing: '0.14em', color: chapter.color, fontWeight: 700 }}>{chapter.title}</span>
                <span style={{ color: '#333' }}>›</span>
                <span style={{ color: '#ccc' }}>{level.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => triggerAction('activateZone')}
                  disabled={state.zoneMeter < ZONE_MIN_METER || state.zoneActive}
                  title={state.zoneActive ? 'Zone Active' : (state.zoneMeter >= ZONE_MIN_METER ? 'Activate Zone' : 'Zone charging')}
                  style={{
                    background: state.zoneActive ? 'rgba(0,229,255,0.18)' : state.zoneMeter >= ZONE_MIN_METER ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#22d3ee' : 'rgba(255,255,255,0.1)'}`,
                    color: state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#80eaff' : '#555',
                    cursor: state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive ? 'pointer' : 'default',
                    fontSize: '0.62rem', padding: '2px 8px', borderRadius: 6, fontFamily: 'inherit'
                  }}
                >
                  ⚡ {state.zoneActive ? `${Math.ceil(state.zoneTimer/1000)}s` : 'ZONE'}
                </button>
                {level.targetLines > 0 && (
                  <span style={{ color: '#555', fontSize: '0.62rem' }}>
                    {Math.min(linesThisLevel, effectiveTargetLines)} / {effectiveTargetLines} lines{isFinalConvergence && finalReadyToTopOut ? ' · SURVIVE' : ''}
                  </span>
                )}
                {state.combo > 1 && (
                  <span style={{ color: '#f59e0b', fontSize: '0.62rem', fontWeight: 700 }}>
                    COMBO x{state.combo}
                  </span>
                )}
                {state.backToBack && (
                  <span style={{ color: '#fbbf24', fontSize: '0.62rem', fontWeight: 700 }}>
                    B2B x{(state.b2bCount ?? 0) + 1}
                  </span>
                )}
                <span style={{ color: '#00d4ff', fontWeight: 700 }}>{state.score.toLocaleString()}</span>
                <button
                  onClick={togglePause}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', cursor: 'pointer', fontSize: '0.6rem', padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit', letterSpacing: '0.1em' }}
                >
                  {paused ? '▶' : '⏸'}
                </button>
                {!isMobile && (
                  <button
                    onClick={cycleZoom}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', cursor: 'pointer', fontSize: '0.6rem', padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit', letterSpacing: '0.1em' }}
                    title="Cycle zoom"
                  >
                    🔍 {Math.round(zoom * 100)}%
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Lines progress bar — shown in both normal and focus mode */}
          {level.targetLines > 0 && (
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <div style={{ height: '100%', background: chapter.color, width: `${Math.min(100, (linesThisLevel / effectiveTargetLines) * 100)}%`, transition: 'width 0.3s ease' }} />
            </div>
          )}

          {isFinalConvergence && finalReadyToTopOut && (
            <div style={{ padding: '6px 12px', background: 'rgba(0, 20, 0, 0.65)', color: '#90ff90', fontSize: '0.58rem', letterSpacing: '0.16em', textAlign: 'center', borderTop: '1px solid rgba(120,255,120,0.25)', borderBottom: '1px solid rgba(120,255,120,0.25)' }}>
              LINE TARGET CLEARED. KEEP PLAYING UNTIL TOPOUT TO BREACH THE MATRIX.
            </div>
          )}

          {/* Middle: slim-left | canvas | hold+zone+next-right */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
            {/* Left strip: slim score / mode accent (no controls) */}
            {!focus && (<div style={{ width: 6, flexShrink: 0, background: chapter.color, opacity: 0.25 }} />)}

            {/* Canvas */}
            <div className="mobile-canvas-wrap" style={{ background: 'transparent', flex: 1, minWidth: 0 }}>
              <SynesthesiaMotionLayer style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <div style={!isMobile ? { transform: `scale(${zoom})`, transformOrigin: 'center center' } : undefined}>
                  <GameCanvas
                    state={state}
                    onTap={() => { if (config?.sfxEnabled && !paused) try { playRotateSFX(pieceTheme || 'classic') } catch {}; emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 'story-tap' }); triggerAction('rotateCW'); try { window.dispatchEvent(new Event('bg-beat')) } catch {} }}
                    onTwoFingerTap={() => { if (config?.sfxEnabled && !paused) try { playZoneActivateSFX(pieceTheme || 'classic') } catch {}; triggerAction('activateZone'); try { window.dispatchEvent(new Event('bg-beat')) } catch {} }}
                    onDragBegin={handleDragBegin}
                    onDragEnd={handleDragEnd}
                    onHardDrop={handleHardDrop}
                    themeOverride={pieceTheme}
                    boardAlpha={boardAlpha}
                  />
                </div>
                {/* Focus toggle styled like Solo's UI tab */}
                <button
                  onClick={() => setFocus(f => !f)}
                  className="ui-toggle-tab"
                  title={focus ? 'Exit Focus' : 'Enter Focus'}
                  aria-label={focus ? 'Exit Focus' : 'Enter Focus'}
                  style={{ right: 0 }}
                >
                  {focus ? '▲' : '▼'}
                </button>
                {focus && (() => {
                  const zoneReady = state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive
                  const zoneFillPct = Math.max(0, Math.min(100, state.zoneActive
                    ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100
                    : (state.zoneMeter || 0)))
                  return (
                    <div className="fullscreen-mini-hud" style={{ right: 0 }}>
                      <div className="fmh-hold">
                        <div className="fmh-label">Hold</div>
                        <PieceMini type={state.hold} pieceTheme={pieceTheme} size={8} />
                      </div>
                      <div className="fmh-zone-wrap">
                        <div className={`fmh-zone-bar${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`} style={{ height: `${zoneFillPct}%` }} />
                      </div>
                      <div className="fmh-next">
                        <div className="fmh-label">Next</div>
                        {(state.queue ?? []).slice(0, 3).map((t, i) => (
                          <PieceMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {/* Pause overlay */}
                {paused && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.2em', color: '#fff' }}>PAUSED</div>
                    <div style={{ fontSize: '0.58rem', color: chapter.color, letterSpacing: '0.22em' }}>{chapter.title} › {level.title}</div>
                    <div style={{ fontSize: '0.56rem', color: '#555', letterSpacing: '0.14em' }}>
                      Lv {state.level} · {linesThisLevel} / {effectiveTargetLines || '∞'} lines
                    </div>
                    {/* Media controls — match Solo pause menu */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '0.25rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.62rem', color: '#bbb', letterSpacing: '0.12em' }}>
                        Now Playing: <span style={{ color: '#fff' }}>{storyMusicRef.current?.getNowPlaying?.()?.title || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button type="button"
                          onClick={() => storyMusicRef.current?.prev?.()}
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
                        {storyMuted ? (
                          <button type="button"
                            onClick={() => { storyMusicRef.current?.resume?.(); setStoryMuted(false) }}
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>▶</button>
                        ) : (
                          <button type="button"
                            onClick={() => { storyMusicRef.current?.pause?.(); setStoryMuted(true) }}
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏸</button>
                        )}
                        <button type="button"
                          onClick={() => storyMusicRef.current?.next?.()}
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏭</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.60rem', color: '#777' }}>Vol</span>
                        <input type="range" min={0} max={1} step={0.01}
                          value={config.musicVolume}
                          onChange={(e) => { const v = parseFloat(e.target.value); setConfig(prev => ({ ...prev, musicVolume: v })); storyMusicRef.current?.setVolume?.(v) }}
                          style={{ width: 180 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setShowSettings(true)}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}
                      >
                        ⚙ Settings
                      </button>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={togglePause}
                      style={{ background: 'none', border: `1px solid ${chapter.color}`, color: chapter.color, borderRadius: 6, padding: '8px 22px', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.16em', fontFamily: 'inherit', fontWeight: 700 }}
                    >
                      ▶ RESUME
                    </motion.button>
                    <button
                      onClick={() => navigate('/story', { replace: true })}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#bbb', borderRadius: 6, padding: '7px 18px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}
                    >
                      ← WORLD MAP
                    </button>
                    <button
                      onClick={() => { togglePause(); pendingResetRef.current = true; setCurrentChapterId(currentChapterId); setCurrentLevelId(currentLevelId); setPhase(PHASE.STORY) }}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#555', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}
                    >
                      RESTART LEVEL
                    </button>
                  </div>
                )}
              </SynesthesiaMotionLayer>
            </div>

            {/* Zone end overlay — shows lines cleared + bonus when Zone deactivates */}
            <AnimatePresence>
              {state.zoneEndResult && (
                <motion.div className="zone-end-overlay"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}>
                  <div className="zone-end-number">{state.zoneEndResult.lines}</div>
                  <div className="zone-end-label">ZONE LINES!</div>
                  <div className="zone-end-bonus">+{state.zoneEndResult.bonus.toLocaleString()}</div>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: '10% 18%', pointerEvents: 'none' }}>
                    {Array.from({ length: Math.min(12, state.zoneEndResult.lines || 0) }).map((_, i) => (
                      <motion.div key={i}
                        initial={{ scaleX: 1, opacity: 0.9 }}
                        animate={{ scaleX: 0, opacity: 0 }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.7, ease: 'easeIn' }}
                        style={{ height: 6, background: 'linear-gradient(90deg,#fff,#00cfff)', borderRadius: 4, filter: 'drop-shadow(0 0 6px #00cfff)' }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right strip removed per request to maximize board area */}
          </div>

          {showOnScreenControls && (
            <TouchControls onPress={handlePress} onRelease={handleRelease} />
          )}
        </div>
      )}

      {/* ── Seamless level-transition overlay ─────────────────────────────── */}
      {/* Board stays frozen underneath; player reads story text then continues */}
      <AnimatePresence>
        {phase === PHASE.TRANSITION && (
          <motion.div
            key="transition-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ textAlign: 'center', maxWidth: 440, padding: '2rem' }}
            >
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.44em', color: chapter.color, marginBottom: 12, textTransform: 'uppercase' }}>
                ✦ {level.title} CLEARED ✦
              </div>
              <p style={{ color: '#ddd', fontSize: '0.92rem', lineHeight: 1.85, letterSpacing: '0.04em', margin: '0 0 1.6rem' }}>
                {level.storyAfter}
              </p>
              {nextLevel && (() => {
                const nf = findLevel(nextLevel.chapterId, nextLevel.levelId)
                return nf ? (
                  <div style={{ fontSize: '0.58rem', color: '#555', letterSpacing: '0.18em', marginBottom: '1.4rem' }}>
                    NEXT &nbsp;›&nbsp; <span style={{ color: nf.chapter.color }}>{nf.chapter.title}</span>&nbsp;/&nbsp;{nf.level.title}
                  </div>
                ) : null
              })()}
              {/* Countdown bar */}
              {transitionCountdown !== null && (
                <div style={{ width: 220, margin: '0 auto 10px', height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: chapter.color, borderRadius: 2, transition: 'width 0.9s linear',
                    width: `${((( found?.level?.isBoss ? 9 : 7) - transitionCountdown) / (found?.level?.isBoss ? 9 : 7)) * 100}%` }} />
                </div>
              )}
              {/* CONTINUE button — lets player proceed when ready */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => transitionAdvanceRef.current?.()}
                style={{ background: chapter.color, border: 'none', color: '#000', borderRadius: 8, padding: '10px 28px', fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}
              >
                CONTINUE →
              </motion.button>
              {transitionCountdown !== null && transitionCountdown > 0 && (
                <div style={{ fontSize: '0.55rem', color: '#555', letterSpacing: '0.12em', marginTop: 6 }}>
                  Auto in {transitionCountdown}s
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings overlay */}
      {showSettings && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.2rem' }}>
          <div style={{ position: 'relative', width: 'min(760px, 94vw)', maxHeight: '90vh', overflow: 'auto', background: 'rgba(10,12,22,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: '0.8rem', letterSpacing: '0.16em', color: '#fff' }}>SETTINGS</div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit' }}>✕ Close</button>
            </div>
            <SettingsPage config={config} onConfig={setConfig} onClearCache={handleHardRefresh} onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* ── Glitch effect overlay — appears when lines reach 40 in Ch7L5 ──── */}
      {glitchActive && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none' }}>
          <GlitchOverlay active={glitchActive} />
        </div>
      )}

      {/* ── MATRIX ASCENT — after Ch7/L5 target + topout ───────────────── */}
      <AnimatePresence>
        {phase === PHASE.MATRIX_ASCENT && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'radial-gradient(ellipse at 50% 45%, rgba(0, 40, 0, 0.55) 0%, rgba(0, 0, 0, 0.96) 72%)', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.45 }}>
              {Array.from({ length: 54 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: '-20%', opacity: 0 }}
                  animate={{ y: '120%', opacity: [0, 0.6, 0.1] }}
                  transition={{ duration: 2.4 + (i % 6) * 0.55, delay: (i % 11) * 0.1, repeat: Infinity, ease: 'linear' }}
                  style={{ position: 'absolute', left: `${(i * 1.9) % 100}%`, top: '-10%', color: i % 8 === 0 ? '#9eff9e' : '#2cff7c', fontSize: `${0.52 + (i % 4) * 0.05}rem`, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}
                >
                  {i % 14 === 0 ? 'TETRA OVERFLOW ULTRA' : i % 5 === 0 ? '01001101' : i % 3 === 0 ? 'MATRIX' : '1010'}
                </motion.div>
              ))}

              {Array.from({ length: 30 }).map((_, i) => {
                const pieceGlyphs = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
                const glyph = pieceGlyphs[i % pieceGlyphs.length]
                const colors = ['#00ff41', '#00cc44', '#00dd55', '#00aa33']
                return (
                  <motion.div
                    key={`mx-piece-${i}`}
                    initial={{ y: '-24%', opacity: 0.1, rotate: 0 }}
                    animate={{ y: '125%', opacity: [0.08, 0.4, 0.08], rotate: [0, 45, 90, 135] }}
                    transition={{ duration: 3.6 + (i % 5) * 0.6, delay: (i % 9) * 0.15, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', left: `${(i * 3.3 + 7) % 100}%`, top: '-10%', fontSize: `${0.7 + (i % 3) * 0.18}rem`, color: colors[i % colors.length], fontWeight: 900, textShadow: '0 0 8px rgba(0,255,65,0.6)' }}
                  >
                    {glyph}
                  </motion.div>
                )
              })}
            </div>

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                style={{ textAlign: 'center', maxWidth: 460 }}
              >
                <div style={{ fontSize: '0.58rem', letterSpacing: '0.42em', color: '#65ff9b', marginBottom: 10 }}>SYSTEM BREACH</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#d6ffd6', letterSpacing: '0.14em', marginBottom: 10 }}>THE MATRIX OPENS</div>
                <p style={{ color: '#87d787', fontSize: '0.78rem', lineHeight: 1.85, letterSpacing: '0.08em', margin: '0 0 1rem' }}>
                  You held the final pattern past completion and crashed the system from inside.
                  <br />
                  Redirecting to Chapter 8 / Level 1...
                </p>
                <div style={{ fontSize: '0.6rem', color: '#65ff9b', letterSpacing: '0.2em' }}>
                  {matrixCountdown && matrixCountdown > 0 ? `JUMP IN ${matrixCountdown}` : 'CONNECTING'}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Completion / fail overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === PHASE.COMPLETE || phase === PHASE.FAIL) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              style={{ textAlign: 'center', maxWidth: 400, background: 'rgba(10,10,20,0.92)', border: `1px solid ${phase === PHASE.COMPLETE ? chapter.color : '#f87171'}`, borderRadius: 16, padding: '2rem', backdropFilter: 'blur(12px)' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>
                {phase === PHASE.COMPLETE ? '✦' : '✕'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.14em', color: phase === PHASE.COMPLETE ? chapter.color : '#f87171', marginBottom: 4 }}>
                {phase === PHASE.COMPLETE ? 'JOURNEY COMPLETE' : 'GAME OVER'}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#666', letterSpacing: '0.16em', marginBottom: '1.2rem', textTransform: 'uppercase' }}>
                {phase === PHASE.COMPLETE ? level.storyAfter : `Clear ${effectiveTargetLines > 0 ? effectiveTargetLines : 'all'} lines to pass.`}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: '0.2rem' }}>
                {finalLines} <span style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '0.12em' }}>LINES</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>
                {finalScore.toLocaleString()} pts
              </div>
              {saving && <div style={{ fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', marginBottom: '1rem' }}>Saving…</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {phase === PHASE.FAIL && (
                  <button
                    onClick={() => { pendingResetRef.current = true; setPhase(PHASE.STORY) }}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#ccc', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}
                  >
                    RETRY
                  </button>
                )}
                <button
                  onClick={() => navigate('/story', { replace: true })}
                  style={{ background: phase === PHASE.COMPLETE ? chapter.color : 'none', border: phase === PHASE.COMPLETE ? 'none' : '1px solid rgba(255,255,255,0.1)', color: phase === PHASE.COMPLETE ? '#000' : '#888', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: phase === PHASE.COMPLETE ? 700 : 400, letterSpacing: '0.12em', fontFamily: 'inherit' }}
                >
                  {phase === PHASE.COMPLETE ? 'WORLD MAP' : 'MAP'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GRAND ENDING — shown after the last level (ch7/l5) ───────────── */}
      <AnimatePresence>
        {phase === PHASE.ENDING && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(ellipse at 50% 40%, rgba(255,215,0,0.08) 0%, rgba(0,0,0,0.96) 70%)' }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 32, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign: 'center', maxWidth: 460, width: '100%' }}
            >
              {/* Gold star */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 180, damping: 14 }}
                style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 24px #ffd700)' }}
              >
                ✦
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                style={{ fontSize: '0.55rem', letterSpacing: '0.5em', color: '#ffd700', textTransform: 'uppercase', marginBottom: 8 }}
              >
                The Journey is Complete
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff', marginBottom: '0.4rem', textShadow: '0 0 32px #ffd70066' }}
              >
                THE END
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                style={{ fontSize: '0.58rem', color: '#ffd700', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '1.6rem', border: '1px solid #ffd70033', borderRadius: 4, padding: '3px 14px', display: 'inline-block' }}
              >
                CONVERGENCE MASTERED
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                style={{ color: '#bbb', fontSize: '0.9rem', lineHeight: 1.85, letterSpacing: '0.04em', margin: '0 0 1.6rem' }}
              >
                You put down the last piece. The music stops. For one perfect moment, the board is clear.
                <br /><br />
                Seven chapters. Four elements. The cosmos. The void. And one pattern that never repeated itself.
                <br /><br />
                You are the last architect. The game remembers you.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.4 }}
                style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.2rem' }}
              >
                <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffd700' }}>{finalLines}</div>
                  <div style={{ fontSize: '0.55rem', color: '#888', letterSpacing: '0.14em' }}>LINES</div>
                </div>
                <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffd700' }}>{finalScore.toLocaleString()}</div>
                  <div style={{ fontSize: '0.55rem', color: '#888', letterSpacing: '0.14em' }}>FINAL PTS</div>
                </div>
              </motion.div>
              {saving && (
                <div style={{ fontSize: '0.6rem', color: '#888', letterSpacing: '0.12em', marginBottom: 12 }}>Saving progress…</div>
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.8 }}
                style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}
              >
                {/* Only show when arriving from ch7/l5 — lets player enter the secret chapter */}
                {currentChapterId === 'ch7' && currentLevelId === 'l5' && (
                  <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setPhase(PHASE.MATRIX_ASCENT)}
                    style={{ background: '#00ff41', border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', textShadow: 'none' }}
                  >
                    ▶ ENTER THE MATRIX
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/story', { replace: true })}
                  style={{ background: '#ffd700', border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}
                >
                  ★ WORLD MAP
                </motion.button>
                <button
                  onClick={() => navigate('/', { replace: true })}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#888', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}
                >
                  Main Menu
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MATRIX END — true finale after ch8/l1 ───────────────────────── */}
      <AnimatePresence>
        {phase === PHASE.MATRIX_END && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(ellipse at 50% 40%, rgba(0,80,0,0.15) 0%, rgba(0,0,0,0.97) 70%)' }}
          >
            {/* Faint falling matrix columns in background */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.18 }}>
              {Array.from({ length: 30 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: '-10%', opacity: 0 }}
                  animate={{ y: '110%', opacity: [0, 0.7, 0] }}
                  transition={{ duration: 3.5 + (i % 5) * 0.7, delay: (i % 13) * 0.12, repeat: Infinity, ease: 'linear' }}
                  style={{ position: 'absolute', left: `${(i * 3.4) % 100}%`, top: '-10%', color: '#00ff41', fontSize: '0.55rem', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
                >
                  {i % 5 === 0 ? '01001101' : i % 3 === 0 ? 'TETRA' : '1010'}
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.88, y: 32, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign: 'center', maxWidth: 460, width: '100%', position: 'relative' }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 180, damping: 14 }}
                style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 24px #00ff41)' }}
              >
                ◈
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                style={{ fontSize: '0.55rem', letterSpacing: '0.5em', color: '#00ff41', textTransform: 'uppercase', marginBottom: 8 }}
              >
                System Override Complete
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '0.1em', color: '#d6ffd6', marginBottom: '0.4rem', textShadow: '0 0 32px #00ff4166' }}
              >
                THE MATRIX FALLS
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                style={{ fontSize: '0.58rem', color: '#00ff41', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '1.6rem', border: '1px solid #00ff4133', borderRadius: 4, padding: '3px 14px', display: 'inline-block' }}
              >
                MATRIX MASTERED
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                style={{ color: '#bbb', fontSize: '0.9rem', lineHeight: 1.85, letterSpacing: '0.04em', margin: '0 0 1.6rem' }}
              >
                You rewrote the source code from inside.
                <br /><br />
                Every chapter, every line, every block — it was never random. The system placed each piece with intention. You played back.
                <br /><br />
                The board is clear. The matrix is silent. You left fingerprints on the source.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.4 }}
                style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.2rem' }}
              >
                <div style={{ background: 'rgba(0,255,65,0.06)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#00ff41' }}>{finalLines}</div>
                  <div style={{ fontSize: '0.55rem', color: '#888', letterSpacing: '0.14em' }}>LINES</div>
                </div>
                <div style={{ background: 'rgba(0,255,65,0.06)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#00ff41' }}>{finalScore.toLocaleString()}</div>
                  <div style={{ fontSize: '0.55rem', color: '#888', letterSpacing: '0.14em' }}>FINAL PTS</div>
                </div>
              </motion.div>
              {saving && (
                <div style={{ fontSize: '0.6rem', color: '#888', letterSpacing: '0.12em', marginBottom: 12 }}>Saving progress…</div>
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.8 }}
                style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}
              >
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/story', { replace: true })}
                  style={{ background: '#00ff41', border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}
                >
                  ◈ WORLD MAP
                </motion.button>
                <button
                  onClick={() => navigate('/', { replace: true })}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#888', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}
                >
                  Main Menu
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


