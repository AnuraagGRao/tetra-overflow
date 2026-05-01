import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { useAuth } from '../contexts/AuthContext'
import { createLobby, joinLobby, updateLobby, updateLobbyPlayer, setLobbyStatus, setLobbyBestOf, subscribeLobby, archiveLobby } from '../firebase/db'
import { TetrisEngine, GAME_MODE, ZONE_MIN_METER } from '../logic/gameEngine'
import { PIECES } from '../logic/tetrominoes'
import { MusicManager } from '../audio/musicManager'
import GameCanvas from '../components/GameCanvas'
import TouchControls from '../components/TouchControls'

const KEY_BINDINGS = {
  ArrowLeft:  { held: 'left' },
  ArrowRight: { held: 'right' },
  ArrowDown:  { held: 'softDrop' },
  ArrowUp:    { action: 'rotateCW' },
  KeyZ:       { action: 'rotateCCW' },
  Space:      { action: 'hardDrop' },
  KeyX:       { action: 'rotate180' },
  KeyC:       { action: 'hold' },
  // No pause in multiplayer (Mute still allowed)
  KeyM:       { action: 'mute' },
}

const MAX_FRAME_MS     = 34
const SNAP_INTERVAL_MS = 300  // faster board updates for smoother opponent preview

// ─── Audio (module-level — persists across re-renders, isolated from App.jsx) ─
let _mpAudioCtx = null
let _mpMusicMgr = null
let _mpSfxVol   = 2.0

const getMpAudio = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!_mpAudioCtx) {
    _mpAudioCtx = new Ctx()
    _mpMusicMgr = new MusicManager(_mpAudioCtx)
  }
  if (_mpAudioCtx.state === 'suspended') _mpAudioCtx.resume()
  return _mpAudioCtx
}

const _mpNote = (freq, dur, gain, type = 'triangle', offset = 0) => {
  const ctx = getMpAudio(); if (!ctx) return
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination)
  osc.type = type; osc.frequency.value = freq
  const t = ctx.currentTime + offset
  g.gain.setValueAtTime(gain * _mpSfxVol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.start(t); osc.stop(t + dur + 0.01)
}
const _mpNoise = (lpFreq, gain, dur, offset = 0) => {
  const ctx = getMpAudio(); if (!ctx) return
  const len = Math.ceil(ctx.sampleRate * Math.min(dur, 0.5))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d   = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lpFreq
  const gn  = ctx.createGain()
  src.connect(flt); flt.connect(gn); gn.connect(ctx.destination)
  const t = ctx.currentTime + offset
  gn.gain.setValueAtTime(gain * _mpSfxVol, t)
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.start(t); src.stop(t + dur + 0.01)
}

let _lastMpMoveBeep = 0
const mpPlayMove     = () => { const n = performance.now(); if (n - _lastMpMoveBeep < 75) return; _lastMpMoveBeep = n; _mpNote(380, 0.022, 0.026, 'triangle') }
const mpPlayRotate   = () => { _mpNote(1100, 0.032, 0.22, 'triangle'); _mpNote(750, 0.020, 0.16, 'sine', 0.010) }
const mpPlayHold     = () =>   _mpNote(660, 0.018, 0.15, 'triangle')
const mpPlayHardDrop = () => { _mpNote(75, 0.18, 0.44, 'sine'); _mpNote(410, 0.06, 0.14, 'triangle', 0.010); _mpNoise(900, 0.18, 0.06, 0.012) }
const mpPlayClear    = (lines = 1) => {
  _mpNoise(9000, 0.18, 0.11)
  const freqs = lines >= 4 ? [392, 523, 659, 784, 1047] : [392, 523, 659, 784]
  freqs.forEach((f, i) => _mpNote(f, 0.095, 0.18, 'sine', i * 0.062))
}
const mpPlayLock = () => {
  const ctx = getMpAudio(); if (!ctx) return
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination); osc.type = 'sine'
  const t = ctx.currentTime
  osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(52, t + 0.07)
  g.gain.setValueAtTime(0.18 * _mpSfxVol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.10)
  osc.start(t); osc.stop(t + 0.11)
}
const mpPlayGarbageIn = () => { _mpNote(180, 0.22, 0.18, 'sawtooth'); _mpNoise(400, 0.15, 0.09, 0.02) }

