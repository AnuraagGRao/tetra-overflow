import { Howl, Howler } from 'howler'

const STEM_SOURCES = {
  bass: new URL('./Before_the_Match.mp3', import.meta.url).href,
  drums: new URL('./Full_Throttle_Logic.mp3', import.meta.url).href,
  synth: new URL('./Pattern_Perfect.mp3', import.meta.url).href,
}

const PENTATONIC_RATIOS = [0.5, 0.5625, 0.6667, 0.75, 0.84375, 1.0, 1.125, 1.3333, 1.5]

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
    this._initHowls()
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

  unlock() {
    try {
      if (Howler.ctx?.state === 'suspended') Howler.ctx.resume()
    } catch {
      // Non-fatal: audio unlock failures should never break gameplay.
    }
  }

  setSfxVolume(v) {
    this.sfxVolume = clamp(v ?? 1, 0, 1)
  }

  setSfxDuck(v) {
    this.sfxDuck = clamp(v ?? 1, 0, 2)
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
        return Howler.ctx
      }
    } catch {}

    if (typeof window === 'undefined') return null
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    try {
      Howler.ctx = ctx
    } catch {}
    return ctx
  }

  _playNote(freq, dur, gain, type = 'sine', offset = 0, rate = 1) {
    const ctx = this._getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g)
    g.connect(ctx.destination)
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
    g.connect(ctx.destination)
    const t = ctx.currentTime + offset
    const vol = clamp(gain * this.sfxVolume * this.sfxDuck, 0, 1)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.start(t)
    src.stop(t + dur + 0.01)
  }

  _arp(notes, dur = 0.07, gain = 0.12, type = 'triangle') {
    notes.forEach((f, i) => this._playNote(f, dur, gain, type, i * dur * 0.65))
  }

  playMove() {
    if (!this._permit('move', 55, 260, 10)) return
    const r = pick(PENTATONIC_RATIOS) * rand(0.985, 1.015)
    this._playNote(380, 0.02, rand(0.16, 0.24), 'triangle', 0, r)
  }

  playRotate() {
    if (!this._permit('rotate', 30, 420, 11)) return
    const r = pick(PENTATONIC_RATIOS) * rand(0.995, 1.03)
    this._playNote(1100, 0.03, rand(0.16, 0.24), 'triangle', 0, r)
    this._playNote(750, 0.02, rand(0.12, 0.18), 'sine', 0.01, r)
  }

  playHold() {
    const r = rand(0.96, 1.04)
    this._playNote(660, 0.045, 0.18, 'triangle', 0, r)
    this._playNote(990, 0.03, 0.12, 'triangle', 0.018, r)
  }

  playSoftDrop() {
    if (!this._permit('softDrop', 75, 420, 8)) return
    this._playNote(300, 0.022, rand(0.08, 0.12), 'triangle', 0, rand(0.98, 1.02))
  }

  playHardDrop() {
    if (!this._permit('hardDrop', 90, 600, 6)) return
    const r = rand(0.98, 1.02)
    this._playNote(75, 0.18, rand(0.3, 0.42), 'sine', 0, r)
    this._playNote(410, 0.06, rand(0.1, 0.15), 'triangle', 0.01, r)
    this._playNoise(900, rand(0.12, 0.2), 0.06, 0.012)
  }

  playLock() {
    if (!this._permit('lock', 45, 600, 8)) return
    const ctx = this._getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g)
    g.connect(ctx.destination)
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

  playLineClear(comboCount = 0) {
    if (!this._permit('lineClear', 70, 850, 6)) return
    const comboRate = 1 + clamp((comboCount || 0) * 0.055, 0, 0.55)
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
