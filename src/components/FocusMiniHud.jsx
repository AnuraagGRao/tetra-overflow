import { ZONE_DURATION_MS, ZONE_MIN_METER } from '../logic/gameEngine'
import TetrominoMini from './TetrominoMini'

export default function FocusMiniHud({
  hold,
  queue = [],
  pieceTheme,
  zoneMeter = 0,
  zoneActive = false,
  zoneTimer = 0,
  zoneDuration = ZONE_DURATION_MS,
  holdLabel = 'Hold',
  nextLabel = 'Next',
  holdDisabled = false,
  queueHidden = false,
  accentColor = '#00e5ff',
  header = null,
  footer = null,
  style,
}) {
  const zoneReady = zoneMeter >= ZONE_MIN_METER && !zoneActive
  const zoneFill = Math.max(0, Math.min(100, zoneActive
    ? (zoneTimer / Math.max(1, zoneDuration || ZONE_DURATION_MS)) * 100
    : zoneMeter))

  return (
    <div className="fullscreen-mini-hud" style={{ right: 0, ...style }}>
      {header}
      <div className="fmh-hold" style={{ opacity: holdDisabled ? 0.35 : 1 }}>
        <div className="fmh-label">{holdLabel}</div>
        <TetrominoMini type={holdDisabled ? null : hold} pieceTheme={pieceTheme} size={8} />
      </div>
      <div className="fmh-zone-wrap">
        <div
          className={`fmh-zone-bar${zoneActive ? ' zone-active' : ''}${zoneReady ? ' zone-ready' : ''}`}
          style={{ height: `${zoneFill}%`, '--focus-accent': accentColor }}
        />
      </div>
      <div className="fmh-next" style={{ opacity: queueHidden ? 0.35 : 1 }}>
        <div className="fmh-label">{nextLabel}</div>
        {!queueHidden && queue.slice(0, 3).map((type, index) => (
          <TetrominoMini key={`${type}-${index}`} type={type} pieceTheme={pieceTheme} size={7} />
        ))}
        {queueHidden && <div style={{ color: accentColor, fontSize: '0.8rem' }}>?</div>}
      </div>
      {footer}
    </div>
  )
}
