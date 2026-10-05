import { useEffect, useRef, useState, useCallback } from 'react'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../logic/tetrominoes'

const VISIBLE_ROWS = BOARD_HEIGHT - 2

/**
 * Manages Season 3 mechanics:
 * - Rewind ability & snapshot ring buffer
 * - Time Dilation rows & gravity overrides
 * - Phantom blocks & solidification
 * - Boss mechanics (hover garbage, blind queue, sticky inputs, clear lag, petrification, shrinking board)
 */
export function useS3Mechanics({ level, engine, state, linesThisLevel, isActive, zoneActive }) {
  const mechanic = level?.mechanic ?? null
  const ability = level?.ability ?? null

  // ── Rewind State ───────────────────────────────────────────────────────────
  const [rewindGauge, setRewindGauge] = useState(0)
  const [rewindActive, setRewindActive] = useState(false)
  const boardSnapshotsRef = useRef([])
  const prevLinesRef = useRef(0)
  const SNAPSHOT_MAX = 5
  const REWIND_GAUGE_PER_LINE = 0.25

  const hasRewind = ['rewind_intro', 'rewind_heavy', 'all_mechanics_mixed'].includes(mechanic)

  // ── Time Dilation State ────────────────────────────────────────────────────
  const [dilationRows, setDilationRows] = useState([])
  const dilationOverrideRef = useRef(null)
  const [dilationFlash, setDilationFlash] = useState(null)

  const hasDilation = ['time_dilation_intro', 'time_dilation_zones', 'all_mechanics_mixed'].includes(mechanic)

  // ── Phantom Blocks State ───────────────────────────────────────────────────
  const [phantoms, setPhantoms] = useState([])
  const phantomIdRef = useRef(0)
  const phantomTimerRef = useRef(null)

  const hasPhantoms = ['phantom_blocks_intro', 'phantom_blocks_heavy', 'all_mechanics_mixed'].includes(mechanic)

  // ── Boss Ability State ─────────────────────────────────────────────────────
  const [abilityActive, setAbilityActive] = useState(false)
  const [abilityLabel, setAbilityLabel] = useState('')
  const [abilityToast, setAbilityToast] = useState(null)
  const [toastId, setToastId] = useState(0)
  const [hoverGarbage, setHoverGarbage] = useState([])
  const [hideQueue, setHideQueue] = useState(false)
  const [, setStickyDelay] = useState(0)
  const [clearLagRows, setClearLagRows] = useState([])
  const [stoneCells, setStoneCells] = useState(() => new Set())
  const [shrinkRows, setShrinkRows] = useState(0)
  const prevClearRef = useRef(null)
  const stickyZoneRef = useRef(false)

  // Internal timers
  const hoverTimerRef = useRef(null)
  const petrifyTimerRef = useRef(null)
  const shrinkTimerRef = useRef(null)
  const lagTimerRef = useRef([])

  // Cleanup on unmount / level change
  useEffect(() => {
    const lagTimers = lagTimerRef.current
    return () => {
      clearInterval(hoverTimerRef.current)
      clearInterval(petrifyTimerRef.current)
      clearInterval(shrinkTimerRef.current)
      clearTimeout(phantomTimerRef.current)
      lagTimers.forEach(t => clearTimeout(t))
    }
  }, [level?.id])

  // Reset mechanics
  const resetMechanics = useCallback(() => {
    setRewindGauge(0)
    setRewindActive(false)
    boardSnapshotsRef.current = []
    prevLinesRef.current = 0

    if (hasDilation) {
      const count =
        mechanic === 'time_dilation_intro' ? 2 : mechanic === 'all_mechanics_mixed' ? 4 : 3
      const rows = []
      const used = new Set()
      for (let i = 0; i < count; i++) {
        let r
        do {
          r = 4 + Math.floor(Math.random() * (VISIBLE_ROWS - 8))
        } while (used.has(r))
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

  // Snapshot board when piece locks
  const prevLockRef = useRef(false)
  useEffect(() => {
    if (!hasRewind || !isActive) return
    if (state.pieceLocked && !prevLockRef.current) {
      const snap = {
        board: engine.board.map(row => [...row]),
        queue: [...(engine.queue || [])],
        hold: engine.hold,
        score: engine.score,
        lines: engine.lines,
      }
      const snaps = boardSnapshotsRef.current
      snaps.push(snap)
      if (snaps.length > SNAPSHOT_MAX) snaps.shift()
    }
    prevLockRef.current = state.pieceLocked
  }, [hasRewind, isActive, state.pieceLocked, engine])

  // Fill rewind gauge on line clears
  useEffect(() => {
    if (!hasRewind) return
    const diff = linesThisLevel - prevLinesRef.current
    if (diff > 0) {
      setRewindGauge(g => Math.min(1, g + diff * REWIND_GAUGE_PER_LINE))
      prevLinesRef.current = linesThisLevel
    }
  }, [hasRewind, linesThisLevel])

  // Activate rewind
  const activateRewind = useCallback(() => {
    const snaps = boardSnapshotsRef.current
    if (!snaps.length || rewindGauge < 1) return
    const snap = snaps.pop()
    try {
      engine.board = snap.board.map(row => [...row])
      engine.queue = [...snap.queue]
      engine.hold = snap.hold
      engine.score = snap.score
      engine.lines = snap.lines
      engine._spawnPiece?.()
    } catch {}
    setRewindGauge(0)
    setRewindActive(true)
    const timer = setTimeout(() => setRewindActive(false), 400)
    return () => clearTimeout(timer)
  }, [rewindGauge, engine])

  // Time-dilation gravity override
  const engineLevelSavedRef = useRef(null)
  const currentPieceY = state.current?.y
  useEffect(() => {
    if (!hasDilation || !isActive || dilationRows.length === 0) return

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

    const curY = currentPieceY
    if (curY == null) return

    const visRow = curY - 2
    const match = dilationRows.find(d => Math.abs(visRow - d.row) <= 1)
    const prevOverride = dilationOverrideRef.current

    if (match) {
      if (!prevOverride) {
        engineLevelSavedRef.current = engine.level
        const newLevel =
          match.type === 'fast' ? Math.min(20, engine.level + 8) : Math.max(1, engine.level - 5)
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
  }, [currentPieceY, dilationRows, engine, hasDilation, isActive, zoneActive])

  // Phantom blocks spawn
  useEffect(() => {
    if (!hasPhantoms || !isActive) {
      clearTimeout(phantomTimerRef.current)
      return
    }
    const INTERVAL =
      mechanic === 'phantom_blocks_heavy' ? 8000 : mechanic === 'all_mechanics_mixed' ? 6000 : 12000
    const spawnPhantom = () => {
      if (!isActive || zoneActive) {
        phantomTimerRef.current = setTimeout(spawnPhantom, INTERVAL)
        return
      }
      const col = Math.floor(Math.random() * (BOARD_WIDTH - 3))
      const row = 4 + Math.floor(Math.random() * (VISIBLE_ROWS - 8))
      const cells = [
        { row, col },
        { row, col: col + 1 },
        { row, col: col + 2 },
        { row: row + 1, col: col + 1 },
      ]
      const id = ++phantomIdRef.current
      const solidifyAt = Date.now() + 10000
      setPhantoms(prev => [...prev.slice(-4), { id, cells, solidifyAt }])
      phantomTimerRef.current = setTimeout(spawnPhantom, INTERVAL)
    }
    phantomTimerRef.current = setTimeout(spawnPhantom, INTERVAL * 0.5)
    return () => clearTimeout(phantomTimerRef.current)
  }, [hasPhantoms, isActive, mechanic, zoneActive])

  // Phantom block solidification
  const [, forceRender] = useState(0)
  useEffect(() => {
    if (!hasPhantoms || !phantoms.length) return
    const id = setInterval(() => {
      const now = Date.now()
      setPhantoms(prev => {
        const remaining = []
        prev.forEach(ph => {
          if (now >= ph.solidifyAt) {
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

  // Hover garbage (boss)
  const queueGarbage = useCallback(
    lines => {
      try {
        engine.pendingGarbage = (engine.pendingGarbage ?? 0) + lines
      } catch {}
    },
    [engine]
  )

  const toastTimerRef = useRef(null)
  const showToast = useCallback(text => {
    setAbilityToast(text)
    setToastId(n => n + 1)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setAbilityToast(null), 2000)
  }, [])

  useEffect(() => {
    if (ability !== 'hover_garbage' || !isActive) return
    clearInterval(hoverTimerRef.current)
    hoverTimerRef.current = setInterval(() => {
      if (!isActive || zoneActive) return
      const id = ++phantomIdRef.current
      const rows = Math.floor(Math.random() * 2) + 1
      setHoverGarbage(prev => [...prev.slice(-3), { id, rows, solidifyAt: Date.now() + 5000 }])
      setAbilityActive(true)
      setAbilityLabel('HOVER GARBAGE')
      showToast('⚠ INCOMING')
      setTimeout(() => {
        setAbilityActive(false)
        setAbilityLabel('')
      }, 1500)
    }, 12000)
    return () => {
      clearInterval(hoverTimerRef.current)
      clearTimeout(toastTimerRef.current)
    }
  }, [ability, isActive, zoneActive, queueGarbage, showToast])

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

  // Blind queue
  useEffect(() => {
    if (ability !== 'blind_queue') return
    setHideQueue(!zoneActive)
  }, [ability, zoneActive])

  // Undo clear (rollback)
  useEffect(() => {
    if (ability !== 'undo_clear' || !isActive) return
    const cur = state.lastClear
    if (cur && cur !== prevClearRef.current && cur.lines > 0) {
      prevClearRef.current = cur
      if (Math.random() < 0.15) {
        queueGarbage(cur.lines)
        setAbilityActive(true)
        setAbilityLabel('FALSE CLEAR')
        showToast('⚠ ROLLBACK')
        const timer = setTimeout(() => {
          setAbilityActive(false)
          setAbilityLabel('')
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [ability, isActive, state.lastClear, queueGarbage, showToast])

  // Sticky inputs
  useEffect(() => {
    if (ability !== 'sticky_inputs') return
    stickyZoneRef.current = zoneActive
    setStickyDelay(zoneActive ? 0 : 80)
    if (zoneActive) {
      setAbilityActive(true)
      setAbilityLabel('ZONE: CRISP INPUTS')
    } else {
      setAbilityActive(true)
      setAbilityLabel('HARDWARE LAG')
    }
  }, [ability, zoneActive])

  // Clear lag
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
      setAbilityActive(true)
      setAbilityLabel('CLEAR LAG')
      setTimeout(() => {
        setAbilityActive(false)
        setAbilityLabel('')
      }, 1200)
    }
  }, [ability, isActive, zoneActive, state.lastClear, showToast])

  // Petrification
  useEffect(() => {
    if (ability !== 'petrification' || !isActive) return
    petrifyTimerRef.current = setInterval(() => {
      if (!isActive) return
      if (zoneActive) {
        setStoneCells(new Set())
        setAbilityActive(true)
        setAbilityLabel('CHRONO-CLEANSE')
        showToast('✦ BOARD CLEANSED')
        setTimeout(() => {
          setAbilityActive(false)
          setAbilityLabel('')
        }, 2000)
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
        setAbilityActive(true)
        setAbilityLabel('PETRIFY')
        showToast('☠ PETRIFIED')
        setTimeout(() => {
          setAbilityActive(false)
          setAbilityLabel('')
        }, 1500)
      } catch {}
    }, 15000)
    return () => {
      clearInterval(petrifyTimerRef.current)
      clearTimeout(toastTimerRef.current)
    }
  }, [ability, isActive, engine, zoneActive, showToast])

  useEffect(() => {
    if (ability !== 'petrification') return
    if (zoneActive && stoneCells.size > 0) {
      setStoneCells(new Set())
      showToast('✦ BOARD CLEANSED')
    }
  }, [ability, zoneActive, stoneCells.size, showToast])

  // Shrinking board
  useEffect(() => {
    if (mechanic !== 'shrinking_board' || !isActive) return
    shrinkTimerRef.current = setInterval(() => {
      if (!isActive || zoneActive) return
      setShrinkRows(r => Math.min(8, r + 1))
      setAbilityActive(true)
      setAbilityLabel('CEILING LOWERING')
      setTimeout(() => {
        setAbilityActive(false)
        setAbilityLabel('')
      }, 1200)
    }, 18000)
    return () => clearInterval(shrinkTimerRef.current)
  }, [mechanic, isActive, zoneActive])

  // Combo reduces shrink
  useEffect(() => {
    if (mechanic !== 'shrinking_board') return
    if (state.combo >= 3) {
      setShrinkRows(r => Math.max(0, r - 1))
    }
  }, [mechanic, state.combo])

  return {
    rewindGauge,
    rewindActive,
    activateRewind,
    hasRewind,
    dilationRows,
    dilationFlash,
    hasDilation,
    phantoms,
    hasPhantoms,
    abilityActive,
    abilityLabel,
    abilityToast,
    toastId,
    hideQueue,
    hoverGarbage,
    clearLagRows,
    stoneCells,
    shrinkRows,
    resetMechanics,
  }
}

export default useS3Mechanics
