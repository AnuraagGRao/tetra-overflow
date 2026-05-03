// Shared game SFX (Solo-quality) for Story and Versus
// Lazy singleton AudioContext; theme-aware variations; simple anti-spam gate.

const ToneContext = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
let sharedAudioContext
let _sfxVol = 1.0
let _sfxDuck = 1.0
const _sfxGate = {}

export const setSfxVolume = (v) => { _sfxVol = Math.max(0, Math.min(1, v ?? 1)) }
export const setSfxDuck = (v) => { _sfxDuck = Math.max(0, Math.min(1, v ?? 1)) }

const getAudioCtx = () => {
  if (!ToneContext) return null
  if (!sharedAudioContext) sharedAudioContext = new ToneContext()
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume()
  return sharedAudioContext
}

const sfxPermit = (name, minGapMs = 60, windowMs = 800, maxPerWindow = 6) => {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const g = _sfxGate[name] || { last: 0, hits: [] }
  if (now - g.last < minGapMs) return false
  g.last = now
  g.hits = (g.hits || []).filter(t => now - t < windowMs)
  if (g.hits.length >= maxPerWindow) { _sfxGate[name] = g; return false }
  g.hits.push(now)
  _sfxGate[name] = g
  return true
}

const playNote = (freq, duration, gain, type = 'sine', offset = 0) => {
  const ctx = getAudioCtx(); if (!ctx) return
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination)
  osc.type = type; osc.frequency.value = freq
  const t = ctx.currentTime + offset
  g.gain.setValueAtTime(gain * _sfxVol * _sfxDuck, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.start(t); osc.stop(t + duration + 0.01)
}

