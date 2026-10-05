// ─── Season 2: Zodiac Boss Battles ─────────────────────────────────────────────
// Refactored with modular GameShell, useTetrisGame hook, and useBossAbility hook

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress, saveGameResult, markEasyModePlayed, setActiveBadge } from '../firebase/db'
import { findZodiacBoss, ZODIAC_BOSSES } from '../logic/storyData_s2'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import { Season2MusicManager } from '../audio/season2MusicManager'
import { useStoryProgress } from '../hooks/useStoryProgress'
import { useBossAbility } from '../hooks/useBossAbility'
import { useTetrisGame } from '../hooks/useTetrisGame'
import {
  GameShell,
  PauseMenuModal,
  SettingsModal,
  StoryBriefingModal,
  LevelResultModal,
} from '../components/game'

const PHASE = { STORY: 'story', LOADING: 'loading', GAME: 'game', COMPLETE: 'complete', FAIL: 'fail' }

export default function ZodiacLevelPage() {
  const { bossId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const boss = useMemo(() => findZodiacBoss(bossId), [bossId])
  const pieceTheme = useMemo(() => BG_TYPE_TO_PIECE_THEME[boss?.bgType] || 'classic', [boss?.bgType])

  useStoryProgress(user?.uid)
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

  const effectiveTargetLines = useMemo(() => {
    const tl = boss?.targetLines || 20
    if (!easyMode) return tl
    const easyOverride = boss?.easyTargetLines
    return typeof easyOverride === 'number' ? easyOverride : Math.round(tl * 0.75)
  }, [boss, easyMode])

  const nextBossId = useMemo(() => {
    const idx = ZODIAC_BOSSES.findIndex(b => b.id === bossId)
    return idx >= 0 && idx < ZODIAC_BOSSES.length - 1 ? ZODIAC_BOSSES[idx + 1].id : null
  }, [bossId])

  // ── Completion & Defeat Callbacks ──────────────────────────────────────────
  const handleLevelComplete = useCallback(
    stats => {
      if (user && easyMode) {
        markEasyModePlayed(user.uid).catch(() => {})
        setActiveBadge(user.uid, 'badge_noob').catch(() => {})
      }
      if (user && boss) {
        setSaving(true)
        const score = stats.score || 0
        const lines = stats.linesThisLevel || 0
        Promise.all([
          saveStoryProgress(user.uid, 's2_zodiac', bossId, score, lines),
          saveGameResult(user.uid, 'zodiac', score, {
            lines,
            level: boss.gravityMult ? Math.round(boss.gravityMult * 5 + 1) : 1,
            bossId,
            tSpins: stats.tSpins || 0,
            piecesPlaced: stats.piecesPlaced || 0,
          }),
        ]).finally(() => setSaving(false))
      }
      setPhase(PHASE.COMPLETE)
    },
    [user, boss, bossId, easyMode]
  )

  const handleGameOver = useCallback(() => {
    setPhase(PHASE.FAIL)
  }, [])

  // ── Headless Tetris Game Hook ──────────────────────────────────────────────
  const game = useTetrisGame({
    targetLines: effectiveTargetLines,
    pieceTheme,
    active: phase === PHASE.GAME,
    musicManagerRef: musicRef,
    onLevelComplete: handleLevelComplete,
    onGameOver: handleGameOver,
  })

  // ── Boss Ability Hook (Decoupled & Legal Top-Level Hook) ───────────────────
  const bossAbility = useBossAbility({
    bossId,
    engine: game.engine,
    state: game.state,
    linesThisLevel: game.linesThisLevel,
    isActive: phase === PHASE.GAME,
  })

  // ── Music Lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === PHASE.LOADING || phase === PHASE.GAME) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass && !musicRef.current) {
        musicRef.current = new Season2MusicManager(new AudioContextClass())
      }
      musicRef.current?.playForBoss?.(bossId)
      musicRef.current?.setVolume?.(game.config.musicVolume ?? 1.0)
    } else if (phase === PHASE.FAIL || phase === PHASE.COMPLETE) {
      musicRef.current?.stop?.()
    }
  }, [phase, bossId, game.config.musicVolume])

  useEffect(() => () => musicRef.current?.stop?.(), [])

  // Reset when bossId changes
  useEffect(() => {
    setPhase(PHASE.STORY)
  }, [bossId])

  const startFight = useCallback(() => {
    const gm = boss?.gravityMult ?? 1.0
    const gravFactor = easyMode ? 0.6 : 1.0
    game.resetGame({ gravityMult: gm * gravFactor })
    setPhase(PHASE.GAME)
  }, [boss, easyMode, game])

  const restartFight = useCallback(() => {
    if (game.paused) game.togglePause()
    startFight()
  }, [game, startFight])

  if (!boss) {
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
        <div>BOSS NOT FOUND</div>
        <button
          type="button"
          onClick={() => navigate('/s2')}
          style={{ padding: '8px 16px', background: '#222', border: '1px solid #555', color: '#ccc', cursor: 'pointer' }}
        >
          ← ZODIAC MAP
        </button>
      </div>
    )
  }

  const bossHpPct = Math.max(0, 100 - Math.min(100, (game.linesThisLevel / effectiveTargetLines) * 100))

  // ── Pre-Battle Briefing ────────────────────────────────────────────────────
  if (phase === PHASE.STORY) {
    return (
      <StoryBriefingModal
        badge={`TRIAL ${boss.sign?.toUpperCase()} • ${boss.element?.toUpperCase()}`}
        title={`${boss.glyph} ${boss.name.toUpperCase()} — ${boss.subtitle}`}
        story={boss.storyBefore}
        targetLines={effectiveTargetLines}
        accentColor={boss.color}
        onStart={startFight}
        startLabel="ENGAGE BOSS →"
        onBack={() => navigate('/s2')}
        backLabel="← ZODIAC MAP"
      />
    )
  }

  // ── Victory / Seal Broken Modal ────────────────────────────────────────────
  if (phase === PHASE.COMPLETE) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'radial-gradient(ellipse at 50% 40%, rgba(10,10,25,0.95) 0%, rgba(0,0,0,0.98) 75%)',
          fontFamily: 'monospace',
          color: '#fff',
          boxSizing: 'border-box',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            textAlign: 'center',
            maxWidth: 420,
            background: 'rgba(10,10,20,0.94)',
            border: `1px solid ${boss.color}`,
            borderRadius: 16,
            padding: '2rem',
            backdropFilter: 'blur(12px)',
            boxShadow: `0 0 32px ${boss.color}33`,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 8, filter: `drop-shadow(0 0 18px ${boss.color})` }}>
            {boss.glyph}
          </div>
          <div style={{ fontSize: '0.52rem', color: boss.color, letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 6 }}>
            Zodiac Seal Broken
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.14em', color: boss.color, marginBottom: '1rem' }}>
            {boss.name.toUpperCase()} DEFEATED
          </div>

          {/* Boss concession quote */}
          <div
            style={{
              background: `${boss.color}0d`,
              border: `1px solid ${boss.color}22`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: '1.2rem',
              textAlign: 'left',
            }}
          >
            <p style={{ color: '#bbb', fontSize: '0.78rem', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
              &ldquo;{boss.storyAfter}&rdquo;
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: '10px 16px',
              marginBottom: '1.2rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.5rem', color: '#777', letterSpacing: '0.12em' }}>SCORE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>
                {game.state.score.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.5rem', color: '#777', letterSpacing: '0.12em' }}>LINES</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: boss.color }}>
                {game.linesThisLevel}
              </div>
            </div>
          </div>

          {saving && <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '1rem' }}>Saving…</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={restartFight}
              style={{
                background: 'none',
                border: `1px solid ${boss.color}55`,
                color: boss.color,
                borderRadius: 8,
                padding: '9px 18px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                fontFamily: 'inherit',
              }}
            >
              REMATCH
            </button>
            {nextBossId && (
              <button
                type="button"
                onClick={() => navigate(`/s2/${nextBossId}`, { replace: true })}
                style={{
                  background: 'linear-gradient(90deg,#22d3ee,#a855f7)',
                  border: 'none',
                  color: '#000',
                  borderRadius: 8,
                  padding: '9px 18px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  fontFamily: 'inherit',
                }}
              >
                NEXT BOSS →
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/s2', { replace: true })}
              style={{
                background: boss.color,
                border: 'none',
                color: '#000',
                borderRadius: 8,
                padding: '9px 18px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                fontFamily: 'inherit',
              }}
            >
              ZODIAC MAP
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Defeat Modal ───────────────────────────────────────────────────────────
  if (phase === PHASE.FAIL) {
    return (
      <LevelResultModal
        type="fail"
        title="DEFEATED"
        subtitle={`${boss.glyph} ${boss.name}`}
        message={`${boss.name} repels your challenge. Refocus your technique.`}
        stats={{ score: game.state.score, level: game.state.level, linesThisLevel: game.linesThisLevel }}
        accentColor={boss.color}
        onPrimary={restartFight}
        primaryLabel="RETRY BATTLE"
        onSecondary={() => navigate('/s2')}
        secondaryLabel="← ZODIAC MAP"
      />
    )
  }

  // ── Main Gameplay ──────────────────────────────────────────────────────────
  return (
    <GameShell
      state={game.state}
      linesThisLevel={game.linesThisLevel}
      targetLines={effectiveTargetLines}
      level={boss}
      levelTitle={`${boss.glyph} ${boss.name}`}
      accentColor={boss.color}
      bgType={boss.bgType || 'classic'}
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
      abilityActive={bossAbility.abilityActive}
      abilityLabel={bossAbility.abilityLabel}
      bossHpPct={bossHpPct}
      hideNextCount={bossAbility.hideNextCount}
      rotationLocked={bossAbility.rotationLocked}
      hudTopSlot={
        bossAbility.attackIndicator && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {bossAbility.attackIndicator.type === 'timer' ? (
              <span style={{ fontSize: '0.62rem', color: boss.color, fontWeight: 700, fontFamily: 'monospace' }}>
                {(bossAbility.attackIndicator.ms / 1000).toFixed(1)}s
              </span>
            ) : (
              <div style={{ width: 44, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(bossAbility.attackIndicator.fill * 100)}%`,
                    background: boss.color,
                  }}
                />
              </div>
            )}
          </div>
        )
      }
      overlaySlot={
        <>
          {/* Cancer Fog Overlay */}
          <AnimatePresence>
            {bossAbility.fogRows && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '28%',
                  background: 'linear-gradient(to top, rgba(0, 30, 80, 0.8), transparent)',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />
            )}
          </AnimatePresence>

          {/* Ophiuchus Constriction Overlay */}
          {bossAbility.constrictionCols > 0 && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${bossAbility.constrictionCols * 8.8}%`,
                  background: 'rgba(0,255,80,0.12)',
                  borderRight: '2px solid rgba(0,255,80,0.4)',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: `${bossAbility.constrictionCols * 8.8}%`,
                  background: 'rgba(0,255,80,0.12)',
                  borderLeft: '2px solid rgba(0,255,80,0.4)',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />
            </>
          )}

          {/* Floating Ability Toast */}
          <AnimatePresence>
            {bossAbility.abilityToast && (
              <motion.div
                key={bossAbility.toastId}
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
                ⚡ {bossAbility.abilityToast}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      }
      pauseMenuSlot={
        <PauseMenuModal
          isOpen={game.paused}
          subtitle={`${boss.glyph} ${boss.name} — ${boss.subtitle}`}
          statsText={`${game.linesThisLevel} / ${effectiveTargetLines} lines`}
          accentColor={boss.color}
          onResume={game.togglePause}
          onRestart={restartFight}
          onExitMap={() => navigate('/s2')}
          mapLabel="← ZODIAC MAP"
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
