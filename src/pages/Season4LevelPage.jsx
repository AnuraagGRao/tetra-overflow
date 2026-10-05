// ─── Season 4: The Genesis Protocol ───────────────────────────────────────────
// Refactored with modular GameShell, useTetrisGame hook, and compound modals

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress } from '../firebase/db'
import { findS4Level, getNextS4Level, isS4LevelUnlocked, isS4Unlocked } from '../logic/storyData_s4'
import { Season4MusicManager } from '../audio/season4MusicManager'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import { useStoryProgress } from '../hooks/useStoryProgress'
import { useTetrisGame } from '../hooks/useTetrisGame'
import {
  GameShell,
  PauseMenuModal,
  SettingsModal,
  StoryBriefingModal,
  LevelResultModal,
} from '../components/game'

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

const PHASE = { STORY: 'story', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }

export default function Season4LevelPage() {
  const { sectorId, levelId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // ── Level & Lore ───────────────────────────────────────────────────────────
  const levelData = useMemo(() => findS4Level(sectorId, levelId), [sectorId, levelId])
  const { sector, level } = levelData || {}
  const sectorColor = sector?.color ?? '#ffffff'
  const pieceTheme = useMemo(
    () => BG_TYPE_TO_PIECE_THEME[S4_BG_FALLBACKS[level?.bgType] ?? 'classic'] ?? 'classic',
    [level?.bgType]
  )
  const bgType = S4_BG_FALLBACKS[level?.bgType] ?? 'pure_white_grid'

  const { progress, loading: progressLoading } = useStoryProgress(user?.uid)
  const s4Unlocked = useMemo(() => isS4Unlocked(progress), [progress])
  const levelUnlocked = useMemo(() => isS4LevelUnlocked(sectorId, levelId, progress), [sectorId, levelId, progress])
  const bypassUnlock = !!(location.state && location.state.fromS4Complete)

  const [phase, setPhase] = useState(PHASE.STORY)
  const [showSettings, setShowSettings] = useState(false)
  const musicRef = useRef(null)

  const effectiveTarget = level?.targetLines ?? 0

  // ── Completion & Fail Handlers ─────────────────────────────────────────────
  const handleLevelComplete = useCallback(() => {
    setPhase(PHASE.COMPLETE)
  }, [])

  const handleGameOver = useCallback(() => {
    setPhase(PHASE.FAIL)
  }, [])

  // ── Headless Tetris Game Hook ──────────────────────────────────────────────
  const game = useTetrisGame({
    targetLines: effectiveTarget,
    pieceTheme,
    active: phase === PHASE.GAME,
    musicManagerRef: musicRef,
    onLevelComplete: handleLevelComplete,
    onGameOver: handleGameOver,
  })

  // ── Music Lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.GAME || !level || !sectorId) return
    const initMusic = async () => {
      try {
        if (!musicRef.current) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext
          const audioCtx = new AudioContextClass()
          if (audioCtx.state === 'suspended') await audioCtx.resume()
          musicRef.current = new Season4MusicManager(audioCtx)
        }
        musicRef.current.setPlaylist(sectorId)
        musicRef.current.setVolume(game.config.musicVolume ?? 1.0)
      } catch (e) {
        console.error('Music init failed:', e)
      }
    }
    initMusic()
    return () => {
      musicRef.current?.stop?.()
    }
  }, [phase, level, sectorId, game.config.musicVolume])

  // Reset when levelId/sectorId changes
  useEffect(() => {
    setPhase(PHASE.STORY)
  }, [sectorId, levelId])

  const handleStartGame = () => {
    game.resetGame({ gravityMult: level?.gravityMult ?? 1.0 })
    setPhase(PHASE.GAME)
  }

  const handleRestartLevel = () => {
    if (game.paused) game.togglePause()
    game.resetGame({ gravityMult: level?.gravityMult ?? 1.0 })
    setPhase(PHASE.GAME)
  }

  const handleSaveAndAdvance = () => {
    if (!user?.uid || !level) return
    const nextLevel = getNextS4Level(sectorId, levelId)
    const finalScore = game.state.score
    const finalLines = game.linesThisLevel
    saveStoryProgress(user.uid, `s4_${sectorId}`, levelId, finalScore, finalLines).catch(e =>
      console.error('Failed to save progress:', e)
    )
    if (nextLevel) {
      navigate(`/s4/${nextLevel.sectorId}/${nextLevel.levelId}`, { state: { fromS4Complete: true } })
    } else {
      navigate('/s4', { state: { completed: true } })
    }
  }

  const handleBackToMap = () => {
    navigate('/s4')
  }

  // ── Loading / Locked States ────────────────────────────────────────────────
  if (progressLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: '#000',
          color: '#0f0',
          fontFamily: 'monospace',
        }}
      >
        INITIALIZING…
      </div>
    )
  }

  if (!s4Unlocked || (!levelUnlocked && !bypassUnlock)) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: '#000',
          color: '#888',
          gap: '1rem',
          fontFamily: 'monospace',
        }}
      >
        <div>🔒 LEVEL LOCKED</div>
        <button
          type="button"
          onClick={handleBackToMap}
          style={{
            padding: '0.5rem 1rem',
            background: '#222',
            border: '1px solid #666',
            color: '#aaa',
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          ← Back
        </button>
      </div>
    )
  }

  // ── Briefing Modal ─────────────────────────────────────────────────────────
  if (phase === PHASE.STORY) {
    return (
      <StoryBriefingModal
        badge={`SECTOR ${sectorId?.toUpperCase()} • ${sector?.title || ''}`}
        title={level?.title}
        story={level?.storyBefore}
        targetLines={effectiveTarget}
        accentColor={sectorColor}
        onStart={handleStartGame}
        onBack={handleBackToMap}
      />
    )
  }

  // ── Victory Modal ──────────────────────────────────────────────────────────
  if (phase === PHASE.COMPLETE) {
    const nextLevel = getNextS4Level(sectorId, levelId)
    return (
      <LevelResultModal
        type="complete"
        title="✓ CLEARED"
        subtitle={`SECTOR ${sectorId?.toUpperCase()} › ${level?.title}`}
        message={level?.storyAfter}
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={sectorColor}
        onPrimary={handleSaveAndAdvance}
        primaryLabel={nextLevel ? 'NEXT →' : 'SEASON COMPLETE →'}
        onSecondary={handleBackToMap}
        secondaryLabel="← SEASON 4 MAP"
      />
    )
  }

  // ── Defeat Modal ───────────────────────────────────────────────────────────
  if (phase === PHASE.FAIL) {
    return (
      <LevelResultModal
        type="fail"
        title="GENESIS COLLAPSE"
        subtitle={level?.title}
        message="The structure exceeded its stability threshold. Recompile the tower and try again."
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={sectorColor}
        onPrimary={handleRestartLevel}
        primaryLabel="RETRY LEVEL"
        onSecondary={handleBackToMap}
        secondaryLabel="← SEASON 4 MAP"
      />
    )
  }

  // ── Main Gameplay ──────────────────────────────────────────────────────────
  return (
    <GameShell
      state={game.state}
      linesThisLevel={game.linesThisLevel}
      targetLines={effectiveTarget}
      level={level}
      levelTitle={level?.title}
      accentColor={sectorColor}
      bgType={bgType}
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
      pauseMenuSlot={
        <PauseMenuModal
          isOpen={game.paused}
          subtitle={`SECTOR ${sectorId?.toUpperCase()} › ${level?.title}`}
          statsText={`Lv ${game.state.level} · ${game.linesThisLevel} / ${effectiveTarget} lines`}
          accentColor={sectorColor}
          onResume={game.togglePause}
          onRestart={handleRestartLevel}
          onExitMap={handleBackToMap}
          mapLabel="← SEASON 4 MAP"
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
