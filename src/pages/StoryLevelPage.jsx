// ─── Season 1: Story Campaign ─────────────────────────────────────────────────
// Refactored with modular GameShell, useTetrisGame hook, and compound modals

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import {
  saveStoryProgress,
  unlockItem,
  saveGameResult,
  markEasyModePlayed,
  setActiveBadge,
  awardStoryChapterMilestone,
} from '../firebase/db'
import { findLevel, getNextLevel } from '../logic/storyData'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import { StoryMusicManager } from '../audio/storyMusicManager'
import GlitchOverlay from '../components/GlitchOverlay'
import { useTetrisGame } from '../hooks/useTetrisGame'
import {
  GameShell,
  PauseMenuModal,
  SettingsModal,
  StoryBriefingModal,
  LevelResultModal,
} from '../components/game'

const PHASE = {
  STORY: 'story',
  LOADING: 'loading',
  GAME: 'game',
  TRANSITION: 'transition',
  COMPLETE: 'complete',
  FAIL: 'fail',
  ENDING: 'ending',
  MATRIX_ASCENT: 'matrix-ascent',
  MATRIX_END: 'matrix-end',
}

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
        <button
          type="button"
          onClick={() => {
            m?.prev?.()
            setBump(x => x + 1)
          }}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#ccc',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={() => m?.pause?.()}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#ccc',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ⏸
        </button>
        <button
          type="button"
          onClick={() => m?.resume?.()}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#ccc',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => {
            m?.next?.()
            setBump(x => x + 1)
          }}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#ccc',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ⏭
        </button>
        <button
          type="button"
          onClick={() => {
            const on = !m?.getShuffleEachLoop?.()
            m?.setShuffleEachLoop?.(on)
            setBump(x => x + 1)
          }}
          style={{
            background: shuffle ? 'rgba(0,212,255,0.10)' : 'rgba(255,255,255,0.07)',
            border: shuffle ? `1px solid ${chapterColor}` : '1px solid rgba(255,255,255,0.18)',
            color: shuffle ? chapterColor : '#ccc',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.70rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.06em',
          }}
        >
          🔀 {shuffle ? 'Shuffle On' : 'Shuffle Off'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: '0.60rem', color: '#777' }}>Xfade</span>
        <input
          type="range"
          min={0.5}
          max={4}
          step={0.1}
          onChange={e => m?.setCrossfadeSeconds?.(parseFloat(e.target.value))}
          defaultValue={1.6}
          style={{ width: 160 }}
        />
      </div>
    </div>
  )
}

