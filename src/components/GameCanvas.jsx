import { useEffect, useRef } from 'react'
import { BOARD_HEIGHT, BOARD_WIDTH, PIECES } from '../logic/tetrominoes'
import { ZONE_DURATION_MS } from '../logic/gameEngine'
import { useTheme } from '../contexts/ThemeContext'

const INFECTED_COLOR = PIECES.INF.color
const ZONE_COLOR     = PIECES.ZONE.color
const GBG_COLOR      = PIECES.GBG.color

const CELL_SIZE = 26

// ── Theme colour maps ────────────────────────────────────────────────────────
const DMG_MAP = {
  I:'#9bbc0f', O:'#8bac0f', T:'#306230', S:'#8bac0f', Z:'#306230',
  J:'#306230', L:'#8bac0f', INF:'#c8f820', ZONE:'#9bbc0f', GBG:'#306230',
}
const BLUEPRINT_MAP = {
  I:'#88DDFF', O:'#FFE888', T:'#CC99FF', S:'#88FFCC', Z:'#FFAAAA',
  J:'#AACCFF', L:'#FFCC88', INF:'#FF88BB', ZONE:'#AAFFFF', GBG:'#AAAAAA',
}
const SKETCH_MAP = {
  I:'#7ECFDF', O:'#E8D850', T:'#C08AE0', S:'#88CC80', Z:'#E08080',
  J:'#88A8E0', L:'#ECA860', INF:'#A888C8', ZONE:'#78D0E8', GBG:'#A4A4A4',
}
const BAUHAUS_MAP = {
  I:'#E81414', O:'#F0E010', T:'#1428E8', S:'#E05050', Z:'#181818',
  J:'#1440C0', L:'#E04818', INF:'#9900CC', ZONE:'#F0E010', GBG:'#888888',
}
const STONE_MAP = {
  I:'#B4B4B4', O:'#A4A4A4', T:'#888888', S:'#949494', Z:'#787878',
  J:'#6C6C6C', L:'#9C9C9C', INF:'#E05050', ZONE:'#CCCCCC', GBG:'#626262',
}
const WOOD_MAP = {
  I:'#C8A96E', O:'#DEB887', T:'#8B6914', S:'#A07840', Z:'#6B4226',
  J:'#5C3317', L:'#B87333', INF:'#4A2800', ZONE:'#DCC878', GBG:'#6A5240',
}
const PIECE_COLOR_MAPS = {
  dmg: DMG_MAP, blueprint: BLUEPRINT_MAP, sketch: SKETCH_MAP,
  bauhaus: BAUHAUS_MAP, stone: STONE_MAP, wood: WOOD_MAP,
}
const CANVAS_BG_DARK  = { dmg:'#0f380f', blueprint:'#001A44', sketch:'#2A2820', bauhaus:'#1A1A12', stone:'#1A1A1A', wood:'#0D2818' }
const CANVAS_BG_LIGHT = { classic:'#1e2230', dmg:'#1a4a0a', blueprint:'#0A2D6E', sketch:'#FAFAF0', bauhaus:'#F5F5E8', stone:'#BEBEBE', wood:'#1A4528' }
const THEME_GRID      = { dmg:'rgba(48,98,48,0.50)', blueprint:'rgba(255,255,255,0.08)', sketch:'rgba(100,80,40,0.12)', bauhaus:'rgba(0,0,0,0.12)', stone:'rgba(255,255,255,0.04)', wood:'rgba(0,0,0,0.12)' }

const adjustHex = (hex, amt) => {
  if (!hex || hex[0] !== '#') return hex
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + amt))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt))
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

const DRAG_START_PX     = 25    // min px before a swipe is committed
const TAP_MAX_PX        = 13   // max total movement for a tap
const HARD_DROP_VEL_PX_MS = 0.45 // px/ms threshold for hard-drop vs soft-drop

// drawCell is defined per-frame inside the useEffect as a theme-aware closure

