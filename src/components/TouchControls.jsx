// Left panel: movement (D-pad style) — hardDrop at top, then left/down/right
const LEFT_BTNS = [
  { key: 'hardDrop', label: '⤓',   hold: false, ariaLabel: 'Hard drop piece' },
  { key: 'left',     label: '◀',    hold: true,  ariaLabel: 'Move piece left' },
  { key: 'softDrop', label: '▼',    hold: true,  ariaLabel: 'Soft drop piece' },
  { key: 'right',    label: '▶',    hold: true,  ariaLabel: 'Move piece right' },
]

// Right panel: rotation + hold
const RIGHT_BTNS = [
  { key: 'rotateCCW', label: '↺',    hold: false, ariaLabel: 'Rotate counter-clockwise' },
  { key: 'rotateCW',  label: '↻',    hold: false, ariaLabel: 'Rotate clockwise' },
  { key: 'rotate180', label: '↕',    hold: false, ariaLabel: 'Rotate 180 degrees' },
  { key: 'hold',      label: 'HOLD', hold: false, ariaLabel: 'Hold piece' },
]

function ControlBtn({ btn, onPress, onRelease }) {
  return (
    <button
      type="button"
      className="control-button"
      aria-label={btn.ariaLabel}
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
        onPress(btn.key, btn.hold)
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        e.stopPropagation()
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
        onRelease(btn.key, btn.hold)
      }}
      onPointerCancel={(e) => {
        e.preventDefault()
        e.stopPropagation()
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
        onRelease(btn.key, btn.hold)
      }}
      onPointerLeave={() => {
        if (btn.hold) onRelease(btn.key, btn.hold)
      }}
    >
      {btn.label}
    </button>
  )
}

export default function TouchControls({ onPress, onRelease }) {
  return (
    <div
      className="touch-controls"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="touch-left">
        {LEFT_BTNS.map(btn => (
          <ControlBtn key={btn.key} btn={btn} onPress={onPress} onRelease={onRelease} />
        ))}
      </div>
      <div className="touch-right">
        {RIGHT_BTNS.map(btn => (
          <ControlBtn key={btn.key} btn={btn} onPress={onPress} onRelease={onRelease} />
        ))}
      </div>
    </div>
  )
}
