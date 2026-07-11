// ─── Season 4 Music Manager ────────────────────────────────────────────────────
// Plays BGM for Season 4: The Genesis Protocol levels.
// Audio files live in src/audio/story_season_4/*.mp3, organized by sector (_s1, _s2, _s3, _s4)
// If a file is missing the fetch fails silently — game plays without BGM.

const SECTOR_TRACK_DEFS = [
  // s1 — The Blank Canvas (indices 0-1)
  { file: 'Perfect_Alignment_s1', gain: 0.88 },
  { file: 'The_Final_Column_s1', gain: 0.88 },
  // s2 — The Null Sector (indices 2-3)
  { file: 'Before_The_Screen_Goes_Black_s2', gain: 0.88 },
  { file: 'Velocity_Spike_s2', gain: 0.88 },
  // s3 — Asymmetry (indices 4-5)
  { file: 'Cascading_Logic_s3', gain: 0.88 },
  { file: 'The_Seventh_Pulse_s3', gain: 0.88 },
  // s4 — The Zenith (indices 6-8)
  { file: 'Ascending_the_Zenith_s4', gain: 0.88 },
  { file: 'Peak_Altitude_s4', gain: 0.88 },
  { file: 'The_Last_Level_s4', gain: 0.88 },
]

const SECTOR_POOLS = {
  s1: [0, 1],
  s2: [2, 3],
  s3: [4, 5],
  s4: [6, 7, 8],
}

// Build URL list
const TRACK_URLS = SECTOR_TRACK_DEFS.map(({ file }) =>
  new URL(`./story_season_4/${file}.mp3`, import.meta.url).href
)

export class Season4MusicManager {
  constructor(audioCtx) {
    this.ctx = audioCtx
    this._source = null
    this._playing = false
    this._currentIdx = -1
    this._sectorId = null
    this._playlist = []
    this._playlistPos = 0
    this._playRequested = false
    this._paused = false
    this._xFadeTimer = null
    this._xfadeSec = 1.6
    this._levelBpm = 120
    this._userVol = 1.0
    this._buffers = new Array(SECTOR_TRACK_DEFS.length).fill(null)
    this._loaded = new Array(SECTOR_TRACK_DEFS.length).fill(false)
    this._smoothBeat = 0

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

    this.masterGain.connect(this.analyser)
    this.analyser.connect(this.lpf)
    this.lpf.connect(this.volumeGain)
    this.volumeGain.connect(audioCtx.destination)

    // Preload all tracks
    this._preloadAll()
  }

  _preloadAll() {
    TRACK_URLS.forEach((url, idx) => {
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => {
          this._buffers[idx] = buf
          this._loaded[idx] = true
          if (this._playRequested && !this._playing && this._playlist.includes(idx)) this.play()
        })
        .catch(() => {
          /* Silently fail if track not found */
        })
    })
  }

  setPlaylist(sectorId) {
    if (sectorId === this._sectorId) return
    this._sectorId = sectorId
    this._playlist = SECTOR_POOLS[sectorId] || []
    this._playlistPos = 0
    this._playRequested = true
    this.stop()
    if (this._playlist.length > 0) {
      this.play()
    }
  }

  play() {
    if (this._playing || !this._playlist.length) return
    const idx = this._playlist[this._playlistPos]
    if (!this._buffers[idx]) {
      return
    }
    this._playTrack(idx)
    this._playing = true
    this._playRequested = false
    this._paused = false
  }

  pause() {
    if (!this._playing) return
    this.stop()
    this._paused = true
  }

  resume() {
    if (this._paused || !this._playing) this.play()
  }

  next() {
    if (!this._playlist.length) return
    this._playlistPos = (this._playlistPos + 1) % this._playlist.length
    this.stop()
    this._playRequested = true
    this.play()
  }

  prev() {
    if (!this._playlist.length) return
    this._playlistPos = (this._playlistPos - 1 + this._playlist.length) % this._playlist.length
    this.stop()
    this._playRequested = true
    this.play()
  }

  _playTrack(idx) {
    this.stop()
    this._currentIdx = idx
    const source = this.ctx.createBufferSource()
    source.buffer = this._buffers[idx]
    source.connect(this.masterGain)
    source.start(0)
    this._source = source

    const buf = this._buffers[idx]
    const dur = buf.duration
    clearTimeout(this._xFadeTimer)

    // Fade in
    this.masterGain.gain.setTargetAtTime(this._userVol, this.ctx.currentTime, 0.12)

    // Schedule next track when this one ends
    this._xFadeTimer = setTimeout(() => {
      this._playlistPos = (this._playlistPos + 1) % this._playlist.length
      this.play()
    }, (dur - this._xfadeSec) * 1000)
  }

  stop() {
    if (this._source) {
      this._source.stop(0)
      this._source = null
    }
    clearTimeout(this._xFadeTimer)
    this._playing = false
  }

  setVolume(vol) {
    this._userVol = Math.max(0, Math.min(1, vol))
    if (this._playing) {
      this.masterGain.gain.setTargetAtTime(this._userVol, this.ctx.currentTime, 0.06)
    }
  }

  getBeat() {
    if (!this._playing || !this._source) return 0
    const elapsed = this.ctx.currentTime - (this._source.startTime || 0)
    const beatMs = (60 / this._levelBpm) * 1000
    return (elapsed * 1000) / beatMs
  }

  getFrequencies() {
    this.analyser.getByteFrequencyData(this._fftData)
    return this._fftData
  }

  getSmoothedBeat() {
    const beat = this.getBeat()
    this._smoothBeat += (beat - this._smoothBeat) * 0.15
    return this._smoothBeat
  }

  isPlaying() {
    return this._playing
  }
}
