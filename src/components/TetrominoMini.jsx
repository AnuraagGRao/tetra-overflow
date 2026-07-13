import { useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { PIECES } from '../logic/tetrominoes'
import { PIECE_COLOR_MAPS } from './GameCanvas'

export default function TetrominoMini({
  type,
  pieceTheme,
  size = 11,
  showEmpty = false,
  className,
  style,
}) {
  const canvasRef = useRef(null)
  const { theme } = useTheme()
  const resolvedTheme = pieceTheme || theme || 'classic'
  const piece = type ? PIECES[type] : null
  const color = piece ? PIECE_COLOR_MAPS[resolvedTheme]?.[type] ?? piece.color ?? '#888888' : '#333333'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!piece) return

    const filledRows = piece.matrix.filter(row => row.some(Boolean))
    if (!filledRows.length) return
    const firstColumn = Math.min(...filledRows.map(row => row.findIndex(Boolean)))
    const lastColumn = Math.max(...filledRows.map(row => row.length - 1 - [...row].reverse().findIndex(Boolean)))
    const pieceWidth = lastColumn - firstColumn + 1
    const canvasColumns = Math.round(canvas.width / size)
    const canvasRows = Math.round(canvas.height / size)
    const offsetX = Math.floor((canvasColumns - pieceWidth) / 2) * size
    const offsetY = Math.floor((canvasRows - filledRows.length) / 2) * size

    context.fillStyle = color
    context.shadowColor = color
    context.shadowBlur = 5
    filledRows.forEach((row, rowIndex) => {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        if (!row[column]) continue
        context.fillRect(
          offsetX + (column - firstColumn) * size + 1,
          offsetY + rowIndex * size + 1,
          size - 2,
          size - 2
        )
      }
    })
  }, [color, piece, size])

  if (!piece && showEmpty) return <span className="preview-empty">—</span>
  return <canvas ref={canvasRef} width={4 * size} height={2 * size} className={className} style={{ display: 'block', ...style }} />
}