// ─── Opponent mini-board ───────────────────────────────────────────────────────
function OpponentBoard({ snapshot, displayName, score, wins = 0, isTarget = false, onClick, compact = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx  = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const cols = 10, rows = 20
    const cw = W / cols, ch = H / rows

    ctx.fillStyle = '#06060f'
    ctx.fillRect(0, 0, W, H)

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'
    ctx.lineWidth = 0.5
    for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, H); ctx.stroke() }
    for (let r = 1; r < rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(W, r * ch); ctx.stroke() }

    // Locked cells with real piece colors (supports compact boardRows format)
    if (snapshot?.boardRows) {
      const rowsArr = snapshot.boardRows
      // Skip hidden spawn rows (0–1). Map visible 20 rows 0..19 ← 2..21
      for (let vr = 0; vr < rows; vr++) {
        const srcIdx = vr + 2
        const rowStr = rowsArr[srcIdx] || ''
        for (let c = 0; c < cols; c++) {
          const sym = rowStr[c]
          if (!sym || sym === '.') continue
          const color = sym === 'G' ? '#444' : (PIECES[sym]?.color ?? '#00d4ff')
          ctx.fillStyle = color
          ctx.fillRect(c * cw + 0.5, vr * ch + 0.5, cw - 1, ch - 1)
        }
      }
    } else if (snapshot?.board) {
      // Back-compat for old nested-array snapshots
      for (let r = 2; r < rows + 2; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = snapshot.board[r]?.[c]
          if (!cell) continue
          ctx.fillStyle = cell === 'GBG' ? '#444' : (PIECES[cell]?.color ?? '#00d4ff')
          ctx.fillRect(c * cw + 0.5, (r - 2) * ch + 0.5, cw - 1, ch - 1)
        }
      }
    }
    // Falling piece (semi-transparent)
    if (snapshot?.current) {
      const { type, x, y } = snapshot.current
      const rows = snapshot.current.rows
      const matrix = rows ? rows.map(r => Array.from(r).map(ch => ch === '1')) : snapshot.current.matrix
      ctx.fillStyle  = PIECES[type]?.color ?? '#ccc'
      ctx.globalAlpha = 0.8
      matrix?.forEach((row, dy) => {
        row?.forEach((cell, dx) => {
          if (!cell) return
          const px = x + dx, py = y + dy
          if (py < 2 || py >= rows + 2 || px < 0 || px >= cols) return
          ctx.fillRect(px * cw + 0.5, (py - 2) * ch + 0.5, cw - 1, ch - 1)
        })
      })
      ctx.globalAlpha = 1
    }

    // If no snapshot yet, show a tiny hint
    if (!snapshot?.board && !snapshot?.current) {
      ctx.fillStyle = 'rgba(200,200,220,0.35)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('waiting…', W / 2, H / 2)
    }
  }, [snapshot])

  const CW = compact ? 60 : 72
  const CH = compact ? 120 : 144
  return (
    <div onClick={onClick}
      style={{ background: 'rgba(5,5,20,0.9)', border: '1px solid rgba(255,255,255,0.1)', cursor: onClick ? 'pointer' : 'default', borderRadius: 5, padding: '3px 3px 2px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <div style={{ fontSize: '0.48rem', color: '#777', letterSpacing: '0.07em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 54 }}>{displayName}</div>
        <div style={{ fontSize: '0.52rem', color: '#f97316', fontWeight: 700 }}>×{wins}</div>
      </div>
      <div style={{ position: 'relative', width: CW, height: CH, margin: '0 auto' }}>
        <canvas ref={canvasRef} width={CW} height={CH} style={{ display: 'block', borderRadius: 2, width: CW, height: CH }} />
        {isTarget && (
          <div style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 8px #00e5ffaa' }} />
        )}
      </div>
      <div style={{ fontSize: '0.46rem', color: '#00d4ff', marginTop: 2, textAlign: 'center' }}>{(score || 0).toLocaleString()}</div>
    </div>
  )
}

// ─── Mini piece preview ────────────────────────────────────────────────────────
function PieceMini({ type, size = 11 }) {
  const canvasRef = useRef(null)
  const color = type ? (PIECES[type]?.color ?? '#888') : '#333'
  const piece = type ? PIECES[type] : null

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!piece) return
    const { matrix } = piece
    const filled = matrix.filter(r => r.some(Boolean))
    if (!filled.length) return
    const colMin = Math.min(...filled.map(r => r.findIndex(Boolean)))
    const colMax = Math.max(...filled.map(r => r.length - 1 - [...r].reverse().findIndex(Boolean)))
    const tw = colMax - colMin + 1, th = filled.length
    const ox = Math.floor((4 - tw) / 2) * size
    const oy = Math.floor((2 - th) / 2) * size
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 4
    filled.forEach((row, ry) => {
      for (let cx = colMin; cx <= colMax; cx++) {
        if (!row[cx]) continue
        ctx.fillRect(ox + (cx - colMin) * size + 1, oy + ry * size + 1, size - 2, size - 2)
      }
    })
  }, [type, color, size, piece])

  return <canvas ref={canvasRef} width={4 * size} height={2 * size} style={{ display: 'block' }} />
}

// ─── Create lobby screen ──────────────────────────────────────────────────────
function CreateScreen({ onCreate }) {
  const { user, userProfile } = useAuth()
  const [busy, setBusy]       = useState(false)
  const displayName = userProfile?.displayName || user?.displayName || 'Player'

  const handle = async () => {
    setBusy(true)
    try { await onCreate() } catch { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '0.14em', color: '#f97316' }}>CREATE LOBBY</div>
        <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 6, letterSpacing: '0.1em' }}>Share the code or QR with your opponents</div>
      </div>
      <motion.button
        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        disabled={busy} onClick={handle}
        style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', color: '#fff', borderRadius: 10, padding: '12px 28px', fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.14em', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1 }}
      >
        {busy ? 'CREATING…' : 'CREATE LOBBY'}
      </motion.button>
      <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '0.08em' }}>Playing as: <span style={{ color: '#ccc' }}>{displayName}</span></div>
    </div>
  )
}

// ─── Join screen ───────────────────────────────────────────────────────────────
function JoinScreen({ onJoin }) {
  const [code, setCode] = useState('')
  const [err, setErr]   = useState('')
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await onJoin(code.toUpperCase().trim()) }
    catch (ex) { setErr(ex.message); setBusy(false) }
  }

  return (
    <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '0.14em', color: '#00d4ff' }}>JOIN LOBBY</div>
        <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 6, letterSpacing: '0.1em' }}>Enter the 6-character code</div>
      </div>
      {err && <div style={{ fontSize: '0.75rem', color: '#f87171', letterSpacing: '0.06em' }}>{err}</div>}
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        placeholder="XXXXXX" maxLength={6} required
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: '1.4rem', letterSpacing: '0.35em', textAlign: 'center', width: 180, fontFamily: 'inherit', outline: 'none' }}
      />
      <motion.button
        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        type="submit" disabled={busy || code.length < 6}
        style={{ background: 'linear-gradient(135deg,#00d4ff,#0066ff)', border: 'none', color: '#fff', borderRadius: 10, padding: '11px 26px', fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.14em', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: (busy || code.length < 6) ? 0.6 : 1 }}
      >
        {busy ? 'JOINING…' : 'JOIN'}
      </motion.button>
    </form>
  )
}

