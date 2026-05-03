import { useEffect, useRef } from 'react'
import { PIECES } from '../logic/tetrominoes'
import { PIECE_COLOR_MAPS } from './GameCanvas' // exported from GameCanvas

function MiniPiece({ type, pieceTheme, size = 12 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height)
    if (!type) return
    const piece = PIECES[type]; if (!piece) return
    const color = (PIECE_COLOR_MAPS[pieceTheme]?.[type]) ?? piece.color ?? '#888'
    const filled = piece.matrix.filter(r => r.some(Boolean))
    if (!filled.length) return
    const colMin = Math.min(...filled.map(r => r.findIndex(Boolean)))
    const colMax = Math.max(...filled.map(r => r.length-1 - [...r].reverse().findIndex(Boolean)))
    const tw = colMax - colMin + 1, th = filled.length
    const cols = Math.round(canvas.width / size), rows = Math.round(canvas.height / size)
    const ox = Math.floor((cols - tw) / 2) * size, oy = Math.floor((rows - th) / 2) * size
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 6
    filled.forEach((row, ry) => {
      for (let cx = colMin; cx <= colMax; cx++) if (row[cx]) {
        ctx.fillRect(ox + (cx - colMin) * size + 1, oy + ry * size + 1, size - 2, size - 2)
      }
    })
  }, [type, pieceTheme, size])
  return <canvas ref={canvasRef} width={size*4} height={size*3} style={{ display: 'block' }} />
}

export default function FocusHud({ state, pieceTheme = 'classic', side = 'right', style }) {
  const zonePct = state.zoneActive
    ? Math.max(0, 1 - (state.zoneTimer / Math.max(1, state.zoneDuration || 1)))
    : Math.min(1, (state.zoneMeter || 0) / 100)

  const col = side === 'left' ? { left: -10, right: 'auto' } : { right: -10, left: 'auto' }
  return (
    <div style={{
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      ...col, display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none', ...style,
    }}>
      {/* HOLD */}
      <div style={cardStyle}>
        <div style={labelStyle}>HOLD</div>
        <div style={{ padding: 6 }}>
          {state.hold ? <MiniPiece type={state.hold} pieceTheme={pieceTheme} size={12} /> : <div style={emptyBox}>—</div>}
        </div>
      </div>

      {/* NEXT */}
      <div style={cardStyle}>
        <div style={labelStyle}>NEXT</div>
        <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(state.queue || []).slice(0, 3).map((t, i) => (
            <MiniPiece key={i} type={t} pieceTheme={pieceTheme} size={10} />
          ))}
        </div>
      </div>

      {/* ZONE */}
      <div style={{ ...cardStyle, alignItems: 'center' }}>
        <div style={labelStyle}>ZONE</div>
        <div style={{
          width: 16, height: 120, borderRadius: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          position: 'relative', overflow: 'hidden', margin: 6,
        }}>
          <div style={{
            position: 'absolute', left: 0, bottom: 0, width: '100%',
            height: `${Math.round(zonePct * 100)}%`,
            background: state.zoneActive ? 'linear-gradient(180deg,#22d3ee,#3b82f6)' : 'linear-gradient(180deg,#34d399,#22d3ee)',
            boxShadow: '0 0 8px rgba(56,189,248,0.5) inset',
          }} />
        </div>
      </div>
    </div>
  )
}

const cardStyle = {
  pointerEvents: 'auto',
  background: 'rgba(0,0,0,0.70)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
}
const labelStyle = {
  fontSize: '0.58rem', letterSpacing: '0.14em', color: '#aaa',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  padding: '4px 8px', textAlign: 'center'
}
const emptyBox = {
  width: 48, height: 36, display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#444', fontSize: '0.8rem'
}