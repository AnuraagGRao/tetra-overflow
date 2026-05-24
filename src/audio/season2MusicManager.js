// ─── Season 2 Zodiac Boss Music Manager ───────────────────────────────────────
// Per-boss BGM pools drawn from src/audio/story_season_2/*.mp3
// API mirrors StoryMusicManager for compatibility with ZodiacLevelPage.

// ── Track catalogue ───────────────────────────────────────────────────────────
const TRACK_DEFS = [
  // aries (0-1)
  { file: 'Clear_the_Board_aries',                gain: 0.88 },
  { file: 'Top_Row_Velocity_aries',               gain: 0.88 },
  // taurus (2-3)
  { file: 'Greenery_and_Stone_taurus',            gain: 0.88 },
  { file: 'Patience_In_The_Wrist_taurus',         gain: 0.88 },
  // gemini (4-5)
  { file: 'Gemini_Rising_gemini',                 gain: 0.88 },
  { file: 'Mercury_Rising_gemini',                gain: 0.88 },
  // cancer (6-7)
  { file: 'Saltwater_Shelter_cancer',             gain: 0.88 },
  { file: 'The_Silver_Current_cancer',            gain: 0.88 },
  // leo (8-9)
  { file: 'Crown_Made_of_Fire_leo',               gain: 0.88 },
  { file: "Leo's_Crown_leo",                      gain: 0.88 },
  // virgo (10-11)
  { file: 'Clearing_The_Lines_virgo',             gain: 0.88 },
  { file: 'Vertical_Flow_virgo',                  gain: 0.88 },
  // libra (12-13)
  { file: 'Poise_in_the_Frame_libra',             gain: 0.88 },
  { file: 'The_Venusian_Flow_libra',              gain: 0.88 },
  // scorpio (14-15)
  { file: 'Obsidian_Apex_scorpio',                gain: 0.88 },
  { file: 'The_Sting_Is_The_Key_scorpio',         gain: 0.88 },
  // sagittarius (16-17)
  { file: 'Centaur_s_Aim_sagittarius',            gain: 0.88 },
  { file: "The_Archer's_Aim_sagittarius",         gain: 0.88 },
  // capricorn (18-19)
  { file: 'Zero_Margin_capricorn',                gain: 0.88 },
  { file: 'Iron_Geometry_capricorn',              gain: 0.88 },
  // aquarius (20-21)
  { file: 'Slipping_Like_Mercury_aquarius',       gain: 0.88 },
  { file: 'The_Waterbearer_aquarius',             gain: 0.88 },
  // pisces (22-23) — note: filenames use "pieces" spelling (files as-is)
  { file: 'Time_Is_A_Liquid_pieces',              gain: 0.88 },
  { file: 'Submerged_Geometry_pieces',            gain: 0.88 },
  // ophiuchus (24-25)
  { file: 'Thirteenth_Ascent_ophiuchus',          gain: 0.88 },
  { file: 'Thirteenth_Constellation_ophiuchus',   gain: 0.88 },
]

const BOSS_POOLS = {
  aries:       [0, 1],
  taurus:      [2, 3],
  gemini:      [4, 5],
  cancer:      [6, 7],
  leo:         [8, 9],
  virgo:       [10, 11],
  libra:       [12, 13],
  scorpio:     [14, 15],
  sagittarius: [16, 17],
  capricorn:   [18, 19],
  aquarius:    [20, 21],
  pisces:      [22, 23],
  ophiuchus:   [24, 25],
}

// Build URLs at module parse time so Vite can bundle the assets
const TRACK_URLS = TRACK_DEFS.map(t => ({
  url: new URL(`./story_season_2/${t.file}.mp3`, import.meta.url).href,
  gain: t.gain,
}))

