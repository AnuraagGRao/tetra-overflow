// Story-mode background music with real-time beat detection via Web Audio AnalyserNode.
// Each chapter has a pool of 2–6 thematically matched tracks; a random one plays per session.
// Within a chapter, the same track continues across level transitions (seamless).
// getBeatEnergy() samples bass-frequency energy every frame and returns a smoothed 0–1 value
// that BackgroundCanvas uses to drive particle speed, glow, and atmosphere intensity.

// ── Track catalogue ───────────────────────────────────────────────────────────
const TRACK_DEFS = [
  // ── earth ──────────────────────────────────────────────────────────────────
  { file: 'Bedrock_Authority_earth',       gain: 0.85 },  //  0  ch1
  { file: 'Bedrock_Spine_earth',           gain: 0.85 },  //  1  ch1
  { file: 'Clay_Turned_to_Stone_earth',    gain: 0.85 },  //  2  ch1
  // ── water ──────────────────────────────────────────────────────────────────
  { file: 'Tidal_Pulse_water',             gain: 0.85 },  //  3  ch2
  { file: 'Beneath_The_Current_water',     gain: 0.85 },  //  4  ch2
  { file: 'Where_Shadows_Grow_water',      gain: 0.85 },  //  5  ch2
  // ── fire ───────────────────────────────────────────────────────────────────
  { file: 'Amber_Haze_fire',               gain: 0.85 },  //  6  ch3
  { file: 'Heat_of_the_Closing_Gate_fire', gain: 0.85 },  //  7  ch3
  { file: 'The_Final_Ascent_fire',         gain: 0.85 },  //  8  ch3
  { file: 'Final_Boss_Pursuit_fire',       gain: 0.85 },  //  9  ch3
  // ── air ────────────────────────────────────────────────────────────────────
  { file: 'The_Velvet_Blue_air',           gain: 0.85 },  // 10  ch4
  { file: 'Horizon_Drift_air',             gain: 0.85 },  // 11  ch4
  { file: 'Weightless_Ascent_air',         gain: 0.85 },  // 12  ch4
  // ── cosmos ─────────────────────────────────────────────────────────────────
  { file: 'The_Last_Orbit_cosmos',         gain: 0.85 },  // 13  ch5
  { file: 'Logic_Into_Trust_cosmos',       gain: 0.85 },  // 14  ch5
  { file: 'The_Center_Pulls_cosmos',       gain: 0.85 },  // 15  ch5
  { file: 'One_Last_Arc_cosmos',           gain: 0.85 },  // 16  ch5
  { file: 'One_Last_Arc_p2_cosmos',        gain: 0.85 },  // 17  ch5
  { file: 'Celestial_Math_cosmos',         gain: 0.85 },  // 18  ch5
  // ── void ───────────────────────────────────────────────────────────────────
  { file: 'Gravity_s_Last_Pull_void',      gain: 0.85 },  // 19  ch6
  { file: 'The_Loop_Resolves_void',        gain: 0.85 },  // 20  ch6
  // ── convergence ────────────────────────────────────────────────────────────
  { file: 'Alpha_and_Omega_convergence',   gain: 0.85 },  // 21  ch7
  { file: 'Pattern_Lock_convergence',      gain: 0.85 },  // 22  ch7
  { file: 'The_Final_Arc_convergence',     gain: 0.85 },  // 23  ch7
  { file: 'Ultra_Mind_convergence',        gain: 0.85 },  // 24  ch7
  { file: 'Geometry_Bends_convergence',    gain: 0.85 },  // 25  ch7
]

// Chapter → pool of track indices. A random one is chosen at chapter entry;
// the same track continues across level transitions within the same chapter.
const CHAPTER_POOLS = {
  ch1: [0, 1, 2],
  ch2: [3, 4, 5],
  ch3: [6, 7, 8, 9],
  ch4: [10, 11, 12],
  ch5: [13, 14, 15, 16, 17, 18],
  ch6: [19, 20],
  ch7: [21, 22, 23, 24, 25],
}

// URLs resolved at Vite parse time (bundled as assets)
const TRACK_URLS = TRACK_DEFS.map(t => ({
  url: new URL(`./story/${t.file}.mp3`, import.meta.url).href,
  gain: t.gain,
}))

