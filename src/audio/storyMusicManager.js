// Story-mode background music with real-time beat detection via Web Audio AnalyserNode.
// Each chapter has 1–3 assigned tracks; the level's track loops for the duration of play.
// getBeatEnergy() samples bass-frequency energy every frame and returns a smoothed 0–1 value
// that BackgroundCanvas uses to drive particle speed, glow, and atmosphere intensity.

// ── Track catalogue ───────────────────────────────────────────────────────────
const TRACK_DEFS = [
  { file: 'Bedrock_Authority', gain: 0.85 },   // 0  – ch1
  { file: 'Tidal_Pulse',       gain: 0.85 },   // 1  – ch2
  { file: 'Amber_Haze',        gain: 0.85 },   // 2  – ch3-l1/l3
  { file: 'Pattern_Lock',      gain: 0.85 },   // 3  – ch3-l2/l4
  { file: 'The_Velvet_Blue',   gain: 0.85 },   // 4  – ch4
  { file: 'The_Last_Orbit',    gain: 0.85 },   // 5  – ch5-l1/l3
  { file: 'Logic_Into_Trust',  gain: 0.85 },   // 6  – ch5-l2/l4
  { file: 'Alpha_and_Omega',   gain: 0.85 },   // 7  – ch6-l1/l3
  { file: 'The_Loop_Resolves', gain: 0.85 },   // 8  – ch6-l2
  { file: 'The_Final_Arc',     gain: 0.85 },   // 9  – ch7-l1/l4
  { file: 'Ultra_Mind',        gain: 0.85 },   // 10 – ch7-l2/l5
  { file: 'One_Last_Arc',      gain: 0.85 },   // 11 – ch7-l3
]

// Chapter → track indices (level cycles through them by level number)
const CHAPTER_MAP = {
  ch1: [0],
  ch2: [1],
  ch3: [2, 3],
  ch4: [4],
  ch5: [5, 6],
  ch6: [7, 8],
  ch7: [9, 10, 11],
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
    this._buffers    = new Array(TRACK_URLS.length).fill(null)
    this._loaded     = new Array(TRACK_URLS.length).fill(false)

    // Audio graph: source → trackGain → analyser → masterGain → destination
    this.masterGain = audioCtx.createGain()
    this.masterGain.gain.value = 0

    this.analyser = audioCtx.createAnalyser()
    this.analyser.fftSize = 512                 // 256 frequency bins
    this.analyser.smoothingTimeConstant = 0.65  // moderate smoothing from Web Audio
    this._fftData = new Uint8Array(this.analyser.frequencyBinCount)

    this.analyser.connect(this.masterGain)
    this.masterGain.connect(audioCtx.destination)

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

  // ── Track selection ─────────────────────────────────────────────────────────
  _pickIndex(chapterId, levelId) {
    const indices = CHAPTER_MAP[chapterId]
    if (!indices?.length) {
      const chNum = parseInt(chapterId.replace('ch', '')) || 1
      return (chNum - 1) % TRACK_URLS.length
    }
    const lvNum = parseInt(levelId.replace('l', '')) || 1
    return indices[(lvNum - 1) % indices.length]
  }

  // ── Playback ────────────────────────────────────────────────────────────────
  _playIndex(idx) {
    if (!this._playing) return
    const buf = this._buffers[idx]
    if (!buf) {
      // Buffer not ready yet — poll until loaded
      const poll = setInterval(() => {
        if (this._loaded[idx]) {
          clearInterval(poll)
          if (this._playing && this._currentIdx === idx) this._playIndex(idx)
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
    src.loop   = true // loop for the full level duration
    src.connect(tg)
    src.start()
    this._source = src
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Start the track assigned to this chapter+level, with a 1.2 s fade-in. */
  playForLevel(chapterId, levelId) {
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this._playing    = true
    this._currentIdx = this._pickIndex(chapterId, levelId)
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(0, t)
    this.masterGain.gain.linearRampToValueAtTime(0.85, t + 1.2)
    this._playIndex(this._currentIdx)
  }

  /**
   * Like playForLevel but skips the switch if the same track is already playing.
   * Call this during seamless level transitions so music continues uninterrupted
   * when consecutive levels share the same track index.
   */
  playForLevelContinuous(chapterId, levelId) {
    const newIdx = this._pickIndex(chapterId, levelId)
    if (newIdx === this._currentIdx && this._playing) return  // same track — keep playing
    this.playForLevel(chapterId, levelId)
  }

  /** Fade out and stop. Safe to call multiple times. */
  stop() {
    if (!this._playing) return
    this._playing = false
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
  }

  /** Restore volume after pause. */
  resume() {
    if (!this._playing) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(0.85, t + 0.3)
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
