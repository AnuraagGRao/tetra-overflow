// Lightweight UI SFX for taps and zooms (Story Map, menus, etc.)
// Creates a singleton AudioContext on first use (requires a user gesture).

const Ctx = window.AudioContext || window.webkitAudioContext
let ctx

function getCtx() {
  if (!Ctx) return null
  if (!ctx) ctx = new Ctx()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function note(hz, gain = 0.12, dur = 0.06, type = 'triangle', offset = 0) {
  const ac = getCtx(); if (!ac) return
  const osc = ac.createOscillator(); const g = ac.createGain()
  osc.connect(g); g.connect(ac.destination)
  osc.type = type; osc.frequency.value = hz
  const t = ac.currentTime + offset
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.start(t); osc.stop(t + dur + 0.01)
}

function noise(lp = 2600, gain = 0.15, dur = 0.04, offset = 0) {
  const ac = getCtx(); if (!ac) return
  const len = Math.ceil(ac.sampleRate * Math.min(dur, 0.5))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource(); src.buffer = buf
  const flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lp
  const g = ac.createGain()
  src.connect(flt); flt.connect(g); g.connect(ac.destination)
  const t = ac.currentTime + offset
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.start(t); src.stop(t + dur + 0.01)
}

export function playTap() {
  // Subtle UI tap
  note(1100, 0.11, 0.028, 'triangle')
}

export function playBack() {
  // Lower pitched back tap
  note(660, 0.12, 0.035, 'triangle')
}

export function playZoomIn() {
  // Gentle whoosh up
  noise(3600, 0.18, 0.06)
  note(660, 0.10, 0.04, 'sine', 0.02)
}

export function playZoomOut() {
  // Gentle whoosh down
  noise(3200, 0.16, 0.05)
  note(440, 0.09, 0.05, 'sine', 0.015)
}
