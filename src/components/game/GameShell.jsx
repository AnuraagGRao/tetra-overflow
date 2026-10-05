import { motion } from 'framer-motion'
import BackgroundCanvas from '../BackgroundCanvas'
import LandscapeGameLayout from '../LandscapeGameLayout'
import GameCanvas from '../GameCanvas'
import ZoomControl from '../ZoomControl'
import TetrominoMini from '../TetrominoMini'
import SynesthesiaMotionLayer from '../SynesthesiaMotionLayer'
import FocusMiniHud from '../FocusMiniHud'
import TouchControls from '../TouchControls'
import { ZONE_MIN_METER, ZONE_DURATION_MS } from '../../logic/gameEngine'

export default function GameShell({
  // Game state & engine
  state = {},
  linesThisLevel = 0,
  targetLines = 0,
  level = null,
  levelTitle = '',
  accentColor = '#00d4ff',
  bgType = 'classic',
  pieceTheme = 'classic',
  gameMode = 'story',

  // Controls & sizing
  isLandscape = false,
  hudSizing = {},
  zoom = 1,
  setZoom = () => {},
  focus = false,
  setFocus = () => {},
  config = {},

  // Inputs
  triggerAction = () => {},
  handlePress = () => {},
  handleRelease = () => {},
  handleHardDrop = () => {},
  togglePause = () => {},

  // Boss & mechanics slots
  abilityActive = false,
  abilityLabel = '',
  bossHpPct = 100,
  hideNextCount = 0,
  holdDisabled = false,
  onOpenSettings,

  // Custom slots
  hudTopSlot = null,
  overlaySlot = null,
  pauseMenuSlot = null,
  settingsModalSlot = null,
  children = null,
}) {
  const effectiveTitle = levelTitle || level?.title || 'TETRIS'
  const effectiveTarget = targetLines || level?.targetLines || 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100dvh',
        background: '#000',
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background Canvas */}
      <BackgroundCanvas bgType={bgType} />

      {/* Landscape Zoom Control */}
      {isLandscape && <ZoomControl zoom={zoom} onChange={setZoom} />}

      {/* Portrait Top Story Header */}
      {!focus && !isLandscape && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: hudSizing.hudPadding || '0.4rem 0.8rem',
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            fontSize: '0.85rem',
            letterSpacing: '0.1em',
            flexShrink: 0,
            backdropFilter: 'blur(8px)',
            gap: 8,
            flexWrap: 'nowrap',
            minHeight: hudSizing.hudMinHeight || 38,
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              fontSize: hudSizing.statsLabel || '0.78rem',
              color: accentColor,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}
          >
            {effectiveTitle}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {hudTopSlot}

            <button
              type="button"
              onClick={() => triggerAction('activateZone')}
              disabled={state.zoneMeter < ZONE_MIN_METER || state.zoneActive}
              style={{
                background: state.zoneActive
                  ? 'rgba(0,229,255,0.18)'
                  : state.zoneMeter >= ZONE_MIN_METER
                  ? 'rgba(0,229,255,0.12)'
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${
                  state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#22d3ee' : 'rgba(255,255,255,0.1)'
                }`,
                color: state.zoneActive ? '#00e5ff' : state.zoneMeter >= ZONE_MIN_METER ? '#80eaff' : '#555',
                cursor: state.zoneMeter >= ZONE_MIN_METER && !state.zoneActive ? 'pointer' : 'default',
                fontSize: '0.6rem',
                padding: '2px 7px',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontWeight: 700,
              }}
            >
              {state.zoneActive ? `ZONE ${Math.ceil(state.zoneTimer / 1000)}s` : 'ZONE'}
            </button>

            {effectiveTarget > 0 && (
              <span style={{ color: '#666', fontSize: '0.62rem', fontFamily: 'monospace' }}>
                {Math.min(linesThisLevel, effectiveTarget)}/{effectiveTarget}
              </span>
            )}

            <button
              type="button"
              onClick={togglePause}
              aria-label="Pause"
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '0.62rem',
                padding: '3px 8px',
                borderRadius: 4,
                fontFamily: 'inherit',
              }}
            >
              ⏸
            </button>
          </div>
        </div>
      )}

      {/* Target Progress Bar */}
      {!isLandscape && effectiveTarget > 0 && (() => {
        const progressPct = Math.max(0, Math.min(100, (linesThisLevel / effectiveTarget) * 100))
        return (
          <div
            style={{
              height: 4,
              background: 'rgba(255,255,255,0.06)',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
              zIndex: 9,
            }}
          >
            {[25, 50, 75].map(pct => (
              <div
                key={pct}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${pct}%`,
                  width: 1,
                  background: 'rgba(0,0,0,0.4)',
                  zIndex: 2,
                }}
              />
            ))}
            <motion.div
              style={{
                position: 'absolute',
                inset: '0 auto 0 0',
                background: accentColor,
                boxShadow: `0 0 6px ${accentColor}88`,
              }}
              animate={{ width: `${progressPct}%`, background: accentColor }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
        )
      })()}

      {/* Portrait HUD Bar (Hold, Stats, Next Queue) */}
      {!focus && !isLandscape && (
        <div
          style={{
            position: 'relative',
            zIndex: 8,
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            borderBottom: `1px solid ${accentColor}33`,
            width: '100%',
            flexShrink: 0,
            overflow: 'hidden',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          {/* Hold Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.3rem 0.45rem',
              borderRight: `1px solid ${accentColor}33`,
              gap: '0.1rem',
              minWidth: 58,
              opacity: holdDisabled ? 0.35 : 1,
            }}
          >
            <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>
              Hold
            </div>
            <TetrominoMini type={holdDisabled ? null : state.hold} pieceTheme={pieceTheme} size={10} />
          </div>

          {/* Stats Bar */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.3rem 0.5rem', gap: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>
                Lv
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                {state.level ?? 1}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>
                Lines
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                {linesThisLevel}
                {effectiveTarget > 0 ? `/${effectiveTarget}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', lineHeight: 1 }}>
                Score
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#00d4ff', lineHeight: 1.1 }}>
                {(state.score ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Next Queue Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.3rem 0.45rem',
              borderLeft: `1px solid ${accentColor}33`,
              gap: '0.15rem',
              minWidth: 58,
            }}
          >
            <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>
              Next
            </div>
            {hideNextCount > 0 ? (
              <div style={{ color: accentColor, fontSize: '0.9rem', fontWeight: 900, height: 42, display: 'flex', alignItems: 'center' }}>
                ?
              </div>
            ) : (
              (state.queue || []).slice(0, 3).map((t, i) => (
                <TetrominoMini key={i} type={t} pieceTheme={pieceTheme} size={7} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Zone Meter Bar */}
      {!focus && !isLandscape && (
        <div style={{ height: 4, width: '100%', background: 'rgba(20, 30, 70, 0.8)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.max(
                0,
                Math.min(
                  100,
                  state.zoneActive
                    ? (state.zoneTimer / Math.max(1, state.zoneDuration || ZONE_DURATION_MS)) * 100
                    : state.zoneMeter || 0
                )
              )}%`,
              background: state.zoneActive
                ? 'linear-gradient(90deg, #8844ff, #00cfff)'
                : state.zoneMeter >= ZONE_MIN_METER
                ? 'linear-gradient(90deg, #00cfff, #fff)'
                : 'linear-gradient(90deg, #1e90ff, #00cfff)',
              transition: 'width 0.15s',
            }}
          />
        </div>
      )}

      {/* ── Landscape Layout ────────────────────────────────────────────── */}
      {isLandscape && (
        <LandscapeGameLayout
          isLandscape={isLandscape}
          gameMode={gameMode}
          state={state}
          paused={false}
          hudSizing={hudSizing}
          zoom={zoom}
          zoneActive={state.zoneActive}
          zoneMeter={state.zoneMeter}
          zoneTimerMs={state.zoneTimer}
          onActivateZone={() => triggerAction('activateZone')}
          currentLevel={level}
          targetLines={effectiveTarget}
          linesThisLevel={linesThisLevel}
          abilityActive={abilityActive}
          abilityLabel={abilityLabel}
          bossHpPct={bossHpPct}
          epochColor={accentColor}
          onPause={togglePause}
          onZoom={() => {}}
          onSettings={() => onOpenSettings?.()}
        >
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GameCanvas
                state={state}
                onTap={() => triggerAction('rotateCW')}
                onTwoFingerTap={() => triggerAction('activateZone')}
                onDragBegin={direction => {
                  if (direction === 'up') triggerAction('hold')
                  else if (direction === 'left' || direction === 'right' || direction === 'down') {
                    handlePress(direction === 'down' ? 'softDrop' : direction, true)
                  }
                }}
                onDragEnd={direction => handleRelease(direction === 'down' ? 'softDrop' : direction, direction !== 'up')}
                onHardDrop={handleHardDrop}
                onZoomGesture={scale => setZoom(val => Math.max(0.5, Math.min(2, val * scale)))}
                themeOverride={pieceTheme}
                screenShakeMultiplier={config.screenShakeMultiplier ?? 1.0}
              />
            </div>
          </div>
        </LandscapeGameLayout>
      )}

      {/* ── Portrait Layout ─────────────────────────────────────────────── */}
      {!isLandscape && (
        <SynesthesiaMotionLayer
          className="mobile-canvas-wrap"
          style={{
            background: 'transparent',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            paddingBottom: focus && config.showOnScreenControls ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' : 0,
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GameCanvas
              state={state}
              onTap={() => triggerAction('rotateCW')}
              onTwoFingerTap={() => triggerAction('activateZone')}
              onDragBegin={direction => {
                if (direction === 'up') triggerAction('hold')
                else if (direction === 'left' || direction === 'right' || direction === 'down') {
                  handlePress(direction === 'down' ? 'softDrop' : direction, true)
                }
              }}
              onDragEnd={direction => handleRelease(direction === 'down' ? 'softDrop' : direction, direction !== 'up')}
              onHardDrop={handleHardDrop}
              onZoomGesture={scale => setZoom(val => Math.max(0.5, Math.min(2, val * scale)))}
              themeOverride={pieceTheme}
              screenShakeMultiplier={config.screenShakeMultiplier ?? 1.0}
            />
          </div>

          {/* Focus mode tab toggle */}
          <button
            type="button"
            onClick={() => setFocus(val => !val)}
            className="ui-toggle-tab"
            title={focus ? 'Exit Focus' : 'Enter Focus'}
            aria-label={focus ? 'Exit Focus' : 'Enter Focus'}
            style={{ right: 0 }}
          >
            {focus ? '▲' : '▼'}
          </button>

          {/* Focus mode mini HUD */}
          {focus && (
            <FocusMiniHud
              hold={holdDisabled ? null : state.hold}
              queue={state.queue}
              pieceTheme={pieceTheme}
              zoneMeter={state.zoneMeter}
              zoneActive={state.zoneActive}
              zoneTimer={state.zoneTimer}
              zoneDuration={state.zoneDuration}
              accentColor={accentColor}
              queueHidden={hideNextCount > 0}
              header={
                effectiveTarget > 0 ? (
                  <div style={{ width: '100%', padding: '4px 5px 0', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.38rem', color: '#555', letterSpacing: '0.1em', marginBottom: 2, textAlign: 'center' }}>
                      PROGRESS
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(0, Math.min(100, (linesThisLevel / effectiveTarget) * 100))}%`,
                          background: accentColor,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {overlaySlot}
        </SynesthesiaMotionLayer>
      )}

      {/* Touch controls */}
      {config.showOnScreenControls && !focus && (
        <TouchControls onPress={handlePress} onRelease={handleRelease} />
      )}
      {config.showOnScreenControls && focus && !isLandscape && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, pointerEvents: 'auto' }}>
          <TouchControls onPress={handlePress} onRelease={handleRelease} />
        </div>
      )}

      {/* Custom overlays & modals */}
      {pauseMenuSlot}
      {settingsModalSlot}
      {children}
    </div>
  )
}
