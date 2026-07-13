import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress, saveGameResult, markEasyModePlayed, setActiveBadge } from '../firebase/db'
import SettingsPage from '../components/SettingsPage'
import { findZodiacBoss, ZODIAC_BOSSES, allZodiacBeaten, ophiuchusBeaten } from '../logic/storyData_s2'
import { TetrisEngine, GAME_MODE, ZONE_MIN_METER, ZONE_DURATION_MS } from '../logic/gameEngine'
import { setSfxVolume, setSfxDuck, playMoveSFX, playRotateSFX, playHoldSFX, playSoftDropSFX, playHardDropSFX, playLockSFX, playLineClearSFX, playTetrisSFX, playZoneActivateSFX } from '../audio/gameSfx'
import GameCanvas from '../components/GameCanvas'
import PieceMini from '../components/TetrominoMini'
import TouchControls from '../components/TouchControls'
import BackgroundCanvas from '../components/BackgroundCanvas'
import SynesthesiaMotionLayer from '../components/SynesthesiaMotionLayer'
import LandscapeGameLayout from '../components/LandscapeGameLayout'
import ZoomControl from '../components/ZoomControl'
import { Season2MusicManager } from '../audio/season2MusicManager'
import { emitSynesthesia, SYNESTHESIA_EVENT } from '../logic/synesthesiaBus'
import { GAME_CONFIG_KEY as CONFIG_KEY, readGameConfig as loadConfig } from '../logic/gameConfig'
import { useStoryProgress } from '../hooks/useStoryProgress'
import { hardResetAndReload } from '../logic/hardReset'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import { useResponsiveHUD } from '../hooks/useResponsiveHUD'

const MAX_FRAME_MS = 34

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

const PHASE = { STORY: 'story', LOADING: 'loading', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }

// ─── Boss ability hook ─────────────────────────────────────────────────────────
/**
 * Manages all per-boss mechanic side-effects. Returns:
 *   mirrorControls      {bool}  — Gemini: swap left/right
 *   hideNextCount       {number}— Leo: # of pieces to hide queue for
 *   rotationLocked      {bool}  — Virgo: block rotation this piece
 *   fogRows             {bool}  — Cancer: show fog on bottom rows
 *   poisonPieceType     {string|null} — Scorpio: current piece is poisoned
 *   colorShift          {number}— Pisces: 0–360 CSS hue offset
 *   constrictionCols    {number}— Ophiuchus: columns locked on each side (0–3)
 *   abilityActive       {bool}  — true during any active effect
 *   abilityLabel        {string}— label of the active effect for UI
 */
