// Multiplayer lobby + match music manager.
// Lobby track: Before_the_Match.mp3
// Match track: Margin_Of_Error.mp3
// Both files exist in src/audio/multiplayer/ — separate from the general BGM pool.

const LOBBY_URL = new URL('./multiplayer/Before_the_Match.mp3', import.meta.url).href
const MATCH_URL  = new URL('./multiplayer/Margin_Of_Error.mp3',  import.meta.url).href

let _ctx    = null
let _gain   = null        // master GainNode
let _source = null        // current BufferSourceNode
let _current = null       // 'lobby' | 'match' | null
let _lobbyBuf = null
let _matchBuf = null
let _targetVol = 0.85

// ── Internal helpers ──────────────────────────────────────────────────────────

function _getCtx() {
  if (_ctx) {
    if (_ctx.state === 'suspended') _ctx.resume()
    return _ctx
  }
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  _ctx = new Ctx()
  _gain = _ctx.createGain()
  _gain.gain.value = _targetVol
  _gain.connect(_ctx.destination)
  // Pre-fetch both tracks so they're ready
  _fetchBuf(LOBBY_URL, buf => { _lobbyBuf = buf })
  _fetchBuf(MATCH_URL,  buf => { _matchBuf = buf })
  return _ctx
}

function _fetchBuf(url, cb) {
  fetch(url)
    .then(r => r.arrayBuffer())
    .then(ab => _ctx.decodeAudioData(ab))
    .then(cb)
    .catch(() => {})
}

function _playBuf(buf, trackName) {
  const ctx = _getCtx()
  if (!ctx || !buf) return
  _stopSource()
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.connect(_gain)
  src.start()
  _source  = src
  _current = trackName
}

function _stopSource() {
  try { _source?.stop() } catch {}
  _source  = null
  _current = null
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Play the lobby waiting-room track (idempotent — no restart if already playing). */
export function mpPlayLobbyMusic() {
  _getCtx() // prime context on user-gesture
  if (_current === 'lobby') return
  if (_lobbyBuf) {
    _playBuf(_lobbyBuf, 'lobby')
  } else {
    // Not loaded yet — fetch then play (if still wanted)
    const ctx = _getCtx()
    if (!ctx) return
    _fetchBuf(LOBBY_URL, buf => {
      _lobbyBuf = buf
      if (_current !== 'lobby') _playBuf(buf, 'lobby')
    })
  }
}

/** Play the in-game match track (idempotent — no restart if already playing). */
export function mpPlayMatchMusic() {
  _getCtx()
  if (_current === 'match') return
  if (_matchBuf) {
    _playBuf(_matchBuf, 'match')
  } else {
    const ctx = _getCtx()
    if (!ctx) return
    _fetchBuf(MATCH_URL, buf => {
      _matchBuf = buf
      if (_current !== 'match') _playBuf(buf, 'match')
    })
  }
}

/** Fade out and stop all multiplayer music. */
export function mpStopMusic() {
  if (!_current) return
  if (_ctx && _gain) {
    // Quick 300ms fade out
    const now = _ctx.currentTime
    _gain.gain.setValueAtTime(_gain.gain.value, now)
    _gain.gain.linearRampToValueAtTime(0, now + 0.3)
    setTimeout(() => {
      _stopSource()
      if (_gain) _gain.gain.value = _targetVol // restore for next play
    }, 320)
  } else {
    _stopSource()
  }
}

/** Set volume (0–1). Applies immediately. */
export function mpSetMusicVolume(v) {
  _targetVol = Math.max(0, Math.min(1, v))
  if (_gain) _gain.gain.value = _targetVol
}

/** Mute / unmute multiplayer music. */
export function mpMuteMusic(muted) {
  if (_gain) _gain.gain.value = muted ? 0 : _targetVol
}
