// Background music using pre-recorded MP3 tracks + Web Audio one-shot SFX.
// Per-track gain — adjust these values if a track sounds louder/quieter than the rest.
const TRACKS = [
  { url: new URL('./Full_Throttle_Logic.mp3',    import.meta.url).href, gain: 0.85 },
  { url: new URL('./Gravity_s_Last_Descent.mp3', import.meta.url).href, gain: 0.75 },
  { url: new URL('./Perfect_Rotation.mp3',       import.meta.url).href, gain: 0.90 },
  { url: new URL('./The_Last_Key.mp3',           import.meta.url).href, gain: 0.80 },
  { url: new URL('./The_Winning_Move.mp3',       import.meta.url).href, gain: 0.85 },
]

export class MusicManager {
  constructor(audioCtx) {
    this.ctx        = audioCtx
    this.playing    = false
    this.trackIndex = 0
    this._source    = null   // current AudioBufferSourceNode
    this._trackGain = null   // per-track normalisation GainNode
    this._buffers   = new Array(TRACKS.length).fill(null)
    this._loaded    = new Array(TRACKS.length).fill(false)
    this._targetVol = 0.9   // master volume target while playing
    this._repeatCount = 0   // how many times current track has played
    this._maxRepeats  = 2   // play each track 2–3 times (randomised per track)

    // Audio graph: trackGain -> masterGain -> lpf -> volumeGain -> destination
    this.masterGain = audioCtx.createGain()
    this.masterGain.gain.value = 0

    this.lpf = audioCtx.createBiquadFilter()
    this.lpf.type = 'lowpass'
    this.lpf.frequency.value = 18000
    this.lpf.Q.value = 0.7

    this.volumeGain = audioCtx.createGain()
    this.volumeGain.gain.value = 1.0

    this.masterGain.connect(this.lpf)
    this.lpf.connect(this.volumeGain)
    this.volumeGain.connect(audioCtx.destination)

    this._loadAll()
  }

  // -- Asset loading ----------------------------------------------------------
  _loadAll() {
    TRACKS.forEach(({ url }, i) => {
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => {
          this._buffers[i] = buf
          this._loaded[i]  = true
          // If we are playing and were waiting for this track, start it now
          if (this.playing && this._source === null && this.trackIndex === i) {
            this._playIndex(i)
          }
        })
        .catch(e => {
          console.warn('MusicManager: failed to load track', i, url, e)
          this._loaded[i] = true
        })
    })
  }

  // -- Playback ---------------------------------------------------------------
  _playIndex(index) {
    if (!this.playing) return

    const buf = this._buffers[index]
    if (!buf) {
      // Buffer not ready — poll then retry
      const wait = setInterval(() => {
        if (this._loaded[index]) {
          clearInterval(wait)
          if (this.playing) this._playIndex(index)
        }
      }, 100)
      return
    }

    // Tear down previous nodes
    try { this._source?.stop() } catch {}
    this._source?.disconnect()
    this._trackGain?.disconnect()

    const tg = this.ctx.createGain()
    tg.gain.value = TRACKS[index].gain
    tg.connect(this.masterGain)
    this._trackGain = tg

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop   = false
    src.connect(tg)
    src.onended = () => {
      if (!this.playing) return
      this._repeatCount++
      if (this._repeatCount < this._maxRepeats) {
        // Play the same track again
        this._playIndex(index)
      } else {
        // Enough repeats — pick a new random track
        this._repeatCount = 0
        this._maxRepeats  = 2 + Math.floor(Math.random() * 2)  // 2 or 3 next time
        let next
        do { next = Math.floor(Math.random() * TRACKS.length) } while (next === index && TRACKS.length > 1)
        this.trackIndex = next
        this._playIndex(this.trackIndex)
      }
    }
    src.start()
    this._source = src
  }

  // -- Public API -------------------------------------------------------------

  /** Start BGM (call from user-gesture handler). */
  start() {
    if (this.playing) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.playing = true
    // Start from a random track each session
    this.trackIndex   = Math.floor(Math.random() * TRACKS.length)
    this._repeatCount = 0
    this._maxRepeats  = 2 + Math.floor(Math.random() * 2)
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(0, t)
    this.masterGain.gain.linearRampToValueAtTime(this._targetVol, t + 0.6)
    this._playIndex(this.trackIndex)
  }

  /** Fully stop BGM (game over / quitting). */
  stop() {
    if (!this.playing) return
    this.playing = false
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(0, t + 0.4)
    setTimeout(() => {
      try { this._source?.stop() } catch {}
      this._source    = null
      this._trackGain = null
    }, 450)
  }

  /** Mute BGM without stopping playback (game paused). */
  pause() {
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(0, t + 0.15)
  }

  /** Restore BGM after a game-pause. */
  resume() {
    if (!this.playing) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(this._targetVol, t + 0.35)
  }

  /** User-controlled master volume (0-1). */
  setVolume(vol) {
    const v = Math.max(0, Math.min(1, vol))
    this._targetVol = v
    this.volumeGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  // No-ops kept for API compat
  setLevel(_level)   {}
  setPurifyMode(_on) {}
  setZenMode(_on)    {}

  /** Zone low-pass + volume duck effect. */
  setZoneFx(on) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const targetFreq = on ? 900 : 18000
    const targetGain = on ? this._targetVol * 0.35 : this._targetVol
    this.lpf.frequency.cancelScheduledValues(t)
    this.lpf.frequency.setValueAtTime(this.lpf.frequency.value, t)
    this.lpf.frequency.linearRampToValueAtTime(targetFreq, t + 0.25)
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t)
    this.masterGain.gain.linearRampToValueAtTime(targetGain, t + 0.35)
  }

  // -- One-shot SFX (bypass masterGain, always audible even when BGM is muted) -
  _sfxNote(hz, gain, dur, type = 'triangle', offset = 0) {
    const { ctx } = this
    const osc = ctx.createOscillator(); const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = type; osc.frequency.value = hz
    const t = ctx.currentTime + offset
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.start(t); osc.stop(t + dur + 0.01)
  }

  playCountdownBeep(n) {
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    if (n > 0) {
      const freqs = [261.6, 293.7, 329.6]
      this._sfxNote(freqs[n - 1] ?? 261.6, 0.18, 0.28, 'triangle')
    } else {
      // "GO!" fanfare
      ;[523.3, 659.3, 784.0, 1046.5].forEach((hz, i) =>
        this._sfxNote(hz, 0.22, 0.24, 'triangle', i * 0.05))
    }
  }

  playZoneReady() {
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    ;[784.0, 1046.5].forEach((hz, i) =>
      this._sfxNote(hz, 0.14, 0.38, 'triangle', i * 0.14))
  }

  playZoneEnd(lines = 0) {
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const base = lines >= 8
      ? [392.0, 523.3, 659.3, 784.0, 1046.5, 1318.5]
      : [392.0, 523.3, 659.3, 784.0, 1046.5]
    base.forEach((hz, i) =>
      this._sfxNote(hz, 0.16, 0.30, 'triangle', i * 0.06))
  }
}