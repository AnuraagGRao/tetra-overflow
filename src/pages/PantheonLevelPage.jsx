import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BackgroundCanvas from '../components/BackgroundCanvas'
import GameCanvas from '../components/GameCanvas'
import PiecePreview from '../components/PiecePreview'
import SettingsPage from '../components/SettingsPage'
import TouchControls from '../components/TouchControls'
import FocusMiniHud from '../components/FocusMiniHud'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress } from '../firebase/db'
import { GAME_MODE, TetrisEngine, ZONE_DURATION_MS, ZONE_MIN_METER } from '../logic/gameEngine'
import { BOARD_HEIGHT, BOARD_WIDTH, PIECES } from '../logic/tetrominoes'
import { findPantheonBoss, getNextPantheonBoss, isPantheonLevelUnlocked, isPantheonUnlocked } from '../logic/storyData_s5'
import { playHardDropSFX, playHoldSFX, playLineClearSFX, playLockSFX, playRotateSFX, playTetrisSFX, playZoneActivateSFX, setSfxVolume } from '../audio/gameSfx'
import { Season5MusicManager } from '../audio/season5MusicManager'
import { GAME_CONFIG_KEY as CONFIG_KEY, readGameConfig as loadConfig } from '../logic/gameConfig'
import { useStoryProgress } from '../hooks/useStoryProgress'

const FRAME_MS = 34
const ANOMALY_GRACE_MS = 6000
const ANOMALY_ACTIVE_MS = 7000
const ANOMALY_RESPITE_MS = 9000
const PHASE = { INTRO: 'intro', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }
const ACTION_ALIASES = { left: 'moveLeft', right: 'moveRight', softDrop: 'softDrop' }
const HELD_ACTIONS = new Set(['moveLeft', 'moveRight', 'softDrop'])

const PIECE_THEMES = {
  gold_wireframe: 'circuit',
  fractal_madness: 'vaporwave',
  void_purple: 'obsidian',
  upside_down_matrix: 'terminal',
  matrix_green_rain: 'terminal',
  mirror_dimension: 'stained',
  obsidian_core: 'obsidian',
  glitch_red: 'bauhaus',
  shattered_mirror: 'sketch',
  pure_white_grid: 'blueprint',
  prismatic_void: 'vaporwave',
}

function cloneCurrent(current) {
  if (!current) return null
  return { ...current, matrix: current.matrix.map(row => [...row]) }
}

function randomVoidCells(count = 4) {
  const cells = []
  const used = new Set()
  while (cells.length < count) {
    const row = 4 + Math.floor(Math.random() * (BOARD_HEIGHT - 6))
    const col = Math.floor(Math.random() * BOARD_WIDTH)
    const key = `${row},${col}`
    if (!used.has(key)) {
      used.add(key)
      cells.push({ row, col })
    }
  }
  return cells
}