const playNoise = (lpFreq, gain, dur, offset = 0) => {
  const ctx = getAudioCtx(); if (!ctx) return
  const len = Math.ceil(ctx.sampleRate * Math.min(dur, 0.5))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lpFreq
  const g = ctx.createGain()
  src.connect(flt); flt.connect(g); g.connect(ctx.destination)
  const t = ctx.currentTime + offset
  g.gain.setValueAtTime(gain * _sfxVol * _sfxDuck, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.start(t); src.stop(t + dur + 0.01)
}

const arp = (notes, dur = 0.07, gain = 0.04, type = 'triangle') =>
  notes.forEach((f, i) => playNote(f, dur, gain, type, i * dur * 0.65))

// Theme-aware helpers (subset of Solo’s variants)
export const playMoveSFX = (theme = 'classic') => {
  if (!sfxPermit('__mv', 75, 200, 8)) return
  switch (theme) {
    case 'sketch': playNoise(2200, 0.32, 0.04); playNoise(4000, 0.14, 0.018, 0.008); playNote(310, 0.03, 0.03, 'triangle', 0.006); break
    case 'blueprint': playNote(910, 0.018, 0.26, 'triangle'); playNoise(2700, 0.09, 0.02, 0.005); break
    case 'stone': playNote(120, 0.10, 0.22, 'triangle'); playNoise(280, 0.11, 0.023); break
    default: playNote(380, 0.022, 0.22, 'triangle'); break
  }
}

export const playRotateSFX = (theme = 'classic') => {
  if (!sfxPermit('__rot', 30, 400, 10)) return
  switch (theme) {
    case 'sketch': playNoise(3400, 0.12, 0.02); playNote(620, 0.04, 0.05, 'triangle'); break
    case 'stone': playNote(100, 0.09, 0.14, 'triangle'); playNoise(200, 0.06, 0.02, 0.003); break
    default: playNote(1100, 0.032, 0.20, 'triangle'); playNote(750, 0.022, 0.14, 'sine', 0.010); break
  }
}

export const playHoldSFX = (theme = 'classic') => {
  switch (theme) {
    case 'sketch': playNoise(3200, 0.16, 0.018); playNote(890, 0.025, 0.10, 'triangle', 0.006); break
    case 'stone': playNote(210, 0.035, 0.18, 'triangle'); playNoise(200, 0.06, 0.012); break
    default: playNote(660, 0.045, 0.19, 'triangle'); playNote(990, 0.035, 0.14, 'triangle', 0.018); break
  }
}

export const playHardDropSFX = (theme = 'classic') => {
  if (!sfxPermit('__hd', 80, 600, 6)) return
  switch (theme) {
    case 'sketch': playNoise(2500, 0.34, 0.055); playNote(103, 0.19, 0.20, 'triangle'); break
    case 'stone': playNote(54, 0.22, 0.30, 'sine'); playNoise(400, 0.16, 0.12); playNote(311, 0.03, 0.08, 'square', 0.021); break
    default: playNote(75, 0.18, 0.40, 'sine'); playNote(410, 0.06, 0.12, 'triangle', 0.010); playNoise(900, 0.16, 0.06, 0.012); break
  }
}

export const playLockSFX = (_theme = 'classic') => {
  if (!sfxPermit('__lk', 45, 600, 8)) return
  // Classic fallback (shared)
  const ctx = getAudioCtx(); if (!ctx) return
  const osc = ctx.createOscillator(), g = ctx.createGain(); osc.connect(g); g.connect(ctx.destination)
  osc.type = 'sine'
  const t = ctx.currentTime
  osc.frequency.setValueAtTime(110, t)
  osc.frequency.exponentialRampToValueAtTime(52, t + 0.07)
  g.gain.setValueAtTime(0.18 * _sfxVol * _sfxDuck, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.10)
  osc.start(t); osc.stop(t + 0.11)
}

export const playLineClearSFX = (_theme = 'classic') => {
  if (!sfxPermit('__lc', 70, 800, 6)) return
  switch (_theme) {
    case 'sketch': playNoise(3400, 0.25, 0.11); playNote(470, 0.07, 0.05, 'triangle', 0.012); break
    case 'stone': playNoise(1600, 0.22, 0.10); playNote(90, 0.25, 0.10, 'triangle', 0.018); break
    default: playNoise(9000, 0.16, 0.11); arp([392, 523, 659, 784], 0.095, 0.16, 'sine'); break
  }
}

export const playTetrisSFX = (_theme = 'classic') => {
  if (!sfxPermit('__tet', 120, 1000, 3)) return
  switch (_theme) {
    case 'sketch': playNoise(3300, 0.38, 0.12); playNote(675, 0.045, 0.10, 'triangle', 0.015); break
    case 'stone': playNoise(420, 0.40, 0.16); playNote(64, 0.3, 0.32, 'triangle'); break
    default: arp([262, 330, 392, 523, 659, 784, 1047, 1319], 0.11, 0.16, 'sine'); playNote(131, 0.41, 0.30, 'triangle', 0.13); break
  }
}

export const playTSpinSFX = (_theme = 'classic') => {
  if (!sfxPermit('__ts', 100, 800, 4)) return
  switch (_theme) {
    case 'sketch': playNote(710, 0.055, 0.16, 'triangle'); playNoise(2600, 0.12, 0.038, 0.009); break
    default: arp([330, 415, 523, 659, 784, 988, 1047], 0.08, 0.18, 'triangle'); playNote(330, 0.20, 0.11, 'sine', 0.06); break
  }
}

export const playAllClearSFX = (_theme = 'classic') => {
  if (!sfxPermit('__ac', 200, 1500, 2)) return
  const fs = [262,294,330,349,392,440,494,523,587,659,698,784,880,988,1047,1319]
  fs.forEach((f, i) => playNote(f, 0.14, 0.16, 'sine', i * 0.038))
  playNote(65,  0.45, 0.18, 'sine', 0.22)
  playNote(131, 0.30, 0.16, 'sine', 0.22)
  playNoise(10000, 0.20, 0.20, 0.12)
}

export const playLevelUpSFX = (_theme = 'classic') => {
  if (!sfxPermit('__lv', 250, 1500, 2)) return
  arp([261.6, 329.6, 392.0, 523.3], 0.10, 0.18, 'triangle')
}

export const playZoneActivateSFX = (_theme = 'classic') => {
  if (!sfxPermit('__zn', 250, 2000, 2)) return
  arp([131, 165, 196, 262, 330, 392, 523, 784], 0.13, 0.18, 'triangle')
  playNoise(2500, 0.22, 0.16, 0.06)
}

export const playPauseSFX = (_theme = 'classic') => { playNote(440, 0.06, 0.11, 'triangle'); playNote(330, 0.05, 0.11, 'triangle', 0.055) }
export const playResumeSFX = (_theme = 'classic') => { playNote(660, 0.045, 0.17, 'triangle'); playNote(840, 0.041, 0.13, 'triangle', 0.06) }
export const playComboSFX = (c, _theme = 'classic') => { const base = Math.min(440 + c * 80, 1600); playNote(base, 0.09, 0.14, 'triangle'); if (c>=3) playNote(base*1.26,0.06,0.12,'triangle',0.022) }
export const playGameOverSFX = (_theme = 'classic') => { arp([523,466,415,370,330,294,262,233,220],0.12,0.14,'sawtooth'); playNote(55,0.5,0.12,'sine',0.12); playNoise(700,0.10,0.4,0.06) }
