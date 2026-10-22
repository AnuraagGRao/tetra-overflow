// ─── Season 6: The Zenith Protocol (Tower Climb Gameplay) ────────────────────
// Built on modular GameShell, useTetrisGame hook, and Season6MusicManager.

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { saveStoryProgress } from '../firebase/db'
import { TetrisEngine, GAME_MODE } from '../logic/gameEngine'
import { Season6MusicManager } from '../audio/season6MusicManager'
import { getStrataForFloor, saveTowerRecord, loadTowerRecord } from '../logic/storyData_s6'
import { useTetrisGame } from '../hooks/useTetrisGame'
import {
  GameShell,
  PauseMenuModal,
  SettingsModal,
  LevelResultModal,
} from '../components/game'

export default function Season6ClimbPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // High score record
  const [personalBest, setPersonalBest] = useState(() => loadTowerRecord())
  const [showSettings, setShowSettings] = useState(false)
  const [floorBanner, setFloorBanner] = useState(null)
  const prevFloorRef = useRef(1)

  // Dedicated Music Manager for Season 6
  const musicManagerRef = useRef(null)
  if (!musicManagerRef.current && typeof window !== 'undefined') {
    musicManagerRef.current = new Season6MusicManager()
  }

  // Pre-configured TetrisEngine instance for tower climb
  const existingEngine = useMemo(() => {
    const eng = new TetrisEngine()
    eng.reset(GAME_MODE.ULTIMATE)
    return eng
  }, [])

  // Hook into headless Tetris game pipeline
  const game = useTetrisGame({
    targetLines: 0, // Infinite climb
    pieceTheme: 'neon',
    active: true,
    existingEngine,
    musicManagerRef,
    onLevelComplete: () => {},
    onGameOver: (summary) => {
      const finalFloor = summary.floor || existingEngine.towerFloor || 1
      const saved = saveTowerRecord({
        floor: finalFloor,
        score: summary.score || 0,
        lines: summary.lines || 0,
      })
      if (saved) setPersonalBest(saved)

      if (user?.uid) {
        saveStoryProgress(user.uid, {
          s6_highest_floor: finalFloor,
          s6_best_score: summary.score || 0,
          s6_completed: finalFloor >= 10,
        }).catch(() => {})
      }
    },
  })

  const currentFloor = Math.max(1, game.state?.towerFloor || 1)
  const strata = useMemo(() => getStrataForFloor(currentFloor), [currentFloor])

  // Track floor advancements and cross-fade music
  useEffect(() => {
    if (currentFloor > prevFloorRef.current) {
      const oldStrata = getStrataForFloor(prevFloorRef.current)
      prevFloorRef.current = currentFloor

      // Trigger floor milestone banner
      setFloorBanner({
        floor: currentFloor,
        strataName: strata.name,
        color: strata.color,
        isNewStrata: oldStrata.tier !== strata.tier,
      })

      const timer = setTimeout(() => setFloorBanner(null), 2400)

      // Cross-fade to next floor's soundtrack
      try {
        musicManagerRef.current?.playForFloor(currentFloor)
      } catch {}

      return () => clearTimeout(timer)
    }
  }, [currentFloor, strata])

  // Start music on mount
  useEffect(() => {
    try {
      musicManagerRef.current?.playForFloor(1)
    } catch {}

    return () => {
      try {
        musicManagerRef.current?.stop()
      } catch {}
    }
  }, [])

  const handleRestart = useCallback(() => {
    prevFloorRef.current = 1
    setFloorBanner(null)
    game.resetGame({ mode: GAME_MODE.ULTIMATE })
    try {
      musicManagerRef.current?.playForFloor(1)
    } catch {}
  }, [game])

  const handleQuit = useCallback(() => {
    try {
      musicManagerRef.current?.stop()
    } catch {}
    navigate('/s6')
  }, [navigate])

  const linesCurrent = game.state?.towerFloorLines || 0
  const linesTarget = game.state?.towerFloorTarget || 5
  const progressPct = Math.min(100, Math.round((linesCurrent / Math.max(1, linesTarget)) * 100))

  return (
    <>
      <GameShell
        state={game.state}
        linesThisLevel={linesCurrent}
        targetLines={linesTarget}
        levelTitle={`ZENITH TOWER · F${String(currentFloor).padStart(2, '0')}`}
        accentColor={strata.color}
        bgType={strata.bgType}
        pieceTheme={strata.pieceTheme}
        gameMode="ultimate"
        isLandscape={game.isLandscape}
        hudSizing={game.hudSizing}
        zoom={game.zoom}
        setZoom={game.setZoom}
        focus={game.focus}
        setFocus={game.setFocus}
        config={game.config}
        setConfig={game.setConfig}
        triggerAction={game.triggerAction}
        handlePress={game.handlePress}
        handleRelease={game.handleRelease}
        handleHardDrop={game.handleHardDrop}
        togglePause={game.togglePause}
        onOpenSettings={() => setShowSettings(true)}
        hudTopSlot={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: '"Courier New", monospace',
          }}>
            {/* Strata Name Badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,0,0,0.6)',
              border: `1px solid ${strata.color}66`,
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.62rem',
              color: strata.color,
              fontWeight: 700,
              letterSpacing: '0.12em',
            }}>
              <span>{strata.badge}</span>
              <span style={{ color: '#fff' }}>{strata.name}</span>
            </span>

            {/* Floor Lines Progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 70 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.52rem', color: '#94a3b8' }}>
                <span>FLOOR PROGRESS</span>
                <span>{linesCurrent}/{linesTarget}</span>
              </div>
              <div style={{
                height: 4,
                width: '100%',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: strata.color,
                  transition: 'width 0.2s ease',
                  boxShadow: `0 0 8px ${strata.color}`,
                }} />
              </div>
            </div>
          </div>
        }
        overlaySlot={
          <AnimatePresence>
            {floorBanner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.05, y: -10 }}
                style={{
                  position: 'absolute',
                  top: '25%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 80,
                  pointerEvents: 'none',
                  background: 'rgba(2, 6, 23, 0.92)',
                  border: `2px solid ${floorBanner.color}`,
                  borderRadius: 12,
                  padding: '16px 32px',
                  textAlign: 'center',
                  boxShadow: `0 0 40px ${floorBanner.color}66, 0 20px 60px rgba(0,0,0,0.8)`,
                  backdropFilter: 'blur(12px)',
                  fontFamily: '"Courier New", monospace',
                }}
              >
                <div style={{ fontSize: '0.62rem', color: floorBanner.color, letterSpacing: '0.3em', fontWeight: 900 }}>
                  {floorBanner.isNewStrata ? 'ATMOSPHERIC STRATA BREACH' : 'FLOOR ASCENSION'}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', letterSpacing: '0.08em', marginTop: 4 }}>
                  FLOOR {floorBanner.floor}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', letterSpacing: '0.15em', marginTop: 2 }}>
                  {floorBanner.strataName}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        }
        pauseMenuSlot={
          <PauseMenuModal
            open={game.state?.paused}
            onResume={game.togglePause}
            onRestart={handleRestart}
            onQuit={handleQuit}
            onOpenSettings={() => setShowSettings(true)}
            levelTitle={`FLOOR ${currentFloor} · ${strata.name}`}
            accentColor={strata.color}
          />
        }
        settingsModalSlot={
          <SettingsModal
            open={showSettings}
            onClose={() => setShowSettings(false)}
            config={game.config}
            onConfig={game.setConfig}
          />
        }
      >
        {/* Game Over Modal */}
        <LevelResultModal
          phase={game.state?.gameOver ? 'fail' : null}
          accentColor={strata.color}
          title={`ZENITH ASCENT TERMINATED`}
          stats={{
            Score: (game.state?.score || 0).toLocaleString(),
            'Peak Floor': `Floor ${currentFloor}`,
            'Personal Best': `Floor ${personalBest.highestFloor || 1}`,
            'Lines Cleared': game.state?.lines || 0,
            Strata: strata.name,
          }}
          buttons={[
            { label: 'ASCEND AGAIN', onClick: handleRestart, primary: true },
            { label: 'RETURN TO MONOLITH', onClick: handleQuit },
          ]}
        />
      </GameShell>
    </>
  )
}