function useBossAbility({ bossId, engine, state, linesThisLevel, isActive }) {
  const [mirrorControls,   setMirrorControls]   = useState(false)
  const [hideNextCount,    setHideNextCount]     = useState(0)
  const [rotationLocked,   setRotationLocked]    = useState(false)
  const [fogRows,          setFogRows]           = useState(false)
  const [,                 setColorShift]        = useState(0)
  const [constrictionCols, setConstrictionCols]  = useState(0)
  const [abilityActive,    setAbilityActive]     = useState(false)
  const [abilityLabel,     setAbilityLabel]      = useState('')
  const [poisonSet,        setPoisonSet]         = useState(() => new Set())
  const [abilityToast,     setAbilityToast]      = useState(null)   // floating toast text
  const [toastId,          setToastId]           = useState(0)      // unique key per toast
  const [_attackTick,      setAttackTick]        = useState(0)      // ticks to update countdown

  const queueBossGarbage = useCallback((lines) => {
    const amount = Math.max(0, lines | 0)
    if (amount <= 0) return
    try {
      if (engine.mode === GAME_MODE.VERSUS) engine.receiveGarbage(amount)
      else engine.pendingGarbage = (engine.pendingGarbage ?? 0) + amount
    } catch {}
  }, [engine])

  // Internal refs (avoid stale-closure issues in timers)
  const linesRef         = useRef(0)
  const mirrorTimerRef   = useRef(null)
  const fogTimerRef      = useRef(null)
  const whirlTimerRef    = useRef(null)
  const tremorTimerRef   = useRef(null)
  const piecesPlacedRef  = useRef(0)
  const colorShiftRef    = useRef(0)
  const colorRafRef      = useRef(null)
  const toastTimerRef    = useRef(null)  // setTimeout for auto-hiding toast
  const attackTickRef    = useRef(null)  // setInterval for countdown display
  const attackStartRef   = useRef(null)  // when current timer interval started
  const attackTotalRef   = useRef(null)  // total interval duration in ms

  // Clear all timers on unmount or boss change
  useEffect(() => {
    return () => {
      clearTimeout(mirrorTimerRef.current)
      clearTimeout(fogTimerRef.current)
      clearInterval(whirlTimerRef.current)
      clearInterval(tremorTimerRef.current)
      cancelAnimationFrame(colorRafRef.current)
      clearInterval(attackTickRef.current)
      clearTimeout(toastTimerRef.current)
    }
  }, [bossId])

  // ── Ability: mirror controls (Gemini) ─────────────────────────────────────
  useEffect(() => {
    if (bossId !== 'gemini' || !isActive) return
    const TRIGGER_EVERY = 8
    const prevLines = linesRef.current
    if (
      linesThisLevel > 0 &&
      Math.floor(linesThisLevel / TRIGGER_EVERY) > Math.floor(prevLines / TRIGGER_EVERY) &&
      linesThisLevel >= TRIGGER_EVERY
    ) {
      clearTimeout(mirrorTimerRef.current)
      setMirrorControls(true)
      setAbilityActive(true)
      setAbilityLabel('MIRROR IMAGE')
      mirrorTimerRef.current = setTimeout(() => {
        setMirrorControls(false)
        setAbilityActive(false)
        setAbilityLabel('')
      }, 5000)
    }
    linesRef.current = linesThisLevel
  }, [bossId, linesThisLevel, isActive])

  // ── Ability: tremor — hard-drop every 10s (Taurus) ────────────────────────
  useEffect(() => {
    if (bossId !== 'taurus' || !isActive) return
    clearInterval(tremorTimerRef.current)
    attackStartRef.current = performance.now()
    attackTotalRef.current = 10000
    clearInterval(attackTickRef.current)
    attackTickRef.current = setInterval(() => setAttackTick(t => t + 1), 100)
    tremorTimerRef.current = setInterval(() => {
      if (!isActive) return
      try { engine.hardDrop() } catch {}
      setAbilityActive(true)
      setAbilityLabel('TREMOR')
      attackStartRef.current = performance.now()
      setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 800)
    }, 10000)
    return () => { clearInterval(tremorTimerRef.current); clearInterval(attackTickRef.current) }
  }, [bossId, isActive, engine])

  // ── Ability: meteor strike — garbage every 5 lines (Aries) ───────────────
  useEffect(() => {
    if (bossId !== 'aries' || !isActive) return
    const TRIGGER_EVERY = 5
    const prevLines = linesRef.current
    if (
      linesThisLevel > 0 &&
      Math.floor(linesThisLevel / TRIGGER_EVERY) > Math.floor(prevLines / TRIGGER_EVERY)
    ) {
      queueBossGarbage(3)
      setAbilityActive(true)
      setAbilityLabel('METEOR STRIKE')
      setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1200)
    }
    linesRef.current = linesThisLevel
  }, [bossId, linesThisLevel, isActive, queueBossGarbage])

  // ── Ability: high tide — fog every 15s (Cancer) ───────────────────────────
  useEffect(() => {
    if (bossId !== 'cancer' || !isActive) return
    clearInterval(fogTimerRef.current)
    attackStartRef.current = performance.now()
    attackTotalRef.current = 15000
    clearInterval(attackTickRef.current)
    attackTickRef.current = setInterval(() => setAttackTick(t => t + 1), 100)
    fogTimerRef.current = setInterval(() => {
      if (!isActive) return
      setFogRows(true)
      setAbilityActive(true)
      setAbilityLabel('HIGH TIDE')
      attackStartRef.current = performance.now()
      setTimeout(() => {
        setFogRows(false)
        setAbilityActive(false)
        setAbilityLabel('')
      }, 8000)
    }, 15000)
    return () => { clearInterval(fogTimerRef.current); clearInterval(attackTickRef.current) }
  }, [bossId, isActive])

  // ── Ability: solar flare — hide next 3 pieces on Tetris (Leo) ────────────
  const prevClearRef = useRef(null)
  useEffect(() => {
    if (bossId !== 'leo' || !isActive) return
    const cur = state.lastClear
    if (cur && cur !== prevClearRef.current && cur.lines >= 4) {
      prevClearRef.current = cur
      setHideNextCount(3)
      setAbilityActive(true)
      setAbilityLabel('SOLAR FLARE')
    }
  }, [bossId, state.lastClear, isActive])

  // Decrement hideNextCount when a piece locks
  const prevLockedRef = useRef(false)
  useEffect(() => {
    if (bossId !== 'leo') return
    if (state.pieceLocked && !prevLockedRef.current) {
      setHideNextCount(n => {
        const next = Math.max(0, n - 1)
        if (next <= 0) { setAbilityActive(false); setAbilityLabel('') }
        return next
      })
    }
    prevLockedRef.current = state.pieceLocked
  }, [bossId, state.pieceLocked])

  // ── Ability: overgrowth — lock rotation every ~10 pieces (Virgo) ─────────
  const prevPieceLockRef = useRef(false)
  useEffect(() => {
    if (bossId !== 'virgo' || !isActive) return
    if (state.pieceLocked && !prevPieceLockRef.current) {
      piecesPlacedRef.current += 1
      if (piecesPlacedRef.current % 8 === 0) {
        setRotationLocked(true)
        setAbilityActive(true)
        setAbilityLabel('OVERGROWTH')
      } else {
        setRotationLocked(false)
        if (abilityLabel === 'OVERGROWTH') { setAbilityActive(false); setAbilityLabel('') }
      }
    }
    prevPieceLockRef.current = state.pieceLocked
  }, [bossId, state.pieceLocked, isActive, abilityLabel])

  // ── Ability: imbalance — check height diff periodically (Libra) ──────────
  useEffect(() => {
    if (bossId !== 'libra' || !isActive) return
    attackStartRef.current = performance.now()
    attackTotalRef.current = 4000
    clearInterval(attackTickRef.current)
    attackTickRef.current = setInterval(() => setAttackTick(t => t + 1), 100)
    const id = setInterval(() => {
      if (!isActive) return
      attackStartRef.current = performance.now()
      try {
        const board = engine.board
        if (!board) return
        const W = board[0]?.length || 10
        const half = Math.floor(W / 2)
        const getColHeight = (col) => {
          for (let r = 0; r < board.length; r++) {
            if (board[r][col]) return board.length - r
          }
          return 0
        }
        let leftMax = 0, rightMax = 0
        for (let c = 0; c < half; c++) leftMax = Math.max(leftMax, getColHeight(c))
        for (let c = half; c < W; c++) rightMax = Math.max(rightMax, getColHeight(c))
        if (Math.abs(leftMax - rightMax) >= 5) {
          queueBossGarbage(3)
          setAbilityActive(true)
          setAbilityLabel('IMBALANCE')
          setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1200)
        }
      } catch {}
    }, 4000)
    return () => { clearInterval(id); clearInterval(attackTickRef.current) }
  }, [bossId, isActive, engine, queueBossGarbage])

  // ── Ability: poison blocks (Scorpio) ─────────────────────────────────────
  // Tag every 3rd queued piece as poisoned; on line-clear with poisoned piece → speed boost
  const prevQueueRef = useRef([])
  const [speedBoostActive, setSpeedBoostActive] = useState(false)
  const speedTimerRef = useRef(null)
  useEffect(() => {
    if (bossId !== 'scorpio' || !isActive) return
    const queue = state.queue ?? []
    if (JSON.stringify(queue) !== JSON.stringify(prevQueueRef.current)) {
      // Re-evaluate poison set — tag ~33% of upcoming pieces
      const newPoison = new Set()
      queue.forEach((_, idx) => { if (idx % 3 === 1) newPoison.add(idx) })
      setPoisonSet(newPoison)
      prevQueueRef.current = queue
    }
  }, [bossId, state.queue, isActive])

  const prevClearScorpio = useRef(null)
  useEffect(() => {
    if (bossId !== 'scorpio' || !isActive) return
    const cur = state.lastClear
    if (cur && cur !== prevClearScorpio.current && cur.lines > 0) {
      prevClearScorpio.current = cur
      // 30% chance of triggering speed boost (approximation of "poisoned piece cleared")
      if (poisonSet.size > 0 && Math.random() < 0.30) {
        clearTimeout(speedTimerRef.current)
        setSpeedBoostActive(true)
        setAbilityActive(true)
        setAbilityLabel('VENOM RUSH')
        // Save both level and storyLevelOffset so the engine doesn't recalculate
        // back to the story level on the next update() tick
        const prevLevel = engine.level
        const prevLevelOffset = engine.storyLevelOffset
        engine.storyLevelOffset = 0
        engine.level = 20
        speedTimerRef.current = setTimeout(() => {
          engine.storyLevelOffset = prevLevelOffset
          engine.level = prevLevel
          setSpeedBoostActive(false)
          setAbilityActive(false)
          setAbilityLabel('')
        }, 5000)
      }
    }
  }, [bossId, state.lastClear, isActive, engine, poisonSet])

  // ── Ability: volley — 25% chance post-clear sends 1 garbage (Sagittarius) ─
  const prevClearSag = useRef(null)
  useEffect(() => {
    if (bossId !== 'sagittarius' || !isActive) return
    const cur = state.lastClear
    if (cur && cur !== prevClearSag.current && cur.lines > 0) {
      prevClearSag.current = cur
      if (Math.random() < 0.45) {
        queueBossGarbage(3)
        setAbilityActive(true)
        setAbilityLabel('VOLLEY SHOT')
        setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1000)
      }
    }
  }, [bossId, state.lastClear, isActive, queueBossGarbage])

  // ── Ability: avalanche — 2 garbage every 5 lines (Capricorn) ────────────
  useEffect(() => {
    if (bossId !== 'capricorn' || !isActive) return
    const TRIGGER_EVERY = 5
    const prevLines = linesRef.current
    if (
      linesThisLevel > 0 &&
      Math.floor(linesThisLevel / TRIGGER_EVERY) > Math.floor(prevLines / TRIGGER_EVERY)
    ) {
      queueBossGarbage(2)
      setAbilityActive(true)
      setAbilityLabel('AVALANCHE')
      setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1400)
    }
    linesRef.current = linesThisLevel
  }, [bossId, linesThisLevel, isActive, queueBossGarbage])

  // ── Ability: whirlwind — random nudge every 3.5s (Aquarius) ──────────────
  useEffect(() => {
    if (bossId !== 'aquarius' || !isActive) return
    clearInterval(whirlTimerRef.current)
    attackStartRef.current = performance.now()
    attackTotalRef.current = 3500
    clearInterval(attackTickRef.current)
    attackTickRef.current = setInterval(() => setAttackTick(t => t + 1), 100)
    whirlTimerRef.current = setInterval(() => {
      if (!isActive) return
      try {
        if (Math.random() < 0.5) engine.tryMove(-1)
        else engine.tryMove(1)
      } catch {}
      setAbilityActive(true)
      setAbilityLabel('WHIRLWIND')
      attackStartRef.current = performance.now()
      setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 700)
    }, 3500)
    return () => { clearInterval(whirlTimerRef.current); clearInterval(attackTickRef.current) }
  }, [bossId, isActive, engine])

  // ── Ability: illusion — cycle hue rotation (Pisces) ──────────────────────
  // Update via CSS custom property directly in the RAF to avoid React batching
  // delays that cause the animation to pause when many game-state updates fire
  // simultaneously (e.g. on piece lock / hard-drop).
  useEffect(() => {
    if (bossId !== 'pisces' || !isActive) {
      cancelAnimationFrame(colorRafRef.current)
      document.documentElement.style.removeProperty('--pisces-hue')
      return
    }
    let prev = performance.now()
    const tick = (now) => {
      const dt = now - prev; prev = now
      colorShiftRef.current = (colorShiftRef.current + dt * 0.12) % 360
      // Drive hue via CSS custom property — frame-accurate, bypasses React batching
      document.documentElement.style.setProperty('--pisces-hue', `${Math.round(colorShiftRef.current)}deg`)
      setColorShift(colorShiftRef.current)
      colorRafRef.current = requestAnimationFrame(tick)
    }
    colorRafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(colorRafRef.current)
      document.documentElement.style.removeProperty('--pisces-hue')
    }
  }, [bossId, isActive])

  // ── Ability: constriction — narrow board every 10 lines (Ophiuchus) ───────
  useEffect(() => {
    if (bossId !== 'ophiuchus' || !isActive) return
    const newCols = Math.min(3, Math.floor(linesThisLevel / 10))
    if (newCols !== constrictionCols) {
      setConstrictionCols(newCols)
      // Send 2 garbage rows to simulate column lockoff
      if (newCols > constrictionCols) {
        queueBossGarbage(2)
        setAbilityActive(true)
        setAbilityLabel('CONSTRICTION')
        setTimeout(() => { setAbilityActive(false); setAbilityLabel('') }, 1600)
      }
    }
  }, [bossId, linesThisLevel, isActive, constrictionCols, queueBossGarbage])

  // ── Sync linesRef for multi-use bosses ────────────────────────────────────
  useEffect(() => {
    if (!['aries', 'capricorn'].includes(bossId)) return
    linesRef.current = linesThisLevel
  }, [bossId, linesThisLevel])

  // ── Toast: show floating label on every ability activation ────────────────
  const prevAbilityActiveRef = useRef(false)
  useEffect(() => {
    if (abilityActive && !prevAbilityActiveRef.current) {
      setAbilityToast(abilityLabel)
      setToastId(id => id + 1)
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setAbilityToast(null), 2500)
    }
    prevAbilityActiveRef.current = abilityActive
  }, [abilityActive, abilityLabel])

  // ── Attack indicator: countdown (timer bosses) or fill bar (line bosses) ───
  let attackIndicator = null
  if (isActive) {
    if (['taurus', 'cancer', 'aquarius', 'libra'].includes(bossId) && attackStartRef.current !== null) {
      const elapsed = performance.now() - attackStartRef.current
      const total   = attackTotalRef.current
      attackIndicator = { type: 'timer', ms: Math.max(0, total - elapsed), total }
    } else if (bossId === 'aries') {
      attackIndicator = { type: 'line', fill: (linesThisLevel % 5) / 5, label: 'METEOR STRIKE' }
    } else if (bossId === 'gemini') {
      attackIndicator = { type: 'line', fill: (linesThisLevel % 8) / 8, label: 'MIRROR IMAGE' }
    } else if (bossId === 'capricorn') {
      attackIndicator = { type: 'line', fill: (linesThisLevel % 10) / 10, label: 'AVALANCHE' }
    } else if (bossId === 'ophiuchus') {
      attackIndicator = { type: 'line', fill: (linesThisLevel % 10) / 10, label: 'CONSTRICTION' }
    }
  }

  return {
    mirrorControls,
    hideNextCount,
    rotationLocked,
    fogRows,
    constrictionCols,
    speedBoostActive,
    abilityActive,
    abilityLabel,
    abilityToast,
    toastId,
    attackIndicator,
  }
}

