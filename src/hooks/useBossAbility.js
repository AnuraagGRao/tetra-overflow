import { useEffect, useRef, useState, useCallback } from 'react'
import { GAME_MODE } from '../logic/gameEngine'

/**
 * Manages all per-boss mechanic side-effects for Zodiac boss battles.
 * Returns:
 *   mirrorControls      {bool}        — Gemini: swap left/right
 *   hideNextCount       {number}      — Leo: # of pieces to hide queue for
 *   rotationLocked      {bool}        — Virgo: block rotation this piece
 *   fogRows             {bool}        — Cancer: show fog on bottom rows
 *   constrictionCols    {number}      — Ophiuchus: columns locked on each side (0–3)
 *   speedBoostActive    {bool}        — Scorpio: venom rush active
 *   abilityActive       {bool}        — true during any active effect
 *   abilityLabel        {string}      — label of the active effect for UI
 *   abilityToast        {string|null} — floating toast text
 *   toastId             {number}      — unique key per toast
 *   attackIndicator     {object|null} — countdown timer or line progress indicator
 */
export function useBossAbility({ bossId, engine, state, linesThisLevel, isActive }) {
  const [mirrorControls, setMirrorControls] = useState(false)
  const [hideNextCount, setHideNextCount] = useState(0)
  const [rotationLocked, setRotationLocked] = useState(false)
  const [fogRows, setFogRows] = useState(false)
  const [, setColorShift] = useState(0)
  const [constrictionCols, setConstrictionCols] = useState(0)
  const [abilityActive, setAbilityActive] = useState(false)
  const [abilityLabel, setAbilityLabel] = useState('')
  const [poisonSet, setPoisonSet] = useState(() => new Set())
  const [abilityToast, setAbilityToast] = useState(null)
  const [toastId, setToastId] = useState(0)
  const [, setAttackTick] = useState(0)

  const queueBossGarbage = useCallback(
    lines => {
      const amount = Math.max(0, lines | 0)
      if (amount <= 0) return
      try {
        if (engine.mode === GAME_MODE.VERSUS) engine.receiveGarbage(amount)
        else engine.pendingGarbage = (engine.pendingGarbage ?? 0) + amount
      } catch {}
    },
    [engine]
  )

  // Internal refs
  const linesRef = useRef(0)
  const mirrorTimerRef = useRef(null)
  const fogTimerRef = useRef(null)
  const whirlTimerRef = useRef(null)
  const tremorTimerRef = useRef(null)
  const piecesPlacedRef = useRef(0)
  const colorShiftRef = useRef(0)
  const colorRafRef = useRef(null)
  const toastTimerRef = useRef(null)
  const attackTickRef = useRef(null)
  const attackStartRef = useRef(null)
  const attackTotalRef = useRef(null)

  // Clear timers on unmount or boss change
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

  // ── Gemini: Mirror Controls ────────────────────────────────────────────────
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

  // ── Taurus: Tremor (Hard Drop every 10s) ────────────────────────────────────
  useEffect(() => {
    if (bossId !== 'taurus' || !isActive) return
    clearInterval(tremorTimerRef.current)
    attackStartRef.current = performance.now()
    attackTotalRef.current = 10000
    clearInterval(attackTickRef.current)
    attackTickRef.current = setInterval(() => setAttackTick(t => t + 1), 100)
    tremorTimerRef.current = setInterval(() => {
      if (!isActive) return
      try {
        engine.hardDrop()
      } catch {}
      setAbilityActive(true)
      setAbilityLabel('TREMOR')
      attackStartRef.current = performance.now()
      setTimeout(() => {
        setAbilityActive(false)
        setAbilityLabel('')
      }, 800)
    }, 10000)
    return () => {
      clearInterval(tremorTimerRef.current)
      clearInterval(attackTickRef.current)
    }
  }, [bossId, isActive, engine])

  // ── Aries: Meteor Strike (Garbage every 5 lines) ───────────────────────────
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
      setTimeout(() => {
        setAbilityActive(false)
        setAbilityLabel('')
      }, 1200)
    }
    linesRef.current = linesThisLevel
  }, [bossId, linesThisLevel, isActive, queueBossGarbage])

  // ── Cancer: High Tide (Fog every 15s) ──────────────────────────────────────
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
    return () => {
      clearInterval(fogTimerRef.current)
      clearInterval(attackTickRef.current)
    }
  }, [bossId, isActive])

  // ── Leo: Solar Flare (Hide next 3 pieces on Tetris) ────────────────────────
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

  const prevLockedRef = useRef(false)
  useEffect(() => {
    if (bossId !== 'leo') return
    if (state.pieceLocked && !prevLockedRef.current) {
      setHideNextCount(n => {
        const next = Math.max(0, n - 1)
        if (next <= 0) {
          setAbilityActive(false)
          setAbilityLabel('')
        }
        return next
      })
    }
    prevLockedRef.current = state.pieceLocked
  }, [bossId, state.pieceLocked])

  // ── Virgo: Overgrowth (Lock rotation every 8 pieces) ───────────────────────
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
        if (abilityLabel === 'OVERGROWTH') {
          setAbilityActive(false)
          setAbilityLabel('')
        }
      }
    }
    prevPieceLockRef.current = state.pieceLocked
  }, [bossId, state.pieceLocked, isActive, abilityLabel])

  // ── Libra: Imbalance (Height differential check) ───────────────────────────
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
        const getColHeight = col => {
          for (let r = 0; r < board.length; r++) {
            if (board[r][col]) return board.length - r
          }
          return 0
        }
        let leftMax = 0
        let rightMax = 0
        for (let c = 0; c < half; c++) leftMax = Math.max(leftMax, getColHeight(c))
        for (let c = half; c < W; c++) rightMax = Math.max(rightMax, getColHeight(c))
        if (Math.abs(leftMax - rightMax) >= 5) {
          queueBossGarbage(3)
          setAbilityActive(true)
          setAbilityLabel('IMBALANCE')
          setTimeout(() => {
            setAbilityActive(false)
            setAbilityLabel('')
          }, 1200)
        }
      } catch {}
    }, 4000)
    return () => {
      clearInterval(id)
      clearInterval(attackTickRef.current)
    }
  }, [bossId, isActive, engine, queueBossGarbage])

  // ── Scorpio: Venom Rush (Poison Blocks) ────────────────────────────────────
  const prevQueueRef = useRef([])
  const [speedBoostActive, setSpeedBoostActive] = useState(false)
  const speedTimerRef = useRef(null)
  useEffect(() => {
    if (bossId !== 'scorpio' || !isActive) return
    const queue = state.queue ?? []
    if (JSON.stringify(queue) !== JSON.stringify(prevQueueRef.current)) {
      const newPoison = new Set()
      queue.forEach((_, idx) => {
        if (idx % 3 === 1) newPoison.add(idx)
      })
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
      if (poisonSet.size > 0 && Math.random() < 0.3) {
        clearTimeout(speedTimerRef.current)
        setSpeedBoostActive(true)
        setAbilityActive(true)
        setAbilityLabel('VENOM RUSH')
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

  // ── Sagittarius: Volley Shot ───────────────────────────────────────────────
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
        setTimeout(() => {
          setAbilityActive(false)
          setAbilityLabel('')
        }, 1000)
      }
    }
  }, [bossId, state.lastClear, isActive, queueBossGarbage])

  // ── Capricorn: Avalanche ───────────────────────────────────────────────────
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
      setTimeout(() => {
        setAbilityActive(false)
        setAbilityLabel('')
      }, 1400)
    }
    linesRef.current = linesThisLevel
  }, [bossId, linesThisLevel, isActive, queueBossGarbage])

  // ── Aquarius: Whirlwind (Random shift every 3.5s) ──────────────────────────
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
      setTimeout(() => {
        setAbilityActive(false)
        setAbilityLabel('')
      }, 700)
    }, 3500)
    return () => {
      clearInterval(whirlTimerRef.current)
      clearInterval(attackTickRef.current)
    }
  }, [bossId, isActive, engine])

  // ── Pisces: Illusion (CSS Hue Shift) ───────────────────────────────────────
  useEffect(() => {
    if (bossId !== 'pisces' || !isActive) {
      cancelAnimationFrame(colorRafRef.current)
      document.documentElement.style.removeProperty('--pisces-hue')
      return
    }
    let prev = performance.now()
    const tick = now => {
      const dt = now - prev
      prev = now
      colorShiftRef.current = (colorShiftRef.current + dt * 0.12) % 360
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

  // ── Ophiuchus: Constriction ────────────────────────────────────────────────
  useEffect(() => {
    if (bossId !== 'ophiuchus' || !isActive) return
    const newCols = Math.min(3, Math.floor(linesThisLevel / 10))
    if (newCols !== constrictionCols) {
      setConstrictionCols(newCols)
      if (newCols > constrictionCols) {
        queueBossGarbage(2)
        setAbilityActive(true)
        setAbilityLabel('CONSTRICTION')
        setTimeout(() => {
          setAbilityActive(false)
          setAbilityLabel('')
        }, 1600)
      }
    }
  }, [bossId, linesThisLevel, isActive, constrictionCols, queueBossGarbage])

  // Sync linesRef for multi-use bosses
  useEffect(() => {
    if (!['aries', 'capricorn'].includes(bossId)) return
    linesRef.current = linesThisLevel
  }, [bossId, linesThisLevel])

  // Floating toast label on activation
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

  // Attack countdown or line fill indicator
  let attackIndicator = null
  if (isActive) {
    if (['taurus', 'cancer', 'aquarius', 'libra'].includes(bossId) && attackStartRef.current !== null) {
      const elapsed = performance.now() - attackStartRef.current
      const total = attackTotalRef.current
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

export default useBossAbility
