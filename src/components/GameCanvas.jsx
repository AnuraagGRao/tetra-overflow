import { useEffect, useRef } from 'react'
import { BOARD_HEIGHT, BOARD_WIDTH, PIECES } from '../logic/tetrominoes'
import { ZONE_DURATION_MS } from '../logic/gameEngine'
import { useTheme } from '../contexts/ThemeContext'
import { BG_TYPE_TO_PIECE_THEME } from '../logic/themeMappings'
import catImageUrl from '../meme/oiia_cat_assets_by_awesomeconsoles7_djwlgwe-fullview.png'

const INFECTED_COLOR = PIECES.INF.color
const ZONE_COLOR     = PIECES.ZONE.color
const GBG_COLOR      = PIECES.GBG.color

const CELL_SIZE = 26
const BOARD_BASE_ALPHA = 0.82 // increased transparency so backgrounds/particles show through

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
export const PIECE_COLOR_MAPS = {
  dmg: DMG_MAP, blueprint: BLUEPRINT_MAP, sketch: SKETCH_MAP,
  bauhaus: BAUHAUS_MAP, stone: STONE_MAP, wood: WOOD_MAP,
  // ── Natural & Elemental ──────────────────────────────────────────────────
  obsidian:   { I:'#cc44ff',O:'#ff44cc',T:'#8844ff',S:'#44ffcc',Z:'#ff8844',J:'#4488ff',L:'#ff4466',INF:'#ff0055',ZONE:'#aa00ff',GBG:'#445566' },
  biolume:    { I:'#00ffee',O:'#88ff44',T:'#aa44ff',S:'#00ff99',Z:'#ff8844',J:'#4488ff',L:'#ff44aa',INF:'#ff2244',ZONE:'#00ffcc',GBG:'#224488' },
  frozen:     { I:'#aaddff',O:'#ddeeff',T:'#88aacc',S:'#ccddff',Z:'#99bbdd',J:'#7799bb',L:'#bbeeff',INF:'#ff6688',ZONE:'#ffffff',GBG:'#667788' },
  terracotta: { I:'#d46a38',O:'#e8a060',T:'#b85030',S:'#8b7355',Z:'#c87840',J:'#7a5c48',L:'#e08060',INF:'#aa1818',ZONE:'#d4b090',GBG:'#6a5040' },
  amber:      { I:'#f0a020',O:'#f8c840',T:'#d07820',S:'#c89040',Z:'#a86020',J:'#804010',L:'#e8b050',INF:'#c03010',ZONE:'#ffe080',GBG:'#806040' },
  // ── Art & Design ────────────────────────────────────────────────────────
  ukiyo:      { I:'#4060b8',O:'#e04018',T:'#b83040',S:'#208840',Z:'#e8a020',J:'#284880',L:'#c86010',INF:'#cc2020',ZONE:'#f0d080',GBG:'#888888' },
  vaporwave:  { I:'#ff88cc',O:'#88ddff',T:'#cc88ff',S:'#ffcc88',Z:'#88ffcc',J:'#aaaaff',L:'#ffaaaa',INF:'#ff4488',ZONE:'#ffffff',GBG:'#888888' },
  stained:    { I:'#0088ff',O:'#ffdd00',T:'#cc00cc',S:'#00cc44',Z:'#ff2200',J:'#0044cc',L:'#ff8800',INF:'#ff0000',ZONE:'#ffffff',GBG:'#888888' },
  popart:     { I:'#0066cc',O:'#ffcc00',T:'#cc0000',S:'#009933',Z:'#dd0000',J:'#003399',L:'#ff6600',INF:'#cc0000',ZONE:'#ffcc00',GBG:'#888888' },
  // ── Tech & Overflow ──────────────────────────────────────────────────────
  terminal:   { I:'#00ff41',O:'#00dd38',T:'#00bb30',S:'#00ff88',Z:'#00cc44',J:'#00aa22',L:'#00ee55',INF:'#ff4444',ZONE:'#ffffff',GBG:'#004410' },
  circuit:    { I:'#ffd700',O:'#ffaa00',T:'#ddaa00',S:'#aa8800',Z:'#ffcc44',J:'#886600',L:'#ffee88',INF:'#ff2222',ZONE:'#00ff88',GBG:'#224422' },
  lego:       { I:'#d01010',O:'#f8c400',T:'#0044aa',S:'#009940',Z:'#ff8c00',J:'#551a8b',L:'#e8a000',INF:'#cc0000',ZONE:'#ffcc00',GBG:'#888888' },
  copper:     { I:'#b87333',O:'#c8a020',T:'#a06020',S:'#d09040',Z:'#8b5a2b',J:'#704214',L:'#cc8844',INF:'#802020',ZONE:'#f0c840',GBG:'#604020' },
}
const CANVAS_BG_DARK  = {
  dmg:'#0f380f', blueprint:'#001A44', sketch:'#2A2820', bauhaus:'#1A1A12', stone:'#1A1A1A', wood:'#0D2818',
  obsidian:'#040006', biolume:'#010c16', frozen:'#060c14', terracotta:'#120800', amber:'#0c0800',
  ukiyo:'#08060e', vaporwave:'#140626', stained:'#080610', popart:'#fffae0',
  terminal:'#000000', circuit:'#0a1408', lego:'#f0f0f0', copper:'#0c0804',
}
const CANVAS_BG_LIGHT = {
  classic:'#1e2230', dmg:'#1a4a0a', blueprint:'#0A2D6E', sketch:'#FAFAF0', bauhaus:'#F5F5E8', stone:'#BEBEBE', wood:'#1A4528',
}
const THEME_GRID = {
  dmg:'rgba(48,98,48,0.50)', blueprint:'rgba(255,255,255,0.08)', sketch:'rgba(100,80,40,0.12)',
  bauhaus:'rgba(0,0,0,0.12)', stone:'rgba(255,255,255,0.04)', wood:'rgba(0,0,0,0.12)',
  obsidian:'rgba(160,40,255,0.09)', biolume:'rgba(0,220,180,0.06)', frozen:'rgba(150,200,255,0.10)',
  terracotta:'rgba(190,95,50,0.10)', amber:'rgba(190,135,20,0.10)',
  ukiyo:'rgba(80,100,180,0.10)', vaporwave:'rgba(255,100,200,0.07)', stained:'rgba(255,200,0,0.08)', popart:'rgba(0,0,0,0.14)',
  terminal:'rgba(0,255,65,0.13)', circuit:'rgba(0,160,80,0.09)', lego:'rgba(0,0,0,0.09)', copper:'rgba(180,115,50,0.10)',
}

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