// ── Manager class ─────────────────────────────────────────────────────────────
export class StoryMusicManager {
  constructor(audioCtx) {
    this.ctx         = audioCtx
    this._source     = null
    this._trackGain  = null
    this._playing    = false
    this._smoothBeat = 0
    this._currentIdx = -1
    this._chapterId  = null
    this._playlist   = []   // array of track indices for current chapter (rotated from a random start)
    this._playlistPos= 0    // position within playlist
    this._shuffleEachLoop = true
    this._xFadeTimer = null
    this._xfadeSec = 1.6
    this._buffers    = new Array(TRACK_URLS.length).fill(null)
    this._loaded     = new Array(TRACK_URLS.length).fill(false)

    // Audio graph: source → trackGain → analyser → masterGain → destination
    this.masterGain = audioCtx.createGain()
    this.masterGain.gain.value = 0

    this.analyser = audioCtx.createAnalyser()
    this.analyser.fftSize = 512                 // 256 frequency bins
    this.analyser.smoothingTimeConstant = 0.65  // moderate smoothing from Web Audio
    this._fftData = new Uint8Array(this.analyser.frequencyBinCount)

    this.volumeGain = audioCtx.createGain()
    this.volumeGain.gain.value = 1.0

    this.analyser.connect(this.masterGain)
    this.masterGain.connect(this.volumeGain)
    this.volumeGain.connect(audioCtx.destination)

    this._loadAll()
  }

