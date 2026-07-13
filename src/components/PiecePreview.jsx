import TetrominoMini from './TetrominoMini'

const PREV_CELL = 10
const PREV_COLS = 4
const PREV_ROWS = 2

export default function PiecePreview({ type, small = false }) {
  const cell = small ? 8 : PREV_CELL
  return (
    <div className="preview-box" style={small ? { height: '1.8rem' } : undefined}>
      <TetrominoMini type={type} size={cell} showEmpty className="preview-canvas" />
    </div>
  )
}
