import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { PIECES } from '../logic/tetrominoes';
import { PIECE_COLOR_MAPS } from './GameCanvas';

const PREV_CELL = 10
const PREV_COLS = 4
const PREV_ROWS = 2

export default function PiecePreview({ type, small = false }) {
  const canvasRef = useRef(null)
  const { theme } = useTheme()
  const previewTheme = theme
  const cell = small ? 8 : PREV_CELL

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!type) return
    const { matrix } = PIECES[type]
    const color = (PIECE_COLOR_MAPS[previewTheme]?.[type]) ?? PIECES[type].color
    const filled = matrix.filter(r => r.some(Boolean))
    const colMin = Math.min(...filled.map(r => r.findIndex(Boolean)))
    const colMax = Math.max(...filled.map(r => r.length - 1 - [...r].reverse().findIndex(Boolean)))
    const tw = colMax - colMin + 1, th = filled.length
    const ox = Math.floor((PREV_COLS - tw) / 2) * cell
    const oy = Math.floor((PREV_ROWS - th) / 2) * cell
    filled.forEach((row, ry) => {
      for (let cx = colMin; cx <= colMax; cx++) {
        if (!row[cx]) continue
        ctx.save()
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8
        ctx.fillRect(ox + (cx - colMin) * cell + 1, oy + ry * cell + 1, cell - 2, cell - 2)
        ctx.restore()
      }
    })
  }, [type, cell, previewTheme])

  const w = PREV_COLS * cell, h = PREV_ROWS * cell
  return (
    <div className="preview-box" style={small ? { height: '1.8rem' } : undefined}>
      {type
        ? <canvas ref={canvasRef} width={w} height={h} className="preview-canvas" />
        : <span className="preview-empty">—</span>}
    </div>
  )
}
