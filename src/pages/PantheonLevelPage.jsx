// ─── Season 5: The Pantheon Arc ──────────────────────────────────────────────
// Refactored with modular GameShell, useTetrisGame hook, and compound modals

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress } from '../firebase/db'
import { TetrisEngine } from '../logic/gameEngine'
import { BOARD_HEIGHT, BOARD_WIDTH, PIECES } from '../logic/tetrominoes'
import { findPantheonBoss, getNextPantheonBoss, isPantheonLevelUnlocked, isPantheonUnlocked } from '../logic/storyData_s5'
import { Season5MusicManager } from '../audio/season5MusicManager'
import { useStoryProgress } from '../hooks/useStoryProgress'
import { useTetrisGame } from '../hooks/useTetrisGame'
import {
  GameShell,
  PauseMenuModal,
  SettingsModal,
  StoryBriefingModal,
  LevelResultModal,
} from '../components/game'

const ANOMALY_GRACE_MS = 6000
const ANOMALY_ACTIVE_MS = 3000
const ANOMALY_RESPITE_MS = 12000
const PHASE = { INTRO: 'intro', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }

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
  const [easyMode, setEasyMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Anomaly Mechanics States
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

  const actionTimersRef = useRef(new Set())
  const snapshotsRef = useRef([])
  const lockCountRef = useRef(0)
  const lastClearRef = useRef(null)
  const lastPieceTypeRef = useRef(null)
  const effectiveMechanicsRef = useRef(new Set())
  const voidCellsRef = useRef([])
  const shrinkRowsRef = useRef(0)
  const discordMapRef = useRef({})
  const musicRef = useRef(null)

  const targetLines = easyMode ? boss?.easyTargetLines ?? boss?.targetLines ?? 40 : boss?.targetLines ?? 40
  const bypassUnlock = !!location.state?.fromPantheonComplete

  const showToast = useCallback(message => {
    setToast(message)
    const timer = setTimeout(() => setToast(null), 1800)
    actionTimersRef.current.add(timer)
  }, [])

  // ── Completion Callbacks ───────────────────────────────────────────────────
  const handleLevelComplete = useCallback(
    stats => {
      if (!boss) return
      const completedProgress = { ...progress, [`pantheon_${boss.id}_completed`]: true }
      setProgress(completedProgress)
      setPhase(PHASE.COMPLETE)
      musicRef.current?.stop?.()
      if (user?.uid) {
        saveStoryProgress(user.uid, 'pantheon', boss.id, stats.score, stats.linesThisLevel).catch(err =>
          console.error('Failed to save Pantheon progress:', err)
        )
      }
    },
    [boss, progress, setProgress, user?.uid]
  )

  const handleGameOver = useCallback(() => {
    setPhase(PHASE.FAIL)
    musicRef.current?.stop?.()
  }, [])

  // ── Headless Tetris Game Hook ──────────────────────────────────────────────
  const game = useTetrisGame({
    existingEngine: engine,
    targetLines,
    pieceTheme,
    active: phase === PHASE.GAME,
    musicManagerRef: musicRef,
    onLevelComplete: handleLevelComplete,
    onGameOver: handleGameOver,
  })

  // ── Music Lifecycle ────────────────────────────────────────────────────────
  const startMusic = useCallback(() => {
    if (!boss) return
    try {
      if (!musicRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return
        musicRef.current = new Season5MusicManager(new AudioContextClass())
      }
      musicRef.current.setVolume(game.config.musicVolume ?? 1)
      musicRef.current.playForBoss(boss.id)
    } catch (error) {
      console.error('Season 5 music failed to start:', error)
    }
  }, [boss, game.config.musicVolume])

  useEffect(() => {
    musicRef.current?.setZoneFx(game.state.zoneActive)
  }, [game.state.zoneActive])

  // ── Configured Anomaly Mechanics ───────────────────────────────────────────
  const configuredMechanics = useMemo(() => {
    if (!boss) return new Set()
    if (boss.id === 'aetherion') {
      const cycle = boss.mechanics || []
      return new Set([
        'divine_judgment',
        'shrinking_board',
        cycle[divinePhase % cycle.length],
        cycle[(divinePhase + 1) % cycle.length],
      ])
    }
    return new Set([boss.mechanic, boss.ability].filter(Boolean))
  }, [boss, divinePhase])

  const activeMechanics = useMemo(
    () => (anomalyActive ? configuredMechanics : new Set()),
    [anomalyActive, configuredMechanics]
  )

  useEffect(() => {
    effectiveMechanicsRef.current = activeMechanics
  }, [activeMechanics])

  useEffect(() => {
    voidCellsRef.current = voidCells
  }, [voidCells])

  useEffect(() => {
    shrinkRowsRef.current = shrinkRows
  }, [shrinkRows])

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

  const startGame = useCallback(() => {
    if (!boss) return
    const startingLevel = Math.max(1, Math.min(8, Math.round(1 + boss.gravityMult * 1.5)))
    game.resetGame({ gravityMult: boss.gravityMult })
    engine.level = startingLevel
    engine.storyLevelOffset = startingLevel
    resetMechanics()
    startMusic()
    setPhase(PHASE.GAME)
  }, [boss, engine, game, resetMechanics, startMusic])

  const restartFight = useCallback(() => {
    if (game.paused) game.togglePause()
    startGame()
  }, [game, startGame])

  // Anomaly cycle timer
  useEffect(() => {
    if (phase !== PHASE.GAME || !boss) {
      setAnomalyActive(false)
      return
    }
    let activeTimer
    let respiteTimer
    const beginAnomaly = () => {
      if (boss.id === 'aetherion') setDivinePhase(val => val + 1)
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

  // Void zones
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

  // Petrification
  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('petrification')) return
    const timer = setTimeout(() => {
      if (engine.zoneActive) {
        setStoneCells(new Set())
        return
      }
      const occupied = []
      for (let r = 2; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          if (engine.board[r]?.[c]) occupied.push(`${r},${c}`)
        }
      }
      if (occupied.length) {
        const selected = occupied[Math.floor(Math.random() * occupied.length)]
        setStoneCells(prev => new Set([...prev, selected]))
        showToast('DIVINE FORGE')
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [activeMechanics, engine, phase, showToast])

  useEffect(() => {
    if (game.state.zoneActive && stoneCells.size) setStoneCells(new Set())
  }, [game.state.zoneActive, stoneCells.size])

  // Shrinking board
  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('shrinking_board')) return
    const timer = setTimeout(
      () => {
        if (!engine.zoneActive) {
          setShrinkRows(v => Math.min(8, v + 1))
          showToast('DIVINE JUDGMENT')
        }
      },
      boss?.id === 'aetherion' ? 1800 : 2600
    )
    return () => clearTimeout(timer)
  }, [activeMechanics, boss?.id, engine, phase, showToast])

  // Engine encounter hooks
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
          piece.matrix.forEach((row, rowOffset) =>
            row.forEach((filled, colOffset) => {
              if (!filled) return
              const boardRow = piece.y + rowOffset
              const boardCol = BOARD_WIDTH - 1 - (piece.x + colOffset)
              if (
                boardRow >= 0 &&
                boardRow < BOARD_HEIGHT &&
                boardCol >= 0 &&
                boardCol < BOARD_WIDTH &&
                !board[boardRow][boardCol]
              ) {
                board[boardRow][boardCol] = piece.type
              }
            })
          )
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
        if (
          mechanics.has('worst_piece') &&
          !engine.zoneActive &&
          lockCountRef.current % 4 === 0 &&
          engine.queue.length
        ) {
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
    return () => {
      engine.storyEncounterHooks = null
    }
  }, [engine, showToast])

  // Discord / Scrambled controls
  useEffect(() => {
    if (phase !== PHASE.GAME || !activeMechanics.has('control_discord')) {
      discordMapRef.current = {}
      setDiscordActive(false)
      return
    }
    const scramble = () => {
      discordMapRef.current =
        Math.random() < 0.5
          ? { moveLeft: 'moveRight', moveRight: 'moveLeft', rotateCW: 'rotateCCW', rotateCCW: 'rotateCW' }
          : { moveLeft: 'rotateCCW', moveRight: 'rotateCW', rotateCW: 'moveRight', rotateCCW: 'moveLeft' }
      setDiscordActive(true)
      showToast('CONTROLS FRACTURED')
    }
    scramble()
    const timer = setInterval(scramble, 9000)
    return () => clearInterval(timer)
  }, [activeMechanics, phase, showToast])

  if (progressLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#05060a',
          color: '#f0c96a',
          fontFamily: 'monospace',
          letterSpacing: '0.2em',
        }}
      >
        READING DIVINE LAW…
      </div>
    )
  }

  if (!boss) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#05060a',
          color: '#f87171',
          fontFamily: 'monospace',
        }}
      >
        DEITY NOT FOUND{' '}
        <button type="button" onClick={() => navigate('/s5')}>
          BACK
        </button>
      </div>
    )
  }

  if (!isPantheonUnlocked(progress) || (!isPantheonLevelUnlocked(boss.id, progress) && !bypassUnlock)) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#05060a',
          color: '#888',
          fontFamily: 'monospace',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '2rem' }}>×</div>
          <div style={{ marginTop: 8 }}>DIVINE THRONE LOCKED</div>
          <button type="button" onClick={() => navigate('/s5')} style={{ marginTop: 16 }}>
            BACK TO PANTHEON
          </button>
        </div>
      </div>
    )
  }

  // ── Pre-Battle Intro Modal ─────────────────────────────────────────────────
  if (phase === PHASE.INTRO) {
    return (
      <StoryBriefingModal
        badge="SEASON 5 • THE PANTHEON ARC"
        title={`${boss.glyph} ${boss.name.toUpperCase()} — ${boss.subtitle}`}
        story={`“${boss.storyBefore}”\n\n${boss.abilityLabel}: ${boss.abilityDesc}`}
        targetLines={targetLines}
        accentColor={boss.color}
        onStart={startGame}
        startLabel="CHALLENGE DEITY →"
        onBack={() => navigate('/s5')}
        backLabel="← PANTHEON MAP"
        extraSlot={
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: easyMode ? boss.color : '#888',
              fontSize: '0.65rem',
              cursor: 'pointer',
              marginTop: 12,
            }}
          >
            <input
              type="checkbox"
              checked={easyMode}
              onChange={e => setEasyMode(e.target.checked)}
              style={{ accentColor: boss.color }}
            />
            EASY TRIAL • {easyMode ? boss.easyTargetLines : boss.targetLines} LINES
          </label>
        }
      />
    )
  }

  // ── Victory Modal ──────────────────────────────────────────────────────────
  if (phase === PHASE.COMPLETE) {
    const nextBoss = getNextPantheonBoss(boss.id)
    return (
      <LevelResultModal
        type="complete"
        title="THRONE OVERTHROWN"
        subtitle={`${boss.glyph} ${boss.name}`}
        message={boss.storyAfter}
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={boss.color}
        onPrimary={() => {
          if (nextBoss) {
            navigate(`/s5/${nextBoss.id}`, { state: { fromPantheonComplete: true } })
          } else {
            navigate('/s5')
          }
        }}
        primaryLabel={nextBoss ? 'NEXT THRONE →' : 'PANTHEON CONQUERED ✦'}
        onSecondary={() => navigate('/s5')}
        secondaryLabel="← PANTHEON MAP"
      />
    )
  }

  // ── Defeat Modal ───────────────────────────────────────────────────────────
  if (phase === PHASE.FAIL) {
    return (
      <LevelResultModal
        type="fail"
        title="JUDGMENT DELIVERED"
        subtitle={`${boss.glyph} ${boss.name}`}
        message="The divine law closes around your tower. Rebuild, return, and answer it differently."
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={boss.color}
        onPrimary={restartFight}
        primaryLabel="RETRY TRIAL"
        onSecondary={() => navigate('/s5')}
        secondaryLabel="← PANTHEON MAP"
      />
    )
  }

  const hideQueue = activeMechanics.has('blind_queue')
  const holdDisabled = activeMechanics.has('void_zones_heavy')
  const renderState = {
    ...game.state,
    hold: holdDisabled ? null : game.state.hold,
    queue: hideQueue ? [] : game.state.queue,
    current:
      mirageType && game.state.current
        ? {
            ...game.state.current,
            type: mirageType,
            matrix: PIECES[mirageType].matrix.map(row => [...row]),
          }
        : game.state.current,
  }

  // ── Main Gameplay ──────────────────────────────────────────────────────────
  return (
    <GameShell
      state={renderState}
      linesThisLevel={game.linesThisLevel}
      targetLines={targetLines}
      level={boss}
      levelTitle={`${boss.glyph} ${boss.name}`}
      accentColor={boss.color}
      bgType={boss.bgType || 'gold_wireframe'}
      pieceTheme={pieceTheme}
      gameMode="story"
      isLandscape={game.isLandscape}
      hudSizing={game.hudSizing}
      zoom={game.zoom}
      setZoom={game.setZoom}
      focus={game.focus}
      setFocus={game.setFocus}
      config={game.config}
      triggerAction={game.triggerAction}
      handlePress={game.handlePress}
      handleRelease={game.handleRelease}
      handleHardDrop={game.handleHardDrop}
      togglePause={game.togglePause}
      onOpenSettings={() => setShowSettings(true)}
      abilityActive={anomalyActive}
      abilityLabel={boss.abilityLabel}
      hideNextCount={hideQueue ? 99 : 0}
      holdDisabled={holdDisabled}
      hudTopSlot={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {anomalyActive && (
            <span
              style={{
                fontSize: '0.58rem',
                color: boss.color,
                fontWeight: 900,
                letterSpacing: '0.12em',
                fontFamily: 'monospace',
              }}
            >
              ⚡ {boss.abilityLabel}
            </span>
          )}
          {discordActive && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#ef476f',
                fontWeight: 700,
                letterSpacing: '0.1em',
                fontFamily: 'monospace',
              }}
            >
              FRACTURED
            </span>
          )}
        </div>
      }
      overlaySlot={
        <>
          {/* Solar Flash Overlay */}
          {solarFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.72, 0.3] }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: '0 0 48% 0',
                background: 'rgba(255,248,205,0.9)',
                pointerEvents: 'none',
                mixBlendMode: 'screen',
                zIndex: 20,
              }}
            />
          )}

          {/* Clear Lag Rows */}
          {clearLagRows.map((row, index) => (
            <div
              key={row.id}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${index * (100 / (BOARD_HEIGHT - 2))}%`,
                height: `${100 / (BOARD_HEIGHT - 2)}%`,
                borderTop: '1px solid rgba(85,214,255,0.7)',
                background: 'rgba(85,214,255,0.2)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
          ))}

          {/* Hover Garbage */}
          {hoverGarbage.map((attack, index) => (
            <motion.div
              key={attack.id}
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${index * 6}%`,
                height: `${attack.rows * 5}%`,
                border: '1px dashed rgba(239,71,111,0.75)',
                background: 'rgba(239,71,111,0.13)',
                color: '#ff91aa',
                fontSize: '0.46rem',
                textAlign: 'right',
                padding: 3,
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 12,
              }}
            >
              RETRIBUTION
            </motion.div>
          ))}

          {/* Floating Anomaly Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.94 }}
                transition={{ duration: 0.22 }}
                style={{
                  position: 'absolute',
                  top: '12%',
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
                  fontFamily: 'monospace',
                }}
              >
                ◈ {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      }
      pauseMenuSlot={
        <PauseMenuModal
          isOpen={game.paused}
          subtitle={`${boss.glyph} ${boss.name} — ${boss.subtitle}`}
          statsText={`Lv ${game.state.level} · ${game.linesThisLevel} / ${targetLines} lines`}
          accentColor={boss.color}
          onResume={game.togglePause}
          onRestart={restartFight}
          onExitMap={() => navigate('/s5')}
          mapLabel="← PANTHEON MAP"
          onOpenSettings={() => setShowSettings(true)}
          musicManager={musicRef.current}
          config={game.config}
          onConfigChange={game.setConfig}
        />
      }
      settingsModalSlot={
        <SettingsModal
          isOpen={showSettings}
          config={game.config}
          onConfig={game.setConfig}
          onClose={() => setShowSettings(false)}
        />
      }
    />
  )
}