export default function StoryLevelPage() {
  const { chapterId, levelId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [currentChapterId, setCurrentChapterId] = useState(chapterId)
  const [currentLevelId, setCurrentLevelId] = useState(levelId)

  const found = useMemo(() => findLevel(currentChapterId, currentLevelId), [currentChapterId, currentLevelId])
  const { chapter, level } = found || {}
  const pieceTheme = BG_TYPE_TO_PIECE_THEME[level?.bgType] || 'classic'

  const [phase, setPhase] = useState(PHASE.STORY)
  const [showSettings, setShowSettings] = useState(false)
  const [storyCountdown, setStoryCountdown] = useState(null)
  const [transitionCountdown, setTransitionCountdown] = useState(null)
  const [matrixCountdown, setMatrixCountdown] = useState(null)
  const [saving, setSaving] = useState(false)
  const [easyMode] = useState(() => {
    try {
      return localStorage.getItem('story-easy') === '1'
    } catch {
      return false
    }
  })

  // Secret endings state
  const [finalReadyToTopOut, setFinalReadyToTopOut] = useState(false)
  const [glitchActive, setGlitchActive] = useState(false)
  const finalClearSavedRef = useRef(false)
  const isFinalConvergence = currentChapterId === 'ch7' && currentLevelId === 'l5'

  const storyMusicRef = useRef(null)
  const transitionAdvanceRef = useRef(null)
  const levelStartScoreRef = useRef(0)

  const effectiveTargetLines = useMemo(() => {
    const tl = level?.targetLines || 0
    if (!easyMode || tl <= 0) return tl
    const easyOverride = level?.easyTargetLines
    return typeof easyOverride === 'number' ? easyOverride : Math.round(tl * 0.75)
  }, [level, easyMode])

  const loopTargetLines = isFinalConvergence ? 0 : effectiveTargetLines

  // ── Level Completion Persistence ───────────────────────────────────────────
  const persistLevelCompletion = useCallback(
    stats => {
      const {
        score,
        linesThisLevel: lt = 0,
        tSpins = 0,
        iPieceLines = 0,
        piecesPlaced = 0,
        holdUses = 0,
        tetrisClears = 0,
        hardDrops = 0,
      } = stats
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
          unlockThemes.filter(Boolean).forEach(id => unlocks.push(unlockItem(user.uid, id)))
        }
        try {
          unlocks.push(
            saveGameResult(user.uid, 'story', score, {
              lines: lt,
              level: found.level.gravityMult ? Math.round(found.level.gravityMult * 5 + 1) : 1,
              survivalMs: 0,
              tSpins,
              iPieceLines,
              piecesPlaced,
              holdUses,
              tetrisClears,
              hardDrops,
            })
          )
        } catch {}
        if (isChapterComplete) {
          unlocks.push(awardStoryChapterMilestone(user.uid, currentChapterId))
        }
        Promise.all(unlocks).finally(() => setSaving(false))
      }
    },
    [user, easyMode, found, currentChapterId, currentLevelId]
  )

  // ── Completion & Game Over Callbacks ───────────────────────────────────────
  const handleLevelComplete = useCallback(
    stats => {
      persistLevelCompletion(stats)
      const next = getNextLevel(currentChapterId, currentLevelId)
      if (next) {
        setPhase(PHASE.TRANSITION)
      } else if (currentChapterId === 'ch8' && currentLevelId === 'l1') {
        setPhase(PHASE.MATRIX_END)
      } else {
        setPhase(PHASE.COMPLETE)
      }
    },
    [currentChapterId, currentLevelId, persistLevelCompletion]
  )

  const handleGameOver = useCallback(
    stats => {
      if (isFinalConvergence && finalReadyToTopOut && stats.gameOverReason === 'topout') {
        if (!finalClearSavedRef.current) {
          finalClearSavedRef.current = true
          persistLevelCompletion(stats)
        }
        setPhase(PHASE.ENDING)
        return
      }
      setPhase(PHASE.FAIL)
    },
    [isFinalConvergence, finalReadyToTopOut, persistLevelCompletion]
  )

  // ── Custom Tick for Secret Endings ─────────────────────────────────────────
  const handleCustomTick = useCallback(
    ({ engine }) => {
      if (isFinalConvergence) {
        const lines = engine.lines - (game?.levelStartLinesRef?.current ?? 0)
        if (lines >= 40 && !glitchActive) setGlitchActive(true)
        if (lines >= 50 && !finalReadyToTopOut) setFinalReadyToTopOut(true)
      }
    },
    [isFinalConvergence, glitchActive, finalReadyToTopOut] // eslint-disable-line
  )

  // ── Headless Tetris Game Hook ──────────────────────────────────────────────
  const game = useTetrisGame({
    targetLines: loopTargetLines,
    pieceTheme,
    active: phase === PHASE.GAME,
    musicManagerRef: storyMusicRef,
    onCustomTick: handleCustomTick,
    onLevelComplete: handleLevelComplete,
    onGameOver: handleGameOver,
  })

  // ── Music Manager Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (phase === PHASE.LOADING || phase === PHASE.GAME) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass && !storyMusicRef.current) {
        storyMusicRef.current = new StoryMusicManager(new AudioContextClass())
      }
      storyMusicRef.current?.playForLevelContinuous(currentChapterId, currentLevelId)
      storyMusicRef.current?.setLevelBpm?.(found?.level?.bpm || 120)
    } else if (phase === PHASE.FAIL || phase === PHASE.COMPLETE) {
      storyMusicRef.current?.stop()
    }
  }, [phase, currentChapterId, currentLevelId, found?.level?.bpm])

  useEffect(() => () => storyMusicRef.current?.stop(), [])

  // ── Level Advancing & Reset Helpers ────────────────────────────────────────
  const startLevelGame = useCallback(() => {
    const gm = found?.level?.gravityMult ?? 1.0
    const gravFactor = easyMode ? 0.6 : 1.0
    levelStartScoreRef.current = game.state.score
    game.resetGame({ gravityMult: gm * gravFactor })
    setPhase(PHASE.GAME)
  }, [found, easyMode, game])

  const restartLevel = useCallback(() => {
    if (game.paused) game.togglePause()
    startLevelGame()
  }, [game, startLevelGame])

  // Story auto-begin (13s countdown)
  useEffect(() => {
    if (phase !== PHASE.STORY) {
      setStoryCountdown(null)
      return
    }
    setStoryCountdown(13)
    let remaining = 13
    const id = setInterval(() => {
      remaining -= 1
      setStoryCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        startLevelGame()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, currentChapterId, currentLevelId, startLevelGame])

  // Seamless transition timer
  useEffect(() => {
    if (phase !== PHASE.TRANSITION) {
      setTransitionCountdown(null)
      return
    }
    const next = getNextLevel(currentChapterId, currentLevelId)
    if (!next) return

    const isBossLevel = found?.level?.isBoss
    const delay = isBossLevel ? 9 : 7
    setTransitionCountdown(delay)
    let remaining = delay

    const doAdvance = () => {
      const nextFound = findLevel(next.chapterId, next.levelId)
      const gm = nextFound?.level?.gravityMult ?? 1.0
      const gravFactor = easyMode ? 0.6 : 1.0
      levelStartScoreRef.current = game.state.score
      game.levelStartLinesRef.current = game.state.lines
      game.resetGame({ gravityMult: gm * gravFactor, linesOffset: game.state.lines })
      setCurrentChapterId(next.chapterId)
      setCurrentLevelId(next.levelId)
      setPhase(PHASE.GAME)
    }

    transitionAdvanceRef.current = doAdvance
    const id = setInterval(() => {
      remaining -= 1
      setTransitionCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        doAdvance()
      }
    }, 1000)

    return () => {
      clearInterval(id)
      transitionAdvanceRef.current = null
    }
  }, [phase, currentChapterId, currentLevelId, found, easyMode, game])

  // Matrix ascent countdown (6s)
  useEffect(() => {
    if (phase !== PHASE.MATRIX_ASCENT) {
      setMatrixCountdown(null)
      return
    }
    setMatrixCountdown(6)
    let remaining = 6
    const id = setInterval(() => {
      remaining -= 1
      setMatrixCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        setCurrentChapterId('ch8')
        setCurrentLevelId('l1')
        setPhase(PHASE.STORY)
        navigate('/s1/ch8/l1', { replace: true })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, navigate])

  if (!found) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: '#000',
          color: '#fff',
          fontFamily: 'monospace',
          gap: 12,
        }}
      >
        <div>LEVEL NOT FOUND</div>
        <button
          type="button"
          onClick={() => navigate('/s1')}
          style={{ padding: '8px 16px', background: '#222', border: '1px solid #555', color: '#ccc', cursor: 'pointer' }}
        >
          ← MAP
        </button>
      </div>
    )
  }

  // ── Pre-Level Story Briefing ───────────────────────────────────────────────
  if (phase === PHASE.STORY) {
    return (
      <StoryBriefingModal
        badge={`${chapter?.title?.toUpperCase()} • ${chapter?.subtitle || ''}`}
        title={level?.title}
        story={level?.storyBefore}
        targetLines={effectiveTargetLines}
        accentColor={chapter?.color}
        onStart={startLevelGame}
        startLabel={storyCountdown ? `START (${storyCountdown}s) →` : 'START →'}
        onBack={() => navigate('/s1')}
        backLabel="← CHAPTER MAP"
      />
    )
  }

  // ── Grand Ending (Ch7/L5 Convergence Mastered) ──────────────────────────────
  if (phase === PHASE.ENDING) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,215,0,0.08) 0%, rgba(0,0,0,0.96) 70%)',
          color: '#fff',
          fontFamily: 'monospace',
          boxSizing: 'border-box',
        }}
      >
        <motion.div
          initial={{ scale: 0.88, y: 32, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', maxWidth: 460, width: '100%' }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 24px #ffd700)' }}>✦</div>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.5em', color: '#ffd700', textTransform: 'uppercase', marginBottom: 8 }}>
            The Journey is Complete
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff', marginBottom: '0.4rem' }}>
            THE END
          </div>
          <div style={{ fontSize: '0.58rem', color: '#ffd700', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '1.6rem', border: '1px solid #ffd70033', borderRadius: 4, padding: '3px 14px', display: 'inline-block' }}>
            CONVERGENCE MASTERED
          </div>
          <p style={{ color: '#bbb', fontSize: '0.9rem', lineHeight: 1.85, margin: '0 0 1.6rem' }}>
            You put down the last piece. The music stops. For one perfect moment, the board is clear.
            <br /><br />
            Seven chapters. Four elements. The cosmos. The void. And one pattern that never repeated itself.
            <br /><br />
            You are the last architect. The game remembers you.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
            <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 10, padding: '10px 18px', minWidth: 90 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffd700' }}>{game.linesThisLevel}</div>
              <div style={{ fontSize: '0.55rem', color: '#888', letterSpacing: '0.14em' }}>LINES</div>
            </div>
            <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 10, padding: '10px 18px', minWidth: 90 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffd700' }}>{game.state.score.toLocaleString()}</div>
              <div style={{ fontSize: '0.55rem', color: '#888', letterSpacing: '0.14em' }}>FINAL PTS</div>
            </div>
          </div>
          {saving && <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: 12 }}>Saving progress…</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setPhase(PHASE.MATRIX_ASCENT)}
              style={{ background: '#00ff41', border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ▶ ENTER THE MATRIX
            </button>
            <button
              type="button"
              onClick={() => navigate('/s1', { replace: true })}
              style={{ background: '#ffd700', border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ★ WORLD MAP
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Matrix End (True Finale after Ch8/L1) ──────────────────────────────────
  if (phase === PHASE.MATRIX_END) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'radial-gradient(ellipse at 50% 40%, rgba(0,80,0,0.15) 0%, rgba(0,0,0,0.97) 70%)',
          color: '#fff',
          fontFamily: 'monospace',
          boxSizing: 'border-box',
        }}
      >
        <motion.div
          initial={{ scale: 0.88, y: 32, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', maxWidth: 460, width: '100%' }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 24px #00ff41)' }}>◈</div>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.5em', color: '#00ff41', textTransform: 'uppercase', marginBottom: 8 }}>
            System Override Complete
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '0.1em', color: '#d6ffd6', marginBottom: '0.4rem' }}>
            THE MATRIX FALLS
          </div>
          <p style={{ color: '#bbb', fontSize: '0.9rem', lineHeight: 1.85, margin: '0 0 1.6rem' }}>
            You rewrote the source code from inside. The board is clear. The matrix is silent.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/s1', { replace: true })}
              style={{ background: '#00ff41', border: 'none', color: '#000', borderRadius: 8, padding: '11px 28px', fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.18em', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ◈ WORLD MAP
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Matrix Ascent Transition ───────────────────────────────────────────────
  if (phase === PHASE.MATRIX_ASCENT) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120,
          background: 'radial-gradient(ellipse at 50% 45%, rgba(0, 40, 0, 0.55) 0%, rgba(0, 0, 0, 0.96) 72%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: 'monospace',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ maxWidth: 460 }}>
          <div style={{ fontSize: '0.58rem', letterSpacing: '0.42em', color: '#65ff9b', marginBottom: 10 }}>
            SYSTEM BREACH
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#d6ffd6', letterSpacing: '0.14em', marginBottom: 10 }}>
            THE MATRIX OPENS
          </div>
          <p style={{ color: '#87d787', fontSize: '0.78rem', lineHeight: 1.85, margin: '0 0 1rem' }}>
            You held the final pattern past completion and crashed the system from inside.
            <br />
            Redirecting to Chapter 8 / Level 1...
          </p>
          <div style={{ fontSize: '0.65rem', color: '#65ff9b', letterSpacing: '0.2em' }}>
            {matrixCountdown ? `JUMP IN ${matrixCountdown}` : 'CONNECTING'}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Standard Level Complete / Fail Modals ──────────────────────────────────
  if (phase === PHASE.COMPLETE) {
    return (
      <LevelResultModal
        type="complete"
        title="✦ CHAPTER COMPLETE"
        subtitle={`${chapter?.title} › ${level?.title}`}
        message={level?.storyAfter}
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={chapter?.color}
        onPrimary={() => navigate('/s1')}
        primaryLabel="WORLD MAP →"
        onSecondary={restartLevel}
        secondaryLabel="REPLAY LEVEL"
      />
    )
  }

  if (phase === PHASE.FAIL) {
    return (
      <LevelResultModal
        type="fail"
        title="SIGNAL LOST"
        subtitle={level?.title}
        message={`Clear ${effectiveTargetLines > 0 ? effectiveTargetLines : 'all'} lines to pass.`}
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={chapter?.color}
        onPrimary={restartLevel}
        primaryLabel="RETRY LEVEL"
        onSecondary={() => navigate('/s1')}
        secondaryLabel="← MAP"
      />
    )
  }

  // ── Main Gameplay ──────────────────────────────────────────────────────────
  return (
    <GameShell
      state={game.state}
      linesThisLevel={game.linesThisLevel}
      targetLines={effectiveTargetLines}
      level={level}
      levelTitle={level?.title}
      accentColor={chapter?.color}
      bgType={level?.bgType || 'classic'}
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
      overlaySlot={glitchActive ? <GlitchOverlay active={glitchActive} /> : null}
      pauseMenuSlot={
        <PauseMenuModal
          isOpen={game.paused}
          subtitle={`${chapter?.title} › ${level?.title}`}
          statsText={`Lv ${game.state.level} · ${game.linesThisLevel} / ${effectiveTargetLines} lines`}
          accentColor={chapter?.color}
          onResume={game.togglePause}
          onRestart={restartLevel}
          onExitMap={() => navigate('/s1')}
          mapLabel="← WORLD MAP"
          onOpenSettings={() => setShowSettings(true)}
          config={game.config}
          onConfigChange={game.setConfig}
          extraSlot={<MediaControls storyMusicRef={storyMusicRef} chapterColor={chapter?.color} />}
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
    >
      {/* Seamless Transition Overlay */}
      <AnimatePresence>
        {phase === PHASE.TRANSITION && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.78)',
              backdropFilter: 'blur(6px)',
              padding: '2rem',
              fontFamily: 'monospace',
            }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              style={{ textAlign: 'center', maxWidth: 440 }}
            >
              <div style={{ fontSize: '0.55rem', letterSpacing: '0.4em', color: chapter?.color, marginBottom: 12 }}>
                ✦ {level?.title} CLEARED ✦
              </div>
              <p style={{ color: '#ddd', fontSize: '0.9rem', lineHeight: 1.8, margin: '0 0 1.5rem' }}>
                {level?.storyAfter}
              </p>
              <button
                type="button"
                onClick={() => transitionAdvanceRef.current?.()}
                style={{
                  background: chapter?.color,
                  border: 'none',
                  color: '#000',
                  borderRadius: 8,
                  padding: '10px 28px',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  letterSpacing: '0.18em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                CONTINUE →
              </button>
              {transitionCountdown !== null && transitionCountdown > 0 && (
                <div style={{ fontSize: '0.55rem', color: '#666', marginTop: 8 }}>
                  Auto in {transitionCountdown}s
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameShell>
  )
}