export default function GameCanvas({ state, onTap, onTripleTap, onDragBegin, onDragEnd, onHardDrop }) {
  const { theme, colorMode } = useTheme()
  const canvasRef = useRef(null)
  const touchRef = useRef(null)
  const pulseRef = useRef(0)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)
  const TAP_TRIPLE_WINDOW_MS = 420

  // ── Touch constants ──────────────────────────────────────────────────────────
  // (DRAG_START_PX, TAP_MAX_PX, HARD_DROP_VEL_PX_MS defined at module level)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !state.current) return
    const ctx = canvas.getContext('2d')

    pulseRef.current += 0.05
    const ghostAlpha = 0.12 + 0.08 * Math.sin(pulseRef.current)

    // ── Theme helpers ───────────────────────────────────────────────────────
    const isCustomTheme = theme in PIECE_COLOR_MAPS
    const colorMap = PIECE_COLOR_MAPS[theme] ?? {}
    const isLightTheme = theme === 'bauhaus' || theme === 'sketch'

    const drawCell = (ctx, x, y, rawColor, alpha = 1, blur = 12, pieceKey = null) => {
      const color = (isCustomTheme && pieceKey) ? (colorMap[pieceKey] ?? rawColor) : rawColor
      ctx.save()
      ctx.globalAlpha = alpha
      switch (theme) {
        case 'dmg': {
          ctx.fillStyle = color
          ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)
          break
        }
        case 'blueprint': {
          // Cross-hatch fill clipped to cell
          ctx.save()
          ctx.beginPath(); ctx.rect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.clip()
          ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.5
          for (let i = -CELL_SIZE; i < CELL_SIZE * 2; i += 5) {
            ctx.beginPath(); ctx.moveTo(x + i, y + 1); ctx.lineTo(x + i + CELL_SIZE, y + CELL_SIZE - 1); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(x + i + CELL_SIZE, y + 1); ctx.lineTo(x + i, y + CELL_SIZE - 1); ctx.stroke()
          }
          ctx.restore()
          // Coloured border
          ctx.strokeStyle = color; ctx.lineWidth = 1.5
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          // Bolt circles at corners
          ctx.fillStyle = 'rgba(255,255,255,0.60)'
          ;[[x+3,y+3],[x+CELL_SIZE-3,y+3],[x+3,y+CELL_SIZE-3],[x+CELL_SIZE-3,y+CELL_SIZE-3]]
            .forEach(([bx,by]) => { ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI * 2); ctx.fill() })
          break
        }
        case 'sketch': {
          const p = 2; const x1 = x + p, y1 = y + p, w = CELL_SIZE - p*2, h = CELL_SIZE - p*2
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(x1 + 4, y1 + 1)
          ctx.quadraticCurveTo(x1 + w * 0.5, y1 - 1, x1 + w - 2, y1 + 2)
          ctx.quadraticCurveTo(x1 + w + 1, y1 + h * 0.4, x1 + w - 1, y1 + h - 2)
          ctx.quadraticCurveTo(x1 + w * 0.5, y1 + h + 1, x1 + 2, y1 + h - 1)
          ctx.quadraticCurveTo(x1 - 1, y1 + h * 0.6, x1 + 4, y1 + 1)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = 'rgba(60,40,10,0.55)'; ctx.lineWidth = 1.5; ctx.stroke()
          break
        }
        case 'bauhaus': {
          ctx.fillStyle = color
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          if (pieceKey === 'I') {
            ctx.fillStyle = 'rgba(0,0,0,0.22)'
            for (let sy = y + 4; sy < y + CELL_SIZE - 1; sy += 5) ctx.fillRect(x + 1, sy, CELL_SIZE - 2, 2)
          } else if (pieceKey === 'O') {
            ctx.fillStyle = 'rgba(0,0,0,0.28)'
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
              ctx.beginPath(); ctx.arc(x + 7 + dx * 10, y + 7 + dy * 10, 2, 0, Math.PI * 2); ctx.fill()
            }
          } else if (pieceKey === 'Z') {
            ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.clip()
            ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2
            for (let i = -CELL_SIZE; i < CELL_SIZE * 2; i += 5) {
              ctx.beginPath(); ctx.moveTo(x + i, y + 1); ctx.lineTo(x + i + CELL_SIZE, y + CELL_SIZE - 1); ctx.stroke()
            }
            ctx.restore()
          } else if (pieceKey === 'S') {
            for (let sx = x + 4; sx < x + CELL_SIZE - 1; sx += 5) {
              ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(sx, y + 1, 2, CELL_SIZE - 2)
            }
          }
          ctx.strokeStyle = '#000000'; ctx.lineWidth = 1
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          break
        }
        case 'stone': {
          const p = 1, cs = CELL_SIZE - 2, cr = 3
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(x+p+cr, y+p); ctx.lineTo(x+p+cs-cr, y+p); ctx.lineTo(x+p+cs, y+p+cr)
          ctx.lineTo(x+p+cs, y+p+cs-cr); ctx.lineTo(x+p+cs-cr, y+p+cs)
          ctx.lineTo(x+p+cr, y+p+cs); ctx.lineTo(x+p, y+p+cs-cr); ctx.lineTo(x+p, y+p+cr)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke()
          break
        }
        case 'wood': {
          const grad = ctx.createLinearGradient(x, y, x + CELL_SIZE * 0.7, y + CELL_SIZE)
          grad.addColorStop(0, adjustHex(color, 22)); grad.addColorStop(0.4, color)
          grad.addColorStop(0.75, color); grad.addColorStop(1, adjustHex(color, -35))
          ctx.fillStyle = grad; ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.strokeStyle = adjustHex(color, -50); ctx.lineWidth = 1.5
          ctx.strokeRect(x + 2.5, y + 2.5, CELL_SIZE - 5, CELL_SIZE - 5)
          break
        }
        default: {
          ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
        }
      }
      ctx.restore()
    }

    const drawGhost = (ctx, x, y, pieceType) => {
      const color = (isCustomTheme ? (colorMap[pieceType] ?? PIECES[pieceType].color) : PIECES[pieceType].color)
      ctx.save()
      switch (theme) {
        case 'dmg':
          ctx.globalAlpha = 0.22; ctx.fillStyle = '#306230'
          ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)
          break
        case 'blueprint':
          ctx.globalAlpha = 0.55; ctx.setLineDash([3, 3])
          ctx.strokeStyle = color; ctx.lineWidth = 1
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.setLineDash([])
          break
        case 'sketch':
          ctx.globalAlpha = 0.35; ctx.setLineDash([3, 2])
          ctx.strokeStyle = 'rgba(60,40,10,0.45)'; ctx.lineWidth = 1.2
          ctx.strokeRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6)
          ctx.setLineDash([])
          break
        case 'bauhaus':
          ctx.globalAlpha = 0.35; ctx.setLineDash([3, 3])
          ctx.strokeStyle = color; ctx.lineWidth = 1.5
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.setLineDash([])
          break
        case 'stone': {
          ctx.globalAlpha = 0.30; ctx.fillStyle = '#9A9A9A'
          const p = 1, cs = CELL_SIZE - 2, cr = 3
          ctx.beginPath()
          ctx.moveTo(x+p+cr, y+p); ctx.lineTo(x+p+cs-cr, y+p); ctx.lineTo(x+p+cs, y+p+cr)
          ctx.lineTo(x+p+cs, y+p+cs-cr); ctx.lineTo(x+p+cs-cr, y+p+cs)
          ctx.lineTo(x+p+cr, y+p+cs); ctx.lineTo(x+p, y+p+cs-cr); ctx.lineTo(x+p, y+p+cr)
          ctx.closePath(); ctx.fill()
          break
        }
        case 'wood':
          ctx.globalAlpha = 0.30; ctx.setLineDash([3, 3])
          ctx.strokeStyle = adjustHex(color, -30); ctx.lineWidth = 1
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.setLineDash([])
          break
        default:
          // Visible fill + bright outline for dark neon theme
          ctx.globalAlpha = 0.30
          ctx.fillStyle = color
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.globalAlpha = 0.72
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.shadowColor = color
          ctx.shadowBlur = 8
          ctx.strokeRect(x + 1.75, y + 1.75, CELL_SIZE - 3.5, CELL_SIZE - 3.5)
      }
      ctx.restore()
    }

    ctx.save()

    // Screen shake
    if (state.shake > 0.5) {
      const sx = (Math.random() - 0.5) * state.shake
      const sy = (Math.random() - 0.5) * state.shake * 0.5
      ctx.translate(sx, sy)
    }

    ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40)

    // Background — zone gradient (default) or flat theme colour
    const themeBg = (colorMode === 'light' ? CANVAS_BG_LIGHT : CANVAS_BG_DARK)[theme]
    if (state.zoneActive && !themeBg) {
      const progress = state.zoneTimer / ZONE_DURATION_MS
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      grad.addColorStop(0, `hsl(${200 + progress * 60}, 80%, 8%)`)
      grad.addColorStop(1, `hsl(${240 + progress * 40}, 90%, 5%)`)
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = themeBg ?? '#090b16'
    }
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40)

    // Grid lines
    ctx.strokeStyle = THEME_GRID[theme] ?? 'rgba(89, 105, 153, 0.2)'
    for (let x = 0; x <= BOARD_WIDTH; x += 1) {
      ctx.beginPath()
      ctx.moveTo(x * CELL_SIZE, 0)
      ctx.lineTo(x * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE)
      ctx.stroke()
    }
    for (let y = 0; y <= BOARD_HEIGHT; y += 1) {
      ctx.beginPath()
      ctx.moveTo(0, y * CELL_SIZE)
      ctx.lineTo(BOARD_WIDTH * CELL_SIZE, y * CELL_SIZE)
      ctx.stroke()
    }

    // Board cells
    state.board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (!cell) return
        if (cell === 'INF') {
          const infColor = (isCustomTheme && colorMap['INF']) ? colorMap['INF'] : INFECTED_COLOR
          const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 400 + x * 0.4 + y * 0.4)
          drawCell(ctx, x * CELL_SIZE, y * CELL_SIZE, infColor, pulse, 18, 'INF')
        } else if (cell === 'ZONE') {
          // Captured zone row — electric cyan glow, fully opaque
          const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200 + y * 0.5)
          drawCell(ctx, x * CELL_SIZE, y * CELL_SIZE, ZONE_COLOR, pulse, 22, 'ZONE')
        } else if (cell === 'GBG') {
          drawCell(ctx, x * CELL_SIZE, y * CELL_SIZE, GBG_COLOR, 0.85, 4, 'GBG')
        } else {
          drawCell(ctx, x * CELL_SIZE, y * CELL_SIZE, PIECES[cell].color, 1, 12, cell)
        }
      })
    })

    // Zone floor divider line (glowing separator above captured rows)
    if (state.zoneActive && state.zoneFloor > 0) {
      const divY = (BOARD_HEIGHT - state.zoneFloor) * CELL_SIZE
      ctx.save()
      ctx.strokeStyle = ZONE_COLOR
      ctx.lineWidth = 2
      ctx.shadowColor = ZONE_COLOR
      ctx.shadowBlur = 12
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(Date.now() / 150)
      ctx.beginPath()
      ctx.moveTo(0, divY)
      ctx.lineTo(BOARD_WIDTH * CELL_SIZE, divY)
      ctx.stroke()
      ctx.restore()
    }

    // Ghost piece
    state.current.matrix.forEach((row, py) => {
      row.forEach((cell, px) => {
        if (!cell) return
        const gx = (state.current.x + px) * CELL_SIZE
        const gy = (state.ghostY + py) * CELL_SIZE
        if (state.ghostY + py >= 0) drawGhost(ctx, gx, gy, state.current.type)
      })
    })

    // Active piece
    state.current.matrix.forEach((row, py) => {
      row.forEach((cell, px) => {
        if (!cell) return
        const x = state.current.x + px
        const y = state.current.y + py
        if (y >= 0) drawCell(ctx, x * CELL_SIZE, y * CELL_SIZE, PIECES[state.current.type].color, 1, 12, state.current.type)
      })
    })

    // Zone ambient glow overlay (default themes only)
    if (state.zoneActive && !isCustomTheme) {
      const hue = 200 + (1 - state.zoneTimer / ZONE_DURATION_MS) * 60
      ctx.save()
      ctx.globalAlpha = 0.06 + 0.04 * Math.sin(Date.now() / 180)
      const glow = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width,
      )
      glow.addColorStop(0, `hsl(${hue}, 100%, 70%)`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }

    // Particles
    state.particles.forEach((p) => {
      const maxTtl = p.maxTtl ?? 240
      const alpha = Math.max(0, p.ttl / maxTtl)
      const px = p.x * CELL_SIZE
      const py = p.y * CELL_SIZE
      const radius = ((p.size ?? 6) * alpha) / 2
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color ?? '#ffffff'
      if (!isCustomTheme) { ctx.shadowColor = p.color ?? '#ffffff'; ctx.shadowBlur = 10 }
      ctx.beginPath()
      ctx.arc(px, py, Math.max(0.5, radius), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })

    // Floating text labels (T-SPIN DOUBLE etc.)
    if (state.floatingTexts) {
      state.floatingTexts.forEach((ft) => {
        const alpha = Math.max(0, ft.ttl / ft.maxTtl)
        const fy = ft.y * CELL_SIZE
        ctx.save()
        ctx.globalAlpha = alpha
        if (ft.big) {
          // Large centred label for Tetris / T-Spin Double+ / B2B clears
          const scale = 0.7 + 0.3 * (ft.ttl / ft.maxTtl)   // pops in then fades
          ctx.font = `bold ${Math.round(18 * scale)}px monospace`
          const isTSpin  = ft.text.includes('T-SPIN') || ft.text.includes('ALL-SPIN')
          const isTetris = ft.text.includes('TETRIS')
          const isB2B    = ft.text.startsWith('B2B')
          if (isLightTheme) {
            ctx.fillStyle = isB2B ? '#8B6200' : isTetris ? '#006880' : isTSpin ? '#6030A0' : '#2A2A2A'
          } else {
            ctx.fillStyle  = isB2B ? '#ffd700' : isTetris ? '#00e5ff' : isTSpin ? '#cc88ff' : '#ffffff'
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 24
          }
          const tw = ctx.measureText(ft.text).width
          ctx.fillText(ft.text, (canvas.width - tw) / 2, Math.max(18, fy))
        } else {
          ctx.font = 'bold 13px monospace'
          if (isLightTheme) {
            ctx.fillStyle = '#2A2A2A'
          } else {
            ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#aa66ff'; ctx.shadowBlur = 18
          }
          const fx = ft.x * CELL_SIZE
          ctx.fillText(ft.text, Math.max(2, Math.min(fx, canvas.width - 130)), Math.max(12, fy))
        }
        ctx.restore()
      })
    }

    ctx.restore()
  }, [state, theme, colorMode])

  const handlePointerDown = (event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    touchRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      dir: null,
    }
  }

  const handlePointerMove = (event) => {
    const start = touchRef.current
    if (!start || start.dir !== null) return   // not tracking, or already committed
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (Math.max(absX, absY) < DRAG_START_PX) return
    const dir = absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
    start.dir = dir
    onDragBegin(dir)
  }

  const handlePointerUp = (event) => {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return

    if (start.dir === null) {
      // Finger barely moved — treat as tap
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX) {
        onTap()
        tapCountRef.current += 1
        clearTimeout(tapTimerRef.current)
        if (tapCountRef.current >= 3) {
          tapCountRef.current = 0
          onTripleTap?.()
        } else {
          tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, TAP_TRIPLE_WINDOW_MS)
        }
      }
      return
    }

    if (start.dir === 'down') {
      const elapsed = performance.now() - start.t
      const distY   = Math.abs(event.clientY - start.y)
      if (elapsed > 0 && distY / elapsed >= HARD_DROP_VEL_PX_MS) {
        onDragEnd('down')      // clear softDrop before hard drop (prevents sticky speed)
        onHardDrop()           // fast fling → hard drop
      } else {
        onDragEnd('down')      // slow drag released → stop soft-drop
      }
      return
    }

    if (start.dir === 'up') return   // up swipe: action was fired in onDragBegin, nothing to release

    onDragEnd(start.dir)   // left / right released
  }

  const handlePointerCancel = () => {
    const start = touchRef.current
    touchRef.current = null
    if (!start || start.dir === null || start.dir === 'up') return
    onDragEnd(start.dir)
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={BOARD_WIDTH * CELL_SIZE}
      height={BOARD_HEIGHT * CELL_SIZE}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role="img"
      aria-label="Tetris game board"
    />
  )
}