export class Season2MusicManager {
  constructor(audioCtx) {
    this.ctx          = audioCtx
    this._source      = null
    this._trackGain   = null
    this._playing     = false
    this._smoothBeat  = 0
    this._currentIdx  = -1
    this._bossId      = null
    this._playlist    = []
    this._playlistPos = 0
    this._shuffleEachLoop  = true
    this._xFadeTimer  = null
    this._xfadeSec    = 1.6
    this._levelBpm    = 120
    this._baseBpm     = 120
    this._userVol     = 1.0
    this._buffers     = new Array(TRACK_URLS.length).fill(null)
    this._loaded      = new Array(TRACK_URLS.length).fill(false)

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
    TRACK_URLS.forEach(({ url }, i) => {
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => {
          this._buffers[i] = buf
          this._loaded[i]  = true
          if (this._playing && this._source === null && this._currentIdx === i) {
            this._playCurrent()
          }
        })
        .catch(() => { this._loaded[i] = true })
    })
  }

  _ensurePlaylist(bossId) {
    if (this._bossId === bossId && this._playlist.length > 0) return
    const pool = (BOSS_POOLS[bossId] || [0]).slice()
    const start = Math.floor(Math.random() * pool.length)
    this._playlist    = pool.slice(start).concat(pool.slice(0, start))
    this._playlistPos = 0
    this._bossId      = bossId
    this._currentIdx  = this._playlist[0]
  }

  // ── Public API (mirrors StoryMusicManager) ─────────────────────────────────

  /** Start or switch to a boss's music */
  playForBoss(bossId) {
    this._ensurePlaylist(bossId)
    this._playing = true
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})

    // Fade masterGain in
    const g = this.masterGain.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(this._userVol, this.ctx.currentTime + 0.6)

    this._playCurrent()
  }

  /** Same boss — no-op (keeps current track playing) */
  playForLevelContinuous(bossId) {
    if (this._bossId === bossId && this._playing) return
    this.playForBoss(bossId)
  }

  stop() {
    this._playing = false
    try { clearTimeout(this._xFadeTimer) } catch {}
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
    const target = on ? 800 : 18000
    this.lpf.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.12)
    const gain = on ? 0.35 : this._userVol
    this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.12)
  }

  setShuffleEachLoop(on) { this._shuffleEachLoop = on }
  getShuffleEachLoop()   { return this._shuffleEachLoop }

  setCrossfadeSeconds(s) { this._xfadeSec = Math.max(0.2, s) }

  getNowPlaying() {
    if (this._currentIdx < 0) return null
    const file = TRACK_DEFS[this._currentIdx]?.file || ''
    const title = file.replace(/_/g, ' ').replace(/\b(\w)/g, m => m.toUpperCase())
    return { title, idx: this._currentIdx }
  }

  getBeatEnergy() {
    if (!this._playing) return 0
    try {
      this.analyser.getByteFrequencyData(this._fftData)
      const binCount = Math.floor(this._fftData.length * 0.06)
      let sum = 0
      for (let i = 0; i < binCount; i++) sum += this._fftData[i]
      const raw = (sum / (binCount * 255)) * 2.2
      this._smoothBeat = this._smoothBeat * 0.72 + raw * 0.28
      return Math.min(1, this._smoothBeat)
    } catch { return 0 }
  }

  prev() {
    this._playlistPos = (this._playlistPos - 1 + this._playlist.length) % this._playlist.length
    this._playTrackAt(this._playlistPos)
  }
  next() {
    this._advance(false)
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _playCurrent() {
    if (!this._playing) return
    const idx = this._playlist[this._playlistPos]
    this._currentIdx = idx
    const buf = this._buffers[idx]
    if (!buf) {
      // Track failed to load (buffer is null but _loaded is true) or is still loading.
      // Avoid an infinite spin when the buffer failed: only retry while buffer is still
      // pending (not yet marked loaded). If already loaded but null (fetch error), skip
      // to the next track after a brief pause so we don't get stuck.
      if (this._loaded[idx] && !this._buffers[idx]) {
        // Buffer definitively failed — advance to next track
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
    this._source?.disconnect()
    this._trackGain?.disconnect()

    const tg = this.ctx.createGain()
    tg.gain.value = TRACK_URLS[idx].gain
    tg.connect(this.analyser)
    this._trackGain = tg

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop   = false
    try {
      const rate = Math.max(0.78, Math.min(1.28, (this._levelBpm || this._baseBpm) / this._baseBpm))
      src.playbackRate.value = rate
    } catch {}
    src.connect(tg)
    src.onended = () => {
      if (!this._playing || this._source !== src) return
      this._advance(false)
    }
    src.start()
    this._source = src

    // Dispatch now-playing toast
    try {
      const file  = TRACK_DEFS[idx]?.file || ''
      const name  = file.replace(/_/g, ' ').replace(/\b(\w)/g, m => m.toUpperCase())
      window.dispatchEvent(new CustomEvent('tetris:nowplaying', { detail: { name } }))
    } catch {}

    // Schedule crossfade
    try { clearTimeout(this._xFadeTimer) } catch {}
    const lead  = Math.max(0.2, this._xfadeSec)
    const waitMs = Math.max(0, (buf.duration - lead) * 1000)
    this._xFadeTimer = setTimeout(() => {
      if (!this._playing || this._source !== src) return
      this._advance(true)
    }, waitMs)
  }

  _playTrackAt(pos) {
    this._playlistPos = pos
    try { clearTimeout(this._xFadeTimer) } catch {}
    try { this._source?.stop(); this._source = null } catch {}
    this._playCurrent()
  }

  _advance(crossfade = false) {
    if (!this._playlist.length) return
    this._playlistPos = (this._playlistPos + 1) % this._playlist.length
    if (this._playlistPos === 0 && this._shuffleEachLoop && this._playlist.length > 1) {
      // Fisher-Yates shuffle on loop
      for (let i = this._playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[this._playlist[i], this._playlist[j]] = [this._playlist[j], this._playlist[i]]
      }
    }

    if (crossfade) {
      // Fade current out, start new
      const g = this.masterGain.gain
      g.cancelScheduledValues(this.ctx.currentTime)
      g.setValueAtTime(g.value, this.ctx.currentTime)
      g.linearRampToValueAtTime(0, this.ctx.currentTime + this._xfadeSec * 0.5)
      setTimeout(() => {
        if (!this._playing) return
        g.setValueAtTime(0, this.ctx.currentTime)
        g.linearRampToValueAtTime(this._userVol, this.ctx.currentTime + this._xfadeSec * 0.5)
        this._playCurrent()
      }, this._xfadeSec * 500)
    } else {
      this._playCurrent()
    }
  }
}
