import { Howl, Howler } from 'howler'

const STEM_SOURCES = {
  bass: new URL('./Before_the_Match.mp3', import.meta.url).href,
  drums: new URL('./Full_Throttle_Logic.mp3', import.meta.url).href,
  synth: new URL('./Pattern_Perfect.mp3', import.meta.url).href,
}

const PENTATONIC_RATIOS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3]
const PENTATONIC_FREQS = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25] // C4..E5

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const rand = (min, max) => min + Math.random() * (max - min)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

class GameAudioController {
  constructor() {
    this.sfxVolume = 1
    this.sfxDuck = 1
    this.musicVolume = 1
    this.stems = {}
    this.stemTargets = { bass: 0, drums: 0, synth: 0 }
    this._syncTimer = null
    this._lastHit = {}

    // Dynamic Filter & Synesthesia Bus
    this._masterSfxGain = null
    this._dynamicFilter = null
    this._analyser = null
    this._fftArray = null
    this._rotNoteStep = 0
    this._currentIntensity = 0

    // DSP Buffer Cache
    this.dspBuffers = {}
    this._dspLoaded = false

    this._initHowls()
    this._preloadDspSoundbank()
  }

  _initHowls() {
    Object.entries(STEM_SOURCES).forEach(([stem, src]) => {
      this.stems[stem] = new Howl({
        src: [src],
        preload: true,
        html5: false,
        loop: true,
        pool: 1,
        volume: 0,
      })
    })
  }