// ─── Game loop hook ────────────────────────────────────────────────────────────
// mirrorRef / rotLockRef are passed as stable refs so the keyboard handler
// never needs to re-register — it reads .current which is always fresh.
function useZodiacGameLoop(engine, targetLines, levelStartLinesRef, levelKey, onComplete, musicRef, beatRef, active, mirrorRef, rotLockRef) {
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
    let mappedKey = key
    if (mirrorRef.current) {
      if (key === 'left') mappedKey = 'right'
      else if (key === 'right') mappedKey = 'left'
    }
    if (isHeld) heldRef.current[mappedKey] = true
    else triggerAction(mappedKey)
  }, [triggerAction, mirrorRef])

  const handleRelease = useCallback((key) => {
    let mappedKey = key
    if (mirrorRef.current) {
      if (key === 'left') mappedKey = 'right'
      else if (key === 'right') mappedKey = 'left'
    }
    heldRef.current[mappedKey] = false
  }, [mirrorRef])

  // Keyboard — refs let us read live mirror/rotLock without re-registering listeners
  useEffect(() => {
    const down = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b) return
      ev.preventDefault(); if (ev.repeat) return
      if (b.held) {
        let key = b.held
        if (mirrorRef.current) { if (key === 'left') key = 'right'; else if (key === 'right') key = 'left' }
        heldRef.current[key] = true
        if (b.held === 'left' || b.held === 'right') emitSynesthesia(SYNESTHESIA_EVENT.MOVE, { intensity: 0.9, source: 'zodiac-kb' })
        if (b.held === 'softDrop') emitSynesthesia(SYNESTHESIA_EVENT.SOFT_DROP, { intensity: 0.82, source: 'zodiac-kb' })
        try { window.dispatchEvent(new Event('bg-beat')) } catch {}
      }
      if (b.action) {
        if (b.action === 'pause') { togglePause(); return }
        // Virgo: block rotation
        if (rotLockRef.current && (b.action === 'rotateCW' || b.action === 'rotateCCW' || b.action === 'rotate180')) return
        actionRef.current[b.action] = true
        if (b.action === 'rotateCW' || b.action === 'rotateCCW' || b.action === 'rotate180') emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 'zodiac-kb' })
        if (b.action === 'hardDrop') emitSynesthesia(SYNESTHESIA_EVENT.HARD_DROP, { intensity: 1.22, source: 'zodiac-kb' })
        try { window.dispatchEvent(new Event('bg-beat')) } catch {}
      }
    }
    const up = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b?.held) return
      ev.preventDefault()
      let key = b.held
      if (mirrorRef.current) { if (key === 'left') key = 'right'; else if (key === 'right') key = 'left' }
      heldRef.current[key] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [mirrorRef, rotLockRef, togglePause])

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
              } else {
                // Virgo: block rotation
                if (rotLockRef.current && (action === 'rotateCW' || action === 'rotateCCW' || action === 'rotate180')) {
                  prevButtons[btn] = pressed
                  continue
                }
                actionRef.current[action] = true
              }
              try { window.dispatchEvent(new Event('bg-beat')) } catch {}
            }
            prevButtons[btn] = pressed
          }
          for (const [btn, held] of Object.entries(GP_HELD_MAP)) {
            const pressed = gp.buttons[btn]?.pressed
            let key = held
            if (mirrorRef.current) { if (key === 'left') key = 'right'; else if (key === 'right') key = 'left' }
            heldRef.current[key] = pressed
          }
          if (gp.axes.length >= 4) {
            const hAxis = gp.axes[2], vAxis = gp.axes[3]
            gpHeldRef.left = Math.abs(hAxis) > AXIS_DEAD && hAxis < 0
            gpHeldRef.right = Math.abs(hAxis) > AXIS_DEAD && hAxis > 0
            gpHeldRef.softDrop = Math.abs(vAxis) > AXIS_DEAD && vAxis > 0
            let leftKey = 'left', rightKey = 'right'
            if (mirrorRef.current) { leftKey = 'right'; rightKey = 'left' }
            heldRef.current[leftKey] = heldRef.current[leftKey] || gpHeldRef.left
            heldRef.current[rightKey] = heldRef.current[rightKey] || gpHeldRef.right
            heldRef.current.softDrop = heldRef.current.softDrop || gpHeldRef.softDrop
          }
        }
      }
      rafId = requestAnimationFrame(poll)
    }
    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [togglePause, mirrorRef, rotLockRef])

  // rAF loop
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

