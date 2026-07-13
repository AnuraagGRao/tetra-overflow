/**
 * LandscapeGameLayout - Modular three-column widescreen layout
 * 
 * Structure:
 * [LEFT PANEL] | [CENTER CANVAS] | [RIGHT PANEL]
 * 
 * This component provides a responsive, scalable layout that works across
 * all game modes (Solo, Story, Versus) while maintaining proper controller
 * focus routing and touch bounding boxes.
 */

import { AnimatePresence } from 'framer-motion'
import LandscapeLeftPanel from './LandscapeLeftPanel'
import LandscapeRightPanel from './LandscapeRightPanel'

export default function LandscapeGameLayout({
  // Layout configuration
  isLandscape = false,
  gameMode = 'solo', // 'solo', 'story', 'versus'
  
  // Game state
  state = {},
  
  // HUD sizing
  hudSizing = {},
  zoom = 1.0,
  
  // Zone meter
  zoneActive = false,
  zoneMeter = 0,
  zoneTimerMs = 0,
  onActivateZone = () => {},
  
  // Story/Boss mode
  currentLevel = null,
  targetLines = 0,
  linesThisLevel = 0,
  abilityActive = false,
  abilityLabel = '',
  bossHpPct = 100, // 0-100 for boss health
  epochColor = '#ff0000',
  
  // Versus mode
  opponentName = '',
  opponentLines = 0,
  garbageIncoming = 0,
  
  // Callbacks
  onPause = () => {},
  onZoom = () => {},
  onSettings = () => {},
  
  // Render children
  children, // The GameCanvas element goes here
}) {
  if (!isLandscape) {
    // Portrait mode: delegate to children (existing layout)
    return children
  }

  const panelWidthVw = 'clamp(90px, 12vw, 140px)'
  const contentGap = 'clamp(8px, 1.5vw, 16px)'

  return (
    <div
      style={{
        display: 'grid',
        position: 'relative',
        zIndex: 1,
        gridTemplateColumns: `${panelWidthVw} 1fr ${panelWidthVw}`,
        gridTemplateRows: '1fr',
        gap: contentGap,
        padding: contentGap,
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        background: 'rgba(0,0,0,0.15)',
        overflow: 'visible',
        boxSizing: 'border-box',
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL: Score, Level, Lines, Hold, Zone Meter */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <LandscapeLeftPanel
        hudSizing={hudSizing}
        state={state}
        epochColor={epochColor}
        zoneActive={zoneActive}
        zoneMeter={zoneMeter}
        zoneTimerMs={zoneTimerMs}
        onActivateZone={onActivateZone}
        currentLevel={currentLevel}
        targetLines={targetLines}
        linesThisLevel={linesThisLevel}
        abilityActive={abilityActive}
        abilityLabel={abilityLabel}
        gameMode={gameMode}
      />

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CENTER: Game Canvas — Maximize board size with proper aspect ratio */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          overflow: 'visible',
          width: '100%',
          height: '100%',
        }}
      >
        {children}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL: Next Queue, Mode Info, Boss HP */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <LandscapeRightPanel
        hudSizing={hudSizing}
        state={state}
        epochColor={epochColor}
        currentLevel={currentLevel}
        targetLines={targetLines}
        linesThisLevel={linesThisLevel}
        bossHpPct={bossHpPct}
        gameMode={gameMode}
        opponentName={opponentName}
        opponentLines={opponentLines}
        garbageIncoming={garbageIncoming}
        onPause={onPause}
        onSettings={onSettings}
        onZoom={onZoom}
        zoom={zoom}
      />
    </div>
  )
}