  // ── Asset loading ───────────────────────────────────────────────────────────
  _loadAll() {
    TRACK_URLS.forEach(({ url }, i) => {
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => {
          this._buffers[i] = buf
          this._loaded[i]  = true
          // If we were already asked to play this track, start it now
          if (this._playing && this._source === null && this._currentIdx === i) {
            this._playIndex(i)
          }
        })
        .catch(() => { this._loaded[i] = true }) // graceful degradation
    })
  }

  // ── Track selection / playlist ─────────────────────────────────────────────
  /** Ensure a playlist exists for the given chapter; rotate from a random start. */
  _ensurePlaylist(chapterId) {
    if (this._chapterId === chapterId && this._playlist.length > 0) return
    const pool = CHAPTER_POOLS[chapterId] && CHAPTER_POOLS[chapterId].slice()
    if (!pool || pool.length === 0) {
      // Fallback: map chapter number deterministically to any track
      const chNum = parseInt((chapterId||'').replace('ch', '')) || 1
      this._playlist = [ (chNum - 1) % TRACK_URLS.length ]
    } else {
      const start = Math.floor(Math.random() * pool.length)
      this._playlist = pool.slice(start).concat(pool.slice(0, start))
    }
    this._playlistPos = 0
    this._chapterId = chapterId
    this._currentIdx = this._playlist[this._playlistPos]
  }

  // ── Playback ────────────────────────────────────────────────────────────────
  _playCurrent() {
    if (!this._playing) return
    const idx = this._playlist[this._playlistPos]
    this._currentIdx = idx
    const buf = this._buffers[idx]
    if (!buf) {
      // Buffer not ready yet — poll until loaded
      const poll = setInterval(() => {
        if (!this._playing) { clearInterval(poll); return }
        if (this._loaded[idx]) {
          clearInterval(poll)
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
    src.loop   = false // play once; we'll advance to next track on end
    src.connect(tg)
    src.onended = () => {
      if (!this._playing) return
      // If onended fires (no crossfade scheduled), advance to next track
      if (this._source === src) this._advance(false)
    }
    src.start()
    this._source = src

    // Schedule crossfade before end, if buffer is known and we're playing
    try { clearTimeout(this._xFadeTimer) } catch {}
    const sec = buf.duration
    const startAt = this.ctx.currentTime
    // Use setTimeout wall clock; okay for approximate scheduling
    const lead = Math.max(0.2, this._xfadeSec)
    const waitMs = Math.max(0, (sec - lead) * 1000)
    this._xFadeTimer = setTimeout(() => {
      if (!this._playing) return
      if (this._source !== src) return
      this._advance(true) // crossfade into next
    }, waitMs)
  }

  _advance(crossfade = false) {
    if (!this._playlist.length) return
    this._playlistPos = (this._playlistPos + 1) % this._playlist.length
    if (this._playlistPos === 0 && this._shuffleEachLoop && this._playlist.length > 1) {
      // Fisher-Yates shuffle, then keep current position at 0
      for (let i = this._playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this._playlist[i], this._playlist[j]] = [this._playlist[j], this._playlist[i]]
      }
      this._playlistPos = 0
    }
    this._currentIdx = this._playlist[this._playlistPos]
    if (!crossfade || !this._source || !this._trackGain) {
      this._playCurrent(); return
    }
    // Crossfade: ramp down current, ramp up next, then swap references
    const nextIdx = this._currentIdx
    const nextBuf = this._buffers[nextIdx]
    if (!nextBuf) { this._playCurrent(); return }
    const nextGain = this.ctx.createGain()
    nextGain.gain.value = 0
    nextGain.connect(this.analyser)
    const nextSrc = this.ctx.createBufferSource()
    nextSrc.buffer = nextBuf
    nextSrc.loop = false
    nextSrc.connect(nextGain)
    nextSrc.start()

    const t = this.ctx.currentTime
    const fade = this._xfadeSec
    // ramp current down
    try {
      this._trackGain.gain.cancelScheduledValues(t)
      this._trackGain.gain.setValueAtTime(this._trackGain.gain.value, t)
      this._trackGain.gain.linearRampToValueAtTime(0, t + fade)
    } catch {}
    // ramp next up to its nominal gain
    try {
      nextGain.gain.cancelScheduledValues(t)
      nextGain.gain.setValueAtTime(0, t)
      nextGain.gain.linearRampToValueAtTime(TRACK_URLS[nextIdx].gain, t + fade)
    } catch {}

    // After fade, stop old source and adopt next
    setTimeout(() => {
      if (!this._playing) { try { nextSrc.stop() } catch {}; return }
      try { this._source?.stop() } catch {}
      this._source?.disconnect(); this._trackGain?.disconnect()
      this._source = nextSrc; this._trackGain = nextGain
      // schedule crossfade for the newly adopted source
      try { clearTimeout(this._xFadeTimer) } catch {}
      const sec = nextBuf.duration
      const lead = Math.max(0.2, this._xfadeSec)
      const waitMs = Math.max(0, (sec - lead) * 1000)
      this._xFadeTimer = setTimeout(() => {
        if (!this._playing) return
        if (this._source !== nextSrc) return
        this._advance(true)
      }, waitMs)
    }, this._xfadeSec * 1000)
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Start chapter playlist at a random track, with a 1.2 s fade-in. */
  playForLevel(chapterId, levelId) { // levelId kept for API compat — not used for selection
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this._playing    = true
    this._ensurePlaylist(chapterId)
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(0, t)
    this.masterGain.gain.linearRampToValueAtTime(0.85, t + 1.2)
    this._playCurrent()
  }

  /**
   * Like playForLevel but keeps the current track playing if it already belongs
   * to the new chapter's pool — so music is uninterrupted during seamless
   * level transitions within the same chapter.
   * Switches to a new random track only when the chapter changes.
   */
  playForLevelContinuous(chapterId, levelId) {
    const pool = CHAPTER_POOLS[chapterId] ?? []
    // Same chapter: keep current playlist/track
    if (this._playing && this._chapterId === chapterId && pool.includes(this._currentIdx)) return
    // Chapter changed: rebuild playlist and start
    this._chapterId = null
    this._playlist = []
    this._playlistPos = 0
    this.playForLevel(chapterId, levelId)
  }

  /** Fade out and stop. Safe to call multiple times. */
  stop() {
    if (!this._playing) return
    this._playing = false
    try { clearTimeout(this._xFadeTimer) } catch {}
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(0, t + 0.5)
    setTimeout(() => {
      try { this._source?.stop() } catch {}
      this._source    = null
      this._trackGain = null
    }, 600)
  }

  /** Mute without stopping (game paused). */
  pause() {
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(0, t + 0.15)
    // Also suspend the context to freeze playback time and avoid advancing tracks while paused
    try { this.ctx.suspend?.() } catch {}
  }

  /** Restore volume after pause. */
  resume() {
    if (!this._playing) return
    if (this.ctx.state === 'suspended') { try { this.ctx.resume() } catch {} }
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(0.85, t + 0.3)
  }

  // ── Media controls / metadata ─────────────────────────────────────────────
  next() { if (!this._playing) return; this._advance(true) }
  prev() {
    if (!this._playing || !this._playlist.length) return
    this._playlistPos = (this._playlistPos - 2 + this._playlist.length) % this._playlist.length
    this._advance(true)
  }
  setShuffleEachLoop(v) { this._shuffleEachLoop = !!v }
  getShuffleEachLoop() { return !!this._shuffleEachLoop }
  setCrossfadeSeconds(sec) { this._xfadeSec = Math.max(0.2, Math.min(8, Number(sec)||0)) }
  setVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)||0))
    this.volumeGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }
  getVolume() { return this.volumeGain?.gain?.value ?? 1 }
  getNowPlaying() {
    const idx = this._currentIdx
    if (idx < 0) return null
    const file = TRACK_DEFS[idx]?.file || ''
    const title = file.replace(/_/g,' ').replace(/\b(\w)/g, (m)=>m.toUpperCase())
    return { idx, title, chapterId: this._chapterId }
  }

  /**
   * Sample bass-frequency energy and return a smoothed 0–1 value.
   * Call every rAF frame; drives BackgroundCanvas beat-reactive effects.
   * Uses bins 0–7 ≈ 0–344 Hz (fftSize=512, 44100 Hz sample rate).
   */
  getBeatEnergy() {
    if (!this._playing) return 0
    this.analyser.getByteFrequencyData(this._fftData)
    let sum = 0
    for (let i = 0; i < 8; i++) sum += this._fftData[i]
    const raw = sum / (8 * 255)
    // Two-stage smoothing: Web Audio does one pass (smoothingTimeConstant=0.65),
    // we add a second EMA here for a slightly laggy but satisfying pulse.
    this._smoothBeat = this._smoothBeat * 0.72 + raw * 0.28
    return this._smoothBeat
  }
}