// ─── Main page component ───────────────────────────────────────────────────────
export default function ZodiacLevelPage() {
  const { bossId }  = useParams()
  const navigate    = useNavigate()
  const { user }    = useAuth()

  const boss = useMemo(() => findZodiacBoss(bossId), [bossId])

  const [phase,      setPhase]      = useState(PHASE.STORY)
  const [finalLines, setFinalLines] = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [saving,     setSaving]     = useState(false)
  const [storyCountdown, setStoryCountdown] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [easyMode,   setEasyMode]   = useState(() => { try { return localStorage.getItem('story-easy') === '1' } catch { return false } })
  const [focus,      setFocus]      = useState(() => { try { return localStorage.getItem('focus-mode') === '1' } catch { return false } })
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [isLandscape, setIsLandscape] = useState(() => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    return window.innerWidth > window.innerHeight && hasTouch
  })
  
  // Get responsive HUD sizing that matches SOLO mode
  const hudSizing = useResponsiveHUD(isLandscape)
  
  const [zoom, setZoom] = useState(() => {
    const saved = Number(localStorage.getItem('tetris-zoom') || 1)
    // Clamp to 0.5–2.0 (50%–200%)
    return saved >= 0.5 && saved <= 2.0 ? saved : 1
  })
  const engine = useMemo(() => new TetrisEngine(), [])

  const levelStartLinesRef = useRef(0)
  const pendingResetRef    = useRef(true)
  const musicRef           = useRef(null)
  const beatRef            = useRef(0)

  // Progress state (to enable "Next Boss" convenience after a clear)
  const { progress } = useStoryProgress(user?.uid)

  const effectiveProgress = useMemo(() => (
    phase === PHASE.COMPLETE
      ? { ...progress, [`zodiac_${bossId}_completed`]: true }
      : progress
  ), [progress, phase, bossId])

  const nextBossId = useMemo(() => {
    try {
      const order = ZODIAC_BOSSES.map(b => b.id)
      // Offer Ophiuchus at the end only once all 12 are beaten and Ophiuchus not yet cleared
      if (allZodiacBeaten(effectiveProgress) && !ophiuchusBeaten(effectiveProgress)) order.push('ophiuchus')
      const start = Math.max(0, order.indexOf(bossId))
      for (let i = 1; i <= order.length; i++) {
        const id = order[(start + i) % order.length]
        if (!effectiveProgress[`zodiac_${id}_completed`]) return id
      }
      return null
    } catch { return null }
  }, [bossId, effectiveProgress])

  const [config, setConfig] = useState(loadConfig)

  const pieceTheme = useMemo(() => BG_TYPE_TO_PIECE_THEME[boss?.bgType] ?? 'classic', [boss])

  useEffect(() => { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) } catch {} }, [config])
  useEffect(() => { try { engine.setSettings({ das: config.das, arr: config.arr }) } catch {} }, [config.das, config.arr, engine])
  useEffect(() => { try { musicRef.current?.setVolume?.(config.musicVolume) } catch {} }, [config.musicVolume])
  useEffect(() => { setSfxVolume(config.sfxVolume ?? 1.0) }, [config.sfxVolume])
  useEffect(() => { try { localStorage.setItem('focus-mode', focus ? '1' : '0') } catch {} }, [focus])
  useEffect(() => { try { localStorage.setItem('story-easy', easyMode ? '1' : '0') } catch {} }, [easyMode])

  // Focus hotkey
  useEffect(() => {
    const onKey = (e) => { if (e.code === 'KeyF') setFocus(f => !f) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      setIsLandscape(window.innerWidth > window.innerHeight && hasTouch)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    pendingResetRef.current = true
    levelStartLinesRef.current = 0
    setFinalLines(0)
    setFinalScore(0)
    setStoryCountdown(null)
    setPhase(PHASE.STORY)
  }, [bossId])

  // Music
  useEffect(() => {
    if (phase === PHASE.LOADING || phase === PHASE.GAME) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx && !musicRef.current) musicRef.current = new Season2MusicManager(new Ctx())
      musicRef.current?.playForBoss(bossId)
      musicRef.current?.setLevelBpm?.(boss?.bpm || 120)
    } else if (phase === PHASE.FAIL || phase === PHASE.COMPLETE) {
      musicRef.current?.stop()
    }
  }, [phase, bossId, boss])
  useEffect(() => () => { musicRef.current?.stop() }, [])

  // Engine reset
  useEffect(() => {
    if (phase === PHASE.GAME && pendingResetRef.current) {
      pendingResetRef.current = false
      engine.reset(GAME_MODE.NORMAL)
      levelStartLinesRef.current = 0
      const gm        = boss?.gravityMult ?? 1.0
      const gravFactor = easyMode ? 0.6 : 1.0
      const targetLevel = Math.max(1, Math.round(gm * gravFactor * 5 + 1))
      engine.level = targetLevel
      engine.storyLevelOffset = targetLevel
      engine.storyLinesOffset = 0
    }
  }, [phase, engine, boss, easyMode])

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
  }, [phase, bossId])

  useEffect(() => {
    if (phase !== PHASE.LOADING) return
    const id = setTimeout(() => {
      pendingResetRef.current = true
      setPhase(PHASE.GAME)
    }, 650)
    return () => clearTimeout(id)
  }, [phase, bossId])

  const effectiveTargetLines = easyMode ? (boss?.easyTargetLines ?? 32) : (boss?.targetLines ?? 40)
  const levelKey             = `zodiac-${bossId}`

  const handleComplete = useCallback(({ score, lines, linesThisLevel: ltl, gameOver }) => {
    const lt = ltl ?? lines
    setFinalScore(score)
    setFinalLines(lt)
    if (gameOver) { setPhase(PHASE.FAIL); return }

    // Save progress
    if (user) {
      setSaving(true)
      const scoreThisLevel = Math.max(0, score)
      const tasks = [
        saveStoryProgress(user.uid, 'zodiac', bossId, scoreThisLevel, lt),
        saveGameResult(user.uid, 'story', score, { lines: lt, level: engine.getState().level || 1 }).catch(() => {}),
      ]
      if (easyMode) {
        tasks.push(markEasyModePlayed(user.uid).catch(() => {}))
        tasks.push(setActiveBadge(user.uid, 'badge_noob').catch(() => {}))
      }
      Promise.all(tasks).finally(() => setSaving(false))
    }
    setPhase(PHASE.COMPLETE)
  }, [user, bossId, easyMode, engine])

  // Boss ability state
  const loopActive = phase === PHASE.GAME

  // Pre-create refs so the game loop keyboard handler can always read the latest
  // mirror/rotLock state without needing to re-register event listeners.
  const mirrorRef  = useRef(false)
  const rotLockRef = useRef(false)

  // Use the main game loop — pass the refs directly
  const {
    state,
    paused,
    triggerAction,
    handlePress,
    handleRelease,
    togglePause,
  } = useZodiacGameLoop(
    engine,
    effectiveTargetLines,
    levelStartLinesRef,
    levelKey,
    handleComplete,
    musicRef,
    beatRef,
    loopActive,
    mirrorRef,
    rotLockRef,
  )

  const linesThisLevel = state.lines - levelStartLinesRef.current

  const {
    mirrorControls,
    hideNextCount,
    rotationLocked,
    fogRows,
    constrictionCols,
    speedBoostActive,
    abilityActive,
    abilityLabel,
    abilityToast,
    toastId,
    attackIndicator,
  } = useBossAbility({ bossId, engine, state, linesThisLevel, isActive: loopActive && !paused })

  // Keep refs in sync — read by keyboard handler and drag callbacks each frame
  mirrorRef.current  = mirrorControls
  rotLockRef.current = rotationLocked

  // SFX
  useEffect(() => {
    if (phase !== PHASE.GAME) return
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
        if (b.action === 'hold') playHoldSFX(th)
        if (b.action === 'activateZone') playZoneActivateSFX(th)
      } catch {}
    }
    window.addEventListener('keydown', onKeySfx)
    return () => window.removeEventListener('keydown', onKeySfx)
  }, [phase, config?.sfxEnabled, pieceTheme, paused])

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
    // handlePress applies mirror internally via mirrorRef.current — pass raw dir
    if (dir === 'left' || dir === 'right') {
      if (config?.sfxEnabled && !paused) try { playMoveSFX(pieceTheme || 'classic') } catch {}
      emitSynesthesia(SYNESTHESIA_EVENT.MOVE, { intensity: 1.03, source: 'zodiac-drag' })
      handlePress(dir, true)
    } else if (dir === 'down') {
      if (config?.sfxEnabled && !paused) try { playSoftDropSFX(pieceTheme || 'classic') } catch {}
      emitSynesthesia(SYNESTHESIA_EVENT.SOFT_DROP, { intensity: 0.95, source: 'zodiac-drag' })
      handlePress('softDrop', true)
    } else if (dir === 'up') {
      if (config?.sfxEnabled && !paused) try { playHoldSFX(pieceTheme || 'classic') } catch {}
      triggerAction('hold')
    }
    try { window.dispatchEvent(new Event('bg-beat')) } catch {}
  }, [handlePress, triggerAction, config?.sfxEnabled, paused, pieceTheme])

  const handleDragEnd = useCallback((dir) => {
    // handleRelease applies mirror internally via mirrorRef.current
    if (dir === 'left' || dir === 'right') handleRelease(dir)
    else if (dir === 'down') handleRelease('softDrop')
  }, [handleRelease])

  const handleHardDrop = useCallback(() => {
    if (config?.sfxEnabled && !paused) try { playHardDropSFX(pieceTheme || 'classic') } catch {}
    handleRelease('softDrop')
    emitSynesthesia(SYNESTHESIA_EVENT.HARD_DROP, { intensity: 1.24, source: 'zodiac-gesture' })
    triggerAction('hardDrop')
    try { window.dispatchEvent(new Event('bg-beat')) } catch {}
  }, [handleRelease, triggerAction, config?.sfxEnabled, paused, pieceTheme])

  const showOnScreenControls = (() => {
    try { return JSON.parse(localStorage.getItem('tetris-config') ?? '{}').showOnScreenControls ?? false }
    catch { return false }
  })()

  const beatEnergy = beatRef.current
  const boardAlpha = phase === PHASE.GAME ? Math.max(0.28, 0.46 - beatEnergy * 0.18) : undefined

  // Pisces illusion: apply CSS hue rotation to the canvas wrapper.
  // Use var(--pisces-hue) which is updated every RAF frame directly on the root
  // element — this is frame-accurate and immune to React's batching delays.
  const illusion = bossId === 'pisces' && phase === PHASE.GAME
  const illusionStyle = illusion
    ? { filter: 'hue-rotate(var(--pisces-hue, 0deg))' }
    : {}

  if (!boss) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a14', color: '#f87171', fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '0.15em' }}>
        BOSS NOT FOUND —
        <button onClick={() => navigate('/s2')} style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', marginLeft: 8 }}>← Back</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: '"Courier New", monospace' }}>
      {/* Background */}
      <BackgroundCanvas
        bgType={boss.bgType || 'stars'}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        beatRef={beatRef}
        bpm={boss.bpm || 120}
        comboStreak={state.combo ?? 0}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)', pointerEvents: 'none' }} />

      {/* ── Story intro ──────────────────────────────────────────────────── */}
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
              style={{ textAlign: 'center', maxWidth: 460 }}
            >
              {/* Boss glyph */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 160, damping: 14 }}
                style={{
                  fontSize: '4rem',
                  marginBottom: '0.6rem',
                  filter: `drop-shadow(0 0 20px ${boss.color})`,
                  lineHeight: 1,
                }}
              >
                {boss.glyph}
              </motion.div>
              <div style={{ fontSize: '0.5rem', color: boss.color, letterSpacing: '0.38em', textTransform: 'uppercase', marginBottom: 6 }}>
                Season 2 · Zodiac Boss
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '0.14em', color: '#fff', marginBottom: 4 }}>
                {boss.name}
              </div>
              <div style={{ fontSize: '0.66rem', color: '#555', letterSpacing: '0.2em', marginBottom: '1.4rem' }}>
                {boss.subtitle}
              </div>

              {/* Boss speech */}
              <div style={{
                background: `${boss.color}0d`,
                border: `1px solid ${boss.color}33`,
                borderRadius: 10,
                padding: '1rem 1.2rem',
                marginBottom: '1.4rem',
                textAlign: 'left',
              }}>
                <p style={{ color: '#ddd', fontSize: '0.88rem', lineHeight: 1.75, letterSpacing: '0.03em', margin: 0, fontStyle: 'italic' }}>
                  "{boss.storyBefore}"
                </p>
              </div>

              {/* Ability preview */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: '1.2rem',
                fontSize: '0.64rem',
                color: '#777',
              }}>
                <span style={{ color: boss.color, fontWeight: 700 }}>⚡ {boss.abilityLabel}:</span>
                {' '}{boss.abilityDesc}
              </div>

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
                    <div style={{ height: '100%', background: boss.color, borderRadius: 2, transition: 'width 0.9s linear', width: `${((13 - storyCountdown) / 13) * 100}%` }} />
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { pendingResetRef.current = true; setPhase(PHASE.LOADING) }}
                  style={{ background: boss.color, border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.2em', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}
                >
                  {storyCountdown !== null && storyCountdown > 0 ? `CHALLENGE (${storyCountdown}s)` : 'CHALLENGE'}
                </motion.button>

                <button
                  onClick={() => navigate('/s2', { replace: true })}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.12em', fontFamily: 'inherit', marginTop: 4 }}
                >
                  ← Zodiac Map
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
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.56rem', letterSpacing: '0.24em', color: boss.color, marginBottom: 12 }}>
                SUMMONING CONSTELLATION
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                style={{ width: 36, height: 36, margin: '0 auto 10px', borderRadius: '50%', border: `2px solid ${boss.color}55`, borderTopColor: boss.color }}
              />
              <div style={{ fontSize: '0.62rem', color: '#9ca3af', letterSpacing: '0.12em' }}>
                Loading boss music and arena...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game phase ───────────────────────────────────────────────────── */}
      {phase === PHASE.GAME && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column' }}>
          {isLandscape && <ZoomControl zoom={zoom} onChange={setZoom} />}
          {/* HUD */}
          {!focus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: hudSizing.hudPadding, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: hudSizing.isMobile ? (isLandscape ? '0.8rem' : '0.85rem') : '0.85rem', letterSpacing: '0.1em', flexShrink: 0, backdropFilter: 'blur(6px)', gap: isLandscape ? 8 : 10, flexWrap: 'nowrap', minHeight: hudSizing.hudMinHeight }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: '1.1rem', filter: `drop-shadow(0 0 6px ${boss.color})`, flexShrink: 0 }}>{boss.glyph}</span>
                <span style={{ color: boss.color, fontWeight: 700, fontSize: hudSizing.statsLabel, whiteSpace: 'nowrap' }}>{boss.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Boss ability indicator */}
                {abilityActive && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ fontSize: '0.55rem', color: boss.color, letterSpacing: '0.16em', border: `1px solid ${boss.color}88`, borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}
                  >
                    ⚡ {abilityLabel}
                  </motion.span>
                )}
                {mirrorControls && (
                  <span style={{ fontSize: '0.55rem', color: '#cc88ff', letterSpacing: '0.12em' }}>↔ MIRRORED</span>
                )}
                {rotationLocked && (
                  <span style={{ fontSize: '0.55rem', color: '#88dd88', letterSpacing: '0.12em' }}>🌿 LOCKED</span>
                )}
                <button
                  onClick={() => triggerAction('activateZone')}
                  disabled={state.zoneMeter < ZONE_MIN_METER || state.zoneActive}
                  style={{
                    background: state.zoneActive ? 'rgba(0,229,255,0.18)' : state.zoneMeter >= ZONE_MIN_METER ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#22d3ee' : 'rgba(255,255,255,0.1)'}`,
                    color: state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#80eaff' : '#555',
                    cursor: state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive ? 'pointer' : 'default',
                    fontSize: '0.62rem', padding: '2px 8px', borderRadius: 6, fontFamily: 'inherit',
                  }}
                >
                  ⚡ {state.zoneActive ? `${Math.ceil(state.zoneTimer / 1000)}s` : 'ZONE'}
                </button>
                <span style={{ color: '#555', fontSize: '0.62rem' }}>
                  {Math.min(linesThisLevel, effectiveTargetLines)} / {effectiveTargetLines}
                </span>
                {state.combo > 1 && <span style={{ color: '#f59e0b', fontSize: '0.62rem', fontWeight: 700 }}>x{state.combo}</span>}
                <span style={{ color: '#00d4ff', fontWeight: 700 }}>{state.score.toLocaleString()}</span>
                <button
                  onClick={togglePause}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', cursor: 'pointer', fontSize: '0.6rem', padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit' }}
                >
                  {paused ? '▶' : '⏸'}
                </button>
              </div>
            </div>
          )}

          {/* Boss HP bar — drains left as player clears lines */}
          {(() => {
            const hpPct = Math.max(0, Math.min(100, 100 - (linesThisLevel / effectiveTargetLines) * 100))
            const hpColor = hpPct > 60 ? boss.color
              : hpPct > 30 ? '#f59e0b'
              : '#ef4444'
            return (
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                {/* Segmented tick marks */}
                {[25, 50, 75].map(pct => (
                  <div key={pct} style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, width: 1, background: 'rgba(0,0,0,0.4)', zIndex: 2 }} />
                ))}
                {/* HP fill — starts full and shrinks from the right */}
                <motion.div
                  style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: hpColor, transformOrigin: 'left center', boxShadow: `0 0 6px ${hpColor}88` }}
                  animate={{ width: `${hpPct}%`, background: hpColor }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
                {/* HP label */}
                <div style={{ position: 'absolute', right: 4, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '0.38rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', zIndex: 3, pointerEvents: 'none' }}>
                  HP
                </div>
              </div>
            )
          })()}

          {/* PORTRAIT MODE: Clean HUD + Canvas layout (matches Solo Mode) */}
          {!isLandscape && !focus && (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '100%', flexShrink: 0, overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
              {/* Hold */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.3rem 0.45rem', borderRight: `1px solid ${boss.color}33`, gap: '0.1rem', minWidth: 58 }}>
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
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{Math.min(linesThisLevel, effectiveTargetLines)}/{effectiveTargetLines}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>Score</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#00d4ff', lineHeight: 1.1 }}>{state.score.toLocaleString()}</div>
                </div>
              </div>
              {/* Next */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.3rem 0.45rem', borderLeft: `1px solid ${boss.color}33`, gap: '0.15rem', minWidth: 58 }}>
                <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Next</div>
                {(state.queue ?? []).slice(0, 3).map((t, i) => (
                  <PieceMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
                ))}
              </div>
            </div>
          )}

          {/* Zone bar (portrait only, below HUD) */}
          {!isLandscape && !focus && (
            <div style={{ height: 4, width: '100%', background: 'rgba(20, 30, 70, 0.8)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, state.zoneActive ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100 : (state.zoneMeter || 0)))}%`, background: state.zoneActive ? 'linear-gradient(90deg, #8844ff, #00cfff)' : state.zoneMeter >= ZONE_MIN_METER ? 'linear-gradient(90deg, #00cfff, #fff)' : 'linear-gradient(90deg, #1e90ff, #00cfff)', transition: 'width 0.15s' }} />
            </div>
          )}

          {/* Landscape mode: full 3-column layout */}
          {isLandscape && (
            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
              {(() => {
                const gameCanvas = (
                  <GameCanvas
                    state={{
                      ...state,
                      queue: hideNextCount > 0 ? [] : state.queue,
                    }}
                    onTap={() => {
                      if (rotationLocked) return
                      if (config?.sfxEnabled && !paused) try { playRotateSFX(pieceTheme || 'classic') } catch {}
                      emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 'zodiac-tap' })
                      triggerAction('rotateCW')
                    }}
                    onTwoFingerTap={() => {
                      if (config?.sfxEnabled && !paused) try { playZoneActivateSFX(pieceTheme || 'classic') } catch {}
                      triggerAction('activateZone')
                    }}
                    onDragBegin={handleDragBegin}
                    onDragEnd={handleDragEnd}
                    onHardDrop={handleHardDrop}
                    onZoomGesture={scale => setZoom(value => Math.max(0.5, Math.min(2, value * scale)))}
                    themeOverride={pieceTheme}
                    boardAlpha={boardAlpha}
                    activePieceEffect={
                      bossId === 'scorpio' && speedBoostActive ? 'poison'
                      : bossId === 'virgo' && rotationLocked ? 'rotlock'
                      : null
                    }
                    screenShakeMultiplier={config?.screenShakeMultiplier ?? 1.0}
                  />
                )
                const canvasElement = !isMobile ? (
                  <div style={{ ...illusionStyle, height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom})`, transformOrigin: 'center center', maxWidth: '100%', maxHeight: '100%' }}>
                    {gameCanvas}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%', transform: `scale(${zoom})`, transformOrigin: 'center center', ...(illusion ? illusionStyle : {}) }}>
                    {gameCanvas}
                  </div>
                )
                return (
                  <LandscapeGameLayout
                    isLandscape={true}
                    gameMode="story"
                    state={state}
                    paused={paused}
                    phase={phase}
                    hudSizing={hudSizing}
                    zoom={zoom}
                    zoneActive={state.zoneActive || false}
                    zoneMeter={state.zoneMeter || 0}
                    zoneTimerMs={state.zoneTimer || 0}
                    onActivateZone={() => triggerAction('activateZone')}
                    currentLevel={boss}
                    targetLines={effectiveTargetLines}
                    linesThisLevel={linesThisLevel}
                    abilityActive={abilityActive}
                    abilityLabel={abilityLabel}
                    epochColor={boss?.color || '#ff0000'}
                    onPause={togglePause}
                    onZoom={() => {}}
                    onSettings={() => setShowSettings(true)}
                  >
                    {canvasElement}
                  </LandscapeGameLayout>
                )
              })()}
              
              {/* Cancer fog overlay */}
              <AnimatePresence>
                {fogRows && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '27%',
                      background: 'linear-gradient(to top, rgba(0, 30, 80, 0.78), transparent)',
                      pointerEvents: 'none',
                      backdropFilter: 'blur(1px)',
                      zIndex: 5,
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Ophiuchus constriction overlay */}
              {constrictionCols > 0 && (
                <>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: `${constrictionCols * 8.8}%`,
                    background: 'rgba(0,255,80,0.12)',
                    borderRight: '2px solid rgba(0,255,80,0.4)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }} />
                  <div style={{
                    position: 'absolute', top: 0, right: 0, bottom: 0,
                    width: `${constrictionCols * 8.8}%`,
                    background: 'rgba(0,255,80,0.12)',
                    borderLeft: '2px solid rgba(0,255,80,0.4)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }} />
                </>
              )}
            </div>
          )}

          {/* Portrait mode: vertical flex layout */}
          {!isLandscape && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, background: 'transparent', overflow: 'visible' }}>
              <SynesthesiaMotionLayer
              className="mobile-canvas-wrap"
              style={{
                background: 'transparent',
                gridColumn: isLandscape ? 2 : undefined,
                flex: !isLandscape ? 1 : undefined,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                paddingBottom: focus && showOnScreenControls && !isLandscape
                  ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px))'
                  : 0,
              }}
            >
              {(() => {
                const gameCanvas = (
                  <GameCanvas
                    state={{
                      ...state,
                      // Leo: hide next queue
                      queue: hideNextCount > 0 ? [] : state.queue,
                    }}
                    onTap={() => {
                      if (rotationLocked) return
                      if (config?.sfxEnabled && !paused) try { playRotateSFX(pieceTheme || 'classic') } catch {}
                      emitSynesthesia(SYNESTHESIA_EVENT.ROTATE, { intensity: 1.0, source: 'zodiac-tap' })
                      triggerAction('rotateCW')
                    }}
                    onTwoFingerTap={() => {
                      if (config?.sfxEnabled && !paused) try { playZoneActivateSFX(pieceTheme || 'classic') } catch {}
                      triggerAction('activateZone')
                    }}
                    onDragBegin={handleDragBegin}
                    onDragEnd={handleDragEnd}
                    onHardDrop={handleHardDrop}
                    onZoomGesture={scale => setZoom(value => Math.max(0.5, Math.min(2, value * scale)))}
                    themeOverride={pieceTheme}
                    boardAlpha={boardAlpha}
                    activePieceEffect={
                      bossId === 'scorpio' && speedBoostActive ? 'poison'
                      : bossId === 'virgo' && rotationLocked ? 'rotlock'
                      : null
                    }
                    screenShakeMultiplier={config?.screenShakeMultiplier ?? 1.0}
                  />
                )
                const canvasElement = !isMobile ? (
                  <div style={{ ...illusionStyle, height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom})`, transformOrigin: 'center center', maxWidth: '100%', maxHeight: '100%' }}>
                    {gameCanvas}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%', ...(illusion ? illusionStyle : {}) }}>
                    {gameCanvas}
                  </div>
                )
                return (
                  <LandscapeGameLayout
                    isLandscape={isLandscape}
                    gameMode="story"
                    state={state}
                    paused={paused}
                    phase={phase}
                    hudSizing={hudSizing}
                    zoom={zoom}
                    zoneActive={state.zoneActive || false}
                    zoneMeter={state.zoneMeter || 0}
                    zoneTimerMs={state.zoneTimer || 0}
                    onActivateZone={() => triggerAction('activateZone')}
                    currentLevel={boss}
                    targetLines={effectiveTargetLines}
                    linesThisLevel={linesThisLevel}
                    abilityActive={abilityActive}
                    abilityLabel={abilityLabel}
                    epochColor={boss?.color || '#ff0000'}
                    onPause={togglePause}
                    onZoom={() => {}}
                    onSettings={() => setShowSettings(true)}
                  >
                    {canvasElement}
                  </LandscapeGameLayout>
                )
              })()}

                  {/* Cancer: fog overlay on bottom rows */}
                  <AnimatePresence>
                    {fogRows && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '27%',
                          background: 'linear-gradient(to top, rgba(0, 30, 80, 0.78), transparent)',
                          pointerEvents: 'none',
                          backdropFilter: 'blur(1px)',
                          zIndex: 5,
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Ophiuchus: constriction overlay */}
                  {constrictionCols > 0 && (
                    <>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0,
                        width: `${constrictionCols * 8.8}%`,
                        background: 'rgba(0,255,80,0.12)',
                        borderRight: '2px solid rgba(0,255,80,0.4)',
                        pointerEvents: 'none',
                        zIndex: 5,
                      }} />
                      <div style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0,
                        width: `${constrictionCols * 8.8}%`,
                        background: 'rgba(0,255,80,0.12)',
                        borderLeft: '2px solid rgba(0,255,80,0.4)',
                        pointerEvents: 'none',
                        zIndex: 5,
                      }} />
                    </>
                  )}

                  {/* Leo: next queue hidden indicator */}
                  {hideNextCount > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      right: -50,
                      transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,0.75)',
                      border: '1px solid #ffcc00',
                      borderRadius: 6,
                      padding: '6px 8px',
                      fontSize: '0.55rem',
                      color: '#ffcc00',
                      letterSpacing: '0.1em',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      zIndex: 6,
                    }}>
                      ☀ FLARE<br />({hideNextCount})
                    </div>
                  )}

                  {/* Floating ability toast */}
                  <AnimatePresence>
                    {abilityToast && (
                      <motion.div
                        key={toastId}
                        initial={{ opacity: 0, y: 8, scale: 0.88 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.94 }}
                        transition={{ duration: 0.22 }}
                        style={{
                          position: 'absolute',
                          top: '10%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(0,0,0,0.88)',
                          border: `1px solid ${boss.color}cc`,
                          borderRadius: 8,
                          padding: '6px 16px',
                          fontSize: '0.72rem',
                          color: boss.color,
                          letterSpacing: '0.2em',
                          fontWeight: 900,
                          whiteSpace: 'nowrap',
                          zIndex: 25,
                          pointerEvents: 'none',
                          boxShadow: `0 0 18px ${boss.color}55`,
                        }}
                      >
                        ⚡ {abilityToast}
                      </motion.div>
                    )}
                  </AnimatePresence>

                {/* Focus toggle */}
                <button
                  onClick={() => setFocus(f => !f)}
                  className="ui-toggle-tab"
                  title={focus ? 'Exit Focus' : 'Enter Focus'}
                  aria-label={focus ? 'Exit Focus' : 'Enter Focus'}
                  style={{ right: 0 }}
                >
                  {focus ? '▲' : '▼'}
                </button>

                {/* Focus mini HUD */}
                {focus && (() => {
                  const zoneReady = state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive
                  const zoneFillPct = Math.max(0, Math.min(100, state.zoneActive
                    ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100
                    : (state.zoneMeter || 0)))
                  return (
                    <div className="fullscreen-mini-hud" style={{ right: 0 }}>
                      {/* Boss HP bar in focus mode */}
                      {(() => {
                        const hpPct = Math.max(0, 100 - Math.min(100, (linesThisLevel / effectiveTargetLines) * 100))
                        const hpColor = hpPct > 60 ? boss.color : hpPct > 30 ? '#f59e0b' : '#ef4444'
                        return (
                          <div style={{ width: '100%', padding: '4px 5px 0', boxSizing: 'border-box' }}>
                            <div style={{ fontSize: '0.38rem', color: '#555', letterSpacing: '0.1em', marginBottom: 2, textAlign: 'center' }}>BOSS HP</div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                              <motion.div
                                style={{ height: '100%', background: hpColor, borderRadius: 2, boxShadow: `0 0 5px ${hpColor}88`, transformOrigin: 'left center' }}
                                animate={{ width: `${hpPct}%`, background: hpColor }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        )
                      })()}
                      <div className="fmh-hold">
                        <div className="fmh-label">Hold</div>
                        <PieceMini type={state.hold} pieceTheme={pieceTheme} size={8} />
                      </div>
                      <div className="fmh-zone-wrap">
                        <div className={`fmh-zone-bar${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`} style={{ height: `${zoneFillPct}%` }} />
                      </div>
                      <div className="fmh-next">
                        <div className="fmh-label">Next</div>
                        {(hideNextCount > 0 ? [] : (state.queue ?? [])).slice(0, 3).map((t, i) => (
                          <PieceMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
                        ))}
                        {hideNextCount > 0 && <div style={{ fontSize: '0.7rem', color: '#ffcc00' }}>☀</div>}
                      </div>
                      {/* Attack indicator — timer countdown or line fill bar */}
                      {attackIndicator && !paused && (
                        <div style={{ padding: '6px 5px 2px', textAlign: 'center', minWidth: 0, width: '100%' }}>
                          {attackIndicator.type === 'timer' ? (
                            <>
                              <div style={{ fontSize: '0.42rem', color: '#777', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>Next Attack</div>
                              <div style={{ fontSize: '0.72rem', color: boss.color, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                                {(attackIndicator.ms / 1000).toFixed(1)}s
                              </div>
                              <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
                                <div style={{ height: '100%', width: `${Math.min(100, (1 - attackIndicator.ms / attackIndicator.total) * 100)}%`, background: boss.color, borderRadius: 2, transition: 'none' }} />
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: '0.42rem', color: '#777', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>Charging</div>
                              <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.round(attackIndicator.fill * 100)}%`, background: `linear-gradient(90deg, ${boss.color}88, ${boss.color})`, borderRadius: 2 }} />
                              </div>
                              <div style={{ fontSize: '0.52rem', color: boss.color, fontWeight: 700, marginTop: 4, letterSpacing: '0.12em' }}>
                                {attackIndicator.label}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Pause overlay */}
                {paused && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.2em', color: '#fff' }}>PAUSED</div>
                    <div style={{ fontSize: '0.85rem', filter: `drop-shadow(0 0 8px ${boss.color})` }}>{boss.glyph}</div>
                    <div style={{ fontSize: '0.6rem', color: boss.color, letterSpacing: '0.2em' }}>{boss.name} — {boss.subtitle}</div>
                    <div style={{ fontSize: '0.56rem', color: '#555', letterSpacing: '0.14em' }}>
                      {linesThisLevel} / {effectiveTargetLines} lines
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => musicRef.current?.prev?.()}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
                      <button type="button" onClick={() => musicRef.current?.pause?.()}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏸</button>
                      <button type="button" onClick={() => musicRef.current?.resume?.()}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>▶</button>
                      <button type="button" onClick={() => musicRef.current?.next?.()}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏭</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.60rem', color: '#777' }}>Vol</span>
                      <input type="range" min={0} max={1} step={0.01}
                        value={config.musicVolume}
                        onChange={e => { const v = parseFloat(e.target.value); setConfig(p => ({ ...p, musicVolume: v })); musicRef.current?.setVolume?.(v) }}
                        style={{ width: 140 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button onClick={() => setShowSettings(true)}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>⚙ Settings</button>
                    </div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={togglePause}
                      style={{ background: 'none', border: `1px solid ${boss.color}`, color: boss.color, borderRadius: 6, padding: '8px 22px', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.16em', fontFamily: 'inherit', fontWeight: 700 }}>
                      ▶ RESUME
                    </motion.button>
                    <button onClick={() => navigate('/s2', { replace: true })}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#bbb', borderRadius: 6, padding: '7px 18px', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>
                      ← ZODIAC MAP
                    </button>
                    <button onClick={() => { togglePause(); pendingResetRef.current = true; setPhase(PHASE.STORY) }}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#555', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>
                      RESTART
                    </button>
                  </div>
                )}
              </SynesthesiaMotionLayer>

              {/* Touch controls (portrait mode only) */}
              {showOnScreenControls && !focus && (
                <TouchControls onPress={handlePress} onRelease={handleRelease} />
              )}

              {showOnScreenControls && focus && (
                <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, pointerEvents: 'auto' }}>
                  <TouchControls onPress={handlePress} onRelease={handleRelease} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Complete / Fail overlay ──────────────────────────────────────── */}
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
              style={{
                textAlign: 'center',
                maxWidth: 400,
                background: 'rgba(10,10,20,0.94)',
                border: `1px solid ${phase === PHASE.COMPLETE ? boss.color : '#f87171'}`,
                borderRadius: 16,
                padding: '2rem',
                backdropFilter: 'blur(12px)',
              }}
            >
              {phase === PHASE.COMPLETE ? (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: 8, filter: `drop-shadow(0 0 18px ${boss.color})` }}>
                    {boss.glyph}
                  </div>
                  <div style={{ fontSize: '0.5rem', color: boss.color, letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Zodiac Seal Broken
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.14em', color: boss.color, marginBottom: '1rem' }}>
                    {boss.name.toUpperCase()} DEFEATED
                  </div>

                  {/* Boss concession speech */}
                  <div style={{
                    background: `${boss.color}0d`,
                    border: `1px solid ${boss.color}22`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: '1.2rem',
                    textAlign: 'left',
                  }}>
                    <p style={{ color: '#bbb', fontSize: '0.78rem', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
                      "{boss.storyAfter}"
                    </p>
                  </div>

                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: '0.2rem' }}>
                    {finalLines} <span style={{ fontSize: '0.7rem', color: '#888' }}>LINES</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '1.2rem' }}>
                    {finalScore.toLocaleString()} pts
                  </div>
                  {saving && <div style={{ fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', marginBottom: '1rem' }}>Saving…</div>}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => { pendingResetRef.current = true; setPhase(PHASE.STORY) }}
                      style={{ background: 'none', border: `1px solid ${boss.color}55`, color: boss.color, borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}
                    >
                      REMATCH
                    </button>
                    {nextBossId && (
                      <button
                        onClick={() => navigate(`/s2/${nextBossId}`, { replace: true })}
                        style={{ background: 'linear-gradient(90deg,#22d3ee,#a855f7)', border: 'none', color: '#000', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em', fontFamily: 'inherit' }}
                      >
                        NEXT BOSS →
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/s2', { replace: true })}
                      style={{ background: boss.color, border: 'none', color: '#000', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'inherit' }}
                    >
                      ZODIAC MAP
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>✕</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.14em', color: '#f87171', marginBottom: '0.5rem' }}>
                    DEFEATED
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '0.14em', marginBottom: '1.2rem' }}>
                    {boss.name} repels your challenge.
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: '0.2rem' }}>
                    {finalLines} <span style={{ fontSize: '0.7rem', color: '#888' }}>LINES</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '1.2rem' }}>{finalScore.toLocaleString()} pts</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button
                      onClick={() => { pendingResetRef.current = true; setPhase(PHASE.STORY) }}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#ccc', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}
                    >
                      RETRY
                    </button>
                    <button
                      onClick={() => navigate('/s2', { replace: true })}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}
                    >
                      MAP
                    </button>
                  </div>
                </>
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
    </div>
  )
}