export default function GameCanvas({ state, onTap, onTwoFingerTap, onDragBegin, onDragEnd, onHardDrop, themeOverride, boardAlpha }) {
  const { theme: contextTheme, colorMode, bgTheme } = useTheme()
  // If a world background is active and no explicit override is provided,
  // align piece theming with the story mapping used in Story mode.
  const mappedTheme = bgTheme ? (BG_TYPE_TO_PIECE_THEME[bgTheme] ?? contextTheme) : contextTheme
  const theme = themeOverride ?? mappedTheme
  const canvasRef = useRef(null)
  const touchRef = useRef(null)
  const pulseRef = useRef(0)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)
  const activePointersRef = useRef(new Map())
  const TAP_MULTI_WINDOW_MS = 420

  // ── Touch constants ──────────────────────────────────────────────────────────
  // (DRAG_START_PX, TAP_MAX_PX, HARD_DROP_VEL_PX_MS defined at module level)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !state.current) return
    const ctx = canvas.getContext('2d')
  // Cat texture for meme blocks
  const catImg = new Image()
  catImg.src = catImageUrl


    pulseRef.current += 0.05
    const ghostAlpha = 0.12 + 0.08 * Math.sin(pulseRef.current)

    // ── Theme helpers ───────────────────────────────────────────────────────
    const isCustomTheme = theme in PIECE_COLOR_MAPS
    const colorMap = PIECE_COLOR_MAPS[theme] ?? {}
    const isLightTheme = theme === 'bauhaus' || theme === 'sketch' || theme === 'popart' || theme === 'lego'

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
        // ── Natural & Elemental ───────────────────────────────────────────────
        case 'obsidian': {
          // Glossy black fill with glowing edge and inner reflection
          ctx.fillStyle = '#070008'
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.shadowColor = color; ctx.shadowBlur = 14
          ctx.strokeStyle = color; ctx.lineWidth = 1.5
          ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3)
          ctx.shadowBlur = 0
          // Diagonal reflection
          ctx.globalAlpha = alpha * 0.25
          ctx.fillStyle = 'rgba(255,255,255,1)'
          ctx.beginPath()
          ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + CELL_SIZE * 0.55, y + 2)
          ctx.lineTo(x + 2, y + CELL_SIZE * 0.45); ctx.closePath(); ctx.fill()
          break
        }
        case 'biolume': {
          // Semi-transparent ocean-deep fill with bioluminescent glow dots
          ctx.globalAlpha = alpha * 0.70
          ctx.fillStyle = adjustHex(color, -70)
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.globalAlpha = alpha
          ctx.shadowColor = color; ctx.shadowBlur = 12
          ctx.strokeStyle = color; ctx.lineWidth = 1
          ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3)
          ctx.shadowBlur = 0
          // Glow dots
          ctx.fillStyle = color
          const dotR = CELL_SIZE * 0.08
          const dots = [[0.25, 0.30], [0.70, 0.65], [0.45, 0.72]]
          for (const [dx, dy] of dots) {
            ctx.globalAlpha = alpha * 0.85
            ctx.beginPath(); ctx.arc(x + dx * CELL_SIZE, y + dy * CELL_SIZE, dotR, 0, Math.PI * 2); ctx.fill()
          }
          break
        }
        case 'frozen': {
          // Icy translucent fill with bevel and bubble
          ctx.globalAlpha = alpha * 0.75
          ctx.fillStyle = adjustHex(color, -30)
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.globalAlpha = alpha
          // White top-left bevel
          ctx.fillStyle = 'rgba(255,255,255,0.55)'
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, 2)
          ctx.fillRect(x + 1, y + 1, 2, CELL_SIZE - 2)
          // Ice-blue bottom-right shadow
          ctx.fillStyle = 'rgba(100,180,255,0.35)'
          ctx.fillRect(x + 1, y + CELL_SIZE - 3, CELL_SIZE - 2, 2)
          ctx.fillRect(x + CELL_SIZE - 3, y + 1, 2, CELL_SIZE - 2)
          // Air bubble
          ctx.globalAlpha = alpha * 0.55
          ctx.strokeStyle = 'rgba(255,255,255,0.80)'; ctx.lineWidth = 0.8
          ctx.beginPath(); ctx.arc(x + CELL_SIZE * 0.72, y + CELL_SIZE * 0.32, CELL_SIZE * 0.10, 0, Math.PI * 2); ctx.stroke()
          break
        }
        case 'terracotta': {
          // Matte clay fill with darker border and crack line
          ctx.fillStyle = color
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.strokeStyle = adjustHex(color, -40); ctx.lineWidth = 1.5
          ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)
          // Subtle crack
          ctx.globalAlpha = alpha * 0.28
          ctx.strokeStyle = adjustHex(color, -60); ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(x + CELL_SIZE * 0.35, y + 2)
          ctx.lineTo(x + CELL_SIZE * 0.50, y + CELL_SIZE * 0.55)
          ctx.lineTo(x + CELL_SIZE * 0.65, y + CELL_SIZE - 2)
          ctx.stroke()
          break
        }
        case 'amber': {
          // Radial gradient (warm centre) with fossil oval
          const ag = ctx.createRadialGradient(
            x + CELL_SIZE * 0.42, y + CELL_SIZE * 0.38, 1,
            x + CELL_SIZE * 0.5,  y + CELL_SIZE * 0.5,  CELL_SIZE * 0.65)
          ag.addColorStop(0, adjustHex(color, 35)); ag.addColorStop(0.5, color); ag.addColorStop(1, adjustHex(color, -30))
          ctx.fillStyle = ag
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.shadowColor = color; ctx.shadowBlur = 8
          ctx.strokeStyle = adjustHex(color, 18); ctx.lineWidth = 1
          ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3)
          ctx.shadowBlur = 0
          // Fossil oval
          ctx.globalAlpha = alpha * 0.22
          ctx.strokeStyle = adjustHex(color, -55); ctx.lineWidth = 1
          ctx.beginPath()
          ctx.ellipse(x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.5, CELL_SIZE * 0.22, CELL_SIZE * 0.13, 0.4, 0, Math.PI * 2); ctx.stroke()
          break
        }
        // ── Art & Design ─────────────────────────────────────────────────────
        case 'ukiyo': {
          // Flat fill + bold black ink outline + sinusoidal wave stroke
          ctx.fillStyle = color
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.strokeStyle = '#111111'; ctx.lineWidth = 2
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          // Wave across mid-cell
          ctx.globalAlpha = alpha * 0.45
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8
          ctx.beginPath()
          const wMid = y + CELL_SIZE * 0.52
          ctx.moveTo(x + 1, wMid)
          for (let wx = 0; wx <= CELL_SIZE - 2; wx++) {
            ctx.lineTo(x + 1 + wx, wMid + Math.sin((wx / (CELL_SIZE - 2)) * Math.PI * 2) * (CELL_SIZE * 0.12))
          }
          ctx.stroke()
          break
        }
        case 'vaporwave': {
          // Marble-like linear gradient, no strong outline
          const vg = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE)
          vg.addColorStop(0, 'rgba(255,255,255,0.72)'); vg.addColorStop(0.4, color); vg.addColorStop(1, adjustHex(color, -20))
          ctx.fillStyle = vg
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.shadowColor = color; ctx.shadowBlur = 10
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1
          ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3)
          ctx.shadowBlur = 0
          break
        }
        case 'stained': {
          // Semi-transparent fill with bold black lead outline and light-ray top gradient
          ctx.globalAlpha = alpha * 0.82
          ctx.fillStyle = color
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.globalAlpha = alpha
          ctx.strokeStyle = '#111111'; ctx.lineWidth = 2.5
          ctx.strokeRect(x + 1.25, y + 1.25, CELL_SIZE - 2.5, CELL_SIZE - 2.5)
          // Light ray from top
          const sg = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + CELL_SIZE * 0.45)
          sg.addColorStop(0, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = sg
          ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE * 0.45 - 2)
          break
        }
        case 'popart': {
          // Flat fill + Ben-Day dot grid + thick black outline
          ctx.fillStyle = color
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.strokeStyle = '#111111'; ctx.lineWidth = 2
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          // Ben-Day dots
          ctx.globalAlpha = alpha * 0.28
          ctx.fillStyle = 'rgba(255,255,255,1)'
          const dotSpacing = CELL_SIZE / 4
          for (let di = 0.5; di < 4; di++) {
            for (let dj = 0.5; dj < 4; dj++) {
              ctx.beginPath()
              ctx.arc(x + di * dotSpacing, y + dj * dotSpacing, dotSpacing * 0.28, 0, Math.PI * 2); ctx.fill()
            }
          }
          break
        }
        // ── Tech & Overflow ──────────────────────────────────────────────────
        case 'terminal': {
          // Dark fill + centered monospace letter
          ctx.fillStyle = 'rgba(0,8,0,0.88)'
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.shadowColor = color; ctx.shadowBlur = 8
          ctx.strokeStyle = color; ctx.lineWidth = 1
          ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3)
          ctx.shadowBlur = 0
          break
        }
        case 'circuit': {
          // Dark PCB fill with gold trace lines and corner pads
          ctx.fillStyle = 'rgba(4,16,4,0.92)'
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.shadowColor = color; ctx.shadowBlur = 6
          ctx.strokeStyle = color; ctx.lineWidth = 1
          ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)
          ctx.shadowBlur = 0
          // Trace lines
          ctx.globalAlpha = alpha * 0.70
          ctx.strokeStyle = color; ctx.lineWidth = 1.2
          // Horizontal trace
          ctx.beginPath(); ctx.moveTo(x + 1, y + CELL_SIZE * 0.5); ctx.lineTo(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.5); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.5); ctx.lineTo(x + CELL_SIZE - 1, y + CELL_SIZE * 0.5); ctx.stroke()
          // Vertical trace
          ctx.beginPath(); ctx.moveTo(x + CELL_SIZE * 0.5, y + 1); ctx.lineTo(x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.35); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.65); ctx.lineTo(x + CELL_SIZE * 0.5, y + CELL_SIZE - 1); ctx.stroke()
          // Center pad
          ctx.globalAlpha = alpha
          ctx.fillStyle = color
          ctx.beginPath(); ctx.arc(x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.5, CELL_SIZE * 0.12, 0, Math.PI * 2); ctx.fill()
          break
        }
        case 'lego': {
          // Glossy bright fill + circular stud on top
          const lg = ctx.createLinearGradient(x + 1, y + 1, x + CELL_SIZE - 1, y + CELL_SIZE - 1)
          lg.addColorStop(0, adjustHex(color, 28)); lg.addColorStop(0.5, color); lg.addColorStop(1, adjustHex(color, -28))
          ctx.fillStyle = lg; ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.strokeStyle = adjustHex(color, -55); ctx.lineWidth = 1.5
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          // Stud circle
          const studR = CELL_SIZE * 0.24
          const studX = x + CELL_SIZE * 0.5, studY = y + CELL_SIZE * 0.5
          ctx.fillStyle = adjustHex(color, 15)
          ctx.beginPath(); ctx.arc(studX, studY, studR, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = adjustHex(color, -40); ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(studX, studY, studR, 0, Math.PI * 2); ctx.stroke()
          // Stud highlight
          ctx.globalAlpha = alpha * 0.55
          ctx.fillStyle = 'rgba(255,255,255,1)'
          ctx.beginPath(); ctx.arc(studX - studR * 0.3, studY - studR * 0.3, studR * 0.38, 0, Math.PI * 2); ctx.fill()
          break
        }
        case 'copper': {
          // Metallic gradient (highlight → mid → dark base) + reflective bevel
          const cg = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + CELL_SIZE - 1)
          cg.addColorStop(0,   adjustHex(color, 40))
          cg.addColorStop(0.35, color)
          cg.addColorStop(0.75, adjustHex(color, -15))
          cg.addColorStop(1,   adjustHex(color, -45))
          ctx.fillStyle = cg; ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          // Top highlight bevel
          ctx.globalAlpha = alpha * 0.50
          ctx.fillStyle = 'rgba(255,255,255,1)'
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, 2)
          ctx.fillRect(x + 1, y + 1, 2, CELL_SIZE - 2)
          ctx.globalAlpha = alpha
          ctx.strokeStyle = adjustHex(color, -50); ctx.lineWidth = 1
          ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)
          break
        }
        default: {
          // Bloom fill
          ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur * 1.6
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          // Top-left highlight bevel
          ctx.shadowBlur = 0; ctx.globalAlpha = alpha * 0.40
          ctx.fillStyle = 'rgba(255,255,255,1)'
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, 3)
          ctx.fillRect(x + 1, y + 1, 3, CELL_SIZE - 2)
          // Bottom-right shadow bevel
          ctx.fillStyle = 'rgba(0,0,0,0.50)'
          ctx.fillRect(x + 1, y + CELL_SIZE - 4, CELL_SIZE - 2, 3)
          ctx.fillRect(x + CELL_SIZE - 4, y + 1, 3, CELL_SIZE - 2)
        }
      }
      ctx.restore()
    }

    const drawCatCell = (ctx, x, y) => {
      ctx.save()
      // Clip and rotate the cat texture within the cell, meme-style
      ctx.beginPath(); ctx.rect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.clip()
      const cx = x + CELL_SIZE / 2, cy = y + CELL_SIZE / 2
      ctx.translate(cx, cy)
      const t = Date.now()
      const base = ((x + y) * 0.003) // per-cell phase offset
      const ang = base + (t * 0.004)  // ~1.4 rad/sec
      ctx.rotate(ang)
      if (catImg.complete) {
        // Draw centered, slightly overfill for coverage when rotated
        const drawSize = CELL_SIZE
        const dx = -drawSize / 2 + 0.0, dy = -drawSize / 2 + 0.0
        try { ctx.drawImage(catImg, 0, 0, catImg.width, catImg.height, dx, dy, drawSize, drawSize) } catch {}
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      // Bright outline
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = '#a855f7'
      ctx.lineWidth = 1.25
      ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3)
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
          ctx.strokeStyle = 'rgba(117, 111, 102, 0.91)'; ctx.lineWidth = 1.2
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
          ctx.strokeStyle = color; ctx.lineWidth = 1
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.setLineDash([])
          break
        case 'obsidian':
        case 'biolume':
        case 'vaporwave':
        case 'stained':
        case 'terminal':
        case 'circuit':
        case 'copper':
          ctx.globalAlpha = 0.28
          ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.globalAlpha = 0.70
          ctx.shadowColor = color; ctx.shadowBlur = 8
          ctx.strokeStyle = color; ctx.lineWidth = 1.5
          ctx.strokeRect(x + 1.75, y + 1.75, CELL_SIZE - 3.5, CELL_SIZE - 3.5)
          break
        case 'frozen':
          ctx.globalAlpha = 0.35
          ctx.fillStyle = 'rgba(180,220,255,0.40)'; ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.strokeStyle = 'rgba(200,240,255,0.70)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2])
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.setLineDash([])
          break
        case 'terracotta':
        case 'amber':
          ctx.globalAlpha = 0.28; ctx.setLineDash([3, 3])
          ctx.strokeStyle = color; ctx.lineWidth = 1
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.setLineDash([])
          break
        case 'ukiyo':
          ctx.globalAlpha = 0.35; ctx.setLineDash([4, 2])
          ctx.strokeStyle = color; ctx.lineWidth = 1.5
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.setLineDash([])
          break
        case 'popart':
        case 'lego':
          ctx.globalAlpha = 0.30
          ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
          ctx.globalAlpha = 0.60
          ctx.strokeStyle = '#111111'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3])
          ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.setLineDash([])
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
    if (boardAlpha !== undefined) {
      // Caller-provided alpha (story mode: beat-synced transparency)
      ctx.globalAlpha = boardAlpha
      ctx.fillStyle = '#04060e'
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40)
      ctx.globalAlpha = 1
    } else if (bgTheme) {
      // Semi-transparent board when a world background is active
      ctx.globalAlpha = 0.48
      ctx.fillStyle = '#04060e'
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40)
      ctx.globalAlpha = 1
    } else if (state.zoneActive && !themeBg) {
      const progress = state.zoneTimer / ZONE_DURATION_MS
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      grad.addColorStop(0, `hsl(${200 + progress * 60}, 80%, 8%)`)
      grad.addColorStop(1, `hsl(${240 + progress * 40}, 90%, 5%)`)
      ctx.globalAlpha = BOARD_BASE_ALPHA
      ctx.fillStyle = grad
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40)
      ctx.globalAlpha = 1
    } else {
      ctx.globalAlpha = BOARD_BASE_ALPHA
      ctx.fillStyle = themeBg ?? '#090b16'
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40)
      ctx.globalAlpha = 1
    }

    // Cat rotating background in meme mode (subtle, behind grid)
    if (state.useMemeBlocks && catImg.complete) {
      ctx.save()
      const cx = canvas.width / 2, cy = canvas.height / 2
      ctx.translate(cx, cy)
      const now = Date.now()
      // Base slow spin with occasional "meme" burst (~every 5s, ~600ms duration, pseudo-random)
      const period = 5000
      const burstWindow = 600
      const phase = Math.floor(now / period)
      const seed = Math.abs(Math.sin(phase * 12.9898 + 78.233)) % 1
      const inBurst = (now % period) < burstWindow && seed > 0.4
      let speed = 0.0012 + (inBurst ? 0.02 : 0) // super fast during burst
      // Subtle jitter so it doesn't feel mechanical
      speed *= (1 + 0.18 * Math.sin(now * 0.0007))
      const ang = (now * speed) % (Math.PI * 2)
      ctx.rotate(ang)
      ctx.globalAlpha = 0.10
      const size = Math.max(canvas.width, canvas.height) * 1.35
      try { ctx.drawImage(catImg, 0, 0, catImg.width, catImg.height, -size / 2, -size / 2, size, size) } catch {}
      ctx.restore()
      ctx.globalAlpha = 1
    }

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
          if (state.useMemeBlocks) drawCatCell(ctx, x * CELL_SIZE, y * CELL_SIZE)
          else drawCell(ctx, x * CELL_SIZE, y * CELL_SIZE, PIECES[cell].color, 1, 12, cell)
        }
      })
    })

    // Incoming garbage alert — draw vertical red guide bars along left/right
    // edges to the height equal to the number of pending garbage rows. This
    // gives a quick sense of how much of the matrix will be covered.
    if ((state.pendingGarbage ?? 0) > 0) {
      const rowsIncoming = Math.min(BOARD_HEIGHT, Math.max(0, state.pendingGarbage | 0))
      const h = rowsIncoming * CELL_SIZE
      const baseY = BOARD_HEIGHT * CELL_SIZE
      const startY = baseY - h
      const barW = 4
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#f87171'
      ctx.shadowColor = '#f87171'
      ctx.shadowBlur = 12
      // Left edge
      ctx.fillRect(0, startY, barW, h)
      // Right edge
      ctx.fillRect(BOARD_WIDTH * CELL_SIZE - barW, startY, barW, h)
      // Top caps for clarity
      ctx.shadowBlur = 0
      ctx.globalAlpha = 0.9
      ctx.fillRect(0, startY - 2, barW, 2)
      ctx.fillRect(BOARD_WIDTH * CELL_SIZE - barW, startY - 2, barW, 2)
      ctx.restore()
    }

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
        if (y >= 0) {
          if (state.useMemeBlocks) drawCatCell(ctx, x * CELL_SIZE, y * CELL_SIZE)
          else drawCell(ctx, x * CELL_SIZE, y * CELL_SIZE, PIECES[state.current.type].color, 1, 12, state.current.type)
        }
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

    // ── Vignette + scanlines for default (classic/neon) theme ────────────
    if (!isCustomTheme && !isLightTheme) {
      // Vignette
      ctx.save()
      const vig = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.75,
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.38)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Subtle scanlines
      ctx.globalAlpha = 0.045
      ctx.fillStyle = '#000'
      for (let sy = 0; sy < canvas.height; sy += 3) {
        ctx.fillRect(0, sy, canvas.width, 1)
      }
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
          const baseSize = ft.huge ? 28 : 18
          ctx.font = `bold ${Math.round(baseSize * scale)}px monospace`
          const isTSpin  = ft.text.includes('T-SPIN') || ft.text.includes('ALL-SPIN')
          const isTetris = ft.text.includes('TETRIS')
          const isB2B    = ft.text.startsWith('B2B')
          if (isLightTheme) {
            ctx.fillStyle = isB2B ? '#8B6200' : isTetris ? '#006880' : isTSpin ? '#6030A0' : '#2A2A2A'
          } else {
            ctx.fillStyle  = isB2B ? '#ffd700' : isTetris ? '#00e5ff' : isTSpin ? '#cc88ff' : '#ffffff'
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = ft.huge ? 36 : 24
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
    // Register pointer for multi-finger detection
    if (event.pointerType === "touch") {
      activePointersRef.current.set(event.pointerId, performance.now())
      if (activePointersRef.current.size === 2) {
        const times = Array.from(activePointersRef.current.values())
        if (Math.abs(times[0] - times[1]) < TAP_MULTI_WINDOW_MS) {
          setTimeout(() => onTwoFingerTap?.(), 0)
        }
      }
    }
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
    activePointersRef.current.delete(event.pointerId)
    const start = touchRef.current
    touchRef.current = null
    if (!start) return

    if (start.dir === null) {
      // Single-finger tap (rotate)
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX) {
        onTap?.()
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
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role="img"
      aria-label="Tetris game board"
    />
  )
}
