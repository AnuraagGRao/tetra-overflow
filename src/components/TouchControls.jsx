// Left panel: movement (D-pad style) — hardDrop at top, then left/down/right
const LEFT_BTNS = [
  { key: 'hardDrop', label: '⤓',   hold: false },
  { key: 'left',     label: '◀',    hold: true  },
  { key: 'softDrop', label: '▼',    hold: true  },
  { key: 'right',    label: '▶',    hold: true  },
]

// Right panel: rotation + hold
const RIGHT_BTNS = [
  { key: 'rotateCCW', label: '↺',    hold: false },
  { key: 'rotateCW',  label: '↻',    hold: false },
  { key: 'rotate180', label: '↕',    hold: false },
  { key: 'hold',      label: 'HOLD', hold: false },
]

function ControlBtn({ btn, onPress, onRelease }) {
  return (
    <button
      type="button"
      className="control-button"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        onPress(btn.key, btn.hold)
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        onRelease(btn.key, btn.hold)
      }}
      onPointerCancel={(e) => {
        e.preventDefault()
        onRelease(btn.key, btn.hold)
      }}
    >
      {btn.label}
    </button>
  )
}

export default function TouchControls({ onPress, onRelease }) {
  return (
    <div className="touch-controls">
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