  _preloadDspSoundbank() {
    if (typeof window === 'undefined') return
    const dspFiles = [
      'nes_move', 'nes_rotate', 'nes_drop', 'nes_clear', 'nes_tetris'
    ]

    const baseUrl = import.meta.env.BASE_URL || '/'
    const dspBase = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}audio/dsp/`

    Promise.all(
      dspFiles.map(async (name) => {
        try {
          const res = await fetch(`${dspBase}${name}.wav`)
          if (!res.ok) return
          const arrayBuffer = await res.arrayBuffer()
          const ctx = this._getCtx()
          if (!ctx) return
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
          this.dspBuffers[name] = audioBuffer
        } catch {
          // Non-fatal: procedural fallback is always available
        }
      })
    ).then(() => {
      this._dspLoaded = true
    }).catch(() => {})
  }

  unlock() {
    try {
      const ctx = this._getCtx()
      if (ctx?.state === 'suspended') ctx.resume()
      if (Howler.ctx?.state === 'suspended') Howler.ctx.resume()
    } catch {
      // Non-fatal: audio unlock failures should never break gameplay.
    }
  }

  setSfxVolume(v) {
    this.sfxVolume = clamp(v ?? 1, 0, 1)
    if (this._masterSfxGain && this._ctx) {
      const vol = clamp(this.sfxVolume * this.sfxDuck, 0, 1)
      this._masterSfxGain.gain.setValueAtTime(vol, this._ctx.currentTime)
    }
  }

  setSfxDuck(v) {
    this.sfxDuck = clamp(v ?? 1, 0, 2)
    if (this._masterSfxGain && this._ctx) {
      const vol = clamp(this.sfxVolume * this.sfxDuck, 0, 1)
      this._masterSfxGain.gain.setValueAtTime(vol, this._ctx.currentTime)
    }
  }

  setMusicVolume(v) {
    this.musicVolume = clamp(v ?? 1, 0, 1)
    this._applyStemTargets(180)
  }

  _permit(name, minGapMs = 60, windowMs = 800, maxPerWindow = 7) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const gate = this._lastHit[name] || { last: 0, hits: [] }
    if (now - gate.last < minGapMs) return false
    gate.last = now
    gate.hits = gate.hits.filter((t) => now - t < windowMs)
    if (gate.hits.length >= maxPerWindow) {
      this._lastHit[name] = gate
      return false
    }
    gate.hits.push(now)
    this._lastHit[name] = gate
    return true
  }

  _getCtx() {
    try {
      if (Howler.ctx) {
        if (Howler.ctx.state === 'suspended') Howler.ctx.resume()
        this._ensureBusPipeline(Howler.ctx)
        return Howler.ctx
      }
    } catch {}

    if (typeof window === 'undefined') return null
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return null
      this._ctx = new Ctx()
      try {
        Howler.ctx = this._ctx
      } catch {}
    }
    this._ensureBusPipeline(this._ctx)
    return this._ctx
  }

  _ensureBusPipeline(ctx) {
    if (this._masterSfxGain && this._dynamicFilter && this._analyser) return

    try {
      this._masterSfxGain = ctx.createGain()
      this._masterSfxGain.gain.setValueAtTime(clamp(this.sfxVolume * this.sfxDuck, 0, 1), ctx.currentTime)

      this._dynamicFilter = ctx.createBiquadFilter()
      this._dynamicFilter.type = 'lowpass'
      this._dynamicFilter.frequency.setValueAtTime(1400, ctx.currentTime)
      this._dynamicFilter.Q.setValueAtTime(1.8, ctx.currentTime)

      this._analyser = ctx.createAnalyser()
      this._analyser.fftSize = 64
      this._analyser.smoothingTimeConstant = 0.75
      this._fftArray = new Uint8Array(this._analyser.frequencyBinCount)

      // Pipeline: masterSfxGain -> dynamicFilter -> analyser -> ctx.destination
      this._masterSfxGain.connect(this._dynamicFilter)
      this._dynamicFilter.connect(this._analyser)
      this._analyser.connect(ctx.destination)
    } catch {
      // Audio pipeline fallback
    }
  }

  // Tetris Effect: Connected style dynamic filter sweep based on PPS, combo, and level
  setIntensity({ pps = 0, combo = 0, level = 1 } = {}) {
    const ctx = this._getCtx()
    if (!ctx || !this._dynamicFilter) return

    const ppsFactor = clamp((pps - 0.5) / 2.5, 0, 1)
    const comboFactor = clamp(combo / 8, 0, 1)
    const levelFactor = clamp((level - 1) / 15, 0, 1)

    const targetIntensity = clamp(ppsFactor * 0.45 + comboFactor * 0.35 + levelFactor * 0.2, 0, 1)
    this._currentIntensity = targetIntensity

    // Cutoff sweeps from 700 Hz (relaxed) up to 18,500 Hz (hyper-fast high adrenaline)
    const targetCutoff = 700 + Math.pow(targetIntensity, 1.35) * (18500 - 700)
    const targetQ = 1.2 + targetIntensity * 1.8

    try {
      this._dynamicFilter.frequency.setTargetAtTime(targetCutoff, ctx.currentTime, 0.08)
      this._dynamicFilter.Q.setTargetAtTime(targetQ, ctx.currentTime, 0.08)
    } catch {}
  }

  // Real-time audio FFT telemetry for BackgroundCanvas & GameCanvas synesthesia
  getFrequencyData() {
    if (!this._analyser || !this._fftArray) {
      return { bass: 0, mid: 0, treble: 0, energy: 0 }
    }
    try {
      this._analyser.getByteFrequencyData(this._fftArray)
      let bSum = 0
      for (let i = 0; i < 4; i++) bSum += this._fftArray[i]
      const bass = bSum / (4 * 255)

      let mSum = 0
      for (let i = 4; i < 13; i++) mSum += this._fftArray[i]
      const mid = mSum / (9 * 255)

      let tSum = 0
      for (let i = 13; i < 32; i++) tSum += this._fftArray[i]
      const treble = tSum / (19 * 255)

      const energy = clamp(bass * 0.55 + mid * 0.30 + treble * 0.15, 0, 1)
      return { bass, mid, treble, energy }
    } catch {
      return { bass: 0, mid: 0, treble: 0, energy: 0 }
    }
  }

  _playDspBuffer(name, gain = 1, rate = 1) {
    const ctx = this._getCtx()
    const buf = this.dspBuffers[name]
    if (!ctx || !buf) return false

    try {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = clamp(rate, 0.25, 4)

      const g = ctx.createGain()
      g.gain.setValueAtTime(gain, ctx.currentTime)

      src.connect(g)
      if (this._masterSfxGain) {
        g.connect(this._masterSfxGain)
      } else {
        g.connect(ctx.destination)
      }

      src.start()
      return true
    } catch {
      return false
    }
  }

  _playNote(freq, dur, gain, type = 'sine', offset = 0, rate = 1) {
    const ctx = this._getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g)
    if (this._masterSfxGain) {
      g.connect(this._masterSfxGain)
    } else {
      g.connect(ctx.destination)
    }
    osc.type = type
    osc.frequency.value = freq * clamp(rate, 0.5, 2)
    const t = ctx.currentTime + offset
    const vol = clamp(gain * this.sfxVolume * this.sfxDuck, 0, 1)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.01)
  }

  _playNoise(lpFreq, gain, dur, offset = 0) {
    const ctx = this._getCtx()
    if (!ctx) return
    const len = Math.ceil(ctx.sampleRate * Math.min(dur, 0.5))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = lpFreq
    const g = ctx.createGain()
    src.connect(flt)
    flt.connect(g)
    if (this._masterSfxGain) {
      g.connect(this._masterSfxGain)
    } else {
      g.connect(ctx.destination)
    }
    const t = ctx.currentTime + offset
    const vol = clamp(gain * this.sfxVolume * this.sfxDuck, 0, 1)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.start(t)
    src.stop(t + dur + 0.01)
  }

  playMove() {
    if (!this._permit('move', 50, 260, 10)) return
    const r = pick(PENTATONIC_RATIOS) * rand(0.985, 1.015)
    this._playNote(380, 0.02, rand(0.16, 0.24), 'triangle', 0, r)
  }

  playRotate() {
    if (!this._permit('rotate', 25, 420, 12)) return
    const r = pick(PENTATONIC_RATIOS) * rand(0.995, 1.03)
    this._playNote(1100, 0.03, rand(0.16, 0.24), 'triangle', 0, r)
    this._playNote(750, 0.02, rand(0.12, 0.18), 'sine', 0.01, r)
  }

  playRotate180() {
    if (!this._permit('rotate180', 25, 420, 12)) return
    const r = pick(PENTATONIC_RATIOS) * rand(0.99, 1.02)
    this._playNote(880, 0.04, rand(0.18, 0.26), 'triangle', 0, r)
    this._playNote(1320, 0.035, rand(0.16, 0.22), 'triangle', 0.018, r)
    this._playNote(1760, 0.03, rand(0.12, 0.18), 'sine', 0.035, r)
  }

  playHold() {
    const r = rand(0.96, 1.04)
    this._playNote(660, 0.045, 0.18, 'triangle', 0, r)
    this._playNote(990, 0.03, 0.12, 'triangle', 0.018, r)
  }

  playSoftDrop() {
    if (!this._permit('softDrop', 70, 420, 8)) return
    this._playNote(300, 0.022, rand(0.08, 0.12), 'triangle', 0, rand(0.98, 1.02))
  }

  playHardDrop() {
    if (!this._permit('hardDrop', 80, 600, 6)) return
    const r = rand(0.98, 1.02)
    this._playNote(75, 0.18, rand(0.3, 0.42), 'sine', 0, r)
    this._playNote(410, 0.06, rand(0.1, 0.15), 'triangle', 0.01, r)
    this._playNoise(900, rand(0.14, 0.22), 0.06, 0.012)
  }

  playLock() {
    if (!this._permit('lock', 45, 600, 8)) return
    const ctx = this._getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g)
    if (this._masterSfxGain) {
      g.connect(this._masterSfxGain)
    } else {
      g.connect(ctx.destination)
    }
    osc.type = 'sine'
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.07)
    const vol = clamp(0.18 * this.sfxVolume * this.sfxDuck, 0, 1)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.start(t)
    osc.stop(t + 0.11)
  }

  playLineClear(linesOrCombo = 1, comboCount = 0) {
    if (!this._permit('lineClear', 60, 850, 6)) return
    const combo = typeof comboCount === 'number' && comboCount > 0
      ? comboCount
      : (typeof linesOrCombo === 'number' ? linesOrCombo : 0)
    const comboRate = 1 + clamp(combo * 0.055, 0, 0.55)
    this._playNoise(9000, rand(0.12, 0.18), 0.11)
    this._arp([392, 523, 659, 784].map((n) => n * comboRate), 0.09, 0.14, 'sine')
  }

  playTetris() {
    if (!this._permit('tetris', 120, 1000, 4)) return
    this._arp([262, 330, 392, 523, 659, 784, 1047], 0.1, 0.16, 'sine')
    this._playNote(131, 0.35, 0.24, 'triangle', 0.12)
  }

  playTSpin() {
    if (!this._permit('tspin', 120, 900, 4)) return
    this._arp([330, 415, 523, 659, 784, 988], 0.075, 0.16, 'triangle')
    this._playNote(330, 0.18, 0.11, 'sine', 0.06)
  }

  // ── Authentic NES Classic 8-bit Audio ────────────────────────────────────────
  playClassicMove() {
    if (!this._permit('classicMove', 45, 260, 10)) return
    if (!this._playDspBuffer('nes_move', 0.7 * this.sfxVolume * this.sfxDuck)) {
      this._playNote(220, 0.022, 0.22, 'square')
    }
  }

  playClassicRotate() {
    if (!this._permit('classicRotate', 25, 420, 12)) return
    if (!this._playDspBuffer('nes_rotate', 0.75 * this.sfxVolume * this.sfxDuck)) {
      this._playNote(440, 0.035, 0.24, 'square')
    }
  }

  playClassicDrop() {
    if (!this._permit('classicDrop', 60, 600, 6)) return
    if (!this._playDspBuffer('nes_drop', 0.8 * this.sfxVolume * this.sfxDuck)) {
      this._playNote(110, 0.06, 0.3, 'square')
    }
  }

  playClassicClear() {
    if (!this._permit('classicClear', 70, 850, 6)) return
    if (!this._playDspBuffer('nes_clear', 0.85 * this.sfxVolume * this.sfxDuck)) {
      this._arp([440, 554, 659, 880], 0.06, 0.25, 'square')
    }
  }

  playClassicTetris() {
    if (!this._permit('classicTetris', 120, 1000, 4)) return
    if (!this._playDspBuffer('nes_tetris', 0.9 * this.sfxVolume * this.sfxDuck)) {
      this._arp([262, 330, 392, 523, 659, 784, 1047, 1318], 0.08, 0.28, 'square')
    }
  }

  playAllClear() {
    if (!this._permit('allClear', 250, 1600, 2)) return
    const fs = [262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784, 880, 988, 1047]
    fs.forEach((f, i) => this._playNote(f, 0.14, 0.14, 'sine', i * 0.032))
    this._playNoise(10000, 0.2, 0.2, 0.12)
  }

  playLevelUp() {
    this._arp([261.6, 329.6, 392.0, 523.3], 0.1, 0.16, 'triangle')
  }

  playZoneActivate() {
    if (!this._permit('zone', 220, 1800, 2)) return
    this._arp([131, 165, 196, 262, 330, 392, 523], 0.12, 0.16, 'triangle')
    this._playNoise(2500, 0.2, 0.16, 0.06)
  }

  playZoneEnd(lines = 0) {
    if (lines <= 0) return
    const isBig = lines >= 8
    const notes = lines >= 16 
      ? [261.6, 329.6, 392.0, 523.3, 659.3, 784.0, 1046.5, 1318.5]
      : lines >= 8
      ? [329.6, 392.0, 523.3, 659.3, 784.0, 1046.5]
      : [392.0, 523.3, 659.3, 784.0]
    
    notes.forEach((f, i) => {
      this._playNote(f, 0.16, isBig ? 0.22 : 0.15, 'triangle', i * 0.065)
      this._playNote(f * 1.5, 0.12, 0.1, 'sine', i * 0.065 + 0.02)
    })
    if (isBig) {
      this._playNoise(12000, 0.35, 0.25, 0.1)
    }
  }

  playPause() {
    this._playNote(440, 0.06, 0.1, 'triangle')
    this._playNote(330, 0.05, 0.1, 'triangle', 0.05)
  }

  playResume() {
    this._playNote(660, 0.045, 0.14, 'triangle')
    this._playNote(840, 0.04, 0.12, 'triangle', 0.06)
  }

  playCombo(c = 1) {
    const base = Math.min(440 + c * 80, 1600)
    this._playNote(base, 0.09, 0.12, 'triangle')
    if (c >= 3) this._playNote(base * 1.26, 0.06, 0.1, 'triangle', 0.02)
  }

  playGameOver() {
    this._arp([523, 466, 415, 370, 330, 294, 262, 233, 220], 0.11, 0.12, 'sawtooth')
    this._playNote(55, 0.45, 0.12, 'sine', 0.12)
    this._playNoise(700, 0.1, 0.35, 0.06)
  }

  startMusicStems() {
    this.unlock()
    Object.values(this.stems).forEach((howl) => {
      if (!howl.playing()) howl.play()
    })
    this.setStemLevels({ bass: 0.5, drums: 0.2, synth: 0.22 })

    if (this._syncTimer) return
    this._syncTimer = window.setInterval(() => this._syncStems(), 1800)
  }

  _syncStems() {
    const bass = this.stems.bass
    if (!bass?.playing()) return
    const masterSeek = Number(bass.seek()) || 0

    ;['drums', 'synth'].forEach((name) => {
      const stem = this.stems[name]
      if (!stem?.playing()) return
      const seek = Number(stem.seek()) || 0
      if (Math.abs(seek - masterSeek) > 0.06) stem.seek(masterSeek)
    })
  }

  setStemLevels({ bass, drums, synth }, fadeMs = 400) {
    if (typeof bass === 'number') this.stemTargets.bass = clamp(bass, 0, 1)
    if (typeof drums === 'number') this.stemTargets.drums = clamp(drums, 0, 1)
    if (typeof synth === 'number') this.stemTargets.synth = clamp(synth, 0, 1)
    this._applyStemTargets(fadeMs)
  }

  _applyStemTargets(fadeMs = 300) {
    Object.entries(this.stemTargets).forEach(([name, target]) => {
      const stem = this.stems[name]
      if (!stem) return
      const current = stem.volume()
      const scaled = clamp(target * this.musicVolume, 0, 1)
      stem.fade(current, scaled, fadeMs)
    })
  }

  updateStemMix({ lines = 0, zoneActive = false, bossState = false } = {}) {
    const drums = lines >= 20 ? 0.66 : 0.16
    const synth = (zoneActive || bossState) ? 0.78 : 0.24
    this.setStemLevels({ bass: 0.52, drums, synth }, 350)
  }

  stopMusicStems(fadeMs = 250) {
    this.setStemLevels({ bass: 0, drums: 0, synth: 0 }, fadeMs)
    window.setTimeout(() => {
      Object.values(this.stems).forEach((stem) => stem.stop())
    }, fadeMs + 20)

    if (this._syncTimer) {
      clearInterval(this._syncTimer)
      this._syncTimer = null
    }
  }
}

export const gameAudioController = new GameAudioController()
