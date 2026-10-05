// ─── Season 3: Chronos Protocol ──────────────────────────────────────────────
// Refactored with modular GameShell, useTetrisGame hook, and useS3Mechanics hook

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress, saveGameResult, markEasyModePlayed, setActiveBadge } from '../firebase/db'
import { findS3Level, getNextS3Level, isS3LevelUnlocked, isS3Unlocked } from '../logic/storyData_s3'
import { Season3MusicManager } from '../audio/season3MusicManager'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import { useStoryProgress } from '../hooks/useStoryProgress'
import { useTetrisGame } from '../hooks/useTetrisGame'
import { useS3Mechanics } from '../hooks/useS3Mechanics'
import {
  GameShell,
  PauseMenuModal,
  SettingsModal,
  StoryBriefingModal,
  LevelResultModal,
  RewindGauge,
} from '../components/game'

const S3_BG_FALLBACKS = {
  glitch_light: 'geometry',
  glitch_med: 'geometry',
  matrix_distorted: 'geometry',
  error_cyan: 'stellar',
  crt_scanline: 'geometry',
  retro_grid: 'geometry',
  vhs_tracking: 'geometry',
  '8bit_dungeon': 'geometry',
  neon_wireframe: 'stellar',
  synthwave_city: 'stellar',
  ai_eye: 'warp',
  lightspeed_tunnel: 'warp',
  red_hex: 'inferno',
  corrupted_code: 'inferno',
  shattered_glass: 'inferno',
}

const PHASE = { STORY: 'story', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }

