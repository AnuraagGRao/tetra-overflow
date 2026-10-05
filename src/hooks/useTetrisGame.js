import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { TetrisEngine, GAME_MODE, ZONE_MIN_METER } from '../logic/gameEngine'
import {
  setSfxVolume,
  setSfxDuck,
  playMoveSFX,
  playRotateSFX,
  playHoldSFX,
  playHardDropSFX,
  playLockSFX,
  playLineClearSFX,
  playTetrisSFX,
  playZoneActivateSFX,
} from '../audio/gameSfx'
import { emitSynesthesia, SYNESTHESIA_EVENT } from '../logic/synesthesiaBus'
import { GAME_CONFIG_KEY as CONFIG_KEY, readGameConfig as loadConfig } from '../logic/gameConfig'
import { useResponsiveHUD } from './useResponsiveHUD'

const MAX_FRAME_MS = 34

const DEFAULT_KEY_BINDINGS = {
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

/**
 * Headless, component-agnostic game hook managing the Tetris engine loop,
 * user inputs (keyboard, gamepad, touch), audio triggers, and responsive layout.
 */
export function useTetrisGame({
  targetLines = 0,
  pieceTheme = 'classic',
  active = true,
  mirrorControls = false,
  rotationLocked = false,
  customKeyBindings = {},
  onCustomAction,
  onCustomTick,
  onLevelComplete,
  onGameOver,
  musicManagerRef,
  existingEngine = null,
} = {}) {
  const engine = useMemo(() => existingEngine || new TetrisEngine(), [existingEngine])
  const [config, setConfig] = useState(loadConfig)
  const [state, setState] = useState(() => engine.getState())
  const [paused, setPaused] = useState(false)
  const [linesThisLevel, setLinesThisLevel] = useState(0)

  const [zoom, setZoom] = useState(() => {
    const saved = Number(localStorage.getItem('tetris-zoom') || 1)
    return saved >= 0.5 && saved <= 2.0 ? saved : 1
  })

  const [focus, setFocus] = useState(() => {
    try {
      return localStorage.getItem('focus-mode') === '1'
    } catch {
      return false
    }
  })

  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  )
  const hudSizing = useResponsiveHUD(isLandscape)

  // Input refs
  const heldRef = useRef({ left: false, right: false, softDrop: false })
  const actionRef = useRef({})
  const levelStartLinesRef = useRef(0)
  const prevGameOverRef = useRef(false)
  const prevStateRef = useRef(null)

  // Metrics
  const statsRef = useRef({
    tSpins: 0,
    iPieceLines: 0,
    piecesPlaced: 0,
    holdUses: 0,
    tetrisClears: 0,
    hardDrops: 0,
    prevPieceType: null,
  })

  // ── Sync Config ────────────────────────────────────────────────────────────
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
    try {
      localStorage.setItem('focus-mode', focus ? '1' : '0')
    } catch {}
  }, [focus])

  // KeyF focus toggle
  useEffect(() => {
    const onKeyDown = event => {
      if (event.code === 'KeyF') setFocus(value => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Responsive layout listener
  useEffect(() => {
    const onResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Actions & Pause ────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    setPaused(prev => {
      const next = !prev
      engine.togglePause()
      if (next) {
        musicManagerRef?.current?.pause?.()
      } else {
        musicManagerRef?.current?.resume?.()
      }
      return next
    })
  }, [engine, musicManagerRef])

  const triggerAction = useCallback(
    name => {
      if (name === 'pause') {
        togglePause()
        return
      }
      if (paused || !active) return

      const leftKey = mirrorControls ? 'right' : 'left'
      const rightKey = mirrorControls ? 'left' : 'right'

      switch (name) {
        case 'moveLeft':
          heldRef.current[leftKey] = true
          break
        case 'moveRight':
          heldRef.current[rightKey] = true
          break
        case 'softDrop':
          heldRef.current.softDrop = true
          break
        case 'rotateCW':
          if (!rotationLocked) {
            playRotateSFX(pieceTheme)
            actionRef.current.rotateCW = true
          }
          break
        case 'rotateCCW':
          if (!rotationLocked) {
            playRotateSFX(pieceTheme)
            actionRef.current.rotateCCW = true
          }
          break
        case 'rotate180':
          if (!rotationLocked) {
            playRotateSFX(pieceTheme)
            actionRef.current.rotate180 = true
          }
          break
        case 'hardDrop':
          playHardDropSFX(pieceTheme)
          actionRef.current.hardDrop = true
          break
        case 'hold':
          playHoldSFX(pieceTheme)
          actionRef.current.hold = true
          break
        case 'activateZone':
          if (state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive) {
            playZoneActivateSFX(pieceTheme)
            actionRef.current.activateZone = true
          }
          break
        default:
          onCustomAction?.(name)
          break
      }
    },
    [paused, active, mirrorControls, rotationLocked, pieceTheme, state.zoneMeter, state.zoneActive, togglePause, onCustomAction]
  )

  const handlePress = useCallback(
    (button, isHeld) => {
      if (isHeld) {
        if (button === 'left') {
          heldRef.current[mirrorControls ? 'right' : 'left'] = true
        } else if (button === 'right') {
          heldRef.current[mirrorControls ? 'left' : 'right'] = true
        } else if (button === 'softDrop') {
          heldRef.current.softDrop = true
        }
        return
      }
      triggerAction(button)
    },
    [mirrorControls, triggerAction]
  )

  const handleRelease = useCallback(
    (button, isHeld) => {
      if (!isHeld) return
      if (button === 'left') {
        heldRef.current[mirrorControls ? 'right' : 'left'] = false
      } else if (button === 'right') {
        heldRef.current[mirrorControls ? 'left' : 'right'] = false
      } else if (button === 'softDrop') {
        heldRef.current.softDrop = false
      }
    },
    [mirrorControls]
  )

  const handleHardDrop = useCallback(() => {
    triggerAction('hardDrop')
  }, [triggerAction])

  // ── Keyboard Listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const bindings = { ...DEFAULT_KEY_BINDINGS, ...customKeyBindings }
    const down = event => {
      const binding = bindings[event.code]
      if (!binding) return
      event.preventDefault()
      if (event.repeat) return

      if (binding.held) {
        const hKey = binding.held
        if (hKey === 'left') heldRef.current[mirrorControls ? 'right' : 'left'] = true
        else if (hKey === 'right') heldRef.current[mirrorControls ? 'left' : 'right'] = true
        else heldRef.current[hKey] = true

        if (hKey === 'left' || hKey === 'right') {
          emitSynesthesia(SYNESTHESIA_EVENT.MOVE, { intensity: 0.9, source: 'keyboard' })
        } else if (hKey === 'softDrop') {
          emitSynesthesia(SYNESTHESIA_EVENT.SOFT_DROP, { intensity: 0.82, source: 'keyboard' })
        }
        try { window.dispatchEvent(new Event('bg-beat')) } catch {}
      }

      if (binding.action) {
        if (binding.action === 'pause') {
          togglePause()
        } else {
          triggerAction(binding.action)
          if (binding.action === 'rotateCW' || binding.action === 'rotateCCW' || binding.action === 'rotate180') {
            emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 'keyboard' })
          } else if (binding.action === 'hardDrop') {
            emitSynesthesia(SYNESTHESIA_EVENT.HARD_DROP, { intensity: 1.22, source: 'keyboard' })
          }
          try { window.dispatchEvent(new Event('bg-beat')) } catch {}
        }
      }
    }

    const up = event => {
      const binding = bindings[event.code]
      if (!binding?.held) return
      event.preventDefault()
      const hKey = binding.held
      if (hKey === 'left') heldRef.current[mirrorControls ? 'right' : 'left'] = false
      else if (hKey === 'right') heldRef.current[mirrorControls ? 'left' : 'right'] = false
      else heldRef.current[hKey] = false
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [customKeyBindings, mirrorControls, togglePause, triggerAction])

  // ── Gamepad Listener ───────────────────────────────────────────────────────
  useEffect(() => {
    const actionMap = {
      12: 'hardDrop',
      0: 'rotateCCW',
      1: 'rotateCW',
      2: 'rotateCCW',
      3: 'rotate180',
      4: 'hold',
      5: 'hold',
      6: 'activateZone',
      7: 'activateZone',
      9: 'pause',
    }
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
        const leftVal = gamepad.buttons[14]?.pressed || gamepad.axes[2] < -0.35
        const rightVal = gamepad.buttons[15]?.pressed || gamepad.axes[2] > 0.35
        heldRef.current[mirrorControls ? 'right' : 'left'] = leftVal
        heldRef.current[mirrorControls ? 'left' : 'right'] = rightVal
        heldRef.current.softDrop = gamepad.buttons[13]?.pressed || gamepad.axes[3] > 0.35
      }
      frameId = requestAnimationFrame(poll)
    }
    frameId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frameId)
  }, [mirrorControls, triggerAction])

  // ── Reset Engine Helper ────────────────────────────────────────────────────
  const resetGame = useCallback(
    ({ mode = GAME_MODE.NORMAL, gravityMult = 1.0, linesOffset = 0 } = {}) => {
      engine.reset(mode)
      levelStartLinesRef.current = 0
      setLinesThisLevel(0)
      prevGameOverRef.current = false
      statsRef.current = {
        tSpins: 0,
        iPieceLines: 0,
        piecesPlaced: 0,
        holdUses: 0,
        tetrisClears: 0,
        hardDrops: 0,
        prevPieceType: null,
      }
      const targetLevel = Math.max(1, Math.round(gravityMult * 5 + 1))
      engine.level = targetLevel
      engine.storyLevelOffset = targetLevel
      engine.storyLinesOffset = linesOffset
      setState(engine.getState())
    },
    [engine]
  )

  // ── Main Game Loop (rAF) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      setState(engine.getState())
      return
    }

    let frameId
    let lastTime = performance.now()

    const frame = now => {
      const dt = Math.min(now - lastTime, MAX_FRAME_MS)
      lastTime = now

      if (!paused) {
        const actions = actionRef.current
        actionRef.current = {}

        // Custom tick callback (e.g. boss abilities, countdowns, glitch effects)
        onCustomTick?.({ dt, engine, state: engine.getState(), held: heldRef.current, actions })

        engine.update(dt, heldRef.current, actions)
        const ns = engine.getState()

        // Track stats & synesthesia
        if (ns.lastClear) {
          const spinType = ns.lastClear.spinType
          const lines = ns.lastClear.lines || 0
          const isSpin = spinType === 'tSpin' || spinType === 'allSpin' || spinType === 'tSpinMini'
          if (isSpin) {
            emitSynesthesia(SYNESTHESIA_EVENT.T_SPIN, { intensity: lines >= 2 ? 1.45 : 1.18, lines })
            statsRef.current.tSpins += 1
          } else if (lines > 0) {
            emitSynesthesia(SYNESTHESIA_EVENT.LINE_CLEAR, { intensity: Math.min(1.5, 0.9 + lines * 0.2), lines })
          }
          if (lines > 0 && statsRef.current.prevPieceType === 'I') statsRef.current.iPieceLines += lines
          if (lines === 4) statsRef.current.tetrisClears += 1
        }
        if (ns.pieceLocked) statsRef.current.piecesPlaced += 1
        if (ns.pieceHeld) statsRef.current.holdUses += 1
        if (ns.hardDropped) statsRef.current.hardDrops += 1
        statsRef.current.prevPieceType = ns.current?.type ?? statsRef.current.prevPieceType

        const currentLinesThisLevel = Math.max(0, ns.lines - levelStartLinesRef.current)
        setLinesThisLevel(currentLinesThisLevel)
        setState(ns)

        // Victory / Game Over checks
        const isComplete = targetLines > 0 && currentLinesThisLevel >= targetLines
        if ((isComplete || ns.gameOver) && !prevGameOverRef.current) {
          prevGameOverRef.current = true
          const resultStats = {
            score: ns.score,
            lines: ns.lines,
            linesThisLevel: currentLinesThisLevel,
            level: ns.level,
            gameOver: ns.gameOver,
            gameOverReason: ns.gameOverReason,
            ...statsRef.current,
          }
          if (isComplete) {
            onLevelComplete?.(resultStats)
          } else {
            onGameOver?.(resultStats)
          }
        }
      }

      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [active, paused, engine, targetLines, onCustomTick, onLevelComplete, onGameOver])

  // ── Audio SFX Reaction ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      prevStateRef.current = state
      return
    }
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
          try { musicManagerRef?.current?.setZoneFx?.(true) } catch {}
        } else {
          setSfxDuck(1.0)
          try { musicManagerRef?.current?.setZoneFx?.(false) } catch {}
        }
      }

      if (prev.current?.type === state.current?.type) {
        if (state.current?.x !== prev.current?.x) playMoveSFX(th)
        else if (state.current?.rotation !== prev.current?.rotation) playRotateSFX(th)
      }
    }
    prevStateRef.current = state
  }, [state, active, pieceTheme, musicManagerRef])

  return {
    engine,
    state,
    paused,
    setPaused,
    togglePause,
    linesThisLevel,
    setLinesThisLevel,
    resetGame,
    triggerAction,
    handlePress,
    handleRelease,
    handleHardDrop,
    isLandscape,
    hudSizing,
    zoom,
    setZoom,
    focus,
    setFocus,
    config,
    setConfig,
    heldRef,
    actionRef,
    levelStartLinesRef,
    statsRef,
  }
}

export default useTetrisGame
