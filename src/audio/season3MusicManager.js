// ─── Season 3 Music Manager ────────────────────────────────────────────────────
// Plays BGM for Season 3 Temporal Fracture levels.
// Audio files live in src/audio/story_season_3/*.mp3
// If a file is missing the fetch fails silently — game plays without BGM.
//
// API intentionally mirrors Season2MusicManager so Season3LevelPage can use
// the same musicRef interface.

const EPOCH_TRACK_DEFS = [
  // e1 — System Degradation (indices 0-3)
  { file: 'Clockwork_Failure_e1',      gain: 0.88 },
  { file: 'Peak_Operational_Load_e1',  gain: 0.88 },
  { file: 'Terminal_Overload_e1',      gain: 0.88 },
  { file: 'Unscheduled_Shutdown_e1',   gain: 0.88 },
  // e2 — The Regression (indices 4-7)
  { file: 'After_the_Power_Dies_e2',       gain: 0.88 },
  { file: 'Before_The_Screen_Went_Dark_e2', gain: 0.88 },
  { file: 'Controller_Disconnected_e2',    gain: 0.88 },
  { file: 'Midnight_Assembly_e2',          gain: 0.88 },
  // e3 — The Overclock (indices 8-11)
  { file: 'Biological_Tax_e3',    gain: 0.88 },
  { file: 'Heart_Is_A_Machine_e3', gain: 0.88 },
  { file: 'Maximum_Load_e3',      gain: 0.88 },
  { file: 'Systemic_Entropy_e3',  gain: 0.88 },
  // e4 — Kernel Panic (indices 12-17)
  { file: 'Critical_Overload_e4',          gain: 0.88 },
  { file: 'Kernel_Panic_e4',               gain: 0.88 },
  { file: 'Maximum_Thermal_Load_e4',       gain: 0.88 },
  { file: 'Midnight_at_Degrees_e4',        gain: 0.88 },
  { file: 'Relentless_Collapse_e4',        gain: 0.88 },
  { file: 'Thermal_Throttling_e4',         gain: 0.88 },
  // Generic S3 track (index 18) — used as overflow / fallback
  { file: 'Maximum_Thermal_Load_Two_s3',   gain: 0.88 },
]

const EPOCH_POOLS = {
  e1: [0, 1, 2, 3],
  e2: [4, 5, 6, 7],
  e3: [8, 9, 10, 11],
  e4: [12, 13, 14, 15, 16, 17, 18],
}

// Build URL list the same way as season2MusicManager — Vite resolves these correctly
// in both dev and prod builds and handles asset hashing automatically.
const TRACK_URLS = EPOCH_TRACK_DEFS.map(({ file }) =>
  new URL(`./story_season_3/${file}.mp3`, import.meta.url).href
)

export class Season3MusicManager {
  constructor(audioCtx) {
    this.ctx          = audioCtx
    this._source      = null
    this._playing     = false
    this._currentIdx  = -1
    this._epochId     = null
    this._playlist    = []
    this._playlistPos = 0
    this._xFadeTimer  = null
    this._xfadeSec    = 1.6
    this._levelBpm    = 120
    this._userVol     = 1.0
    this._buffers     = new Array(EPOCH_TRACK_DEFS.length).fill(null)
    this._loaded      = new Array(EPOCH_TRACK_DEFS.length).fill(false)
    this._smoothBeat  = 0

    // Audio graph: source → trackGain → analyser → masterGain → lpf → volumeGain → dest
    this.masterGain = audioCtx.createGain()
    this.masterGain.gain.value = 0

    this.analyser = audioCtx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.65
    this._fftData = new Uint8Array(this.analyser.frequencyBinCount)

    this.lpf = audioCtx.createBiquadFilter()
    this.lpf.type = 'lowpass'
    this.lpf.frequency.value = 18000

    this.volumeGain = audioCtx.createGain()
    this.volumeGain.gain.value = 1.0

    this.analyser.connect(this.masterGain)
    this.masterGain.connect(this.lpf)
    this.lpf.connect(this.volumeGain)
    this.volumeGain.connect(audioCtx.destination)

    this._loadAll()
  }

