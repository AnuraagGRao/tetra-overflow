// Season 5 Pantheon boss music.
// Each deity owns one track from src/audio/story_season_5.

const TRACK_DEFS = [
  { bossId: 'atlas', file: 'Titanium_Weight', gain: 0.88 },
  { bossId: 'tyche', file: 'Severed_Power_Lines', gain: 0.88 },
  { bossId: 'erebus', file: 'The_Last_Hydraulic', gain: 0.88 },
  { bossId: 'chronos', file: 'Terminal_Protocol', gain: 0.88 },
  { bossId: 'mnemosyne', file: 'Terminal_Ascent', gain: 0.88 },
  { bossId: 'janus', file: 'Iron_Handshake', gain: 0.88 },
  { bossId: 'hephaestus', file: 'Hammer_Against_Anvil', gain: 0.88 },
  { bossId: 'eris', file: 'Hammer_on_Steel', gain: 0.88 },
  { bossId: 'nemesis', file: 'Iron_Threshold', gain: 0.88 },
  { bossId: 'helios', file: 'Weight_of_the_Hammer', gain: 0.88 },
  { bossId: 'aetherion', file: 'Under_The_Heavy_Anvil', gain: 0.9 },
]

const TRACK_URLS = TRACK_DEFS.map(track => new URL(`./story_season_5/${track.file}.mp3`, import.meta.url).href)
const BOSS_TRACKS = Object.fromEntries(TRACK_DEFS.map((track, index) => [track.bossId, index]))

function titleForTrack(track) {
  return track.file.replaceAll('_', ' ')
}

export class Season5MusicManager {
  constructor(audioContext) {
    this.ctx = audioContext
    this._source = null
    this._currentIndex = -1
    this._requestedIndex = -1
    this._playing = false
    this._paused = false
    this._userVolume = 1
    this._endTimer = null
    this._buffers = new Array(TRACK_DEFS.length).fill(null)

    this.trackGain = audioContext.createGain()
    this.masterGain = audioContext.createGain()
    this.lowPass = audioContext.createBiquadFilter()
    this.lowPass.type = 'lowpass'
    this.lowPass.frequency.value = 18000
    this.trackGain.connect(this.masterGain)
    this.masterGain.connect(this.lowPass)
    this.lowPass.connect(audioContext.destination)
    this.masterGain.gain.value = 0

    this._preload()
  }

  _preload() {
    TRACK_URLS.forEach((url, index) => {
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`Track request failed: ${response.status}`)
          return response.arrayBuffer()
        })
        .then(buffer => this.ctx.decodeAudioData(buffer))
        .then(decoded => {
          this._buffers[index] = decoded
          if (this._playing && this._requestedIndex === index && !this._source) this._playIndex(index)
        })
        .catch(error => console.warn(`[Season5Music] Failed to load ${TRACK_DEFS[index].file}:`, error))
    })
  }

  playForBoss(bossId) {
    const index = BOSS_TRACKS[bossId]
    if (index === undefined) return
    this._requestedIndex = index
    this._playing = true
    this._paused = false
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    if (this._currentIndex !== index || !this._source) this._playIndex(index)
  }

  _playIndex(index) {
    const buffer = this._buffers[index]
    if (!buffer || !this._playing) return
    this._stopSource()
    this._currentIndex = index

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.trackGain)
    source.start()
    this._source = source

    const track = TRACK_DEFS[index]
    this.trackGain.gain.setValueAtTime(track.gain, this.ctx.currentTime)
    const gain = this.masterGain.gain
    gain.cancelScheduledValues(this.ctx.currentTime)
    gain.setValueAtTime(gain.value, this.ctx.currentTime)
    gain.linearRampToValueAtTime(this._userVolume, this.ctx.currentTime + 0.5)

    try {
      window.dispatchEvent(new CustomEvent('tetris:nowplaying', { detail: { name: titleForTrack(track) } }))
    } catch {}

    clearTimeout(this._endTimer)
    this._endTimer = setTimeout(() => {
      this._source = null
      if (this._playing && !this._paused) this._playIndex(index)
    }, Math.max(1000, (buffer.duration - 0.1) * 1000))
  }

  _stopSource() {
    clearTimeout(this._endTimer)
    if (!this._source) return
    try { this._source.stop() } catch {}
    try { this._source.disconnect() } catch {}
    this._source = null
  }

  pause() {
    if (!this._playing || this._paused) return
    this._paused = true
    this.ctx.suspend().catch(() => {})
  }

  resume() {
    if (!this._playing) return
    this._paused = false
    this.ctx.resume().catch(() => {})
    if (!this._source && this._requestedIndex >= 0) this._playIndex(this._requestedIndex)
  }

  stop() {
    this._playing = false
    this._paused = false
    const gain = this.masterGain.gain
    gain.cancelScheduledValues(this.ctx.currentTime)
    gain.setTargetAtTime(0, this.ctx.currentTime, 0.08)
    this._stopSource()
  }

  setVolume(volume) {
    this._userVolume = Math.max(0, Math.min(1, Number(volume) || 0))
    if (this._playing) this.masterGain.gain.setTargetAtTime(this._userVolume, this.ctx.currentTime, 0.06)
  }

  setZoneFx(active) {
    this.lowPass.frequency.setTargetAtTime(active ? 720 : 18000, this.ctx.currentTime, 0.12)
    const targetGain = active ? this._userVolume * 0.42 : this._userVolume
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.12)
  }

  getNowPlaying() {
    const track = TRACK_DEFS[this._currentIndex]
    return track ? { title: titleForTrack(track), bossId: track.bossId } : null
  }

  destroy() {
    this.stop()
    try { this.trackGain.disconnect() } catch {}
    try { this.masterGain.disconnect() } catch {}
    try { this.lowPass.disconnect() } catch {}
    this.ctx.close().catch(() => {})
  }
}
