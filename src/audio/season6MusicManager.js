// Season 6 Zenith Tower Climb dynamic floor music manager.
// Cross-fades dynamically across strata tiers based on the player's active floor.

const TIER_TRACKS = [
  { minFloor: 1,   maxFloor: 10,  file: 'Aligning_the_Lattice',    title: 'Aligning the Lattice',    bpm: 128, gain: 0.90 },
  { minFloor: 11,  maxFloor: 25,  file: 'Vertical_Flow',            title: 'Vertical Flow',            bpm: 136, gain: 0.90 },
  { minFloor: 26,  maxFloor: 45,  file: 'The_View_From_Orbit',      title: 'The View From Orbit',      bpm: 146, gain: 0.90 },
  { minFloor: 46,  maxFloor: 70,  file: 'Orbiting_the_Pale_Star',  title: 'Orbiting the Pale Star',  bpm: 158, gain: 0.90 },
  { minFloor: 71,  maxFloor: 99,  file: 'Peak_Operational_Load',   title: 'Peak Operational Load',   bpm: 170, gain: 0.92 },
  { minFloor: 100, maxFloor: 9999,file: 'Terminal_Overload',       title: 'Terminal Overload',       bpm: 182, gain: 0.92 },
]

const TRACK_URLS = TIER_TRACKS.map(
  track => new URL(`./story_season_6/${track.file}.mp3`, import.meta.url).href
)

export function getTierForFloor(floor) {
  const f = Math.max(1, Number(floor) || 1)
  const index = TIER_TRACKS.findIndex(t => f >= t.minFloor && f <= t.maxFloor)
  return index !== -1 ? index : TIER_TRACKS.length - 1
}

export function getTrackMetaForFloor(floor) {
  const idx = getTierForFloor(floor)
  return TIER_TRACKS[idx]
}

export class Season6MusicManager {
  constructor(audioContext = null) {
    this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)()
    this._sources = new Map() // index -> active AudioBufferSourceNode
    this._gains = new Map()   // index -> GainNode
    this._currentIndex = -1
    this._playing = false
    this._paused = false
    this._userVolume = 1.0
    this._buffers = new Array(TIER_TRACKS.length).fill(null)

    this.masterGain = this.ctx.createGain()
    this.lowPass = this.ctx.createBiquadFilter()
    this.lowPass.type = 'lowpass'
    this.lowPass.frequency.value = 18000

    this.masterGain.connect(this.lowPass)
    this.lowPass.connect(this.ctx.destination)
    this.masterGain.gain.value = 1.0

    this._preload()
  }

  _preload() {
    TRACK_URLS.forEach((url, index) => {
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.arrayBuffer()
        })
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(decoded => {
          this._buffers[index] = decoded
          if (this._playing && this._currentIndex === index && !this._sources.has(index)) {
            this._startTrack(index, true)
          }
        })
        .catch(err => {
          console.warn(`[Season6Music] Failed loading ${TIER_TRACKS[index].file}:`, err)
        })
    })
  }

  playForFloor(floor = 1) {
    const nextIdx = getTierForFloor(floor)
    this._playing = true
    this._paused = false

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }

    if (nextIdx !== this._currentIndex || !this._sources.has(nextIdx)) {
      this._transitionToIndex(nextIdx)
    }
  }

  _transitionToIndex(nextIdx) {
    const prevIdx = this._currentIndex
    this._currentIndex = nextIdx

    // Fade out previous track
    if (prevIdx >= 0 && this._gains.has(prevIdx)) {
      const prevGain = this._gains.get(prevIdx)
      const now = this.ctx.currentTime
      prevGain.gain.cancelScheduledValues(now)
      prevGain.gain.setValueAtTime(prevGain.gain.value, now)
      prevGain.gain.linearRampToValueAtTime(0, now + 0.8)

      const prevSource = this._sources.get(prevIdx)
      setTimeout(() => {
        try { prevSource?.stop() } catch {}
        this._sources.delete(prevIdx)
        this._gains.delete(prevIdx)
      }, 850)
    }

    this._startTrack(nextIdx, false)
  }

  _startTrack(index, immediate = false) {
    const buffer = this._buffers[index]
    if (!buffer || !this._playing) return

    // Stop existing instance of this index if any
    try {
      this._sources.get(index)?.stop()
    } catch {}

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const trackGain = this.ctx.createGain()
    const targetGain = TIER_TRACKS[index].gain * this._userVolume
    const now = this.ctx.currentTime

    if (immediate) {
      trackGain.gain.setValueAtTime(targetGain, now)
    } else {
      trackGain.gain.setValueAtTime(0, now)
      trackGain.gain.linearRampToValueAtTime(targetGain, now + 0.8)
    }

    source.connect(trackGain)
    trackGain.connect(this.masterGain)
    source.start(0)

    this._sources.set(index, source)
    this._gains.set(index, trackGain)

    const meta = TIER_TRACKS[index]
    try {
      window.dispatchEvent(new CustomEvent('tetris:nowplaying', {
        detail: { name: meta.title, bpm: meta.bpm }
      }))
    } catch {}
  }

  setVolume(vol) {
    this._userVolume = Math.max(0, Math.min(1, Number(vol) || 0))
    if (this._currentIndex >= 0 && this._gains.has(this._currentIndex)) {
      const targetGain = TIER_TRACKS[this._currentIndex].gain * this._userVolume
      const now = this.ctx.currentTime
      const g = this._gains.get(this._currentIndex).gain
      g.cancelScheduledValues(now)
      g.setValueAtTime(g.value, now)
      g.linearRampToValueAtTime(targetGain, now + 0.1)
    }
  }

  setZoneFx(active) {
    const now = this.ctx.currentTime
    const freq = active ? 3200 : 18000
    this.lowPass.frequency.cancelScheduledValues(now)
    this.lowPass.frequency.setValueAtTime(this.lowPass.frequency.value, now)
    this.lowPass.frequency.exponentialRampToValueAtTime(freq, now + 0.3)
  }

  pause() {
    this._paused = true
    if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {})
  }

  resume() {
    this._paused = false
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  stop() {
    this._playing = false
    for (const [idx, source] of this._sources.entries()) {
      try { source.stop() } catch {}
    }
    this._sources.clear()
    this._gains.clear()
    this._currentIndex = -1
  }
}