export default function Season3LevelPage() {
  const { epochId, levelId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const levelData = useMemo(() => findS3Level(epochId, levelId), [epochId, levelId])
  const { epoch, level } = levelData || {}
  const epochColor = epoch?.color ?? '#ff0000'
  const pieceTheme = useMemo(
    () => BG_TYPE_TO_PIECE_THEME[S3_BG_FALLBACKS[level?.bgType] ?? 'geometry'] ?? 'geometry',
    [level?.bgType]
  )
  const bgType = S3_BG_FALLBACKS[level?.bgType] ?? 'geometry'

  const { progress, loading: progressLoading } = useStoryProgress(user?.uid)
  const s3Unlocked = useMemo(() => isS3Unlocked(progress), [progress])
  const levelUnlocked = useMemo(() => isS3LevelUnlocked(epochId, levelId, progress), [epochId, levelId, progress])
  const bypassUnlock = !!(location.state && location.state.fromS3Complete)

  const [phase, setPhase] = useState(PHASE.STORY)
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)

  const [easyMode] = useState(() => {
    try {
      return localStorage.getItem('story-easy') === '1'
    } catch {
      return false
    }
  })

  const musicRef = useRef(null)
  const effectiveTarget = easyMode ? (level?.easyTargetLines || level?.targetLines) : level?.targetLines

  // ── Completion & Defeat Callbacks ──────────────────────────────────────────
  const handleLevelComplete = useCallback(
    stats => {
      if (user && easyMode) {
        markEasyModePlayed(user.uid).catch(() => {})
        setActiveBadge(user.uid, 'badge_noob').catch(() => {})
      }
      if (user && level) {
        setSaving(true)
        const finalScore = stats.score
        const finalLines = stats.linesThisLevel
        Promise.all([
          saveStoryProgress(user.uid, `s3_${epochId}`, levelId, finalScore, finalLines),
          saveGameResult(user.uid, 's3', finalScore, {
            lines: finalLines,
            level: level.gravityMult ? Math.round(level.gravityMult * 5 + 1) : 1,
            epochId,
            levelId,
            tSpins: stats.tSpins || 0,
            piecesPlaced: stats.piecesPlaced || 0,
          }),
        ]).finally(() => setSaving(false))
      }
      setPhase(PHASE.COMPLETE)
    },
    [user, easyMode, level, epochId, levelId]
  )

  const handleGameOver = useCallback(() => {
    setPhase(PHASE.FAIL)
  }, [])

  // ── Headless Game Hook ─────────────────────────────────────────────────────
  const game = useTetrisGame({
    targetLines: effectiveTarget,
    pieceTheme,
    active: phase === PHASE.GAME,
    musicManagerRef: musicRef,
    customKeyBindings: { KeyR: { action: 'rewind' } },
    onCustomAction: name => {
      if (name === 'rewind') s3.activateRewind()
    },
    onLevelComplete: handleLevelComplete,
    onGameOver: handleGameOver,
  })

  // ── Season 3 Mechanics Hook ────────────────────────────────────────────────
  const s3 = useS3Mechanics({
    level,
    engine: game.engine,
    state: game.state,
    linesThisLevel: game.linesThisLevel,
    isActive: phase === PHASE.GAME,
    zoneActive: game.state.zoneActive,
  })

  // ── Music Manager Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.GAME || !level || !epochId) return
    const initMusic = async () => {
      try {
        if (!musicRef.current) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext
          const audioCtx = new AudioContextClass()
          if (audioCtx.state === 'suspended') await audioCtx.resume()
          musicRef.current = new Season3MusicManager(audioCtx)
        }
        musicRef.current.setPlaylist(epochId)
        musicRef.current.setVolume(game.config.musicVolume ?? 1.0)
      } catch (e) {
        console.error('S3 music init failed:', e)
      }
    }
    initMusic()
    return () => {
      musicRef.current?.stop?.()
    }
  }, [phase, level, epochId, game.config.musicVolume])

  // Reset when level changes
  useEffect(() => {
    setPhase(PHASE.STORY)
  }, [epochId, levelId])

  const handleStartGame = () => {
    s3.resetMechanics()
    game.resetGame({ gravityMult: level?.gravityMult ?? 1.0 })
    setPhase(PHASE.GAME)
  }

  const handleRestartLevel = () => {
    if (game.paused) game.togglePause()
    handleStartGame()
  }

  const handleAdvanceLevel = () => {
    const nextLevel = getNextS3Level(epochId, levelId)
    if (nextLevel) {
      navigate(`/s3/${nextLevel.epochId}/${nextLevel.levelId}`, { state: { fromS3Complete: true } })
    } else {
      navigate('/s3', { state: { completed: true } })
    }
  }

  const handleBackToMap = () => {
    navigate('/s3')
  }

  // ── Loading & Unlock Guards ────────────────────────────────────────────────
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
        SYNCING TEMPORAL BUFFER…
      </div>
    )
  }

  if (!s3Unlocked || (!levelUnlocked && !bypassUnlock)) {
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
        <div>🔒 TIMELINE LOCKED</div>
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
          ← Season 3 Map
        </button>
      </div>
    )
  }

  // ── Pre-Level Story Briefing ───────────────────────────────────────────────
  if (phase === PHASE.STORY) {
    return (
      <StoryBriefingModal
        badge={`EPOCH ${epochId?.toUpperCase()} • ${epoch?.title || ''}`}
        title={level?.title}
        story={level?.storyBefore}
        targetLines={effectiveTarget}
        accentColor={epochColor}
        onStart={handleStartGame}
        onBack={handleBackToMap}
        backLabel="← EPOCH MAP"
      />
    )
  }

  // ── Victory Modal ──────────────────────────────────────────────────────────
  if (phase === PHASE.COMPLETE) {
    const nextLevel = getNextS3Level(epochId, levelId)
    return (
      <LevelResultModal
        type="complete"
        title="✓ CLEARED"
        subtitle={`EPOCH ${epochId?.toUpperCase()} › ${level?.title}`}
        message={level?.storyAfter}
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={epochColor}
        onPrimary={handleAdvanceLevel}
        primaryLabel={nextLevel ? 'NEXT TIMELINE →' : 'SEASON 3 COMPLETE ✦'}
        onSecondary={handleBackToMap}
        secondaryLabel="← SEASON 3 MAP"
        extraSlot={saving ? <div style={{ fontSize: '0.62rem', color: '#888' }}>Saving progress…</div> : null}
      />
    )
  }

  // ── Defeat Modal ───────────────────────────────────────────────────────────
  if (phase === PHASE.FAIL) {
    return (
      <LevelResultModal
        type="fail"
        title="TEMPORAL COLLAPSE"
        subtitle={level?.title}
        message="The timeline shattered under excessive entropy. Rewind and stabilize the sector."
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={epochColor}
        onPrimary={handleRestartLevel}
        primaryLabel="RETRY TIMELINE"
        onSecondary={handleBackToMap}
        secondaryLabel="← SEASON 3 MAP"
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
      accentColor={epochColor}
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
      abilityActive={s3.abilityActive}
      abilityLabel={s3.abilityLabel}
      hideNextCount={s3.hideQueue ? 99 : 0}
      hudTopSlot={
        s3.hasRewind && (
          <RewindGauge
            fill={s3.rewindGauge}
            ready={s3.rewindGauge >= 1}
            onActivate={s3.activateRewind}
          />
        )
      }
      overlaySlot={
        <>
          {/* Time Dilation Flash */}
          <AnimatePresence>
            {s3.dilationFlash && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    s3.dilationFlash === 'fast'
                      ? 'radial-gradient(circle, rgba(255,80,80,0.4) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(80,180,255,0.4) 0%, transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 15,
                }}
              />
            )}
          </AnimatePresence>

          {/* Floating Ability Toast */}
          <AnimatePresence>
            {s3.abilityToast && (
              <motion.div
                key={s3.toastId}
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
                  border: `1px solid ${epochColor}cc`,
                  borderRadius: 8,
                  padding: '6px 16px',
                  fontSize: '0.72rem',
                  color: epochColor,
                  letterSpacing: '0.2em',
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                  zIndex: 25,
                  pointerEvents: 'none',
                  boxShadow: `0 0 18px ${epochColor}55`,
                  fontFamily: 'monospace',
                }}
              >
                {s3.abilityToast}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      }
      pauseMenuSlot={
        <PauseMenuModal
          isOpen={game.paused}
          subtitle={`EPOCH ${epochId?.toUpperCase()} › ${level?.title}`}
          statsText={`Lv ${game.state.level} · ${game.linesThisLevel} / ${effectiveTarget} lines`}
          accentColor={epochColor}
          onResume={game.togglePause}
          onRestart={handleRestartLevel}
          onExitMap={handleBackToMap}
          mapLabel="← SEASON 3 MAP"
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