// ─── Waiting room ─────────────────────────────────────────────────────────────
function WaitingRoom({ lobby, isHost, onStart, onLeave, onBestOfChange, selfUid, lobbyCode }) {
  const joinUrl = new URL(`${import.meta.env.BASE_URL}multiplayer?join=${lobby.code}`, window.location.origin).href
  const bestOf  = lobby.bestOf ?? 3
  const me = lobby.players.find(p => p.uid === selfUid)
  const myBuff = me?.buff ?? 0
  const myNerf = me?.nerf ?? 0
  const setBuff = (v) => updateLobbyPlayer(lobbyCode, selfUid, { buff: v, nerf: v > 0 ? 0 : (me?.nerf ?? 0) })
  const setNerf = (v) => updateLobbyPlayer(lobbyCode, selfUid, { nerf: v, buff: v > 0 ? 0 : (me?.buff ?? 0) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.4rem', padding: '2rem', maxWidth: 360, margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.55rem', letterSpacing: '0.3em', color: '#f97316', marginBottom: 6 }}>LOBBY CODE</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.3em', color: '#fff', textShadow: '0 0 20px rgba(249,115,22,0.5)' }}>{lobby.code}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 12 }}>
        <QRCode value={joinUrl} size={130} fgColor="#0a0a14" bgColor="#fff" />
      </div>

      {/* Buff / Nerf selectors (self). You can select either BUFF or NERF (not both). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 42, fontSize: '0.6rem', color: '#88d', letterSpacing: '0.12em' }}>BUFF</span>
          <input type="range" min={0} max={3} step={1} value={myBuff}
            onChange={e => setBuff(parseInt(e.target.value))}
            disabled={myNerf > 0}
            style={{ flex: 1, accentColor: '#00d4ff' }} />
          <span style={{ width: 20, textAlign: 'right', fontSize: '0.62rem', color: myBuff>0?'#00d4ff':'#777' }}>{myBuff}</span>
        </div>
        <div style={{ fontSize: '0.5rem', color: '#98c8ff', letterSpacing: '0.08em', margin: '-2px 0 6px 52px' }}>
          BUFF increases your outgoing sends. Set to 0 to turn off.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 42, fontSize: '0.6rem', color: '#f88', letterSpacing: '0.12em' }}>NERF</span>
          <input type="range" min={0} max={3} step={1} value={myNerf}
            onChange={e => setNerf(parseInt(e.target.value))}
            disabled={myBuff > 0}
            style={{ flex: 1, accentColor: '#f97316' }} />
          <span style={{ width: 20, textAlign: 'right', fontSize: '0.62rem', color: myNerf>0?'#f97316':'#777' }}>{myNerf}</span>
        </div>
        <div style={{ fontSize: '0.5rem', color: '#f7b285', letterSpacing: '0.08em', margin: '-2px 0 0 52px' }}>
          NERF reduces your outgoing sends. Set to 0 to turn off.
        </div>
      </div>

      {/* Best-of selector */}
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: '0.52rem', color: '#888', letterSpacing: '0.14em', marginBottom: 6, textAlign: 'center' }}>MATCH FORMAT</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 3, 5, 7].map(n => (
            <button
              key={n}
              onClick={() => isHost && onBestOfChange(n)}
              style={{
                flex: 1,
                background: bestOf === n ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                border:     `1px solid ${bestOf === n ? '#f97316' : 'rgba(255,255,255,0.1)'}`,
                color:      bestOf === n ? '#f97316' : '#555',
                borderRadius: 7, padding: '8px 4px', fontSize: '0.68rem',
                fontWeight: 700, cursor: isHost ? 'pointer' : 'default',
                fontFamily: 'inherit', letterSpacing: '0.06em',
                opacity: isHost ? 1 : 0.7,
              }}
            >
              {n === 1 ? 'BO1' : `BO${n}`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.52rem', color: '#555', marginTop: 4, textAlign: 'center' }}>
          {bestOf === 1 ? 'Single match' : `Best of ${bestOf} — first to ${Math.ceil(bestOf / 2)} wins`}
          {!isHost && ' (host sets)'}
        </div>
      </div>

      {/* Player list (shows BUFF/NERF selections to everyone) */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lobby.players.map((p, i) => {
          const selBuff = p.buff ?? 0
          const selNerf = p.nerf ?? 0
          const tag = selBuff > 0 ? { label: `BUFF +${selBuff}`, color: '#00d4ff', bg: 'rgba(0,212,255,0.15)', border: '#00d4ff' }
                    : selNerf > 0 ? { label: `NERF +${selNerf}`, color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: '#f97316' }
                    : null
          return (
          <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg,#f97316,#ef4444)' : 'linear-gradient(135deg,#00d4ff,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, flexShrink: 0 }}>
              {p.displayName[0].toUpperCase()}
            </div>
            <span style={{ flex: 1, fontSize: '0.82rem', color: '#ddd', letterSpacing: '0.06em' }}>{p.displayName}</span>
            {tag ? (
              <span style={{ fontSize: '0.6rem', color: tag.color, background: tag.bg, border: `1px solid ${tag.border}`, padding: '2px 6px', borderRadius: 6, marginRight: 6, letterSpacing: '0.08em' }}>{tag.label}</span>
            ) : (
              <span style={{ fontSize: '0.6rem', color: '#444', letterSpacing: '0.08em', marginRight: 6 }}>—</span>
            )}
            <span style={{ fontSize: '0.6rem', color: i === 0 ? '#f97316' : '#555', letterSpacing: '0.14em' }}>{i === 0 ? 'HOST' : 'GUEST'}</span>
          </div>
        )})}
        {lobby.players.length < 2 && (
          <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#555', letterSpacing: '0.12em', padding: '8px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8 }}>
            Waiting for players… ({lobby.players.length}/4)
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
        {isHost && lobby.players.length >= 2 && (
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onStart}
            style={{ background: '#22c55e', border: 'none', color: '#000', borderRadius: 8, padding: '11px 24px', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.14em', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            START GAME
          </motion.button>
        )}
        <button onClick={onLeave} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#888', borderRadius: 8, padding: '10px 18px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.1em' }}>
          LEAVE
        </button>
      </div>
    </div>
  )
}

// ─── Screen states ─────────────────────────────────────────────────────────────
const SCREEN = { PICK: 'pick', CREATE: 'create', JOIN: 'join', LOBBY: 'lobby', GAME: 'game', ROUND_END: 'round_end', RESULT: 'result' }

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MultiplayerPage() {
  const navigate    = useNavigate()
  const { user, userProfile } = useAuth()
  const displayName = userProfile?.displayName || user?.displayName || 'Player'

  const [screen,      setScreen]      = useState(SCREEN.PICK)
  const [lobbyCode,   setLobbyCode]   = useState(null)
  const [lobby,       setLobby]       = useState(null)
  const [isHost,      setIsHost]      = useState(false)
  const [myState,     setMyState]     = useState(null)
  // No pause in multiplayer; keep state for overlay suppression
  const [paused,      setPaused]      = useState(false)
  const [muted,       setMuted]       = useState(false)
  const [roundResult, setRoundResult] = useState(null)

  const engine = useMemo(() => new TetrisEngine(), [])

  const heldRef            = useRef({ left: false, right: false, softDrop: false })
  const actionRef          = useRef({})
  const pausedRef          = useRef(false)
  const mutedRef           = useRef(false)
  const screenRef          = useRef(SCREEN.PICK)
  const lobbyRef           = useRef(null)
  const lastSeenRoundRef   = useRef(0)    // which round the engine was last reset for
  const roundEndDoneRef    = useRef(false) // host-only: prevents double round-end processing
  const roundTimerRef      = useRef(null) // cleanup handle for 3-second round-end delay
  const garbageSentToRef   = useRef({})   // { [targetUid]: totalSentToThem }
  const opponentGarbageRef = useRef({})   // { [senderUid]: totalApplied }
  const [targetUid, setTargetUid] = useState(null)
  const [compactPreviews, setCompactPreviews] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vs-compact-previews') ?? 'false') } catch { return false }
  })
  const [gridCols, setGridCols] = useState(() => (window.innerWidth > 1024 ? 4 : window.innerWidth > 768 ? 3 : 2))
    // Auto-join via URL (?join= or ?code=) or legacy hash (#join:CODE)
    useEffect(() => {
      try {
        const url = new URL(window.location.href)
        let code = (url.searchParams.get('join') || url.searchParams.get('code') || '').toUpperCase()
        if (!code && window.location.hash.startsWith('#join:')) code = window.location.hash.slice(6).toUpperCase()
        if (code && /^[A-Z0-9]{6}$/.test(code)) {
          handleJoin(code).catch(() => setScreen(SCREEN.JOIN))
        }
      } catch {}
    }, [])
  const currentTargetRef   = useRef(null) // current random garbage target UID
  const lastSnapRef        = useRef(0)
  const unsubRef           = useRef(null)
  const prevStateRef       = useRef(null) // previous engine state for SFX edge detection

  // Keep refs in sync with state
  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { lobbyRef.current  = lobby  }, [lobby])
  useEffect(() => {
    const onResize = () => setGridCols(window.innerWidth > 1024 ? 4 : window.innerWidth > 768 ? 3 : 2)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const toggleCompact = useCallback(() => {
    setCompactPreviews(v => { const n = !v; localStorage.setItem('vs-compact-previews', JSON.stringify(n)); return n })
  }, [])
  // Auto-disable compact when there are 4 or fewer opponents
  useEffect(() => {
    const oppCount = (lobby?.players ?? []).filter(p => p.uid !== user?.uid).length
    if (oppCount <= 4 && compactPreviews) {
      setCompactPreviews(false)
      try { localStorage.setItem('vs-compact-previews', 'false') } catch {}
    }
  }, [lobby, user, compactPreviews])
  // WS streaming disabled — Firestore-only path remains

  const showOnScreenControls = (() => {
    try { return JSON.parse(localStorage.getItem('tetris-config') ?? '{}').showOnScreenControls ?? false }
    catch { return false }
  })()

  // ── Init SFX volume from config; stop music on unmount ────────────────────────
  useEffect(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('tetris-config') ?? '{}')
      _mpSfxVol = cfg.sfxEnabled !== false ? (cfg.sfxVolume ?? 2.0) : 0
    } catch {}
    return () => {
      clearTimeout(roundTimerRef.current)
      _mpMusicMgr?.stop()
    }
  }, [])

  // ── Apply DAS / ARR from user config ──────────────────────────────────────────
  useEffect(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('tetris-config') ?? '{}')
      engine.setSettings({ das: cfg.das ?? 110, arr: cfg.arr ?? 25 })
    } catch {}
  }, [engine])

  // ── Pause / resume ────────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    // no-op: pause disabled in Versus
    pausedRef.current = false
    setPaused(false)
  }, [])

  // ── Mute ─────────────────────────────────────────────────────────────────────
  const applyMute = useCallback((mute) => {
    mutedRef.current = mute
    setMuted(mute)
    if (mute) {
      _mpMusicMgr?.setVolume(0)
      _mpSfxVol = 0
    } else {
      try {
        const cfg = JSON.parse(localStorage.getItem('tetris-config') ?? '{}')
        _mpMusicMgr?.setVolume(cfg.musicVolume ?? 1.0)
        _mpSfxVol = cfg.sfxVolume ?? 2.0
      } catch { _mpMusicMgr?.setVolume(1.0); _mpSfxVol = 2.0 }
    }
  }, [])
  const toggleMute = useCallback(() => applyMute(!mutedRef.current), [applyMute])

  // ── Random garbage target selection ──────────────────────────────────────────
  const pickTarget = useCallback((lobbyData) => {
    const alive = (lobbyData?.players ?? []).filter(p => p.uid !== user?.uid && !p.gameOver)
    if (alive.length) {
      const uid = alive[Math.floor(Math.random() * alive.length)].uid
      currentTargetRef.current = uid
      setTargetUid(uid)
    }
  }, [user])
  const selectTarget = useCallback((uid) => { currentTargetRef.current = uid; setTargetUid(uid) }, [])

  // ── Host: process end of round ────────────────────────────────────────────────
  const endRound = useCallback(async (lobbyData, winnerUid) => {
    if (!lobbyCode) return
    const prevWins   = lobbyData.roundWins ?? {}
    const newWins    = { ...prevWins, [winnerUid]: (prevWins[winnerUid] ?? 0) + 1 }
    const bestOf     = lobbyData.bestOf ?? 3
    const winsNeeded = Math.ceil(bestOf / 2)

    if (newWins[winnerUid] >= winsNeeded) {
      await updateLobby(lobbyCode, { roundWins: newWins, status: 'finished', matchWinner: winnerUid })
    } else {
      const nextRound    = (lobbyData.currentRound ?? 1) + 1
      const resetPlayers = lobbyData.players.map(p => ({
        ...p, gameOver: false, score: 0, boardSnapshot: null, garbageSentTo: {},
      }))
      // Keeping status = 'playing' with new currentRound triggers all clients to restart
      await updateLobby(lobbyCode, { roundWins: newWins, currentRound: nextRound, players: resetPlayers })
    }
  }, [lobbyCode])

  // Stable ref so the subscribeLobby closure always calls the latest endRound
  const endRoundRef = useRef(endRound)
  useEffect(() => { endRoundRef.current = endRound }, [endRound])

  // ── Lobby subscription ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lobbyCode) return

    const unsub = subscribeLobby(lobbyCode, (data) => {
      setLobby(data)

      // New round start (first game or subsequent rounds)
      if (data.status === 'playing' && (data.currentRound ?? 1) !== lastSeenRoundRef.current) {
        lastSeenRoundRef.current  = data.currentRound ?? 1
        roundEndDoneRef.current   = false
        garbageSentToRef.current   = {}
        opponentGarbageRef.current = {}
        prevStateRef.current       = null

        engine.reset(GAME_MODE.VERSUS)
        setMyState(engine.getState())
        setScreen(SCREEN.GAME)
        setPaused(false)
        pausedRef.current = false

        getMpAudio()
        try {
          const cfg = JSON.parse(localStorage.getItem('tetris-config') ?? '{}')
          _mpMusicMgr?.setVolume(mutedRef.current ? 0 : (cfg.musicVolume ?? 1.0))
        } catch { _mpMusicMgr?.setVolume(mutedRef.current ? 0 : 1.0) }
        _mpMusicMgr?.start()
        pickTarget(data)
        // Push an immediate snapshot so opponents see our board right away
        try {
          const s0 = engine.getState()
          const boardRows = (s0.board || []).map(row => (row || []).map(c => c === null ? '.' : (c === 'GBG' ? 'G' : c)).join(''))
          const curRows = s0.current?.matrix
            ? (s0.current.matrix || []).map(r => (r || []).map(v => (v ? '1' : '.')).join(''))
            : null
          updateLobbyPlayer(lobbyCode, user.uid, {
            score: s0.score,
            boardSnapshot: {
              boardRows,
              current: s0.current
                ? { type: s0.current.type, x: s0.current.x, y: s0.current.y, rows: curRows }
                : null,
              ts: Date.now(),
            },
          }).catch((err) => { try { console.error('[versus] initial snapshot failed', err) } catch {} })
        } catch {}
        return
      }

      // Match over
      if (data.status === 'finished') {
        _mpMusicMgr?.stop()
        const myW  = (data.roundWins ?? {})[user?.uid] ?? 0
        const topW = Math.max(0, ...Object.values(data.roundWins ?? {}).map(Number))
        setRoundResult({
          won: myW >= topW && myW > 0,
          roundWins:   data.roundWins ?? {},
          matchWinner: data.matchWinner,
        })
        setScreen(SCREEN.RESULT)
        return
      }

      // During a live round
      if (lastSeenRoundRef.current > 0 && data.status === 'playing') {
        // Incoming garbage: compute delta per opponent
        let gotGarbage = false
        for (const p of (data.players ?? [])) {
          if (p.uid === user?.uid) continue
          const incoming = p.garbageSentTo?.[user?.uid] ?? 0
          const applied  = opponentGarbageRef.current[p.uid] ?? 0
          if (incoming > applied) {
            const self = data.players.find(pp => pp.uid === user?.uid)
            const buff = self?.buff ?? 0
            const nerf = self?.nerf ?? 0
            const delta = Math.max(0, (incoming - applied) + nerf - buff)
            engine.receiveGarbage(delta)
            opponentGarbageRef.current[p.uid] = incoming
            gotGarbage = true
          }
        }
        if (gotGarbage && screenRef.current === SCREEN.GAME) mpPlayGarbageIn()

        // Host-only: detect round end (≤1 player alive)
        if (isHost && !roundEndDoneRef.current) {
          const alive = data.players.filter(p => !p.gameOver)
          if (alive.length <= 1 && data.players.length > 1) {
            roundEndDoneRef.current = true
            _mpMusicMgr?.stop()
            const winnerUid = alive[0]?.uid
              ?? data.players.reduce((b, p) => (p.score > (b?.score ?? -1) ? p : b), data.players[0])?.uid
            const wonRound = winnerUid === user?.uid
            setRoundResult({ won: wonRound, roundWins: data.roundWins ?? {} })
            if (screenRef.current === SCREEN.GAME) setScreen(SCREEN.ROUND_END)
            // Delay 3s so players can see the round result before the next round starts
            clearTimeout(roundTimerRef.current)
            roundTimerRef.current = setTimeout(() => endRoundRef.current(data, winnerUid), 3000)
          }
        }
      }
    })

    unsubRef.current = unsub
    return () => unsub()
  }, [lobbyCode, isHost, user, engine, pickTarget]) // eslint-disable-line

  // ── Game rAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== SCREEN.GAME) return
    let frameId, lastTime = performance.now()

    const frame = (now) => {
      const dt      = Math.min(now - lastTime, MAX_FRAME_MS); lastTime = now
      const actions = actionRef.current
      actionRef.current = {}

      engine.update(dt, heldRef.current, actions)
      const ns   = engine.getState()
      const prev = prevStateRef.current
      setMyState(ns)

      // No WS stream sending in this build

      // SFX triggers (edge detection against prev frame)
      if (prev) {
        if (ns.hardDropped)               mpPlayHardDrop()
        else if (ns.pieceLocked)          mpPlayLock()
        if (ns.lastClear?.lines > 0)      mpPlayClear(ns.lastClear.lines)
        if (ns.pieceHeld)                 mpPlayHold()
        // Move / rotate: only fire when the SAME piece is moving (not on spawn)
        if (prev.current?.type === ns.current?.type) {
          if (ns.current?.x !== prev.current?.x)          mpPlayMove()
          else if (ns.current?.rotation !== prev.current?.rotation) mpPlayRotate()
        }
      }
      prevStateRef.current = ns

      // Zone LPF music effect
      if (prev?.zoneActive !== ns.zoneActive) _mpMusicMgr?.setZoneFx?.(ns.zoneActive)

      // Outgoing garbage — uses random target, re-rolls after each attack
      if (ns.lastGarbage > 0 && lobbyCode && currentTargetRef.current) {
        const tgt = currentTargetRef.current
        const self = lobbyRef.current?.players?.find(p => p.uid === user?.uid)
        const buff = self?.buff ?? 0
        const nerf = self?.nerf ?? 0
        const adjusted = Math.max(0, ns.lastGarbage + buff - nerf)
        garbageSentToRef.current[tgt] = (garbageSentToRef.current[tgt] ?? 0) + adjusted
        updateLobbyPlayer(lobbyCode, user.uid, {
          garbageSentTo: { ...garbageSentToRef.current },
          score: ns.score,
        }).catch((err) => { try { console.error('[versus] send garbage failed', err) } catch {} })
        if (lobbyRef.current) pickTarget(lobbyRef.current)  // pick a new random target
      }

      // Game over: write to Firestore, host's subscribeLobby will call endRound
      if (ns.gameOver) {
        if (lobbyCode) updateLobbyPlayer(lobbyCode, user.uid, { score: ns.score, gameOver: true }).catch(() => {})
        _mpMusicMgr?.stop()
        setRoundResult({ won: false, roundWins: lobbyRef.current?.roundWins ?? {} })
        setScreen(SCREEN.ROUND_END)
        return
      }

      // Periodic board snapshot for opponent preview
      if (lobbyCode && now - lastSnapRef.current > SNAP_INTERVAL_MS) {
        lastSnapRef.current = now
        updateLobbyPlayer(lobbyCode, user.uid, {
          score: ns.score,
          boardSnapshot: {
            boardRows: (ns.board || []).map(row => (row || []).map(c => c === null ? '.' : (c === 'GBG' ? 'G' : c)).join('')),
            current: ns.current
              ? { type: ns.current.type, x: ns.current.x, y: ns.current.y, rows: (ns.current.matrix || []).map(r => (r || []).map(v => (v ? '1' : '.')).join('')) }
              : null,
            ts: Date.now(),
          },
        }).catch((err) => { try { console.error('[versus] periodic snapshot failed', err) } catch {} })
      }

      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [screen]) // eslint-disable-line

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== SCREEN.GAME) return
    const down = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b) return
      ev.preventDefault(); if (ev.repeat) return
      if (b.held) heldRef.current[b.held] = true
      if (b.action) {
        if (b.action === 'mute') toggleMute()
        else if (b.action === 'mute') toggleMute()
        else actionRef.current[b.action] = true
      }
    }
    const up = (ev) => {
      const b = KEY_BINDINGS[ev.code]
      if (b?.held) { ev.preventDefault(); heldRef.current[b.held] = false }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [screen, togglePause, toggleMute])

  // ── Input callbacks ───────────────────────────────────────────────────────────
  const triggerAction  = useCallback((a) => { actionRef.current[a] = true }, [])
  const handlePress    = useCallback((k, held) => { if (held) heldRef.current[k] = true; else triggerAction(k) }, [triggerAction])
  const handleRelease  = useCallback((k) => { heldRef.current[k] = false }, [])

  const handleDragBegin = useCallback((dir) => {
    if (dir === 'left' || dir === 'right') handlePress(dir, true)
    else if (dir === 'down') handlePress('softDrop', true)
    else if (dir === 'up')   triggerAction('hold')
  }, [handlePress, triggerAction])
  const handleDragEnd = useCallback((dir) => {
    if (dir === 'left' || dir === 'right') handleRelease(dir)
    else if (dir === 'down') handleRelease('softDrop')
  }, [handleRelease])
  const handleHardDrop = useCallback(() => {
    handleRelease('softDrop'); triggerAction('hardDrop')
  }, [handleRelease, triggerAction])

  // ── Lobby actions ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    getMpAudio()  // prime AudioContext during user gesture
    const code = await createLobby(user.uid, displayName)
    setLobbyCode(code); setIsHost(true); setScreen(SCREEN.LOBBY)
  }
  const handleJoin = async (code) => {
    getMpAudio()  // prime AudioContext during user gesture
    await joinLobby(code, user.uid, displayName)
    setLobbyCode(code); setIsHost(false); setScreen(SCREEN.LOBBY)
  }
  const handleStart = async () => {
    getMpAudio()  // warm up context before Firestore fires
    if (lobbyCode) await setLobbyStatus(lobbyCode, 'playing')
  }
  const handleBestOfChange = async (n) => {
    if (lobbyCode) await setLobbyBestOf(lobbyCode, n)
  }
  const handleLeave = () => {
    clearTimeout(roundTimerRef.current)
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    lastSeenRoundRef.current = 0
    roundEndDoneRef.current  = false
    pausedRef.current        = false
    setPaused(false)
    // Host: archive lobby before leaving
    if (isHost && lobbyCode) archiveLobby(lobbyCode, { endedBy: user?.uid }).catch(() => {})
    setLobbyCode(null); setLobby(null)
    setScreen(SCREEN.PICK)
    _mpMusicMgr?.stop()
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const opponents    = (lobby?.players ?? []).filter(p => p.uid !== user?.uid)
  const roundWins    = lobby?.roundWins ?? {}
  const myWins       = roundWins[user?.uid] ?? 0
  const bestOf       = lobby?.bestOf ?? 3
  const currentRound = lobby?.currentRound ?? 1
  const winsNeeded   = Math.ceil(bestOf / 2)
  const leftWidth    = opponents.length > 4 ? 130 : 86

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a14', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace', color: '#fff', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, zIndex: 10, position: 'relative' }}>
        <button
          onClick={screen === SCREEN.GAME ? undefined : () => (screen === SCREEN.PICK ? navigate('/') : setScreen(SCREEN.PICK))}
          style={{ background: 'none', border: 'none', color: '#666', cursor: screen === SCREEN.GAME ? 'default' : 'pointer', fontSize: '0.72rem', letterSpacing: '0.14em', fontFamily: 'inherit', padding: 0, opacity: screen === SCREEN.GAME ? 0.3 : 1 }}
        >
          ← {screen === SCREEN.PICK ? 'MENU' : 'BACK'}
        </button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '0.2em', color: '#f97316' }}>VERSUS</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 60, justifyContent: 'flex-end' }}>
          {screen === SCREEN.GAME && (
            <button onClick={toggleMute} title={muted ? 'Unmute (M)' : 'Mute (M)'}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: muted ? '#444' : '#999', cursor: 'pointer', fontSize: '0.7rem', padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit' }}>
              {muted ? '🔇' : '🔊'}
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">

          {/* ── Pick ─────────────────────────────────────────────────────── */}
          {screen === SCREEN.PICK && (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.12em' }}>ONLINE VERSUS</div>
                <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 6, letterSpacing: '0.1em' }}>Up to 4 players — send garbage, survive</div>
              </div>
              {[
                { label: 'CREATE LOBBY', sub: 'Generate a room code',    color: '#f97316', onClick: () => setScreen(SCREEN.CREATE) },
                { label: 'JOIN LOBBY',   sub: 'Enter a code or scan QR', color: '#00d4ff', onClick: () => setScreen(SCREEN.JOIN)   },
              ].map(btn => (
                <motion.button key={btn.label} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }} onClick={btn.onClick}
                  style={{ width: '100%', maxWidth: 300, background: `${btn.color}14`, border: `1px solid ${btn.color}55`, borderRadius: 12, padding: '1.1rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.14em', color: btn.color }}>{btn.label}</div>
                  <div style={{ fontSize: '0.62rem', color: '#555', marginTop: 4, letterSpacing: '0.1em' }}>{btn.sub}</div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* ── Create ───────────────────────────────────────────────────── */}
          {screen === SCREEN.CREATE && (
            <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreateScreen onCreate={handleCreate} />
            </motion.div>
          )}

          {/* ── Join ─────────────────────────────────────────────────────── */}
          {screen === SCREEN.JOIN && (
            <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <JoinScreen onJoin={handleJoin} />
            </motion.div>
          )}

          {/* ── Lobby ────────────────────────────────────────────────────── */}
          {screen === SCREEN.LOBBY && lobby && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, overflowY: 'auto' }}>
              <WaitingRoom lobby={lobby} lobbyCode={lobbyCode} selfUid={user?.uid} isHost={isHost} onStart={handleStart} onLeave={handleLeave} onBestOfChange={handleBestOfChange} />
            </motion.div>
          )}

          {/* ── Game ─────────────────────────────────────────────────────── */}
          {screen === SCREEN.GAME && myState && (
            <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

              {/* HUD bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 10px', background: 'rgba(0,0,0,0.7)', flexShrink: 0, backdropFilter: 'blur(6px)', gap: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 68 }}>
                  <span style={{ fontSize: '0.46rem', color: '#666', letterSpacing: '0.1em' }}>RND {currentRound} of {bestOf}</span>
                  <span style={{ fontSize: '0.42rem', color: '#444', letterSpacing: '0.08em' }}>
                    P {Math.max(0, (lobby?.players || []).filter(p => !p.gameOver).length)} / {(lobby?.players || []).length}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: '#f97316', fontWeight: 700, letterSpacing: '0.06em' }}>
                    {myWins}&nbsp;–&nbsp;{opponents.map(o => roundWins[o.uid] ?? 0).join('–')}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span style={{ color: '#00d4ff', fontWeight: 700, fontSize: '0.72rem' }}>{myState.score.toLocaleString()}</span>
                  <span style={{ fontSize: '0.44rem', color: '#555', letterSpacing: '0.08em' }}>LVL {myState.level}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={toggleMute} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: muted ? '#444' : '#888', cursor: 'pointer', fontSize: '0.56rem', padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }}>
                    {muted ? '🔇' : '🔊'}
                  </button>
                </div>
              </div>

              {/* Main area */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>

                {/* Left column: opponent boards (grid) */}
                <div style={{ width: leftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '8px 6px', gap: 6, background: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>

                  {opponents.length === 0 && (
                    <div style={{ fontSize: '0.44rem', color: '#333', textAlign: 'center', letterSpacing: '0.08em', paddingTop: 6 }}>no opponent</div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 6 }}>
                    {opponents.map(opp => (
                      <OpponentBoard
                        key={opp.uid}
                        snapshot={opp.boardSnapshot}
                        displayName={opp.displayName}
                        score={opp.score}
                        wins={roundWins[opp.uid] ?? 0}
                        isTarget={opp.uid === (targetUid || currentTargetRef.current)}
                        onClick={() => selectTarget(opp.uid)}
                        compact={compactPreviews}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <div style={{ fontSize: '0.5rem', color: '#666', letterSpacing: '0.08em' }}>Tap a card to target</div>
                    {opponents.length > 4 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.52rem', color: '#888' }}>
                        Compact
                        <input type="checkbox" checked={!!compactPreviews} onChange={toggleCompact} />
                      </label>
                    )}
                  </div>

                  <div style={{ flex: 1 }} />

                  {myState.pendingGarbage > 0 && (
                    <div style={{ fontSize: '0.58rem', color: '#f87171', fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center' }}>
                      ↑{myState.pendingGarbage}
                    </div>
                  )}
                </div>

                {/* Canvas */}
                <div className="mobile-canvas-wrap" style={{ background: 'transparent', flex: 1, minWidth: 0 }}>
                  <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GameCanvas
                      state={myState}
                      onTap={() => triggerAction('rotateCW')}
                      onTwoFingerTap={() => {}}
                      onDragBegin={handleDragBegin}
                      onDragEnd={handleDragEnd}
                      onHardDrop={handleHardDrop}
                    />
                    {/* Pause overlay removed in Versus */}
                  </div>
                </div>

                {/* Right column: Hold + Next + Zone meter */}
                <div style={{ width: 72, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 6px', gap: 8, background: 'rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '0.45rem', color: '#555', letterSpacing: '0.12em' }}>HOLD</div>
                  <PieceMini type={myState.hold} size={10} />
                  <div style={{ flex: 1 }} />
                  <div style={{ fontSize: '0.45rem', color: '#555', letterSpacing: '0.12em' }}>NEXT</div>
                  {(myState.queue ?? []).slice(0, 3).map((type, i) => (
                    <PieceMini key={i} type={type} size={i === 0 ? 10 : 8} />
                  ))}
                  {/* Zone controls moved here */}
                  <button
                    onClick={() => triggerAction('activateZone')}
                    disabled={myState.zoneMeter < ZONE_MIN_METER || myState.zoneActive}
                    style={{
                      background: myState.zoneActive ? 'rgba(0,229,255,0.18)' : myState.zoneMeter >= ZONE_MIN_METER ? 'rgba(0,180,255,0.22)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${myState.zoneActive ? '#00e5ff' : myState.zoneMeter >= ZONE_MIN_METER ? '#00aaff' : 'rgba(255,255,255,0.1)'}`,
                      color: myState.zoneActive ? '#00e5ff' : myState.zoneMeter >= ZONE_MIN_METER ? '#80d4ff' : '#444',
                      borderRadius: 5, padding: '4px 6px',
                      cursor: myState.zoneMeter >= ZONE_MIN_METER && !myState.zoneActive ? 'pointer' : 'default',
                      fontSize: '0.52rem', letterSpacing: '0.08em', fontFamily: 'inherit', width: '100%', transition: 'all 0.2s',
                    }}
                  >
                    {myState.zoneActive ? '◈ ON' : 'ZONE'}
                  </button>
                  <div style={{ width: 10, height: 64, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${myState.zoneMeter}%`, background: myState.zoneActive ? '#00e5ff' : `hsl(${200 + myState.zoneMeter * 0.4}, 90%, 60%)`, transition: 'height 0.15s ease' }} />
                  </div>
                </div>
              </div>

              {showOnScreenControls && <TouchControls onPress={handlePress} onRelease={handleRelease} />}
            </motion.div>
          )}

          {/* ── Round end ─────────────────────────────────────────────────── */}
          {screen === SCREEN.ROUND_END && (
            <motion.div key="round-end" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <div style={{ textAlign: 'center', background: '#10101c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '2rem 2.5rem', maxWidth: 320 }}>
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>{roundResult?.won ? '🏆' : '💀'}</div>
                <div style={{ fontSize: '0.5rem', color: '#777', letterSpacing: '0.3em', marginBottom: 4 }}>ROUND {currentRound}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.14em', color: roundResult?.won ? '#22c55e' : '#f87171', marginBottom: '1.4rem' }}>
                  {roundResult?.won ? 'ROUND WIN' : 'ROUND LOST'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.2rem', marginBottom: '1.2rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#00d4ff' }}>{myWins}</div>
                    <div style={{ fontSize: '0.5rem', color: '#666' }}>YOU</div>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#333' }}>–</div>
                  {opponents.map(opp => (
                    <div key={opp.uid} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f97316' }}>{roundResult?.roundWins?.[opp.uid] ?? roundWins[opp.uid] ?? 0}</div>
                      <div style={{ fontSize: '0.5rem', color: '#666', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.displayName}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: '0.08em', marginBottom: '1.2rem' }}>
                  {isHost ? 'Next round starting in 3 s…' : 'Waiting for host…'}
                </div>
                <button onClick={handleLeave} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: '#666', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>
                  LEAVE MATCH
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Match result ──────────────────────────────────────────────── */}
          {screen === SCREEN.RESULT && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <div style={{ textAlign: 'center', background: '#10101c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '2rem 2.5rem', maxWidth: 340 }}>
                <div style={{ fontSize: '2.4rem', marginBottom: 6 }}>{roundResult?.matchWinner === user?.uid ? '🏆' : '💀'}</div>
                <div style={{ fontSize: '0.5rem', color: '#777', letterSpacing: '0.3em', marginBottom: 6 }}>MATCH COMPLETE</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.16em', color: roundResult?.matchWinner === user?.uid ? '#22c55e' : '#f87171', marginBottom: '1.6rem' }}>
                  {roundResult?.matchWinner === user?.uid ? 'VICTORY' : 'DEFEATED'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.4rem', marginBottom: '1.6rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#00d4ff' }}>{myWins}</div>
                    <div style={{ fontSize: '0.52rem', color: '#666' }}>YOU</div>
                  </div>
                  <div style={{ fontSize: '1rem', color: '#333' }}>–</div>
                  {opponents.map(opp => (
                    <div key={opp.uid} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f97316' }}>{roundResult?.roundWins?.[opp.uid] ?? 0}</div>
                      <div style={{ fontSize: '0.52rem', color: '#666', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.displayName}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: '1.5rem' }}>
                  {bestOf === 1 ? 'Single match' : `Best of ${bestOf} — first to ${winsNeeded}`}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={handleLeave} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>
                    LOBBY
                  </button>
                  <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.1em', fontFamily: 'inherit' }}>
                    MENU
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