function Stat({ label, value, color = '#fff' }) {
  return (
    <div style={{ minWidth: 0, textAlign: 'center' }}>
      <div style={{ color: '#666a74', fontSize: '0.45rem', fontWeight: 700, letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ marginTop: 2, color, fontSize: '0.9rem', fontWeight: 900, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

export default function PantheonLevelPage() {
  const { bossId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const boss = useMemo(() => findPantheonBoss(bossId), [bossId])
  const engine = useMemo(() => new TetrisEngine(), [])
  const pieceTheme = PIECE_THEMES[boss?.bgType] || 'classic'

  const { progress, setProgress, loading: progressLoading } = useStoryProgress(user?.uid, bossId)
  const [phase, setPhase] = useState(PHASE.INTRO)
  const [state, setState] = useState(engine.getState())
  const [paused, setPaused] = useState(false)
  const [easyMode, setEasyMode] = useState(false)
  const [config, setConfig] = useState(loadConfig)
  const [showSettings, setShowSettings] = useState(false)
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)
  const [focus, setFocus] = useState(() => {
    try { return localStorage.getItem('focus-mode') === '1' } catch { return false }
  })
  const [anomalyActive, setAnomalyActive] = useState(false)
  const [toast, setToast] = useState(null)
  const [voidCells, setVoidCells] = useState([])
  const [clearLagRows, setClearLagRows] = useState([])
  const [stoneCells, setStoneCells] = useState(() => new Set())
  const [shrinkRows, setShrinkRows] = useState(0)
  const [solarFlash, setSolarFlash] = useState(false)
  const [mirageType, setMirageType] = useState(null)
  const [discordActive, setDiscordActive] = useState(false)
  const [divinePhase, setDivinePhase] = useState(0)
  const [hoverGarbage, setHoverGarbage] = useState([])

  const heldRef = useRef({ left: false, right: false, softDrop: false })
  const heldBindingsRef = useRef({})
  const actionRef = useRef({})
  const actionTimersRef = useRef(new Set())
  const snapshotsRef = useRef([])
  const lockCountRef = useRef(0)
  const completionHandledRef = useRef(false)
  const lastClearRef = useRef(null)
  const lastPieceTypeRef = useRef(null)
  const effectiveMechanicsRef = useRef(new Set())
  const voidCellsRef = useRef([])
  const shrinkRowsRef = useRef(0)
  const discordMapRef = useRef({})
  const musicRef = useRef(null)

  const targetLines = easyMode ? boss?.easyTargetLines ?? boss?.targetLines ?? 40 : boss?.targetLines ?? 40
  const linesThisLevel = Math.max(0, state.lines)
  const bypassUnlock = !!location.state?.fromPantheonComplete

  const showToast = useCallback(message => {
    setToast(message)
    const timer = setTimeout(() => setToast(null), 1800)
    actionTimersRef.current.add(timer)
  }, [])

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    engine.setSettings({ das: config.das, arr: config.arr })
    setSfxVolume(config.sfxVolume ?? 1)
    musicRef.current?.setVolume(config.musicVolume ?? 1)
  }, [config, engine])

  useEffect(() => {
    const actionTimers = actionTimersRef.current
    setPhase(PHASE.INTRO)
    setPaused(false)
    setEasyMode(false)
    setState(engine.getState())
    completionHandledRef.current = false
    return () => {
      engine.storyEncounterHooks = null
      actionTimers.forEach(timer => clearTimeout(timer))
      actionTimers.clear()
      musicRef.current?.destroy()
      musicRef.current = null
    }
  }, [bossId, engine])

  const configuredMechanics = useMemo(() => {
    if (!boss) return new Set()
    if (boss.id === 'aetherion') {
      const cycle = boss.mechanics || []
      return new Set(['divine_judgment', 'shrinking_board', cycle[divinePhase % cycle.length], cycle[(divinePhase + 1) % cycle.length]])
    }
    return new Set([boss.mechanic, boss.ability].filter(Boolean))
  }, [boss, divinePhase])

  const activeMechanics = useMemo(
    () => anomalyActive ? configuredMechanics : new Set(),
    [anomalyActive, configuredMechanics]
  )

  useEffect(() => {
    effectiveMechanicsRef.current = activeMechanics
  }, [activeMechanics])

  useEffect(() => { voidCellsRef.current = voidCells }, [voidCells])
  useEffect(() => { shrinkRowsRef.current = shrinkRows }, [shrinkRows])

  const resetMechanics = useCallback(() => {
    setToast(null)
    setVoidCells([])
    setClearLagRows([])
    setStoneCells(new Set())
    setShrinkRows(0)
    setSolarFlash(false)
    setMirageType(null)
    setDiscordActive(false)
    setDivinePhase(0)
    setHoverGarbage([])
    setAnomalyActive(false)
    snapshotsRef.current = []
    lockCountRef.current = 0
    lastClearRef.current = null
    lastPieceTypeRef.current = null
    discordMapRef.current = {}
  }, [])

  const startMusic = useCallback(() => {
    if (!boss) return
    try {
      if (!musicRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return
        musicRef.current = new Season5MusicManager(new AudioContextClass())
      }
      musicRef.current.setVolume(config.musicVolume ?? 1)
      musicRef.current.playForBoss(boss.id)
    } catch (error) {
      console.error('Season 5 music failed to start:', error)
    }
  }, [boss, config.musicVolume])

  const startGame = useCallback(() => {
    if (!boss) return
    engine.reset(GAME_MODE.NORMAL)
    const startingLevel = Math.max(1, Math.min(8, Math.round(1 + boss.gravityMult * 1.5)))
    engine.level = startingLevel
    engine.storyLevelOffset = startingLevel
    engine.storyLinesOffset = 0
    completionHandledRef.current = false
    heldRef.current = { left: false, right: false, softDrop: false }
    actionRef.current = {}
    resetMechanics()
    startMusic()
    setState(engine.getState())
    setPaused(false)
    setPhase(PHASE.GAME)
  }, [boss, engine, resetMechanics, startMusic])

  useEffect(() => {
    musicRef.current?.setZoneFx(state.zoneActive)
  }, [state.zoneActive])

  useEffect(() => {
    if (phase !== PHASE.GAME || !boss) {
      setAnomalyActive(false)
      return
    }
    let activeTimer
    let respiteTimer
    const beginAnomaly = () => {
      if (boss.id === 'aetherion') setDivinePhase(value => value + 1)
      setAnomalyActive(true)
      showToast(boss.abilityLabel)
      activeTimer = setTimeout(() => {
        setAnomalyActive(false)
        showToast('DIVINE CALM')
        respiteTimer = setTimeout(beginAnomaly, ANOMALY_RESPITE_MS)
      }, ANOMALY_ACTIVE_MS)
    }
    const graceTimer = setTimeout(beginAnomaly, ANOMALY_GRACE_MS)
    return () => {
      clearTimeout(graceTimer)
      clearTimeout(activeTimer)
      clearTimeout(respiteTimer)
      setAnomalyActive(false)
    }
  }, [boss, phase, showToast])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('void_zones_heavy')) {
      setVoidCells([])
      return
    }
    setVoidCells(randomVoidCells(boss?.id === 'aetherion' ? 3 : 5))
    const timer = setInterval(() => {
      if (!engine.zoneActive) {
        setVoidCells(randomVoidCells(boss?.id === 'aetherion' ? 3 : 5))
        showToast('VOID ZONES SHIFT')
      }
    }, 6500)
    return () => clearInterval(timer)
  }, [activeMechanics, boss?.id, engine, phase, showToast])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('rewind_heavy')) return
    const timer = setTimeout(() => {
      const snapshots = snapshotsRef.current
      if (snapshots.length < 2 || engine.zoneActive) return
      const snapshot = snapshots[Math.max(0, snapshots.length - 3)]
      const preservedLines = engine.lines
      engine.board = snapshot.board.map(row => [...row])
      engine.queue = [...snapshot.queue]
      engine.hold = snapshot.hold
      engine.score = snapshot.score
      engine.current = cloneCurrent(snapshot.current)
      engine.lines = preservedLines
      engine.lockTimer = 0
      showToast('PERFECT RECALL')
      setState(engine.getState())
    }, 2400)
    return () => clearTimeout(timer)
  }, [activeMechanics, engine, phase, showToast])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('petrification')) return
    const timer = setTimeout(() => {
      if (engine.zoneActive) {
        setStoneCells(new Set())
        return
      }
      const occupied = []
      for (let row = 2; row < BOARD_HEIGHT; row++) {
        for (let col = 0; col < BOARD_WIDTH; col++) {
          if (engine.board[row]?.[col]) occupied.push(`${row},${col}`)
        }
      }
      if (occupied.length) {
        const selected = occupied[Math.floor(Math.random() * occupied.length)]
        setStoneCells(previous => new Set([...previous, selected]))
        showToast('DIVINE FORGE')
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [activeMechanics, engine, phase, showToast])

  useEffect(() => {
    if (state.zoneActive && stoneCells.size) setStoneCells(new Set())
  }, [state.zoneActive, stoneCells.size])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('shrinking_board')) return
    const timer = setTimeout(() => {
      if (!engine.zoneActive) {
        setShrinkRows(value => Math.min(8, value + 1))
        showToast('DIVINE JUDGMENT')
      }
    }, boss?.id === 'aetherion' ? 1800 : 2600)
    return () => clearTimeout(timer)
  }, [activeMechanics, boss?.id, engine, phase, showToast])

  const latestClear = state.lastClear
  useEffect(() => {
    if (activeMechanics.has('shrinking_board') && latestClear?.lines >= 3) {
      setShrinkRows(value => Math.max(0, value - 1))
    }
  }, [activeMechanics, latestClear])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('control_discord')) {
      discordMapRef.current = {}
      setDiscordActive(false)
      return
    }
    const scramble = () => {
      discordMapRef.current = Math.random() < 0.5
        ? { moveLeft: 'moveRight', moveRight: 'moveLeft', rotateCW: 'rotateCCW', rotateCCW: 'rotateCW' }
        : { moveLeft: 'rotateCCW', moveRight: 'rotateCW', rotateCW: 'moveRight', rotateCCW: 'moveLeft' }
      setDiscordActive(true)
      showToast('CONTROLS FRACTURED')
    }
    scramble()
    const timer = setInterval(scramble, 9000)
    return () => clearInterval(timer)
  }, [activeMechanics, phase, showToast])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('blind_queue')) {
      setSolarFlash(false)
      return
    }
    const flare = () => {
      setSolarFlash(true)
      const timer = setTimeout(() => setSolarFlash(false), 1800)
      actionTimersRef.current.add(timer)
    }
    flare()
  }, [activeMechanics, phase])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('hover_garbage')) return
    const timer = setTimeout(() => {
      if (engine.zoneActive) return
      const attack = { id: Date.now(), rows: engine.combo >= 2 ? 2 : 1, landsAt: Date.now() + 4500 }
      setHoverGarbage(previous => [...previous.slice(-2), attack])
      showToast('RETRIBUTION SUSPENDED')
      const landingTimer = setTimeout(() => {
        engine.pendingGarbage = (engine.pendingGarbage || 0) + attack.rows
        setHoverGarbage(previous => previous.filter(item => item.id !== attack.id))
      }, 4500)
      actionTimersRef.current.add(landingTimer)
    }, 2200)
    return () => clearTimeout(timer)
  }, [activeMechanics, engine, phase, showToast])

  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('clear_lag')) return
    const clear = latestClear
    if (!clear || clear === lastClearRef.current || clear.lines <= 0) return
    lastClearRef.current = clear
    const rows = Array.from({ length: clear.lines }, (_, index) => ({ id: Date.now() + index }))
    setClearLagRows(previous => [...previous, ...rows])
    const timer = setTimeout(() => setClearLagRows(previous => previous.filter(row => !rows.some(item => item.id === row.id))), 3200)
    actionTimersRef.current.add(timer)
    showToast('CLEAR LAG')
  }, [activeMechanics, latestClear, phase, showToast])

  const currentPieceType = state.current?.type
  useEffect(() => {
    if (!activeMechanics.has('mirage_blocks') || phase !== PHASE.GAME || !currentPieceType) {
      setMirageType(null)
      return
    }
    if (lastPieceTypeRef.current !== currentPieceType || !mirageType) {
      lastPieceTypeRef.current = currentPieceType
      const choices = Object.keys(PIECES).filter(type => type.length === 1 && type !== currentPieceType)
      setMirageType(choices[Math.floor(Math.random() * choices.length)])
    }
  }, [activeMechanics, currentPieceType, mirageType, phase])

  useEffect(() => {
    engine.storyEncounterHooks = {
      afterMerge: ({ board, piece }) => {
        const mechanics = effectiveMechanicsRef.current
        if (mechanics.has('void_zones_heavy') && !engine.zoneActive) {
          voidCellsRef.current.forEach(({ row, col }) => {
            if (board[row]) board[row][col] = null
          })
        }
        if (mechanics.has('echo_drops') && !engine.zoneActive) {
          piece.matrix.forEach((row, rowOffset) => row.forEach((filled, colOffset) => {
            if (!filled) return
            const boardRow = piece.y + rowOffset
            const boardCol = BOARD_WIDTH - 1 - (piece.x + colOffset)
            if (boardRow >= 0 && boardRow < BOARD_HEIGHT && boardCol >= 0 && boardCol < BOARD_WIDTH && !board[boardRow][boardCol]) {
              board[boardRow][boardCol] = piece.type
            }
          }))
        }
      },
      afterLock: ({ board }) => {
        const mechanics = effectiveMechanicsRef.current
        lockCountRef.current += 1
        snapshotsRef.current.push({
          board: board.map(row => [...row]),
          queue: [...engine.queue],
          hold: engine.hold,
          score: engine.score,
          current: cloneCurrent(engine.current),
        })
        if (snapshotsRef.current.length > 7) snapshotsRef.current.shift()
        if (mechanics.has('worst_piece') && !engine.zoneActive && lockCountRef.current % 4 === 0 && engine.queue.length) {
          engine.queue[0] = Math.random() < 0.5 ? 'S' : 'Z'
          showToast('LOADED FATE')
        }
        if (mechanics.has('shrinking_board') && shrinkRowsRef.current > 0) {
          const ceiling = 2 + shrinkRowsRef.current
          const breached = board.slice(2, ceiling).some(row => row.some(Boolean))
          if (breached) {
            engine.gameOver = true
            engine.gameOverReason = 'divine-judgment'
          }
        }
      },
    }
    return () => { engine.storyEncounterHooks = null }
  }, [engine, showToast])

  const resolveAction = useCallback(action => discordMapRef.current[action] || action, [])

  const queueAction = useCallback((rawAction, heldKey = null) => {
    if (phase !== PHASE.GAME || paused) return
    const action = resolveAction(ACTION_ALIASES[rawAction] || rawAction)
    if (activeMechanics.has('void_zones_heavy') && action === 'hold') {
      showToast('HOLD ERASED')
      return
    }

    const apply = () => {
      if (HELD_ACTIONS.has(action)) {
        const key = action === 'moveLeft' ? 'left' : action === 'moveRight' ? 'right' : 'softDrop'
        heldRef.current[key] = true
        if (heldKey) heldBindingsRef.current[heldKey] = key
        return
      }
      if (action === 'rotateCW' || action === 'rotateCCW' || action === 'rotate180') playRotateSFX(pieceTheme)
      if (action === 'hardDrop') playHardDropSFX()
      if (action === 'hold') playHoldSFX()
      if (action === 'activateZone') playZoneActivateSFX(pieceTheme)
      actionRef.current[action] = true
    }

    const delayed = activeMechanics.has('sticky_inputs') && !engine.zoneActive
    if (delayed) {
      const timer = setTimeout(apply, 110)
      actionTimersRef.current.add(timer)
    } else {
      apply()
    }
  }, [activeMechanics, engine, paused, phase, pieceTheme, resolveAction, showToast])

  const releaseAction = useCallback(rawKey => {
    const key = heldBindingsRef.current[rawKey] || (rawKey === 'left' || rawKey === 'right' || rawKey === 'softDrop' ? rawKey : null)
    if (key) heldRef.current[key] = false
    delete heldBindingsRef.current[rawKey]
  }, [])

  const togglePause = useCallback(() => {
    engine.togglePause()
    setPaused(value => {
      const nextPaused = !value
      if (nextPaused) musicRef.current?.pause()
      else musicRef.current?.resume()
      return nextPaused
    })
  }, [engine])

  useEffect(() => {
    const bindings = {
      ArrowLeft: ['moveLeft', true], ArrowRight: ['moveRight', true], ArrowDown: ['softDrop', true],
      ArrowUp: ['rotateCW', false], KeyZ: ['rotateCCW', false], KeyX: ['rotate180', false],
      KeyC: ['hold', false], Space: ['hardDrop', false], Escape: ['pause', false], KeyP: ['pause', false],
    }
    const down = event => {
      const binding = bindings[event.code]
      if (!binding) return
      event.preventDefault()
      if (event.repeat) return
      if (binding[0] === 'pause') {
        togglePause()
      } else {
        queueAction(binding[0], event.code)
      }
    }
    const up = event => {
      if (!bindings[event.code]?.[1]) return
      event.preventDefault()
      releaseAction(event.code)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [queueAction, releaseAction, togglePause])

  useEffect(() => {
    const actionMap = { 0: 'rotateCCW', 1: 'rotateCW', 2: 'rotateCCW', 3: 'rotate180', 4: 'hold', 5: 'hold', 6: 'activateZone', 7: 'activateZone', 9: 'pause', 12: 'hardDrop' }
    const previous = {}
    let frameId
    const poll = () => {
      for (const gamepad of navigator.getGamepads?.() || []) {
        if (!gamepad) continue
        Object.entries(actionMap).forEach(([button, action]) => {
          const pressed = gamepad.buttons[button]?.pressed === true
          if (pressed && !previous[button]) {
            if (action === 'pause') togglePause()
            else queueAction(action)
          }
          previous[button] = pressed
        })
        const left = gamepad.buttons[14]?.pressed || gamepad.axes[0] < -0.45
        const right = gamepad.buttons[15]?.pressed || gamepad.axes[0] > 0.45
        const down = gamepad.buttons[13]?.pressed || gamepad.axes[1] > 0.45
        if (left && !previous.gpLeft) queueAction('moveLeft', 'gpLeft')
        if (right && !previous.gpRight) queueAction('moveRight', 'gpRight')
        if (down && !previous.gpDown) queueAction('softDrop', 'gpDown')
        if (!left && previous.gpLeft) releaseAction('gpLeft')
        if (!right && previous.gpRight) releaseAction('gpRight')
        if (!down && previous.gpDown) releaseAction('gpDown')
        previous.gpLeft = left
        previous.gpRight = right
        previous.gpDown = down
      }
      frameId = requestAnimationFrame(poll)
    }
    frameId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frameId)
  }, [queueAction, releaseAction, togglePause])

  useEffect(() => {
    if (phase !== PHASE.GAME || paused || !boss) return
    let lastTime = performance.now()
    const loop = setInterval(() => {
      const now = performance.now()
      const delta = Math.min(FRAME_MS, now - lastTime)
      lastTime = now
      const actions = actionRef.current
      actionRef.current = {}
      engine.update(delta, heldRef.current, actions)
      const nextState = engine.getState()
      setState(nextState)

      if (nextState.lastClear?.lines > 0 && config.sfxEnabled) {
        if (nextState.lastClear.lines >= 4) playTetrisSFX(pieceTheme)
        else playLineClearSFX(nextState.lastClear.lines, pieceTheme)
      } else if (nextState.pieceLocked && config.sfxEnabled) {
        playLockSFX(pieceTheme)
      }

      if (engine.lines >= targetLines && !completionHandledRef.current) {
        completionHandledRef.current = true
        const completedProgress = { ...progress, [`pantheon_${boss.id}_completed`]: true }
        setProgress(completedProgress)
        setPhase(PHASE.COMPLETE)
        musicRef.current?.stop()
        saveStoryProgress(user.uid, 'pantheon', boss.id, engine.score, engine.lines)
          .catch(error => console.error('Failed to save Pantheon progress:', error))
      } else if (engine.gameOver && !completionHandledRef.current) {
        setPhase(PHASE.FAIL)
        musicRef.current?.stop()
      }
    }, FRAME_MS)
    return () => clearInterval(loop)
  }, [boss, config.sfxEnabled, engine, paused, phase, pieceTheme, progress, setProgress, targetLines, user?.uid])

  const handleTouchPress = (button, isHeld) => {
    if (isHeld) queueAction(button, button)
    else queueAction(button)
  }

  const handleTouchRelease = (button, isHeld) => {
    if (isHeld) releaseAction(button)
  }

  if (progressLoading) {
    return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#05060a', color: '#f0c96a', fontFamily: 'monospace', letterSpacing: '0.2em' }}>READING DIVINE LAW…</div>
  }

  if (!boss) {
    return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#05060a', color: '#f87171', fontFamily: 'monospace' }}>DEITY NOT FOUND <button onClick={() => navigate('/s5')}>BACK</button></div>
  }

  if (!isPantheonUnlocked(progress) || (!isPantheonLevelUnlocked(boss.id, progress) && !bypassUnlock)) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#05060a', color: '#888', fontFamily: 'monospace', textAlign: 'center' }}>
        <div><div style={{ fontSize: '2rem' }}>×</div><div style={{ marginTop: 8 }}>DIVINE THRONE LOCKED</div><button onClick={() => navigate('/s5')} style={{ marginTop: 16 }}>BACK TO PANTHEON</button></div>
      </div>
    )
  }

  if (phase === PHASE.INTRO) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 20, background: '#05060a', color: '#fff', fontFamily: '"Courier New", monospace', textAlign: 'center' }}>
        <BackgroundCanvas bgType={boss.bgType} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,4,8,0.72)' }} />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'relative', width: 'min(560px, 100%)' }}>
          <div style={{ color: boss.color, fontSize: '3.5rem', filter: `drop-shadow(0 0 22px ${boss.glowColor})` }}>{boss.glyph}</div>
          <div style={{ marginTop: 10, color: boss.color, fontSize: '0.52rem', letterSpacing: '0.32em' }}>SEASON 5 · THE PANTHEON ARC</div>
          <h1 style={{ margin: '8px 0 0', fontSize: 'clamp(1.6rem, 7vw, 2.7rem)', letterSpacing: '0.08em' }}>{boss.name.toUpperCase()}</h1>
          <div style={{ marginTop: 4, color: '#8a8e98', fontSize: '0.72rem' }}>{boss.subtitle}</div>
          <p style={{ margin: '24px auto 0', maxWidth: 500, color: '#c5c7ce', fontSize: '0.82rem', lineHeight: 1.75 }}>“{boss.storyBefore}”</p>
          <div style={{ margin: '20px auto 0', padding: '10px 14px', maxWidth: 460, borderTop: `1px solid ${boss.color}44`, borderBottom: `1px solid ${boss.color}44`, color: '#999da7', fontSize: '0.68rem', lineHeight: 1.55 }}>
            <strong style={{ display: 'block', marginBottom: 4, color: boss.color, letterSpacing: '0.16em' }}>{boss.abilityLabel}</strong>
            {boss.abilityDesc}
          </div>
          <label style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, color: easyMode ? boss.color : '#777', fontSize: '0.62rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={easyMode} onChange={event => setEasyMode(event.target.checked)} /> EASY TRIAL · {easyMode ? boss.easyTargetLines : boss.targetLines} LINES
          </label>
          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button onClick={() => navigate('/s5')} style={{ minHeight: 42, padding: '0 16px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 6, background: 'transparent', color: '#888', cursor: 'pointer', font: 'inherit' }}>← MAP</button>
            <button onClick={startGame} style={{ minHeight: 42, padding: '0 24px', border: 'none', borderRadius: 6, background: boss.color, color: '#05060a', cursor: 'pointer', font: 'inherit', fontWeight: 900, letterSpacing: '0.16em' }}>CHALLENGE</button>
          </div>
        </motion.div>
      </div>
    )
  }

  if (phase === PHASE.COMPLETE || phase === PHASE.FAIL) {
    const won = phase === PHASE.COMPLETE
    const nextBoss = won ? getNextPantheonBoss(boss.id) : null
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 20, overflow: 'hidden', background: '#05060a', color: '#fff', fontFamily: '"Courier New", monospace', textAlign: 'center' }}>
        <BackgroundCanvas bgType={boss.bgType} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,4,8,0.82)' }} />
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} style={{ position: 'relative', width: 'min(500px, 100%)' }}>
          <div style={{ color: won ? boss.color : '#ef476f', fontSize: '3rem' }}>{won ? '✦' : '×'}</div>
          <div style={{ marginTop: 8, color: won ? boss.color : '#ef476f', fontSize: '0.55rem', letterSpacing: '0.28em' }}>{won ? 'THRONE OVERTHROWN' : 'JUDGMENT DELIVERED'}</div>
          <h1 style={{ margin: '10px 0 0', fontSize: '1.6rem' }}>{boss.name.toUpperCase()}</h1>
          <p style={{ margin: '18px auto 0', maxWidth: 460, color: '#aeb1ba', fontSize: '0.8rem', lineHeight: 1.7 }}>{won ? boss.storyAfter : 'The divine law closes around your tower. Rebuild, return, and answer it differently.'}</p>
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Stat label="LINES" value={linesThisLevel} color={boss.color} />
            <Stat label="SCORE" value={state.score.toLocaleString()} />
            <Stat label="LEVEL" value={state.level} />
          </div>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!won && <button onClick={startGame} style={{ minHeight: 42, padding: '0 20px', border: 'none', borderRadius: 6, background: '#ef476f', color: '#130308', cursor: 'pointer', font: 'inherit', fontWeight: 900 }}>RETRY</button>}
            {nextBoss && <button onClick={() => navigate(`/s5/${nextBoss.id}`, { state: { fromPantheonComplete: true } })} style={{ minHeight: 42, padding: '0 20px', border: 'none', borderRadius: 6, background: boss.color, color: '#05060a', cursor: 'pointer', font: 'inherit', fontWeight: 900 }}>NEXT THRONE →</button>}
            {won && !nextBoss && <button onClick={() => navigate('/s5')} style={{ minHeight: 42, padding: '0 20px', border: 'none', borderRadius: 6, background: '#f0c96a', color: '#05060a', cursor: 'pointer', font: 'inherit', fontWeight: 900 }}>PANTHEON CONQUERED</button>}
            <button onClick={() => navigate('/s5')} style={{ minHeight: 42, padding: '0 16px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 6, background: 'transparent', color: '#999', cursor: 'pointer', font: 'inherit' }}>MAP</button>
          </div>
        </motion.div>
      </div>
    )
  }

  const hideQueue = activeMechanics.has('blind_queue')
  const holdDisabled = activeMechanics.has('void_zones_heavy')
  const renderState = {
    ...state,
    hold: holdDisabled ? null : state.hold,
    queue: hideQueue ? [] : state.queue,
    current: mirageType && state.current ? { ...state.current, type: mirageType, matrix: PIECES[mirageType].matrix.map(row => [...row]) } : state.current,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#05060a', color: '#fff', fontFamily: '"Courier New", monospace' }}>
      <BackgroundCanvas bgType={boss.bgType} />
      {(!focus || isLandscape) && (
        <header style={{ position: 'relative', zIndex: 20, minHeight: 48, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10, padding: 'calc(7px + env(safe-area-inset-top, 0px)) 12px 7px', borderBottom: `1px solid ${boss.color}44`, background: 'rgba(4,5,9,0.78)', backdropFilter: 'blur(10px)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: anomalyActive ? boss.color : '#6f7380', fontSize: '0.44rem', letterSpacing: '0.2em' }}>S5 · {anomalyActive ? boss.abilityLabel : 'DIVINE CALM'}{discordActive ? ' · SCHISM ACTIVE' : ''}</div>
            <div style={{ marginTop: 2, overflow: 'hidden', color: '#f4f4f6', fontSize: '0.75rem', fontWeight: 900, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{boss.glyph} {boss.name.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stat label="LINES" value={`${linesThisLevel}/${targetLines}`} color={boss.color} />
            <Stat label="SCORE" value={state.score.toLocaleString()} />
            <button onClick={togglePause} aria-label="Pause" title="Pause" style={{ width: 34, height: 34, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#bbb', cursor: 'pointer' }}>{paused ? '▶' : 'Ⅱ'}</button>
          </div>
        </header>
      )}

      <div style={{ position: 'relative', zIndex: 15, height: 4, flexShrink: 0, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{ width: `${Math.min(100, (linesThisLevel / targetLines) * 100)}%`, height: '100%', background: boss.color, transition: 'width 0.25s' }} />
      </div>

      <main style={{ position: 'relative', zIndex: 5, flex: 1, minHeight: 0, display: 'flex', flexDirection: isLandscape ? 'row' : 'column', alignItems: 'stretch', justifyContent: 'center' }}>
        {!isLandscape && !focus && (
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 70px', alignItems: 'center', flexShrink: 0, minHeight: 54, borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(4,5,9,0.68)' }}>
            <div style={{ textAlign: 'center', opacity: holdDisabled ? 0.28 : 1 }}><div style={{ color: '#666', fontSize: '0.42rem' }}>{holdDisabled ? 'VOID' : 'HOLD'}</div><PiecePreview type={holdDisabled ? null : state.hold} small /></div>
            <div style={{ textAlign: 'center' }}><Stat label="GRAVITY" value={`${boss.gravityMult.toFixed(2)}×`} color={boss.color} /></div>
            <div style={{ textAlign: 'center', opacity: hideQueue ? 0.28 : 1 }}><div style={{ color: '#666', fontSize: '0.42rem' }}>{hideQueue ? 'BLIND' : 'NEXT'}</div><PiecePreview type={hideQueue ? null : state.queue?.[0]} small /></div>
          </div>
        )}

        {isLandscape && (
          <aside style={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, borderRight: '1px solid rgba(255,255,255,0.07)', background: 'rgba(4,5,9,0.58)' }}>
            <div style={{ opacity: holdDisabled ? 0.25 : 1, textAlign: 'center' }}><div style={{ color: '#666', fontSize: '0.48rem', letterSpacing: '0.12em' }}>{holdDisabled ? 'HOLD ERASED' : 'HOLD'}</div><PiecePreview type={holdDisabled ? null : state.hold} /></div>
            <Stat label="LEVEL" value={state.level} color={boss.color} />
            <Stat label="COMBO" value={state.combo || '—'} />
          </aside>
        )}

        <div className="mobile-canvas-wrap" style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'transparent', paddingBottom: focus && config.showOnScreenControls && !isLandscape ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' : 0 }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GameCanvas
              state={renderState}
              onTap={() => queueAction('rotateCW')}
              onTwoFingerTap={() => queueAction('activateZone')}
              onDragBegin={direction => {
                if (direction === 'up') queueAction('hold')
                else queueAction(direction === 'down' ? 'softDrop' : direction, direction)
              }}
              onDragEnd={direction => releaseAction(direction === 'down' ? 'softDrop' : direction)}
              onHardDrop={() => queueAction('hardDrop')}
              themeOverride={pieceTheme}
              renderQuality={config.renderQuality}
              screenShakeMultiplier={config.screenShakeMultiplier ?? 1}
            />
          </div>

          {voidCells.map(cell => <motion.div key={`${cell.row}-${cell.col}`} animate={{ opacity: [0.35, 0.9, 0.35] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ position: 'absolute', left: `${(cell.col / BOARD_WIDTH) * 100}%`, top: `${((cell.row - 2) / (BOARD_HEIGHT - 2)) * 100}%`, width: `${100 / BOARD_WIDTH}%`, height: `${100 / (BOARD_HEIGHT - 2)}%`, border: '1px solid rgba(160,90,255,0.8)', background: 'rgba(70,0,110,0.42)', boxSizing: 'border-box', pointerEvents: 'none' }} />)}
          {[...stoneCells].map(key => {
            const [row, col] = key.split(',').map(Number)
            return <div key={key} style={{ position: 'absolute', left: `${(col / BOARD_WIDTH) * 100}%`, top: `${((row - 2) / (BOARD_HEIGHT - 2)) * 100}%`, width: `${100 / BOARD_WIDTH}%`, height: `${100 / (BOARD_HEIGHT - 2)}%`, border: '1px solid #ffc06f', background: 'rgba(110,70,35,0.55)', boxSizing: 'border-box', pointerEvents: 'none' }} />
          })}
          {clearLagRows.map((row, index) => <div key={row.id} style={{ position: 'absolute', left: 0, right: 0, bottom: `${index * (100 / (BOARD_HEIGHT - 2))}%`, height: `${100 / (BOARD_HEIGHT - 2)}%`, borderTop: '1px solid rgba(85,214,255,0.7)', background: 'rgba(85,214,255,0.2)', pointerEvents: 'none' }} />)}
          {hoverGarbage.map((attack, index) => <motion.div key={attack.id} animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 0.7, repeat: Infinity }} style={{ position: 'absolute', left: 0, right: 0, bottom: `${index * 6}%`, height: `${attack.rows * 5}%`, border: '1px dashed rgba(239,71,111,0.75)', background: 'rgba(239,71,111,0.13)', color: '#ff91aa', fontSize: '0.46rem', textAlign: 'right', padding: 3, boxSizing: 'border-box', pointerEvents: 'none' }}>RETRIBUTION</motion.div>)}
          {shrinkRows > 0 && <motion.div animate={{ height: `${(shrinkRows / (BOARD_HEIGHT - 2)) * 100}%` }} style={{ position: 'absolute', top: 0, left: 0, right: 0, borderBottom: `2px solid ${boss.color}`, background: 'rgba(255,255,255,0.13)', pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', color: boss.color, fontSize: '0.48rem', letterSpacing: '0.18em' }}>DIVINE CEILING</motion.div>}
          {solarFlash && <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.72, 0.3] }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: '0 0 48% 0', background: 'rgba(255,248,205,0.9)', pointerEvents: 'none', mixBlendMode: 'screen' }} />}
          {mirageType && <div style={{ position: 'absolute', top: 8, left: 8, padding: '3px 6px', border: `1px solid ${boss.color}66`, background: 'rgba(0,0,0,0.65)', color: boss.color, fontSize: '0.44rem', letterSpacing: '0.12em', pointerEvents: 'none' }}>MIRAGE</div>}
          {!isLandscape && (
            <button onClick={() => setFocus(value => !value)} className="ui-toggle-tab" title={focus ? 'Exit Focus' : 'Enter Focus'} aria-label={focus ? 'Exit Focus' : 'Enter Focus'} style={{ right: 0 }}>
              {focus ? '▲' : '▼'}
            </button>
          )}
          {focus && !isLandscape && (
            <FocusMiniHud
              hold={state.hold}
              queue={state.queue}
              pieceTheme={pieceTheme}
              zoneMeter={state.zoneMeter}
              zoneActive={state.zoneActive}
              zoneTimer={state.zoneTimer}
              zoneDuration={state.zoneDuration}
              holdLabel={holdDisabled ? 'Void' : 'Hold'}
              nextLabel={hideQueue ? 'Blind' : 'Next'}
              holdDisabled={holdDisabled}
              queueHidden={hideQueue}
              accentColor={boss.color}
              header={(
                <div style={{ width: '100%', padding: '4px 5px 0', boxSizing: 'border-box' }}>
                  <div style={{ color: anomalyActive ? boss.color : '#555', fontSize: '0.38rem', letterSpacing: '0.08em', textAlign: 'center' }}>{anomalyActive ? 'ANOMALY' : 'STABLE'}</div>
                  <div style={{ height: 4, marginTop: 2, overflow: 'hidden', borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, (linesThisLevel / Math.max(1, targetLines)) * 100))}%`, height: '100%', borderRadius: 2, background: boss.color }} />
                  </div>
                </div>
              )}
            />
          )}
          <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ position: 'absolute', top: '11%', left: '50%', transform: 'translateX(-50%)', maxWidth: '80%', padding: '6px 12px', border: `1px solid ${boss.color}99`, borderRadius: 6, background: 'rgba(3,4,8,0.9)', color: boss.color, fontSize: '0.58rem', fontWeight: 900, letterSpacing: '0.14em', textAlign: 'center', pointerEvents: 'none' }}>{toast}</motion.div>}</AnimatePresence>
        </div>

        {isLandscape && (
          <aside style={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(4,5,9,0.58)' }}>
            <div style={{ color: '#666', fontSize: '0.48rem', letterSpacing: '0.12em' }}>{hideQueue ? 'QUEUE BLINDED' : 'NEXT'}</div>
            {(hideQueue ? [] : state.queue || []).slice(0, 4).map((type, index) => <PiecePreview key={`${type}-${index}`} type={type} small />)}
            {hideQueue && <div style={{ color: boss.color, fontSize: '2rem' }}>☉</div>}
            <button onClick={() => queueAction('activateZone')} disabled={state.zoneMeter < ZONE_MIN_METER || state.zoneActive} style={{ marginTop: 8, width: 92, minHeight: 34, border: `1px solid ${state.zoneMeter >= ZONE_MIN_METER ? '#00e5ff' : '#333'}`, borderRadius: 6, background: state.zoneActive ? 'rgba(0,229,255,0.18)' : 'transparent', color: state.zoneMeter >= ZONE_MIN_METER ? '#80eaff' : '#555', cursor: state.zoneMeter >= ZONE_MIN_METER ? 'pointer' : 'default', font: 'inherit', fontSize: '0.52rem' }}>{state.zoneActive ? `${Math.ceil(state.zoneTimer / 1000)}s` : 'ZONE'}</button>
          </aside>
        )}
      </main>

      {(!focus || isLandscape) && <div style={{ position: 'relative', zIndex: 12, height: 4, flexShrink: 0, background: 'rgba(15,30,60,0.8)' }}><div style={{ width: `${Math.max(0, Math.min(100, state.zoneActive ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100 : state.zoneMeter || 0))}%`, height: '100%', background: state.zoneActive ? 'linear-gradient(90deg,#8844ff,#00cfff)' : 'linear-gradient(90deg,#1e90ff,#00cfff)' }} /></div>}

      {config.showOnScreenControls && !paused && (!focus || isLandscape) && <TouchControls onPress={handleTouchPress} onRelease={handleTouchRelease} />}
      {config.showOnScreenControls && !paused && focus && !isLandscape && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, pointerEvents: 'auto' }}>
          <TouchControls onPress={handleTouchPress} onRelease={handleTouchRelease} />
        </div>
      )}

      {paused && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', background: 'rgba(2,3,7,0.88)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: 'min(320px, 88vw)', textAlign: 'center' }}>
            <div style={{ color: boss.color, fontSize: '0.55rem', letterSpacing: '0.24em' }}>DIVINE AUDIENCE SUSPENDED</div>
            <div style={{ marginTop: 8, fontSize: '1.4rem', fontWeight: 900 }}>PAUSED</div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={togglePause} style={{ minHeight: 42, border: 'none', borderRadius: 6, background: boss.color, color: '#05060a', cursor: 'pointer', font: 'inherit', fontWeight: 900 }}>RESUME</button>
              <button onClick={() => setShowSettings(true)} style={{ minHeight: 38, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 6, background: 'transparent', color: '#bbb', cursor: 'pointer', font: 'inherit' }}>SETTINGS</button>
              <button onClick={startGame} style={{ minHeight: 38, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, background: 'transparent', color: '#888', cursor: 'pointer', font: 'inherit' }}>RESTART</button>
              <button onClick={() => navigate('/s5')} style={{ minHeight: 38, border: 'none', background: 'transparent', color: '#777', cursor: 'pointer', font: 'inherit' }}>PANTHEON MAP</button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 150, overflowY: 'auto', padding: 20, background: 'rgba(0,0,0,0.85)' }}>
            <SettingsPage config={config} onConfig={setConfig} onClose={() => setShowSettings(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}