  _loadAll() {
    EPOCH_TRACK_DEFS.forEach(({ gain }, i) => {
      const url = TRACK_URLS[i]
      fetch(url)
        .then(r => { if (!r.ok) throw new Error('not found'); return r.arrayBuffer() })
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => {
          this._buffers[i] = buf
          this._loaded[i]  = true
          if (this._playing && this._source === null && this._currentIdx === i) {
            this._playCurrent()
          }
        })
        .catch(() => { this._loaded[i] = true })  // fail silently
    })
  }

  _ensurePlaylist(epochId) {
    if (this._epochId === epochId && this._playlist.length > 0) return
    const pool  = (EPOCH_POOLS[epochId] || EPOCH_POOLS['e1']).slice()
    const start = Math.floor(Math.random() * pool.length)
    this._playlist    = pool.slice(start).concat(pool.slice(0, start))
    this._playlistPos = 0
    this._epochId     = epochId
    this._currentIdx  = this._playlist[0]
  }

  _playCurrent() {
    const idx = this._currentIdx
    const buf = this._buffers[idx]
    if (!buf) {
      if (this._loaded[idx] && !this._buffers[idx]) {
        this._advance(false)
        return
      }
      const poll = setInterval(() => {
        if (!this._playing) { clearInterval(poll); return }
        if (this._loaded[idx]) {
          clearInterval(poll)
          if (!this._buffers[idx]) { this._advance(false); return }
          if (this._playing && this._currentIdx === idx) this._playCurrent()
        }
      }, 100)
      return
    }

    try { this._source?.stop() } catch {}
    const src = this.ctx.createBufferSource()
    src.buffer  = buf
    src.loop    = false

    const gain = this.ctx.createGain()
    gain.gain.value = EPOCH_TRACK_DEFS[idx]?.gain ?? 0.88
    src.connect(gain)
    gain.connect(this.analyser)

    const fadeIn  = Math.min(this._xfadeSec, buf.duration * 0.25)
    const fadeOut = Math.min(this._xfadeSec, buf.duration * 0.2)
    const now = this.ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(EPOCH_TRACK_DEFS[idx]?.gain ?? 0.88, now + fadeIn)
    gain.gain.setValueAtTime(EPOCH_TRACK_DEFS[idx]?.gain ?? 0.88, now + buf.duration - fadeOut)
    gain.gain.linearRampToValueAtTime(0, now + buf.duration)

    this._source = src
    src.start(0)
    clearTimeout(this._xFadeTimer)
    this._xFadeTimer = setTimeout(() => {
      if (!this._playing) return
      this._advance(true)
    }, (buf.duration - Math.min(this._xfadeSec, buf.duration * 0.15)) * 1000)
  }

  _advance(crossfade) {
    this._playlistPos = (this._playlistPos + 1) % this._playlist.length
    this._currentIdx  = this._playlist[this._playlistPos]
    if (this._playing) this._playCurrent()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  playForEpoch(epochId) {
    this._ensurePlaylist(epochId)
    this._playing = true
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    const g = this.masterGain.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(this._userVol, this.ctx.currentTime + 0.6)
    this._playCurrent()
  }

  stop() {
    this._playing = false
    clearTimeout(this._xFadeTimer)
    const g = this.masterGain.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(0, this.ctx.currentTime + 0.55)
    setTimeout(() => {
      try { this._source?.stop(); this._source = null } catch {}
    }, 600)
  }

  pause()  { try { this.ctx.suspend() } catch {} }
  resume() { try { this.ctx.resume()  } catch {} }

  prev() {
    this._playlistPos = (this._playlistPos - 2 + this._playlist.length) % this._playlist.length
    this._advance(false)
  }

  next() { this._advance(false) }

  setVolume(v) {
    this._userVol = Math.max(0, Math.min(1, v))
    if (this._playing) {
      const g = this.masterGain.gain
      g.cancelScheduledValues(this.ctx.currentTime)
      g.linearRampToValueAtTime(this._userVol, this.ctx.currentTime + 0.08)
    }
  }

  setLevelBpm(bpm) { this._levelBpm = bpm }

  setZoneFx(on) {
    const target = on ? 600 : 18000
    this.lpf.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.12)
    const gain = on ? 0.30 : this._userVol
    this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.12)
  }

  getBeatEnergy() {
    try {
      this.analyser.getByteFrequencyData(this._fftData)
      let sum = 0
      for (let i = 0; i < 12; i++) sum += this._fftData[i]
      const raw = sum / (12 * 255)
      this._smoothBeat = this._smoothBeat * 0.7 + raw * 0.3
      return this._smoothBeat
    } catch { return 0 }
  }
}
