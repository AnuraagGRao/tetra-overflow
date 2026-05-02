import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './App.css'
import GameCanvas, { PIECE_COLOR_MAPS } from './components/GameCanvas'
import { BG_TYPE_TO_PIECE_THEME } from './logic/themeMappings'
import TouchControls from './components/TouchControls'
import ThemeSwitcher from './components/ThemeSwitcher'
import AboutPage from './components/AboutPage'
import SettingsPage from './components/SettingsPage'
import LoadingScreen from './components/LoadingScreen'
import GlitchOverlay from './components/GlitchOverlay'
import { useTheme } from './contexts/ThemeContext'
import { useAuth } from './contexts/AuthContext'
import { MusicManager } from './audio/musicManager'
import { saveGameResult } from './firebase/db'
import catImageUrl from './meme/oiia_cat_assets_by_awesomeconsoles7_djwlgwe-fullview.png'
import catMusicUrl from './meme/YTDown_YouTube_OIIAOIIA-CAT-but-in-4K-Not-Actually_Media_ZHgyQGoeaB0_009_128k.mp3'
import horror1Url from './meme/horror1.jpg'
import horror2Url from './meme/horror2.jpg'
import horror3Url from './meme/horror3.jpg'
import eerie1Url from './meme/horror1.mp3'
import eerie2Url from './meme/horror2.mp3'
import eerie3Url from './meme/horror3.mp3'
import {
  BLITZ_DURATION_MS, GAME_MODE, PURIFY_DURATION_MS,
  SPRINT_LINES, TetrisEngine, ZONE_DURATION_MS, ZONE_MIN_METER,
  TOWER_INIT_GARBAGE_MS,
} from './logic/gameEngine'
import { PIECES } from './logic/tetrominoes'

// ─── Key bindings ─────────────────────────────────────────────────────────────
const KEY_BINDINGS = {
  ArrowLeft:  { held: 'left' },
  ArrowRight: { held: 'right' },
  ArrowDown:  { held: 'softDrop' },
  ArrowUp:    { action: 'rotateCW' },
  KeyZ:       { action: 'rotateCCW' },
  Space:      { action: 'hardDrop' },
  KeyX:       { action: 'rotate180' },
  KeyF:       { action: 'rotate180' },
  KeyC:       { action: 'hold' },
  ShiftLeft:  { action: 'activateZone' },
  ShiftRight: { action: 'activateZone' },
  Escape:     { action: 'pause' },
  KeyP:       { action: 'pause' },
}



// ─── Audio ────────────────────────────────────────────────────────────────────
const MAX_FRAME_TIME_MS = 34
const ToneContext = window.AudioContext || window.webkitAudioContext
let sharedAudioContext
let musicManager

// SFX master volume scale (0–1), updated from config
let _sfxVol = 1.0
const setSfxVolume = (v) => { _sfxVol = Math.max(0, Math.min(1, v)) }
// Temporary ducking multiplier for SFX (0–1) — used during jumpscares etc.
let _sfxDuck = 1.0
const setSfxDuck = (v) => { _sfxDuck = Math.max(0, Math.min(1, v)) }

// SFX anti-spam gate: prevents rapid-fire repeats that can sound like loops
const _sfxGate = {}
// Dev-only SFX logger. Enable in the console with: window.__sfxDebug = true
// Logs in BOTH dev and prod when __sfxDebug is truthy.
const sfxLog = (name, status = 'play') => {
  try {
    if (typeof window !== 'undefined' && window.__sfxDebug) {
      console.log(`[SFX] ${name} ${status} @ ${Math.round(performance.now())}`)
    }
  } catch {}
}
const sfxPermit = (name, minGapMs = 60, windowMs = 800, maxPerWindow = 6) => {
  const now = performance.now()
  const g = _sfxGate[name] || { last: 0, hits: [] }
  if (now - g.last < minGapMs) return false
  g.last = now
  g.hits = (g.hits || []).filter(t => now - t < windowMs)
  if (g.hits.length >= maxPerWindow) { _sfxGate[name] = g; sfxLog(name, 'drop'); return false }
  g.hits.push(now)
  _sfxGate[name] = g
  sfxLog(name, 'play')
  return true
}

const getAudioCtx = () => {
  if (!ToneContext) return null
  if (!sharedAudioContext) {
    sharedAudioContext = new ToneContext()
    musicManager = new MusicManager(sharedAudioContext)
  }
  return sharedAudioContext
}

const playNote = (freq, duration, gain, type = 'sine', offset = 0) => {
  const ctx = getAudioCtx(); if (!ctx) return
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination)
  osc.type = type; osc.frequency.value = freq
  const t = ctx.currentTime + offset
  g.gain.setValueAtTime(gain * _sfxVol, t)
  g.gain.setValueAtTime(gain * _sfxVol * _sfxDuck, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.start(t); osc.stop(t + duration + 0.01)
}
const arp = (notes, dur = 0.07, gain = 0.04, type = 'triangle') =>
  notes.forEach((f, i) => playNote(f, dur, gain, type, i * dur * 0.65))

// Noise burst helper for whooshes/impacts
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

// Move SFX — subtle, rate-limited so DAS doesn't spam it
let _lastMoveBeep = 0
const playMoveSFX = (theme = 'classic') => {
  sfxLog('move')
  const now = performance.now();
  if (now - _lastMoveBeep < 75) return;
  _lastMoveBeep = now;
  switch (theme) {
    case 'sketch':
      // Even louder
      playNoise(2200, 0.36, 0.045); // was 0.21, now 0.36
      playNoise(4000, 0.18, 0.020, 0.009); // was 0.09, now 0.18
      playNote(310, 0.03, 0.04, 'triangle', 0.006); // was 0.02, now 0.04
      break;
    case 'blueprint':
      playNote(910, 0.018, 0.32, 'triangle');
      playNoise(2700, 0.11, 0.020, 0.005);
      break;
    case 'stone':
      playNote(120, 0.10, 0.28, 'triangle');
      playNoise(280, 0.13, 0.025);
      break;
    case 'wood':
      playNote(270, 0.065, 0.36, 'triangle');
      playNoise(820, 0.07, 0.023, 0.009);
      break;
    case 'bauhaus':
      playNote(600, 0.06, 0.36, 'square');
      playNoise(1100, 0.13, 0.018, 0.004);
      break;
    case 'dmg':
      playNote(330, 0.026, 0.25, 'triangle');
      break;
    default:
      playNote(380, 0.022, 0.26, 'triangle');
      break;
  }
};

const playTapSFX = (theme = 'classic') => {
  sfxLog('tap')
  switch (theme) {
    case 'sketch':
      playNoise(3200, 0.24, 0.022);
      playNote(1250, 0.023, 0.10, 'triangle', 0.006);
      break;
    case 'stone':
      playNote(420, 0.029, 0.18, 'triangle');
      break;
    case 'wood':
      playNote(640, 0.021, 0.19, 'triangle');
      playNote(1200, 0.013, 0.10, 'triangle', 0.008);
      break;
    case 'bauhaus':
      playNote(880, 0.025, 0.20, 'square');
      break;
    case 'blueprint':
      playNote(1200, 0.022, 0.15, 'triangle');
      playNote(1800, 0.011, 0.07, 'triangle', 0.009);
      break;
    case 'dmg':
      playNote(1200, 0.025, 0.13, 'triangle');
      break;
    default:
      playNote(1200, 0.028, 0.15, 'sine');
      break;
  }
};

// Softer chaos wave cue for Ultimate (replaces harsh infection SFX)
let _lastChaosSfx = 0
const playChaosWaveSFX = (theme = 'classic') => {
  const now = performance.now()
  // Rate-limit to avoid overlap if waves get very close together
  if (now - _lastChaosSfx < 1200) return
  _lastChaosSfx = now
  // Gentle whoosh + low thump, both obey global SFX duck
  playNoise(2200, 0.18, 0.055)
  playNote(110, 0.10, 0.11, 'sine', 0.01)
}

const playSwipeSFX = (dir, theme = 'classic') => {
  switch (theme) {
    case 'sketch':
      // Papery swish: short, wideband noise for left/right, higher for up/down
      if (dir === 'left' || dir === 'right') {
        playNoise(3300, 0.47, 0.026); // bold paper air
      } else if (dir === 'up') {
        playNoise(4400, 0.33, 0.029);
      } else if (dir === 'down') {
        playNoise(4200, 0.38, 0.019);
      }
      break;
    case 'stone':
      if (dir === 'left' || dir === 'right') {
        playNote(160, 0.03, 0.29, 'triangle');
      } else if (dir === 'up') {
        playNote(320, 0.024, 0.24, 'triangle');
      } else if (dir === 'down') {
        playNote(220, 0.041, 0.22, 'triangle');
      }
      break;
    case 'wood':
      if (dir === 'left' || dir === 'right') {
        playNote(330, 0.038, 0.24, 'triangle');
        playNoise(800, 0.13, 0.011, 0.009);
      } else {
        playNote(210, 0.052, 0.21, 'triangle');
        playNoise(700, 0.14, 0.017, 0.012);
      }
      break;
    case 'bauhaus':
      playNote(dir === 'right' ? 770 : 440, 0.025, 0.18, 'square');
      break;
    case 'blueprint':
      playNote(dir === 'right' ? 1760 : 1098, 0.021, 0.17, 'triangle');
      playNoise(3000, 0.06, 0.013, 0.006);
      break;
    case 'dmg':
      playNote(dir === 'right' ? 880 : 520, 0.031, 0.15, 'triangle');
      break;
    default:
      if (dir === 'left' || dir === 'right') {
        playNote(dir === 'left' ? 520 : 620, 0.040, 0.15, 'triangle');
      } else if (dir === 'up') {
        playNote(700, 0.025, 0.18, 'triangle');
        playNote(900, 0.022, 0.09, 'triangle', 0.018);
      } else if (dir === 'down') {
        playNote(600, 0.025, 0.18, 'triangle');
        playNote(420, 0.022, 0.09, 'triangle', 0.018);
      }
      break;
  }
};

const playRotateSFX = (theme = 'classic') => {
  if (!sfxPermit('rotate', 30, 400, 10)) return
  switch (theme) {
    case 'sketch':
      // Pencil twist: short burst noise + mild note
      playNoise(3400, 0.14, 0.022);
      playNote(620, 0.043, 0.06, 'triangle'); // papery "scuff"
      break;
    case 'stone':
      // Heavy clack
      playNote(100, 0.09, 0.16, 'triangle');
      playNoise(200, 0.08, 0.021, 0.003);
      break;
    case 'wood':
      // Hollow wood snap
      playNote(320, 0.048, 0.17, 'triangle');
      playNote(640, 0.019, 0.06, 'triangle', 0.018);
      break;
    case 'bauhaus':
      playNote(680, 0.036, 0.18, 'square');
      break;
    case 'blueprint':
      playNote(1450, 0.013, 0.19, 'triangle');
      playNoise(4400, 0.02, 0.012, 0.008);
      break;
    case 'dmg':
      playNote(1200, 0.025, 0.15, 'triangle');
      break;
    default:
      playNote(1100, 0.032, 0.24, 'triangle');
      playNote(750,  0.022, 0.18, 'sine', 0.010);
      break;
  }
};

const playLockSFX = (theme = 'classic') => {
  if (!sfxPermit('lock', 45, 600, 8)) return
  switch (theme) {
    case 'sketch':
      // Paper tap + pencil flick
      playNoise(1600, 0.17, 0.017);
      playNote(240, 0.036, 0.11, 'triangle', 0.004);
      break;
    case 'stone':
      // Heavy stone thunk
      playNote(52, 0.11, 0.22, 'sine');
      playNoise(250, 0.14, 0.018);
      break;
    case 'wood':
      // Wood on wood
      playNote(410, 0.036, 0.18, 'triangle');
      playNote(840, 0.018, 0.10, 'triangle', 0.008);
      break;
    case 'bauhaus':
      playNote(260, 0.038, 0.23, 'square');
      break;
    case 'blueprint':
      playNote(970, 0.023, 0.14, 'triangle');
      playNoise(2800, 0.06, 0.016, 0.003);
      break;
    case 'dmg':
      playNote(220, 0.03, 0.16, 'triangle');
      break;
    default: {
      // Classic fallback (oscillator thud)
      const ctx = getAudioCtx(); if (!ctx) return;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime;
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(52, t + 0.07);
      g.gain.setValueAtTime(0.18 * _sfxVol, t); // louder than before
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
      osc.start(t); osc.stop(t + 0.11);
      break;
    }
  }
};

const playHardDropSFX = (theme = 'classic') => {
  if (!sfxPermit('hardDrop', 80, 600, 6)) return
  switch (theme) {
    case 'sketch':
      // Loud paper slam: wideband noise + low triangle blop
      playNoise(2500, 0.38, 0.055);
      playNote(103,  0.19, 0.23, 'triangle');
      break;
    case 'stone':
      // Stone THUD + high-pitched chisel
      playNote(54,  0.22, 0.35, 'sine');      // bottom stone impact
      playNoise(400, 0.18, 0.12);
      playNote(311, 0.03, 0.09, 'square', 0.021); // chisel scrape
      break;
    case 'wood':
      // Firm wood slam + knock
      playNote(176, 0.12, 0.32, 'triangle');
      playNote(660, 0.025, 0.17, 'triangle', 0.012);
      playNoise(900, 0.09, 0.04, 0.008);
      break;
    case 'bauhaus':
      // Heavy block plop
      playNote(440, 0.22, 0.29, 'square');
      playNoise(2200, 0.13, 0.042, 0.006);
      break;
    case 'blueprint':
      // Blueprint: high/low beep + staple
      playNote(1260, 0.018, 0.25, 'triangle');
      playNote(80,   0.21, 0.17, 'triangle');
      playNoise(4100, 0.09, 0.025, 0.005);
      break;
    case 'dmg':
      playNote(247, 0.14, 0.25, 'triangle');
      playNote(82, 0.22, 0.19, 'sine');
      break;
    default:
      // Classic – deep thud, medium click, short noise
      playNote(75, 0.18, 0.44, 'sine');
      playNote(410, 0.06, 0.14, 'triangle', 0.010);
      playNoise(900, 0.18, 0.06, 0.012);
      break;
  }
};

const playLineClearSFX = (theme = 'classic') => {
  if (!sfxPermit('lineClear', 70, 800, 6)) return
  switch (theme) {
    case 'sketch':
      // Paper scrap: sharp filtered noise and soft "bristle" tap
      playNoise(3400, 0.29, 0.11);
      playNote(470, 0.07, 0.06, 'triangle', 0.012);
      break;
    case 'stone':
      // Cracking rock burst
      playNoise(1600, 0.24, 0.10);
      playNote(90, 0.25, 0.12, 'triangle', 0.018);
      playNote(390, 0.048, 0.05, 'triangle', 0.020);
      break;
    case 'wood':
      // Snapping branch + knock
      playNote(250, 0.115, 0.15, 'triangle', 0.03);
      playNoise(620, 0.17, 0.058);
      break;
    case 'bauhaus':
      // Playful percussive riff
      arp([330, 392, 523, 784, 1100], 0.061, 0.17, 'square');
      playNoise(2100, 0.07, 0.04, 0.009);
      break;
    case 'blueprint':
      playNote(990, 0.035, 0.21, 'triangle');
      playNoise(2900, 0.09, 0.024, 0.006);
      break;
    case 'dmg':
      playNote(590, 0.042, 0.15, 'triangle');
      arp([392, 659, 784], 0.083, 0.11, 'sine');
      break;
    default:
      playNoise(9000, 0.18, 0.11);
      arp([392, 523, 659, 784], 0.095, 0.18, 'sine');
      break;
  }
};

const playTSpinSFX = (theme = 'classic') => {
  if (!sfxPermit('tspin', 100, 800, 4)) return
  switch (theme) {
    case 'sketch':
      // Squeaky pencil scratch + short noise
      playNote(710, 0.055, 0.19, 'triangle');
      playNote(1319, 0.088, 0.13, 'triangle', 0.022);
      playNoise(2600, 0.14, 0.038, 0.009);
      break;
    case 'stone':
      // "Chink" and bold clack
      playNote(230, 0.15, 0.20, 'triangle');
      playNote(784, 0.09, 0.13, 'triangle', 0.01);
      playNoise(500, 0.11, 0.022, 0.006);
      break;
    case 'wood':
      // Sharp wooden click
      playNote(523, 0.12, 0.21, 'triangle');
      playNote(987, 0.04, 0.12, 'sine', 0.042);
      playNoise(1200, 0.09, 0.013, 0.007);
      break;
    case 'bauhaus':
      // Boop x2
      playNote(1308, 0.054, 0.22, 'square');
      playNote(784, 0.062, 0.14, 'square', 0.013);
      break;
    case 'blueprint':
      playNote(2048, 0.023, 0.19, 'triangle');
      playNote(1047, 0.053, 0.13, 'triangle', 0.02);
      playNoise(3700, 0.07, 0.014, 0.01);
      break;
    case 'dmg':
      playNote(784, 0.18, 0.14, 'triangle');
      playNote(988, 0.11, 0.07, 'triangle', 0.012);
      break;
    default:
      // Classic: arpeggio blast + twinkle
      arp([330, 415, 523, 659, 784, 988, 1047], 0.08, 0.22, 'triangle');
      playNote(330, 0.20, 0.13, 'sine', 0.06);
      break;
  }
};

const playTetrisSFX = (theme = 'classic') => {
  if (!sfxPermit('tetris', 120, 1000, 3)) return
  switch (theme) {
    case 'sketch':
      // Ripping paper & celebratory "clap"
      playNoise(3300, 0.42, 0.12);
      playNote(675, 0.045, 0.12, 'triangle', 0.015);
      playNote(940, 0.037, 0.11, 'triangle', 0.06);
      break;
    case 'stone':
      // Giant rock rumble + "crack"
      playNoise(420, 0.45, 0.16);
      playNote(64, 0.3, 0.39, 'triangle');
      playNote(220, 0.041, 0.12, 'square', 0.076);
      break;
    case 'wood':
      // Dense hollow multi-knock
      playNote(130, 0.15, 0.18, 'triangle');
      playNote(370, 0.07, 0.14, 'triangle', 0.019);
      playNote(900, 0.03, 0.14, 'triangle', 0.038);
      playNoise(1000, 0.29, 0.059, 0.033);
      break;
    case 'bauhaus':
      // Stuttering percussive scale
      arp([494, 587, 784, 988, 1175], 0.082, 0.24, 'square');
      playNoise(3000, 0.10, 0.08, 0.010);
      break;
    case 'blueprint':
      // Metallic beep cascade + sharp noise
      playNote(1840, 0.025, 0.27, 'triangle');
      arp([932, 1245, 1480], 0.032, 0.18, 'triangle');
      playNoise(4500, 0.19, 0.034, 0.011);
      break;
    case 'dmg':
      playNote(523, 0.052, 0.21, 'triangle');
      playNote(1047, 0.041, 0.13, 'triangle', 0.035);
      playNoise(3600, 0.08, 0.06, 0.022);
      break;
    default:
      // Classic: celebratory sweep + bass slap
      arp([262, 330, 392, 523, 659, 784, 1047, 1319], 0.11, 0.18, 'sine');
      playNote(131, 0.41, 0.34, 'triangle', 0.13);
      playNoise(1900, 0.25, 0.18, 0.027);
      break;
  }
};

const playAllClearSFX = (theme = 'classic') => {
  if (!sfxPermit('allclear', 200, 1500, 2)) return
  switch (theme) {
    case 'sketch':
      // Great sweep, paper-air fanfare, bright paper shimmer
      arp([523, 659, 784, 987, 1175, 1397], 0.13, 0.19, 'triangle');
      playNoise(4400, 0.27, 0.12, 0.017);
      playNote(2300, 0.03, 0.20, 'triangle', 0.08);
      break;
    case 'stone':
      // Rock crumbles + rumble blast
      playNote(148, 0.21, 0.34, 'triangle');
      playNoise(880, 0.23, 0.16, 0.014);
      arp([123, 330, 494, 740], 0.09, 0.18, 'triangle');
      break;
    case 'wood':
      // Wooden chime + celebratory knock
      playNote(987, 0.05, 0.22, 'triangle');
      arp([248, 364, 523, 740, 1100], 0.088, 0.21, 'triangle');
      playNoise(2400, 0.09, 0.04, 0.037);
      break;
    case 'bauhaus':
      // Rapid square arpeggio, bright, "confetti" feel
      arp([393, 587, 784, 1175, 1568, 2349, 3136, 3951], 0.07, 0.25, 'square');
      playNote(784, 0.07, 0.16, 'square', 0.06);
      break;
    case 'blueprint':
      // Big metallic fanfare
      arp([1245, 1661, 2093, 2489], 0.068, 0.20, 'triangle');
      playNote(880, 0.21, 0.19, 'triangle', 0.04);
      playNoise(3400, 0.24, 0.036, 0.027);
      break;
    case 'dmg':
      arp([262, 330, 392, 523, 659, 784, 1047], 0.11, 0.15, 'triangle');
      playNote(392, 0.15, 0.15, 'triangle', 0.1);
      break;
    default:
      // Classic: full chromatic sweep + bass boom
      const fs = [262,294,330,349,392,440,494,523,587,659,698,784,880,988,1047,1319];
      fs.forEach((f, i) => playNote(f, 0.14, 0.18, 'sine', i * 0.038));
      playNote(65,  0.45, 0.21, 'sine', 0.22);
      playNote(131, 0.30, 0.19, 'sine', 0.22);
      playNoise(10000, 0.23, 0.22, 0.12);
      break;
  }
};

const playB2BSFX = (theme = 'classic') => {
  if (!sfxPermit('b2b', 200, 1200, 2)) return
  switch (theme) {
    case 'sketch':
      // Double pencil tap and paper flick
      playNote(1190, 0.038, 0.17, 'triangle');
      playNoise(2450, 0.12, 0.012, 0.011);
      playNote(2050, 0.030, 0.13, 'triangle', 0.012);
      break;
    case 'stone':
      // Consecutive rock strikes
      playNote(82, 0.025, 0.31, 'triangle');
      playNote(246, 0.021, 0.13, 'triangle', 0.011);
      playNoise(340, 0.13, 0.016, 0.012);
      break;
    case 'wood':
      // Thumping double knock
      playNote(440, 0.048, 0.22, 'triangle');
      playNote(760, 0.016, 0.21, 'triangle', 0.010);
      playNote(1380, 0.012, 0.10, 'triangle', 0.024);
      break;
    case 'bauhaus':
      playNote(1070, 0.041, 0.28, 'square');
      playNote(1840, 0.021, 0.14, 'square', 0.013);
      break;
    case 'blueprint':
      // Quick ascending trio
      playNote(1319, 0.012, 0.23, 'triangle');
      playNote(1480, 0.019, 0.19, 'triangle', 0.012);
      playNoise(2700, 0.11, 0.009, 0.011);
      break;
    case 'dmg':
      playNote(988, 0.063, 0.23, 'triangle');
      playNote(523, 0.061, 0.19, 'triangle', 0.012);
      break;
    default:
      arp([1047, 1319, 1568], 0.038, 0.22, 'sine');
      break;
  }
};

// Softer floor-advance bell (separate from 'tetris' cue) — single resonant tone, not an arp
const playFloorFanfareSFX = (theme = 'classic') => {
  if (!sfxPermit('floor', 1200, 4000, 1)) return  // very restrictive — once per 1.2s, one per 4s window
  // Resonant bell: distinct from any line-clear arp so it doesn't feel like a loop
  playNote(1047, 0.28, 0.08, 'sine')
  playNote(1568, 0.18, 0.05, 'sine', 0.07)
  playNote(2093, 0.12, 0.03, 'sine', 0.14)
}

const playLevelUpSFX = (theme = 'classic') => {
  if (!sfxPermit('levelup', 250, 1500, 2)) return
  switch (theme) {
    case 'sketch':
      arp([262, 330, 392, 660, 1230], 0.10, 0.20, 'triangle');
      playNoise(2700, 0.15, 0.022, 0.023);
      break;
    case 'stone':
      arp([220, 230, 330, 392], 0.09, 0.21, 'triangle');
      playNote(82, 0.09, 0.21, 'triangle', 0.067);
      break;
    case 'wood':
      arp([330, 392, 523, 784], 0.11, 0.18, 'triangle');
      playNote(900, 0.027, 0.17, 'triangle', 0.021);
      break;
    case 'bauhaus':
      arp([330, 392, 523, 784, 988], 0.07, 0.22, 'square');
      break;
    case 'blueprint':
      arp([523, 659, 1108, 1450], 0.083, 0.19, 'triangle');
      break;
    case 'dmg':
      arp([294, 392, 523, 784], 0.09, 0.17, 'triangle');
      break;
    default:
      arp([261.6, 329.6, 392.0, 523.3], 0.10, 0.20, 'triangle');
      break;
  }
};

const playZoneActivateSFX = (theme = 'classic') => {
  if (!sfxPermit('zoneActivate', 250, 2000, 2)) return
  switch (theme) {
    case 'sketch':
      // Dramatic big paper whip + rising clarity
      playNoise(3500, 0.31, 0.20, 0);
      arp([294, 523, 1047, 1500, 1850, 2047], 0.065, 0.19, 'triangle');
      playNote(1660, 0.05, 0.22, 'triangle', 0.15);
      break;
    case 'stone':
      // Asteroid impact: thud, low tremble, and sparkle
      playNote(88, 0.22, 0.32, 'sine');
      playNoise(1100, 0.23, 0.23, 0.01);
      playNote(1760, 0.04, 0.13, 'triangle', 0.16);
      break;
    case 'wood':
      // Wooden chime/twinkle + pop
      arp([330, 392, 523, 660, 1047, 1200], 0.052, 0.17, 'triangle');
      playNote(2047, 0.03, 0.18, 'triangle', 0.13);
      break;
    case 'bauhaus':
      // Staggered square pulse
      arp([523, 784, 1097, 1568, 2000], 0.068, 0.23, 'square');
      playNoise(2100, 0.14, 0.07, 0.05);
      break;
    case 'blueprint':
      // Ascending metallic shimmer + staple
      arp([740, 990, 1480, 2047], 0.046, 0.20, 'triangle');
      playNoise(4000, 0.13, 0.045, 0.08);
      break;
    case 'dmg':
      arp([392, 523, 659, 784, 988], 0.090, 0.14, 'triangle');
      playNote(1047, 0.05, 0.13, 'triangle', 0.12);
      break;
    default:
      arp([131, 165, 196, 262, 330, 392, 523, 784], 0.13, 0.20, 'triangle');
      playNoise(2500, 0.24, 0.16, 0.06);
      break;
  }
};

const playGameOverSFX = (theme = 'classic') => {
  arp([523, 466, 415, 370, 330, 294, 262, 233, 220], 0.12, 0.16, 'sawtooth')
  playNote(55, 0.5, 0.14, 'sine', 0.12)
  playNoise(700, 0.10, 0.4, 0.06)
}

const playComboSFX = (c, theme = 'classic') => {
  const base = Math.min(440 + c * 80, 1600);
  switch (theme) {
    case 'sketch':
      playNote(base, 0.08, 0.16, 'triangle');
      playNoise(4000, 0.11, 0.023, 0.009);
      if (c >= 3) playNote(base * 1.33, 0.07, 0.12, 'triangle', 0.020);
      break;
    case 'stone':
      playNote(base / 2, 0.10, 0.18, 'triangle');
      playNoise(800, 0.13, 0.022, 0.010);
      if (c >= 3) playNote(base * 0.75, 0.06, 0.09, 'triangle', 0.02);
      break;
    case 'wood':
      playNote(base, 0.08, 0.15, 'triangle');
      playNote(base * 1.25, 0.07, 0.10, 'triangle', 0.013);
      playNoise(1100, 0.08, 0.010, 0.014);
      break;
    case 'bauhaus':
      playNote(base, 0.08, 0.21, 'square');
      if (c >= 3) playNote(base * 1.15, 0.06, 0.13, 'square', 0.016);
      break;
    case 'blueprint':
      playNote(base * 1.5, 0.03, 0.18, 'triangle');
      playNoise(2800, 0.07, 0.019, 0.008);
      break;
    case 'dmg':
      playNote(base * 0.7, 0.043, 0.16, 'triangle');
      break;
    default:
      playNote(base, 0.09, 0.16, 'triangle');
      if (c >= 3) playNote(base * 1.26, 0.06, 0.14, 'triangle', 0.022);
      if (c >= 5) playNote(base * 1.5,  0.05, 0.13, 'sine', 0.044);
      break;
  }
};

const playZenResetSFX = (theme = 'classic') => {
  switch (theme) {
    case 'sketch':
      // Gentle wind-brush and sweep
      playNoise(2400, 0.19, 0.16, 0.01);
      arp([784, 880, 1047, 1319, 1568, 1760], 0.14, 0.14, 'triangle');
      break;
    case 'stone':
      // Deep low rumble + “reset” shimmer
      playNote(49, 0.24, 0.17, 'triangle');
      playNote(156, 0.16, 0.13, 'triangle');
      arp([220, 330, 392], 0.12, 0.14, 'triangle');
      playNoise(800, 0.15, 0.23, 0.04);
      break;
    case 'wood':
      // Upward wood knocks & gentle bloom
      playNote(392, 0.09, 0.21, 'triangle');
      arp([392, 523, 784, 987], 0.11, 0.17, 'triangle');
      playNoise(1500, 0.06, 0.08, 0.03);
      break;
    case 'bauhaus':
      // Twinkling, musical color reset
      arp([523, 659, 784, 987, 1175], 0.085, 0.19, 'square');
      playNote(784, 0.08, 0.15, 'square', 0.031);
      break;
    case 'blueprint':
      arp([930, 1100, 1480, 1960], 0.083, 0.20, 'triangle');
      playNoise(2550, 0.14, 0.061, 0.014);
      break;
    case 'dmg':
      arp([784, 880, 1047, 1319], 0.13, 0.13, 'triangle');
      playNote(523, 0.14, 0.13, 'triangle', 0.09);
      break;
    default:
      arp([784, 880, 1047, 1319], 0.20, 0.19, 'sine');
      break;
  }
};

const playPauseSFX = (theme = 'classic') => {
  switch (theme) {
    case 'sketch':
      playNote(485, 0.08, 0.18, 'triangle');
      playNoise(1200, 0.12, 0.016);
      break;
    case 'stone':
      playNote(132, 0.08, 0.20, 'triangle');
      playNoise(500, 0.10, 0.014);
      break;
    case 'wood':
      playNote(480, 0.07, 0.21, 'triangle');
      playNote(710, 0.02, 0.12, 'triangle', 0.026);
      break;
    case 'bauhaus':
      playNote(550, 0.04, 0.21, 'square');
      playNote(330, 0.06, 0.13, 'square', 0.05);
      break;
    case 'blueprint':
      playNote(1180, 0.03, 0.13, 'triangle');
      playNoise(3100, 0.09, 0.013, 0.008);
      break;
    case 'dmg':
      playNote(880, 0.048, 0.13, 'triangle');
      break;
    default:
      playNote(440, 0.06, 0.13, 'triangle');
      playNote(330, 0.05, 0.13, 'triangle', 0.055);
      break;
  }
};

const playResumeSFX = (theme = 'classic') => {
  switch (theme) {
    case 'sketch':
      playNote(660, 0.045, 0.19, 'triangle');
      playNote(840, 0.041, 0.15, 'triangle', 0.06);
      playNoise(2100, 0.09, 0.012, 0.013);
      break;
    case 'stone':
      playNote(240, 0.058, 0.19, 'triangle');
      playNote(392, 0.046, 0.19, 'triangle', 0.05);
      playNoise(700, 0.09, 0.015, 0.01);
      break;
    case 'wood':
      playNote(540, 0.053, 0.16, 'triangle');
      playNote(1400, 0.031, 0.09, 'triangle', 0.055);
      break;
    case 'bauhaus':
      playNote(990, 0.047, 0.19, 'square');
      playNote(784, 0.061, 0.12, 'square', 0.052);
      break;
    case 'blueprint':
      playNote(1500, 0.025, 0.11, 'triangle');
      playNote(860, 0.055, 0.12, 'triangle', 0.02);
      playNoise(3900, 0.08, 0.018, 0.008);
      break;
    case 'dmg':
      playNote(1320, 0.038, 0.13, 'triangle');
      playNote(880, 0.048, 0.16, 'triangle', 0.022);
      break;
    default:
      playNote(330, 0.05, 0.13, 'triangle');
      playNote(440, 0.06, 0.15, 'triangle', 0.055);
      playNote(523, 0.06, 0.15, 'triangle', 0.110);
      break;
  }
};

const playInfectionSFX = (theme = 'classic') => {
  switch (theme) {
    case 'sketch':
      // Paper-rip + pencil scratch (unsettling)
      playNoise(1800, 0.23, 0.14);
      playNote(210, 0.61, 0.06, 'triangle', 0.17);
      playNoise(4500, 0.10, 0.040, 0.06);
      break;
    case 'stone':
      // Jagged "shatter"
      playNoise(900, 0.20, 0.23);
      playNote(49, 0.45, 0.15, 'triangle', 0.16);
      break;
    case 'wood':
      playNoise(1500, 0.18, 0.19);
      playNote(220, 0.33, 0.09, 'triangle', 0.13);
      break;
    case 'bauhaus':
      playNoise(1100, 0.21, 0.12);
      playNote(1000, 0.08, 0.17, 'square', 0.12);
      break;
    case 'blueprint':
      playNote(1600, 0.07, 0.13, 'triangle');
      playNoise(4100, 0.14, 0.048, 0.07);
      break;
    case 'dmg':
      playNote(82, 0.45, 0.12, 'triangle');
      playNote(104, 0.33, 0.14, 'triangle', 0.17);
      break;
    default: {
      // OG/creepy: detuned oscillator, shimmer, crackle
      const ctx = getAudioCtx(); if (!ctx) return;
      const t = ctx.currentTime;
      // Warble low
      const osc1 = ctx.createOscillator(), g1 = ctx.createGain();
      osc1.connect(g1); g1.connect(ctx.destination);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(82, t);
      osc1.frequency.linearRampToValueAtTime(74, t + 0.18);
      osc1.frequency.linearRampToValueAtTime(88, t + 0.36);
      osc1.frequency.linearRampToValueAtTime(76, t + 0.55);
      g1.gain.setValueAtTime(0.14 * _sfxVol, t);
      g1.gain.linearRampToValueAtTime(0.11 * _sfxVol, t + 0.55);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.70);
      osc1.start(t); osc1.stop(t + 0.71);
      // Shimmer
      const osc2 = ctx.createOscillator(), g2 = ctx.createGain();
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, t + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(440, t + 0.55);
      g2.gain.setValueAtTime(0.12 * _sfxVol, t + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc2.start(t + 0.05); osc2.stop(t + 0.66);
      // Crackle
      playNoise(1200, 0.11, 0.5, 0.02);
      break;
    }
  }
};

const playHoldSFX = (theme = 'classic') => {
  switch (theme) {
    case 'sketch':
      // Quick "flip" with pencil tap
      playNoise(3200, 0.18, 0.018);
      playNote(890, 0.025, 0.12, 'triangle', 0.006);
      break;
    case 'stone':
      // Chipped rock tap
      playNote(210, 0.035, 0.22, 'triangle');
      playNoise(200, 0.07, 0.012);
      break;
    case 'wood':
      playNote(440, 0.027, 0.21, 'triangle');
      playNote(990, 0.013, 0.12, 'triangle', 0.010);
      break;
    case 'bauhaus':
      playNote(1288, 0.021, 0.17, 'square');
      break;
    case 'blueprint':
      playNote(1110, 0.019, 0.14, 'triangle');
      playNoise(2400, 0.06, 0.008, 0.009);
      break;
    case 'dmg':
      playNote(350, 0.035, 0.13, 'triangle');
      break;
    default:
      playNote(660, 0.045, 0.21, 'triangle');
      playNote(990, 0.035, 0.17, 'triangle', 0.018);
      break;
  }
};

const playZoneMeterMilestoneSFX = (tier, theme = 'classic') => {
  // tier: 1 = 50%, 2 = 75%
  switch (theme) {
    case 'sketch':
      if (tier === 2) {
        playNoise(2800, 0.19, 0.13);
        playNote(1190, 0.031, 0.13, 'triangle', 0.05);
      } else {
        playNoise(3200, 0.17, 0.09);
      }
      break;
    case 'stone':
      if (tier === 2) {
        playNote(440, 0.12, 0.18, 'triangle');
        playNoise(900, 0.16, 0.028, 0.018);
      } else {
        playNote(280, 0.08, 0.13, 'triangle');
      }
      break;
    case 'wood':
      if (tier === 2) {
        playNote(900, 0.09, 0.16, 'triangle');
        playNoise(1100, 0.15, 0.021, 0.015);
      } else {
        playNote(523, 0.08, 0.13, 'triangle');
        playNoise(600, 0.07, 0.018);
      }
      break;
    case 'bauhaus':
      if (tier === 2) {
        arp([392, 784, 1097], 0.06, 0.22, 'square');
      } else {
        playNote(784, 0.07, 0.12, 'square');
      }
      break;
    case 'blueprint':
      if (tier === 2) {
        arp([990, 1480], 0.07, 0.13, 'triangle');
        playNoise(2400, 0.09, 0.022, 0.014);
      } else {
        playNote(740, 0.09, 0.12, 'triangle');
      }
      break;
    case 'dmg':
      if (tier === 2) {
        playNote(988, 0.09, 0.14, 'triangle');
        playNote(784, 0.10, 0.09, 'triangle', 0.025);
      } else {
        playNote(784, 0.08, 0.13, 'triangle');
      }
      break;
    default:
      if (tier === 2) {
        playNote(880, 0.07, 0.14, 'triangle');
        playNote(1320, 0.05, 0.11, 'triangle', 0.03);
      } else {
        playNote(660, 0.06, 0.11, 'triangle');
      }
      break;
  }
};

const playLineClearHaptic = (lines) => {
  if (lines >= 4) return [20, 5, 20, 5, 20, 5, 60]
  if (lines === 3) return [15, 5, 15, 5, 15]
  if (lines === 2) return [12, 5, 12]
  return [10]
}

const playCountdownTickSFX = (second, theme = 'classic') => {
  // Rising pitch/urgency as count approaches 0
  switch (theme) {
    case 'sketch': {
      // Loud paper snap + sharp click, higher pitch/urgency late
      const f = 610 + (10 - second) * 70;
      playNoise(3200, 0.16 + 0.012 * (11 - second), 0.03 + 0.007 * (11 - second));
      playNote(f, 0.06, 0.15, 'triangle');
      if (second <= 3) playNote(f * 1.35, 0.045, 0.07, 'triangle', 0.02);
      break;
    }
    case 'stone': {
      // Stone tick + echo
      const f = 340 + (10 - second) * 60;
      playNote(f, 0.07, 0.17, 'triangle');
      if (second <= 3) playNote(1100, 0.07, 0.13, 'triangle', 0.012);
      break;
    }
    case 'wood': {
      // Knock and woody tick, sharp up high
      const f = 390 + (10 - second) * 65;
      playNote(f, 0.07, 0.16, 'triangle');
      playNote(f * 1.15, 0.032, 0.09, 'triangle', 0.041);
      if (second <= 3) playNoise(1100, 0.09, 0.017, 0.025);
      break;
    }
    case 'bauhaus': {
      // Square click with arpeggio urgency late
      const f = 520 + (10 - second) * 60;
      playNote(f, 0.06, 0.19, 'square');
      if (second <= 3) arp([f * 1.1, f * 1.23], 0.031, 0.15, 'square');
      break;
    }
    case 'blueprint': {
      // Metallic rapid beep, arpeggio at the end
      const f = 690 + (10 - second) * 80;
      playNote(f, 0.05, 0.13, 'triangle');
      if (second <= 3) arp([f, f * 1.4], 0.027, 0.09, 'triangle');
      break;
    }
    case 'dmg': {
      // Chiptune chirp; arpeggiate at last 3 seconds
      const f = 880 + (10 - second) * 60;
      playNote(f, 0.045, 0.14, 'triangle');
      if (second <= 3) arp([f * 0.8, f], 0.021, 0.07, 'triangle');
      break;
    }
    default: {
      // Classic—sharper "tick" and double-pulse late
      const freq = 660 + (10 - second) * 55;
      playNote(freq, 0.07, 0.12, 'square');
      if (second <= 3) playNote(freq * 1.5, 0.05, 0.06, 'sine', 0.028);
      break;
    }
  }
};

// ─── Config / settings storage ───────────────────────────────────────────────
const CONFIG_KEY = 'tetris-config'
const DEFAULT_CONFIG = { sfxEnabled: true, hapticEnabled: true, musicVolume: 1.0, sfxVolume: 2.0, das: 110, arr: 25, showOnScreenControls: false }
const loadConfig = () => {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') } }
  catch (e) { console.warn('Failed to load config:', e); return { ...DEFAULT_CONFIG } }
}

// ─── High-score storage ───────────────────────────────────────────────────────
const HS_KEY = 'tetris-highs'
const loadHighScores = () => {
  try { return JSON.parse(localStorage.getItem(HS_KEY) ?? '{}') } catch { return {} }
}

// ─── PiecePreview ─────────────────────────────────────────────────────────────
const PREV_CELL = 10
const PREV_COLS = 4
const PREV_ROWS = 2

function PiecePreview({ type, small = false }) {
  const canvasRef = useRef(null)
  // When a world background is active in Solo mode, mirror story behaviour and
  // show previews using the mapped piece theme.
  const { theme, bgTheme } = useTheme()
  const previewTheme = bgTheme ? (BG_TYPE_TO_PIECE_THEME[bgTheme] ?? theme) : theme
  const cell = small ? 8 : PREV_CELL

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!type) return
    const { matrix } = PIECES[type]
    const color = (PIECE_COLOR_MAPS[previewTheme]?.[type]) ?? PIECES[type].color
    const filled = matrix.filter(r => r.some(Boolean))
    const colMin = Math.min(...filled.map(r => r.findIndex(Boolean)))
    const colMax = Math.max(...filled.map(r => r.length - 1 - [...r].reverse().findIndex(Boolean)))
    const tw = colMax - colMin + 1, th = filled.length
    const ox = Math.floor((PREV_COLS - tw) / 2) * cell
    const oy = Math.floor((PREV_ROWS - th) / 2) * cell
    filled.forEach((row, ry) => {
      for (let cx = colMin; cx <= colMax; cx++) {
        if (!row[cx]) continue
        ctx.save()
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8
        ctx.fillRect(ox + (cx - colMin) * cell + 1, oy + ry * cell + 1, cell - 2, cell - 2)
        ctx.restore()
      }
    })
  }, [type, cell, previewTheme])

  const w = PREV_COLS * cell, h = PREV_ROWS * cell
  return (
    <div className="preview-box" style={small ? { height: '1.8rem' } : undefined}>
      {type
        ? <canvas ref={canvasRef} width={w} height={h} className="preview-canvas" />
        : <span className="preview-empty">—</span>}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { setTheme, theme, bgTheme } = useTheme()
  const { user } = useAuth()
  const engine  = useMemo(() => new TetrisEngine(), [])

  const [isLoading, setIsLoading] = useState(true)
  const [state,  setState]  = useState(() => engine.getState())
  const [config, setConfig] = useState(loadConfig)
  const [gameMode, setGameMode]   = useState(GAME_MODE.NORMAL)
  const [musicOn, setMusicOn]     = useState(false)
  const [coinDelta, setCoinDelta] = useState(0)
  const [countdown, setCountdown] = useState(null)
  const [highScores, setHighScores] = useState(() => loadHighScores())
  const [newHigh, setNewHigh]     = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const checkMobile = () => window.innerWidth < 768 || (window.innerHeight < 600 && ('ontouchstart' in window || navigator.maxTouchPoints > 0))
  const checkLandscape = () => window.innerHeight < 600 && window.innerWidth > window.innerHeight && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  const [isMobile, setIsMobile]       = useState(checkMobile)
  const [isLandscape, setIsLandscape] = useState(checkLandscape)
  const [showMobileModes, setShowMobileModes] = useState(false)
  const [zenResetting, setZenResetting] = useState(false)
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('tetris-zoom') || 1))
  const [isUiHidden, setIsUiHidden] = useState(false)
  const cycleZoom = () => setZoom(z => {
    const next = z >= 1.5 ? 1 : z >= 1.25 ? 1.5 : 1.25
    localStorage.setItem('tetris-zoom', next)
    return next
  })

  const heldRef   = useRef({ left: false, right: false, softDrop: false })
  const gpHeldRef  = useRef({ left: false, right: false, softDrop: false })
  const actionRef  = useRef({})
  const prevGameOverRef  = useRef(false)
  const prevLevelRef      = useRef(1)
  const prevBackToBackRef = useRef(false)
  const prevZoneMeterRef  = useRef(0)
  const prevZoneActiveRef = useRef(false)
  const musicOnRef  = useRef(false)
  const countdownActiveRef = useRef(false)
  const gameModeRef = useRef(GAME_MODE.NORMAL)
  const botDiffRef    = useRef('medium')
  const isMobileRef   = useRef(window.innerWidth < 768 || (window.innerHeight < 600 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)))
  const zenResettingRef = useRef(false)
  const prevBlitzSecRef  = useRef(null)
  const prevPurifySecRef = useRef(null)
  const configRef         = useRef(config)
  useEffect(() => { configRef.current = config }, [config])

  // ─── Ultimate cat music (separate Audio element) ─────────────────────────
  const catAudioRef = useRef(null)
  const isCatRunRef = useRef(false)
  const catFadeTimerRef = useRef(null)
  const catRunEndAtRef = useRef(0)
  const eerieAudiosRef = useRef([])
  const eerieCurrentRef = useRef(null)
  const eerieFadeTimerRef = useRef(null)
  const [jumpscare, setJumpscare] = useState(null) // { src, until }
  const lastJumpscareRef = useRef(0)
  const jumpscareAllowedAfterRef = useRef(0)
  const jumpscareCooldownRef = useRef(60000)
  const sfxDuckTimerRef = useRef(null)
  const chaosSfxLastRef = useRef(0)
  const chaosSfxMutedUntilRef = useRef(0)
  const chaosCueEndAtRef = useRef(0)
  const [floorFx, setFloorFx] = useState(null) // { until, floor, burstCat }
  useEffect(() => {
    const el = new Audio(catMusicUrl)
    el.loop = false
    el.volume = 0.70
    catAudioRef.current = el
    return () => { el.pause(); el.src = '' }
  }, [])

  useEffect(() => {
    const urls = [eerie1Url, eerie2Url, eerie3Url].filter(Boolean)
    const els = urls.map(u => { const a = new Audio(u); a.loop = false; a.volume = 0.3; return a })
    eerieAudiosRef.current = els
    return () => { els.forEach(a => { try { a.pause(); a.src = '' } catch {} }) }
  }, [])

  const stopEerie = useCallback(() => {
    try {
      if (eerieFadeTimerRef.current) { clearInterval(eerieFadeTimerRef.current); eerieFadeTimerRef.current = null }
      const cur = eerieCurrentRef.current
      if (cur) { cur.pause(); cur.currentTime = 0; eerieCurrentRef.current = null }
    } catch {}
  }, [])

  const fadeOutAndStopEerie = useCallback((audio, ms = 500) => {
    try {
      if (!audio) return
      if (eerieFadeTimerRef.current) { clearInterval(eerieFadeTimerRef.current); eerieFadeTimerRef.current = null }
      const steps = 10
      const stepDur = Math.max(16, Math.floor(ms / steps))
      let i = 0
      eerieFadeTimerRef.current = setInterval(() => {
        i += 1
        const t = 1 - i / steps
        audio.volume = Math.max(0, 0.3 * Math.max(0, t))
        if (i >= steps) {
          clearInterval(eerieFadeTimerRef.current); eerieFadeTimerRef.current = null
          try { audio.pause(); audio.currentTime = 0 } catch {}
          if (eerieCurrentRef.current === audio) eerieCurrentRef.current = null
        }
      }, stepDur)
    } catch {}
  }, [])

  const fadeOutAndStopCat = useCallback((audio, ms = 1200) => {
    try {
      if (!audio) return
      if (catFadeTimerRef.current) { clearInterval(catFadeTimerRef.current); catFadeTimerRef.current = null }
      const startVol = Math.min(0.7, audio.volume || 0.7)
      const steps = 12
      const stepDur = Math.max(16, Math.floor(ms / steps))
      let i = 0
      catFadeTimerRef.current = setInterval(() => {
        i += 1
        const t = 1 - i / steps
        audio.volume = Math.max(0, startVol * Math.max(0, t))
        if (i >= steps) {
          clearInterval(catFadeTimerRef.current); catFadeTimerRef.current = null
          try { audio.pause(); audio.currentTime = 0 } catch {}
        }
      }, stepDur)
    } catch {}
  }, [])

  // Persist config changes
  useEffect(() => { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) }, [config])

  // Sync engine DAS/ARR from config
  useEffect(() => { engine.setSettings({ das: config.das, arr: config.arr }) },  [engine, config.das, config.arr])

  // Resize → isMobile
  useEffect(() => {
    const handler = () => {
      const m = window.innerWidth < 768 || (window.innerHeight < 600 && ('ontouchstart' in window || navigator.maxTouchPoints > 0))
      const ls = window.innerHeight < 600 && window.innerWidth > window.innerHeight && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
      isMobileRef.current = m
      setIsMobile(m)
      setIsLandscape(ls)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ─── Visual Viewport sync ───────────────────────────────────────────────────
  // Keeps --app-height in sync with the *visual* viewport so that mobile-layout
  // fills exactly the visible area even when the browser chrome is animating in/out.
  const syncAppHeight = useCallback(() => {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight
    document.documentElement.style.setProperty('--app-height', `${h}px`)
  }, [])

  useEffect(() => {
    syncAppHeight()
    const vvp = window.visualViewport
    if (vvp) {
      vvp.addEventListener('resize', syncAppHeight)
      vvp.addEventListener('scroll', syncAppHeight)
    }
    window.addEventListener('resize', syncAppHeight)
    return () => {
      if (vvp) {
        vvp.removeEventListener('resize', syncAppHeight)
        vvp.removeEventListener('scroll', syncAppHeight)
      }
      window.removeEventListener('resize', syncAppHeight)
    }
  }, [syncAppHeight])

  // Re-sync whenever the UI hidden state changes so the canvas fills the freed
  // space on the very first toggle without requiring a second tap.
  useEffect(() => {
    syncAppHeight()
    // Belt-and-suspenders: nudge layout engine after the CSS transition starts
    const id = setTimeout(syncAppHeight, 50)
    return () => clearTimeout(id)
  }, [isUiHidden, syncAppHeight])

  // Toggle handler — forces a repaint immediately after state update
  const handleUiToggle = useCallback(() => {
    setIsUiHidden(h => !h)
    // schedule height re-sync after React has committed the class change:
    // rAF fires after the next paint; the 1 ms follow-up catches browsers that
    // defer the visual-viewport update until after the first frame (Mobile Safari).
    requestAnimationFrame(() => {
      syncAppHeight()
      setTimeout(syncAppHeight, 1)
    })
  }, [syncAppHeight])

  // Sync infection-timer multiplier: give mobile portrait players 1.5× more reaction time
  useEffect(() => {
    const mult = isMobile && !isLandscape ? 1.5 : 1.0
    engine.setTouchMultiplier(mult)
  }, [engine, isMobile, isLandscape])

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      // Only show the banner if not already installed (standalone)
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setInstallPrompt(null); setShowInstallBanner(false) }
  }

  const handleInstallFromAbout = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setInstallPrompt(null); setShowInstallBanner(false) }
  }

  const handleDismissInstall = () => setShowInstallBanner(false)

  const renderInstallBanner = () => showInstallBanner ? (
    <div className="pwa-install-banner">
      <span className="pwa-install-text">📲 Add Tetra Overflow Ultra to your home screen for the best experience</span>
      <div className="pwa-install-actions">
        <button type="button" className="pwa-install-btn" onClick={handleInstall}>Install</button>
        <button type="button" className="pwa-dismiss-btn" onClick={handleDismissInstall}>✕</button>
      </div>
    </div>
  ) : null

  const handleZenTopOut = () => {
    // Guard against multiple top-out callbacks firing during the same lock/spawn cycle.
    if (zenResettingRef.current) return
    zenResettingRef.current = true
    setZenResetting(true)
    playZenResetSFX(theme)
    engine.zenClearBoard()
    setState(engine.getState())
    setTimeout(() => {
      zenResettingRef.current = false
      setZenResetting(false)
    }, 380)
  }

  // ─── Start game ────────────────────────────────────────────────────────────
  const startGame = (mode) => {
    getAudioCtx()
    setGameMode(mode); gameModeRef.current = mode
    engine.reset(mode, 'easy')
    setState(engine.getState())
    setCoinDelta(0)
    prevGameOverRef.current = false
    prevLevelRef.current = 1; prevBackToBackRef.current = false; prevZoneMeterRef.current = 0; prevZoneActiveRef.current = false
    zenResettingRef.current = false
    prevBlitzSecRef.current = null; prevPurifySecRef.current = null
    setZenResetting(false)
    setNewHigh(false)
    heldRef.current  = { left: false, right: false, softDrop: false }
    actionRef.current = {}
    // Zen: wire topout handler + auto-apply zen theme
    if (mode === GAME_MODE.ZEN) {
      engine.setTopOutHandler(handleZenTopOut)
      setTheme('classic')
    } else if (mode === GAME_MODE.ULTIMATE) {
      engine.setTopOutHandler(null)
      // Sometimes enable cat run (music + cat blocks)
      const isCat = Math.random() < 0.3
      isCatRunRef.current = isCat
      engine.useMemeBlocks = isCat
      // Schedule when jumpscares are allowed to start (hidden window in minutes)
      const now = performance.now()
      const minDelay = 60_000  // 1 min
      const maxDelay = 180_000 // 3 min
      jumpscareAllowedAfterRef.current = now + (minDelay + Math.random() * (maxDelay - minDelay))
      // Reset last and randomize an initial cooldown window (1–2 min)
      lastJumpscareRef.current = 0
      jumpscareCooldownRef.current = 60_000 + Math.random() * 60_000
      // Fully disable chaos/"infection" cue after ~9s to ensure it never feels like a loop
      chaosCueEndAtRef.current = now + 9_000
    } else {
      engine.setTopOutHandler(null)
      engine.useMemeBlocks = false
    }
    // Unlock Vibration API on Android (requires a user-gesture context — startGame is called from button click)
    try { navigator.vibrate?.(1) } catch {}
    countdownActiveRef.current = true
    setCountdown(3)
    setShowMobileModes(false)
  }

  // ─── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      countdownActiveRef.current = false
      setCountdown(null)
      musicManager?.playCountdownBeep?.(0) // "GO!" fanfare
      // Start music: Ultimate may use cat track briefly, then fade it out
      if (gameModeRef.current === GAME_MODE.ULTIMATE && isCatRunRef.current) {
        const a = catAudioRef.current
        if (a) {
          a.currentTime = 0
          a.volume = 0.65
          a.play().catch(() => {})
          const endAt = performance.now() + 15000 // play ~15s, then fade/stop
          catRunEndAtRef.current = endAt
          setTimeout(() => fadeOutAndStopCat(a, 1200), 15000)
          // Also revert cat blocks/background after the same window
          setTimeout(() => { try { engine.useMemeBlocks = false } catch {} }, 15050)
        }
      } else if (musicOnRef.current) {
        musicManager?.start()
        musicManager?.setVolume(configRef.current.musicVolume)
      }
      return
    }
    musicManager?.playCountdownBeep?.(countdown) // 3, 2, 1 beeps
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  // ─── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let last = performance.now(), frameId = 0
    const frame = (now) => {
      const dt = Math.min(MAX_FRAME_TIME_MS, now - last); last = now
      if (!countdownActiveRef.current) {
        const held = {
          left:     heldRef.current.left     || gpHeldRef.current.left,
          right:    heldRef.current.right    || gpHeldRef.current.right,
          softDrop: heldRef.current.softDrop || gpHeldRef.current.softDrop,
        }
        engine.update(dt, held, actionRef.current)
        actionRef.current = {}
      } else {
        actionRef.current = {}
      }

      const ns  = engine.getState()

      const cfg = configRef.current
      const sfxOn = cfg.sfxEnabled
      const hapticOn = cfg.hapticEnabled
      const doVibrate = (pattern) => { if (hapticOn) navigator.vibrate?.(pattern) }

      if (ns.hardDropped) {
        if (sfxOn) playHardDropSFX(theme)
        doVibrate([25, 50, 25])
      } else if (ns.pieceLocked) {
        if (sfxOn) playLockSFX(theme)
        doVibrate(25)
      }
      if (ns.pieceHeld) {
        if (sfxOn) playHoldSFX(theme)
        doVibrate(25)
      }
      if (ns.infectionAdded) {
        if (sfxOn) playInfectionSFX(theme)
        doVibrate([30, 15, 30, 15, 40])
      }
      if (ns.ultimateGarbageAdded) {
          // Explicitly disable chaos/"infection" cue SFX (and vibration) in Ultimate.
          // No-op by design per request.
        // Randomized jumpscare trigger after a hidden initial delay and long cooldown
        const jsNow = performance.now()
        if (
          isUltimate &&
          jsNow >= (jumpscareAllowedAfterRef.current || 0) &&
          jsNow - (lastJumpscareRef.current || 0) > (jumpscareCooldownRef.current || 0) &&
          Math.random() < 0.25
        ) {
          const imgs = [horror1Url, horror2Url, horror3Url]
          const src = imgs[Math.floor(Math.random() * imgs.length)]
          lastJumpscareRef.current = jsNow
          setJumpscare({ src, until: jsNow + 1600 })
          try {
            const arr = eerieAudiosRef.current || []
            if (arr.length) {
              stopEerie()
              const a = arr[Math.floor(Math.random() * arr.length)]
              a.currentTime = 0; a.volume = 0.28
              eerieCurrentRef.current = a
              a.play().catch(() => {})
              // Auto fade-out and stop towards the end of the visual flash
              setTimeout(() => fadeOutAndStopEerie(a, 600), 1000)
            }
          } catch {}
          // Duck all other SFX while the jumpscare plays to avoid stacking loudness
          try {
            setSfxDuck(0.5)
            if (sfxDuckTimerRef.current) clearTimeout(sfxDuckTimerRef.current)
            sfxDuckTimerRef.current = setTimeout(() => setSfxDuck(1.0), 1700)
          } catch {}
          // Randomize next cooldown between 1–2 minutes to avoid predictability
          jumpscareCooldownRef.current = 60_000 + Math.random() * 60_000
          setTimeout(() => setJumpscare(null), 1650)
        }
      }
      let playedClearCue = false
      if (ns.lastClear) {
        const { spinType, lines, isAllClear } = ns.lastClear
        if (isAllClear) {
          if (sfxOn) playAllClearSFX(theme)
          doVibrate([30, 10, 30, 10, 30, 10, 80])
          playedClearCue = true
        } else if (spinType === 'tSpin' || spinType === 'allSpin') {
          if (sfxOn) playTSpinSFX(theme)
          doVibrate([20, 15, 40])
          playedClearCue = true
        } else if (lines === 4) {
          if (sfxOn) playTetrisSFX(theme)
          doVibrate([30, 10, 30, 10, 30, 10, 80])
          playedClearCue = true
        } else if (lines > 0) {
          if (sfxOn) playLineClearSFX(theme)
          doVibrate(playLineClearHaptic(lines))
          playedClearCue = true
        }
      }
      // After handling clear cues, play floor fanfare only if no clear SFX fired this frame
      if (ns.towerFloorAdvance) {
        if (sfxOn && !playedClearCue) playFloorFanfareSFX(theme)
        doVibrate([20, 10, 30, 10, 60])
        // Trigger brief visual floor FX overlay; occasional cat cameo like the meme
        const burstCat = Math.random() < 0.35
        setFloorFx({ until: performance.now() + 1600, floor: ns.towerFloor, burstCat })
        setTimeout(() => setFloorFx(prev => (prev && performance.now() >= prev.until ? null : prev)), 1650)
      }
      if (ns.lastCombo > 0 && sfxOn) playComboSFX(ns.lastCombo, theme)
      // B2B streak start
      if (ns.backToBack && !prevBackToBackRef.current && sfxOn) playB2BSFX(theme)
      prevBackToBackRef.current = ns.backToBack
      // Level up
      // Suppress level-up SFX in Ultimate — level isn't meaningful there and the sound feels like a loop
      if (ns.level > prevLevelRef.current && sfxOn && ns.mode !== GAME_MODE.ULTIMATE) playLevelUpSFX(theme)
      prevLevelRef.current = ns.level
      // Zone meter milestones (50%, 75%) + zone ready (100%)
      const prevMeter = prevZoneMeterRef.current
      if (!ns.zoneActive) {
        if (ns.zoneMeter >= 100 && prevMeter < 100) {
          musicManager?.playZoneReady?.()
          doVibrate([20, 15, 20, 15, 40])
        } else if (ns.zoneMeter >= 75 && prevMeter < 75) {
          if (sfxOn) playZoneMeterMilestoneSFX(2, theme)
          doVibrate([15, 12, 25])
        } else if (ns.zoneMeter >= 50 && prevMeter < 50) {
          if (sfxOn) playZoneMeterMilestoneSFX(1, theme)
          doVibrate(25)
        }
      }
      prevZoneMeterRef.current = ns.zoneMeter
      // Zone end — play fanfare when zone deactivates
      if (prevZoneActiveRef.current && !ns.zoneActive && ns.zoneEndResult) {
        musicManager?.playZoneEnd?.(ns.zoneEndResult.lines ?? 0)
        doVibrate([0, 80, 30, 80, 30, 120])
      }
      // Zone FX: toggle low-pass and ducking on BGM when Zone activates/deactivates
      if (!prevZoneActiveRef.current && ns.zoneActive) {
        musicManager?.setZoneFx?.(true)
      }
      if (prevZoneActiveRef.current && !ns.zoneActive) {
        musicManager?.setZoneFx?.(false)
      }
      prevZoneActiveRef.current = ns.zoneActive

      // 10-second countdown ticks for Blitz and Purify timers
      if (!ns.gameOver && !ns.paused) {
        if (ns.mode === GAME_MODE.BLITZ && ns.blitzTimer > 0 && ns.blitzTimer <= 10000) {
          const sec = Math.ceil(ns.blitzTimer / 1000)
          if (prevBlitzSecRef.current !== null && sec !== prevBlitzSecRef.current) {
            if (sfxOn) playCountdownTickSFX(sec, theme)
          }
          prevBlitzSecRef.current = sec
        } else {
          prevBlitzSecRef.current = null
        }
        if (ns.mode === GAME_MODE.PURIFY && ns.purifyTimer > 0 && ns.purifyTimer <= 10000) {
          const sec = Math.ceil(ns.purifyTimer / 1000)
          if (prevPurifySecRef.current !== null && sec !== prevPurifySecRef.current) {
            if (sfxOn) playCountdownTickSFX(sec, theme)
          }
          prevPurifySecRef.current = sec
        } else {
          prevPurifySecRef.current = null
        }
      }

      if (ns.gameOver && !prevGameOverRef.current && gameModeRef.current !== GAME_MODE.ZEN) {
        if (sfxOn) playGameOverSFX(theme)
        doVibrate([100, 50, 100, 50, 100])
        if (musicOnRef.current) { musicManager?.stop(); musicOnRef.current = false; setMusicOn(false) }
        if (gameModeRef.current === GAME_MODE.ULTIMATE && isCatRunRef.current) { try { catAudioRef.current.pause(); catAudioRef.current.currentTime = 0 } catch {} }
        stopEerie()
        setSfxDuck(1.0)
        const hs = loadHighScores(), key = gameModeRef.current
        if (!hs[key] || ns.score > hs[key]) {
          hs[key] = ns.score
          localStorage.setItem(HS_KEY, JSON.stringify(hs))
          setHighScores({ ...hs }); setNewHigh(true)
        }
        // Save to Firestore (coins = 1 per 1000 pts, best score updated, leaderboard)
        if (user?.uid) {
          saveGameResult(user.uid, gameModeRef.current, ns.score, {
            lines: ns.lines, level: ns.level,
          }).then(res => setCoinDelta(res?.coinsEarned || 0)).catch(() => {})
        }
      }
      prevGameOverRef.current = ns.gameOver
      setState(ns)
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [engine])

  // ─── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (ev) => {
      const sfxOn = configRef.current.sfxEnabled
      const b = KEY_BINDINGS[ev.code]; if (!b) return
      ev.preventDefault(); if (ev.repeat) return
      if (b.held) {
        heldRef.current[b.held] = true
        if ((b.held === 'left' || b.held === 'right') && sfxOn) playMoveSFX(theme)
      }
      if (b.action) {
        if (countdownActiveRef.current && b.action !== 'pause') return
        actionRef.current[b.action] = true
        if ((b.action === 'rotateCW' || b.action === 'rotateCCW' || b.action === 'rotate180') && sfxOn) playRotateSFX(theme)
        if (b.action === 'activateZone') {
          if (sfxOn) playZoneActivateSFX(theme)
          if (configRef.current.hapticEnabled) navigator.vibrate?.([20, 10, 40])
        }
        if (b.action === 'hardDrop' && sfxOn) playHardDropSFX(theme)
        if (b.action === 'pause') handlePauseToggle()
      }
    }
    const up = (ev) => {
      const b = KEY_BINDINGS[ev.code]; if (!b?.held) return
      ev.preventDefault(); heldRef.current[b.held] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [engine]) // eslint-disable-line

  // ─── Touch/button helpers ──────────────────────────────────────────────────
  const triggerAction = (action) => {
    if (countdownActiveRef.current) return
    actionRef.current[action] = true
    const sfxOn = configRef.current.sfxEnabled
    const hapticOn = configRef.current.hapticEnabled
    if (action === 'rotateCW' || action === 'rotateCCW' || action === 'rotate180') {
      if (sfxOn) playRotateSFX(theme)
      if (hapticOn) navigator.vibrate?.(20)
    } else if (action === 'hardDrop') {
      if (sfxOn) playHardDropSFX(theme)
      if (hapticOn) navigator.vibrate?.([25, 50, 25])
    } else if (action === 'activateZone') {
      if (sfxOn) playZoneActivateSFX(theme)
      if (hapticOn) navigator.vibrate?.([30, 15, 50])
    } else if (action === 'hold') {
      if (sfxOn) playHoldSFX(theme)
      if (hapticOn) navigator.vibrate?.(25)
    }
  }

  const handlePress  = (key, hold) => {
    const sfxOn = configRef.current.sfxEnabled
    const hapticOn = configRef.current.hapticEnabled
    if (hold) {
      heldRef.current[key] = true
      if (key === 'left' || key === 'right') { if (sfxOn) playMoveSFX(theme); if (hapticOn) navigator.vibrate?.(20) }
      else if (key === 'softDrop' && hapticOn) navigator.vibrate?.(15)
    } else {
      triggerAction(key)
    }
  }
  const handleRelease = (key, hold) => { if (hold) heldRef.current[key] = false }
  const handleDragBegin = (dir) => {
    const sfxOn = configRef.current.sfxEnabled
    if (dir === 'left' || dir === 'right') {
      heldRef.current[dir] = true
      if (sfxOn) playSwipeSFX(dir, theme)
    } else if (dir === 'down') {
      heldRef.current.softDrop = true
      if (sfxOn) playSwipeSFX('down', theme)
    } else if (dir === 'up') {
      if (sfxOn) playSwipeSFX('up', theme)
      triggerAction('hold')
    }
  }
  const handleDragEnd = (dir) => {
    if (dir === 'left' || dir === 'right') heldRef.current[dir] = false
    else if (dir === 'down') heldRef.current.softDrop = false
  }
  const handleHardDrop = () => {
    if (!countdownActiveRef.current) {
      heldRef.current.softDrop = false
      actionRef.current.hardDrop = true
      if (configRef.current.sfxEnabled) playHardDropSFX(theme)
      if (configRef.current.hapticEnabled) navigator.vibrate?.([25, 50, 25])
    }
  }
  const handleZoneActivate = () => {
    actionRef.current.activateZone = true
    if (configRef.current.sfxEnabled) playZoneActivateSFX()
    if (configRef.current.hapticEnabled) navigator.vibrate?.([30, 15, 50])
  }

  // ─── Gamepad ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const AXIS_DEAD = 0.35
    // button index → held key
    const GP_HELD_MAP = { 13: 'softDrop', 14: 'left', 15: 'right' }
    // button index → action name
    const GP_ACTION_MAP = {
      12: 'hardDrop',     // D-pad up
      0:  'rotateCCW',    // A / Cross
      1:  'rotateCW',     // B / Circle
      2:  'rotateCCW',    // X / Square
      3:  'rotate180',    // Y / Triangle
      4:  'hold',         // LB / L1
      5:  'hold',         // RB / R1
      6:  'activateZone', // LT / L2
      7:  'activateZone', // RT / R2
      9:  'pause',        // Start
    }
    const prevButtons = {} // gamepad index → { buttonIndex: wasPressed }
    let rafId
    const poll = () => {
      const gamepads = navigator.getGamepads?.()
      if (gamepads) {
        let gpLeft = false, gpRight = false, gpSoftDrop = false
        for (const gp of gamepads) {
          if (!gp) continue
          if (!prevButtons[gp.index]) prevButtons[gp.index] = {}
          const prev = prevButtons[gp.index]
          // Held: D-pad
          for (const [bi, key] of Object.entries(GP_HELD_MAP)) {
            if (gp.buttons[bi]?.pressed) {
              if (key === 'left')     gpLeft     = true
              if (key === 'right')    gpRight    = true
              if (key === 'softDrop') gpSoftDrop = true
            }
          }
          // Held: left analog stick
          const ax = gp.axes[0] ?? 0
          const ay = gp.axes[1] ?? 0
          if (ax < -AXIS_DEAD) gpLeft     = true
          if (ax >  AXIS_DEAD) gpRight    = true
          if (ay >  AXIS_DEAD) gpSoftDrop = true
          // Actions: rising edge only
          for (const [bi, action] of Object.entries(GP_ACTION_MAP)) {
            const pressed = !!gp.buttons[bi]?.pressed
            if (pressed && !prev[bi]) {
              if (action === 'pause') {
                engine.togglePause()
                const s = engine.getState(); setState(s)
                const sfxOn = configRef.current.sfxEnabled
                if (s.paused) {
                  if (sfxOn) playPauseSFX(theme)
                  if (musicOnRef.current) musicManager?.pause()
                } else {
                  if (sfxOn) playResumeSFX(theme)
                  if (musicOnRef.current) musicManager?.resume()
                }
              } else if (!countdownActiveRef.current) {
                actionRef.current[action] = true
                const sfxOn = configRef.current.sfxEnabled
                if ((action === 'rotateCW' || action === 'rotateCCW' || action === 'rotate180') && sfxOn) playRotateSFX(theme)
                else if (action === 'hardDrop' && sfxOn) playHardDropSFX(theme)
                else if (action === 'activateZone') {
                  if (sfxOn) playZoneActivateSFX(theme)
                  if (configRef.current.hapticEnabled) navigator.vibrate?.([30, 15, 50])
                }
              }
            }
            prev[bi] = pressed
          }
        }
        gpHeldRef.current.left     = gpLeft
        gpHeldRef.current.right    = gpRight
        gpHeldRef.current.softDrop = gpSoftDrop
      }
      rafId = requestAnimationFrame(poll)
    }
    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [engine]) // eslint-disable-line

  const handlePauseToggle = () => {
    engine.togglePause()
    const s = engine.getState(); setState(s)
    const sfxOn = configRef.current.sfxEnabled
    if (s.paused) {
      if (sfxOn) playPauseSFX(theme)
      if (musicOnRef.current) musicManager?.pause()
      if (gameModeRef.current === GAME_MODE.ULTIMATE && isCatRunRef.current) catAudioRef.current?.pause()
      // Ensure jumpscare audio stops when pausing
      stopEerie()
      setSfxDuck(1.0)
    } else {
      if (sfxOn) playResumeSFX(theme)
      if (musicOnRef.current) musicManager?.resume()
      if (gameModeRef.current === GAME_MODE.ULTIMATE && isCatRunRef.current) {
        // Only resume cat sound if we are still within its 10s window
        if (performance.now() < (catRunEndAtRef.current || 0)) {
          catAudioRef.current?.play().catch(() => {})
        }
      }
    }
  }

  const toggleMusic = () => {
    getAudioCtx(); if (!musicManager) return
    const doToggle = () => {
      if (musicOnRef.current) {
        musicManager.stop(); musicOnRef.current = false; setMusicOn(false)
      } else {
        musicManager.start()
        musicManager.setVolume(configRef.current.musicVolume)
        musicOnRef.current = true; setMusicOn(true)
      }
    }
    const ctx = sharedAudioContext
    if (ctx?.state === 'suspended') ctx.resume().then(doToggle); else doToggle()
  }

  // Sync music volume when config changes
  useEffect(() => {
    if (musicOnRef.current) musicManager?.setVolume?.(config.musicVolume)
  }, [config.musicVolume])

  // Sync SFX volume when config changes
  useEffect(() => {
    setSfxVolume(config.sfxVolume ?? 1.0)
  }, [config.sfxVolume])

  const setBotDiff = (d) => { setBotDifficulty(d); botDiffRef.current = d }

  // ─── Derived ────────────────────────────────────────────────────────────────
  const zoneReady  = state.zoneMeter >= ZONE_MIN_METER
  const isPurify   = state.mode === GAME_MODE.PURIFY
  const isUltimate = state.mode === GAME_MODE.ULTIMATE
  const isVersus   = state.mode === GAME_MODE.VERSUS
  const isTower    = state.mode === GAME_MODE.ULTIMATE  // TOWER merged into ULTIMATE
  const showZone   = state.mode === GAME_MODE.NORMAL || state.mode === GAME_MODE.ULTIMATE

  // Glitch effect: active in Ultimate when stack reaches row 10 from top
  const glitchActive = isUltimate && (() => {
    if (!state.board) return false
    for (let r = 0; r < 14; r++) {
      if (state.board[r]?.some(c => c !== null)) return true
    }
    return false
  })()

  const fmt = (ms) => {
    const t = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(t / 60), s = t % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  const fmtElapsed = (ms) => {
    const t = Math.floor(ms / 10), cs = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000)
    return `${m}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }

  // ─── Overlay ────────────────────────────────────────────────────────────────
  const renderOverlay = (s, isP2 = false) => {
    if (!s.gameOver) return null
    if (s.mode === GAME_MODE.ZEN) return null  // zen never shows game-over
    let title = 'GAME OVER'
    if (isVersus) title = isP2 ? (s.gameOverReason === 'win' ? '🏆 P2 WINS' : '💀 P2 LOST') : (s.gameOverReason === 'win' ? '🏆 P1 WINS' : '💀 P1 LOST')
    else if (s.mode === GAME_MODE.SPRINT && s.gameOverReason === 'complete') title = '🏁 SPRINT DONE'
    else if (s.gameOverReason === 'timeout') title = "⏱ TIME'S UP"
    else if (s.gameOverReason === 'topout') title = '💀 GAME OVER'
    return (
      <div className="overlay">
        <div className="overlay-title">{title}</div>
        {newHigh && !isP2 && <div className="overlay-new-high">🏆 New Best!</div>}
        <div className="overlay-sub">Score: {s.score.toLocaleString()}</div>
        {s.mode === GAME_MODE.SPRINT && <div className="overlay-sub">Time: {fmtElapsed(s.elapsedTime)}</div>}
        {s.mode === GAME_MODE.PURIFY && <div className="overlay-sub">Purified: {s.blocksPurified} blocks</div>}
        {s.mode === GAME_MODE.ULTIMATE && <div className="overlay-sub">🗼 Floor {s.towerFloor} reached!</div>}
        <div className="overlay-sub">Lv {s.level} · {s.lines} lines</div>
        {coinDelta > 0 && <div className="overlay-sub" style={{ color: '#eab308' }}>+{coinDelta} coins</div>}
        {!isP2 && <button type="button" className="overlay-restart" onClick={() => startGame(gameMode)}>Play Again</button>}
      </div>
    )
  }

  const renderPauseOverlay = (s) => s.paused && !s.gameOver ? (
    <div className="overlay">
      <div className="overlay-title">PAUSED</div>
      <div style={{ fontSize: '0.62rem', color: '#666', letterSpacing: '0.16em', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
        {s.mode?.toUpperCase()} · Lv {s.level} · {s.lines} lines
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '0.75rem', alignItems: 'center' }}>
        <div style={{ fontSize: '0.62rem', color: '#bbb', letterSpacing: '0.12em' }}>
          Now Playing: <span style={{ color: '#fff' }}>{musicManager?.getNowPlaying?.() || '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button"
            onClick={() => musicManager?.prev?.()}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
          {musicOn ? (
            <button type="button"
              onClick={() => musicManager?.pause?.()}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏸</button>
          ) : (
            <button type="button"
              onClick={toggleMusic}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>▶</button>
          )}
          <button type="button"
            onClick={() => musicManager?.next?.()}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>⏭</button>
          <button type="button"
            onClick={() => musicManager?.setMuted?.(!(musicManager?.isMuted?.()))}
            style={{ background: musicManager?.isMuted?.() ? 'rgba(255,60,60,0.10)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: musicManager?.isMuted?.() ? '#ff6666' : '#ccc', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            {musicManager?.isMuted?.() ? '🔇 Muted' : '🔊 Mute'}
          </button>
          <button type="button"
            onClick={() => setShowSettings(true)}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#ccc', borderRadius: 6, padding: '5px 14px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.1em' }}>
            ⚙ Settings
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.60rem', color: '#777' }}>Vol</span>
          <input type="range" min={0} max={1} step={0.01}
            value={config.musicVolume}
            onChange={(e) => { const v = parseFloat(e.target.value); setConfig(prev => ({ ...prev, musicVolume: v })); musicManager?.setVolume?.(v) }}
            style={{ width: 180 }} />
        </div>
      </div>
      <button type="button" className="overlay-restart" onClick={handlePauseToggle}>▶ Resume</button>
    </div>
  ) : null

  const renderCountdown = () => countdown !== null ? (
    <div className="overlay countdown-overlay">
      <div className="countdown-number">{countdown === 0 ? 'GO!' : countdown}</div>
    </div>
  ) : null

  const renderZoneEnd = (s) => (
    <AnimatePresence>
      {s.zoneEndResult && (
        <motion.div className="zone-end-overlay"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}>
          <div className="zone-end-number">{s.zoneEndResult.lines}</div>
          <div className="zone-end-label">ZONE LINES!</div>
          <div className="zone-end-bonus">+{s.zoneEndResult.bonus.toLocaleString()}</div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: '10% 18%', pointerEvents: 'none' }}>
            {Array.from({ length: Math.min(12, s.zoneEndResult.lines || 0) }).map((_, i) => (
              <motion.div key={i}
                initial={{ scaleX: 1, opacity: 0.9 }}
                animate={{ scaleX: 0, opacity: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.7, ease: 'easeIn' }}
                style={{ height: 6, background: 'linear-gradient(90deg,#fff,#00cfff)', borderRadius: 4, filter: 'drop-shadow(0 0 6px #00cfff)' }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── Zone meter fill ────────────────────────────────────────────────────────
  const zoneFillPct = state.zoneActive
    ? (state.zoneTimer / (state.zoneDuration || ZONE_DURATION_MS)) * 100
    : state.zoneMeter
  const zoneFillClass = `zone-meter-fill${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`

  // ─── MODES ──────────────────────────────────────────────────────────────────
  const MODES = [
    { mode: GAME_MODE.NORMAL, label: 'Normal' },
    { mode: GAME_MODE.SPRINT, label: 'Sprint' },
    { mode: GAME_MODE.BLITZ,  label: 'Blitz'  },
    { mode: GAME_MODE.PURIFY, label: 'Purify' },
    { mode: GAME_MODE.ZEN,    label: '🧘 Zen'  },
    { mode: GAME_MODE.ULTIMATE, label: '⚡ Ultimate' },
  ]

  const modeButtons = (
    <>
      {MODES.map(({ mode, label }) => (
        <button key={mode} type="button" className={`mode-btn${gameMode === mode ? ' active' : ''}`}
          onClick={() => startGame(mode)}>
          <span>{label}</span>
          {mode === GAME_MODE.ULTIMATE && (
            <span style={{ marginLeft: 8, fontSize: '0.58rem', color: '#eab308', letterSpacing: '0.08em', border: '1px solid rgba(234,179,8,0.45)', borderRadius: 10, padding: '1px 6px', background: 'rgba(234,179,8,0.08)', textTransform: 'uppercase' }}>2× coins</span>
          )}
        </button>
      ))}
    </>
  )

  // ─── Left flank (desktop) — Stats only ──────────────────────────────────────
  const leftFlank = (
    <div className="flank flank-left">
      <div className="stat-block">
        <div className="stat-item">
          <span className="label">Score</span>
          <span className="value small">{state.score.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="label">Level</span>
          <span className="value">{state.level}</span>
        </div>
        <div className="stat-item">
          <span className="label">Lines</span>
          <span className="value">{state.lines}{state.mode === GAME_MODE.SPRINT ? `/${SPRINT_LINES}` : ''}</span>
        </div>
        {state.mode === GAME_MODE.SPRINT && (
          <div className="stat-item"><span className="label">Time</span><span className="value small">{fmtElapsed(state.elapsedTime)}</span></div>
        )}
        {state.mode === GAME_MODE.BLITZ && (
          <div className="blitz-timer-display" style={{ color: state.blitzTimer < 15000 ? '#f87171' : '#facc15' }}>
            ⏱ {fmt(state.blitzTimer)}
          </div>
        )}
        {highScores[state.mode] != null && (
          <div className="high-score-line">Best: {highScores[state.mode].toLocaleString()}</div>
        )}
        {isTower && (
          <>
            <div className="stat-item" style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.4rem' }}>
              <span className="label">Floor</span>
              <span className="value" style={{ color: '#fb923c', textShadow: '0 0 10px #fb923c88' }}>{state.towerFloor}</span>
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', margin: '4px 0' }}>
              <div style={{ height: '100%', background: '#fb923c', borderRadius: 2, transition: 'width 0.2s ease', width: `${Math.round(((state.towerFloorLines || 0) / (state.towerFloorTarget || 5)) * 100)}%` }} />
            </div>
            <div style={{ fontSize: '0.5rem', color: '#888', letterSpacing: '0.1em' }}>{state.towerFloorLines || 0}/{state.towerFloorTarget || 5} LINES</div>
          </>
        )}
        {isPurify && (
          <>
            <div className="purify-timer-display" style={{ color: state.purifyTimer < 30000 ? '#f87171' : '#8b5cf6' }}>
              {fmt(state.purifyTimer)}
            </div>
            <div className="purify-count-row">
              <span>Purified</span>
              <strong>{state.blocksPurified}</strong>
            </div>
          </>
        )}
      </div>

      {state.combo > 1 && (
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-warn)', textShadow: '0 0 10px #f59e0b' }}>
          x{state.combo} COMBO
        </div>
      )}
      {!isPurify && state.backToBack && (
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffcc44', letterSpacing: '0.08em' }}>
          🔥 B2B{state.b2bCount > 1 ? ` x${state.b2bCount}` : ''}
        </div>
      )}
    </div>
  )

  // ─── Right flank (desktop) — Hold + Zone + Next ──────────────────────────────
  const rightFlank = (() => {
    const R = 26, circ = 2 * Math.PI * R
    const fillPct = state.zoneActive
      ? (state.zoneTimer / (state.zoneDuration || ZONE_DURATION_MS))
      : state.zoneMeter / 100
    const offset = circ * (1 - fillPct)
    const circClass = `zone-circle-fill${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`
    return (
      <div className="flank flank-right">
        <div>
          <div className="flank-label">Hold</div>
          <PiecePreview type={state.hold} />
        </div>

        {showZone && (
          <div className="zone-block" style={{ marginTop: '0.4rem' }}>
            <div className="flank-label">Zone</div>
            <div className="zone-circle-wrap">
              <svg className="zone-circle-svg" width="64" height="64" viewBox="0 0 64 64">
                <defs>
                  <linearGradient id="zoneFillGradR" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1e90ff" />
                    <stop offset="100%" stopColor="#00cfff" />
                  </linearGradient>
                  <linearGradient id="zoneActiveGradR" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8844ff" />
                    <stop offset="100%" stopColor="#00cfff" />
                  </linearGradient>
                </defs>
                <circle className="zone-circle-bg" cx="32" cy="32" r={R} />
                <circle className={circClass} cx="32" cy="32" r={R}
                  strokeDasharray={circ}
                  strokeDashoffset={offset} />
              </svg>
              <div className="zone-circle-label">
                {state.zoneActive
                  ? <><span className="zone-pct">{Math.ceil(state.zoneTimer / 1000)}s</span><span>ZONE</span></>
                  : <><span className="zone-pct">{state.zoneMeter}%</span>{zoneReady && <span>READY</span>}</>
                }
              </div>
            </div>
            {zoneReady && !state.zoneActive && (
              <button type="button" className="zone-status" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', color: 'var(--c-zone)', textDecoration: 'underline' }}
                onClick={handleZoneActivate}>▶ Activate (Shift)</button>
            )}
            {state.zoneActive && <div className="zone-status">Floor: {state.zoneFloor} rows</div>}
          </div>
        )}

        <div style={{ marginTop: '0.5rem' }}>
          <div className="flank-label">Next</div>
          <div className="queue-list">
            {state.queue.slice(0, 5).map((type, i) => <PiecePreview key={`${type}-${i}`} type={type} />)}
          </div>
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          <button type="button" className="icon-btn" style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem' }} onClick={() => setShowSettings(true)}>⚙ Settings</button>
        </div>
      </div>
    )
  })()

  // ─── Desktop render ─────────────────────────────────────────────────────────
  const renderDesktop = () => (
    <>
      <header className="site-header">
        <div className="site-logo">TETRA <span className="logo-overflow">OVERFLOW</span><sup className="logo-ultra">Ultra</sup></div>
        <div className="header-controls">
          <button type="button" className="icon-btn" onClick={() => startGame(gameMode)}>↺ Restart</button>
          <button type="button" className="icon-btn" onClick={handlePauseToggle}>
            {state.paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button type="button" className={`icon-btn${musicOn ? ' active' : ''}`} onClick={toggleMusic}>
            {musicOn ? '🔇' : '🎵'} Music
          </button>
          <button type="button" className="icon-btn" onClick={cycleZoom} title="Cycle zoom">
            🔍 {Math.round(zoom * 100)}%
          </button>
          <ThemeSwitcher />
          <button type="button" className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">⚙ Settings</button>
          <button type="button" className="icon-btn" onClick={() => setShowAbout(true)} title="About">ℹ About</button>
        </div>
      </header>

      <nav className="mode-strip">{modeButtons}</nav>

      <div className="play-area">
        {leftFlank}

        <div className="game-area">
            {state.combo > 1 && (
              <div className="combo-display">
                <div className="combo-number">{state.combo}</div>
                <div className="combo-label">COMBO</div>
              </div>
            )}
      {!isPurify && state.backToBack && <div className="b2b-badge">🔥 B2B{state.b2bCount > 1 ? ` x${state.b2bCount}` : ''}</div>}
            <div className={`game-canvas-wrap${zenResetting ? ' zen-clearing' : ''}`}>
              <GameCanvas state={state} onTap={() => triggerAction('rotateCW')}
                onTwoFingerTap={() => triggerAction('activateZone')}
                onDragBegin={handleDragBegin} onDragEnd={handleDragEnd} onHardDrop={handleHardDrop}
                boardAlpha={bgTheme ? 0.42 : undefined} />
              <GlitchOverlay active={glitchActive} />
              {/* Floor FX overlay */}
              <AnimatePresence>
                {floorFx && (
                  <motion.div
                    key="floor-fx"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ position: 'absolute', inset: 0, zIndex: 48, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {floorFx.burstCat && (
                      <motion.img
                        src={catImageUrl}
                        alt=""
                        initial={{ scale: 1.2, opacity: 0.06 }}
                        animate={{ rotate: [0, 360], opacity: [0.08, 0.12, 0.08], scale: [1.2, 1.0] }}
                        transition={{ duration: 1.2, ease: 'linear' }}
                        style={{ position: 'absolute', width: '140%', height: '140%', objectFit: 'cover', filter: 'contrast(110%) saturate(108%)' }}
                      />
                    )}
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0.6, opacity: 0.35 }}
                        animate={{ scale: 1.6 + i * 0.2, opacity: 0 }}
                        transition={{ duration: 0.9 + i * 0.15, ease: 'easeOut' }}
                        style={{ position: 'absolute', width: 220 + i * 30, height: 220 + i * 30, borderRadius: '50%', border: '2px solid #a855f7', boxShadow: '0 0 14px #a855f777 inset' }}
                      />
                    ))}
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ position: 'relative', zIndex: 2, padding: '0.35rem 0.7rem', borderRadius: 8, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 900, letterSpacing: '0.14em', fontSize: '0.9rem', textAlign: 'center' }}
                    >
                      FLOOR {state.towerFloor}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {jumpscare && (
                  <motion.div
                    key="jumpscare"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ position: 'absolute', inset: 0, background: '#000', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <motion.img
                      src={jumpscare.src}
                      alt=""
                      initial={{ scale: 1.02 }}
                      animate={{ scale: 1, rotate: [-1.5, 1.5, -1.0] }}
                      transition={{ duration: 1.4, ease: 'easeInOut' }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(115%) saturate(108%)' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              {renderOverlay(state, false)}
              {renderPauseOverlay(state)}
              {renderZoneEnd(state)}
              {renderCountdown()}
            </div>
            <div className="game-hud-bottom">
              {state.mode === GAME_MODE.SPRINT && <span>⏱ <span className="hud-val">{fmtElapsed(state.elapsedTime)}</span></span>}
              {state.mode !== GAME_MODE.SPRINT && state.mode !== GAME_MODE.BLITZ && <span />}
              <span style={{ textAlign: 'center' }}>
                {showZone && zoneReady && !state.zoneActive && (
                  <button type="button" onClick={handleZoneActivate}
                    style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid var(--c-accent)', color: 'var(--c-accent)', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', animation: 'zone-ready-pulse 0.5s infinite alternate' }}>
                    ⚡ Zone
                  </button>
                )}
                {state.zoneActive && <span style={{ color: 'var(--c-zone)', fontWeight: 700 }}>⚡ ZONE {Math.ceil(state.zoneTimer / 1000)}s</span>}
              </span>
              <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {isUltimate && !state.gameOver && (
                  <div title="Next chaos wave" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: '#889', letterSpacing: '0.08em' }}>CHAOS</span>
                    <div style={{ width: 90, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, 1 - (state.ultimateTimer / (state.ultimatePeriod || 1)))) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#a855f7,#22d3ee)', boxShadow: '0 0 10px #22d3ee66 inset' }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#889', width: 28, textAlign: 'right' }}>{Math.ceil((state.ultimateTimer || 0)/1000)}s</span>
                  </div>
                )}
              </span>
            </div>
          </div>

        {rightFlank}
      </div>
    </>
  )

  // ─── Mobile landscape (swipe + controller only) ────────────────────────────
  const renderMobileLandscape = () => (
    <div className="mobile-ls">

      {/* Left context panel: Purify info only */}
      {isPurify && (
        <div className="ls-left">
          <div className="ls-diff-title">Purify</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--c-muted)' }}>Clear the infection!</div>
        </div>
      )}

      {/* Centre: HUD bar + zone bar + canvas */}
      <div className="ls-centre">
        {/* stat bar */}
        <div className="ls-hud">
          <div className="ls-stat">
            <span className="l">HOLD</span>
            <PiecePreview type={state.hold} small />
          </div>
          <div className="ls-stat">
            <span className="l">Score</span>
            <span className="v">{state.score.toLocaleString()}</span>
          </div>
          <div className="ls-stat">
            <span className="l">Lv</span>
            <span className="v">{state.level}</span>
          </div>
          <div className="ls-stat">
            <span className="l">Lines</span>
            <span className="v">{state.lines}{state.mode === GAME_MODE.SPRINT ? `/${SPRINT_LINES}` : ''}</span>
          </div>
          {state.mode === GAME_MODE.BLITZ && (
            <div className="ls-stat">
              <span className="l">Time</span>
              <span className="v" style={{ color: state.blitzTimer < 15000 ? '#f87171' : '#facc15' }}>{fmt(state.blitzTimer)}</span>
            </div>
          )}
          {state.mode === GAME_MODE.PURIFY && (
            <div className="ls-stat">
              <span className="l">Left</span>
              <span className="v" style={{ color: state.purifyTimer < 30000 ? '#f87171' : '#a78bfa' }}>{fmt(state.purifyTimer)}</span>
            </div>
          )}
          <div className="ls-stat">
            <span className="l">Next</span>
            <div style={{ display: 'flex', gap: '0.15rem' }}>
              {state.queue.slice(0, 2).map((t, i) => <PiecePreview key={`${t}-${i}`} type={t} small />)}
            </div>
          </div>
        </div>

        {/* zone bar */}
        {showZone && (
          <div className="mobile-zone-bar">
            <div className={`mobile-zone-fill${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`}
              style={{ width: `${zoneFillPct}%` }} />
          </div>
        )}
        {/* chaos bar (Ultimate) */}
        {isUltimate && !state.gameOver && (
          <div style={{ marginTop: 6, width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(Math.max(0, Math.min(1, 1 - (state.ultimateTimer / (state.ultimatePeriod || 1)))) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#a855f7,#22d3ee)' }} />
          </div>
        )}

        {/* board */}
        <div className={`ls-canvas-wrap${zenResetting ? ' zen-clearing' : ''}`}>
          <GameCanvas state={state} onTap={() => triggerAction('rotateCW')}
            onTwoFingerTap={() => triggerAction('activateZone')}
            onDragBegin={handleDragBegin} onDragEnd={handleDragEnd} onHardDrop={handleHardDrop}
            boardAlpha={bgTheme ? 0.42 : undefined} />
          {renderOverlay(state, false)}
          {renderPauseOverlay(state)}
          {renderZoneEnd(state)}
          {renderCountdown()}
        </div>
      </div>

      {/* ── Right: actions + controls ── */}
      <div className="ls-right">
        {/* primary action buttons */}
        <button type="button" className="ls-action-btn ls-pause-btn" onClick={handlePauseToggle}>
          <span className="ls-btn-icon">{state.paused ? '▶' : '⏸'}</span>
          <span className="ls-btn-label">{state.paused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* zone button — prominent when ready */}
        {showZone && (
          <button type="button"
            className={`ls-zone-btn${state.zoneActive ? ' active' : ''}${zoneReady && !state.zoneActive ? ' ready' : ''}`}
            disabled={!zoneReady && !state.zoneActive}
            onClick={handleZoneActivate}>
            <span>⚡</span>
            <span className="ls-btn-label">{state.zoneActive ? 'ZONE ON' : zoneReady ? 'ZONE!' : `Zone ${state.zoneMeter}%`}</span>
          </button>
        )}

        {/* utility row */}
        <div className="ls-util ls-util-3">
          <button type="button" className={`ls-util-btn${musicOn ? ' active' : ''}`} onClick={toggleMusic}>🎵</button>
          <button type="button" className="ls-util-btn" onClick={() => startGame(gameMode)}>↺</button>
          <button type="button" className="ls-util-btn" onClick={() => setShowAbout(true)}>ℹ</button>
        </div>
        <div className="ls-util ls-util-3">
          <button type="button" className="ls-util-btn" onClick={() => setShowSettings(true)}>⚙</button>
        </div>

        {/* mode selector */}
        <div className="ls-modes">
          {[ 
            { mode: GAME_MODE.NORMAL,  label: 'Normal'  },
            { mode: GAME_MODE.SPRINT,  label: 'Sprint'  },
            { mode: GAME_MODE.BLITZ,   label: 'Blitz'   },
            { mode: GAME_MODE.ZEN,     label: 'Zen'     },
            { mode: GAME_MODE.PURIFY,  label: 'Purify'  },
            { mode: GAME_MODE.ULTIMATE, label: '⚡ Ultimate' },
          ].map(({ mode, label }) => (
            <button key={mode} type="button"
              className={`ls-mode-btn${gameMode === mode ? ' active' : ''}`}
              onClick={() => startGame(mode)}>
              <span>{label}</span>
              {mode === GAME_MODE.ULTIMATE && (
                <span style={{ marginLeft: 6, fontSize: '0.5rem', color: '#eab308', border: '1px solid rgba(234,179,8,0.45)', borderRadius: 8, padding: '0 5px', background: 'rgba(234,179,8,0.08)', textTransform: 'uppercase' }}>2×</span>
              )}
            </button>
          ))}
        </div>
      </div>

    </div>
  )

  // ─── Mobile non-versus ──────────────────────────────────────────────────────
  const renderMobileNormal = () => (
    <div className={`mobile-layout${isUiHidden ? ' ui-hidden' : ''}`}>
      {/* Floating UI toggle tab — always visible on the right bezel */}
      <button
        type="button"
        className="ui-toggle-tab"
        onClick={handleUiToggle}
        aria-label={isUiHidden ? 'Show controls' : 'Hide controls'}
      >
        {isUiHidden ? '▲' : '▼'}
      </button>
      {/* HUD */}
      <div className="mobile-hud">
        <div className="mobile-hud-hold">
          <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--c-muted)', textTransform: 'uppercase' }}>Hold</div>
          <PiecePreview type={state.hold} small />
        </div>
        <div className="mobile-hud-center">
          <div className="mobile-stat">
            <span className="l">Score</span>
            <span className="v" style={{ fontSize: '0.95rem' }}>{state.score.toLocaleString()}</span>
          </div>
          <div className="mobile-stat">
            <span className="l">Lv</span>
            <span className="v">{state.level}</span>
          </div>
          <div className="mobile-stat">
            <span className="l">Lines</span>
            <span className="v">{state.lines}{state.mode === GAME_MODE.SPRINT ? `/${SPRINT_LINES}` : ''}</span>
          </div>
          {state.mode === GAME_MODE.BLITZ && (
            <div className="mobile-stat">
              <span className="l">Time</span>
              <span className="v" style={{ color: state.blitzTimer < 15000 ? '#f87171' : '#facc15', fontSize: '0.95rem' }}>{fmt(state.blitzTimer)}</span>
            </div>
          )}
          {state.mode === GAME_MODE.PURIFY && (
            <div className="mobile-stat">
              <span className="l">Left</span>
              <span className="v" style={{ color: state.purifyTimer < 30000 ? '#f87171' : '#a78bfa', fontSize: '0.9rem' }}>{fmt(state.purifyTimer)}</span>
            </div>
          )}
        </div>
        <div className="mobile-hud-next">
          <div style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--c-muted)', textTransform: 'uppercase' }}>Next</div>
          {state.queue.slice(0, 3).map((t, i) => <PiecePreview key={`${t}-${i}`} type={t} small />)}
        </div>
      </div>

      {/* Zone bar - only in Normal and Versus modes */}
      {showZone && (
        <div className="mobile-zone-bar">
          <div className={`mobile-zone-fill${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`}
            style={{ width: `${zoneFillPct}%` }} />
        </div>
      )}
      {isUltimate && !state.gameOver && (
        <div style={{ marginTop: 6, width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(Math.max(0, Math.min(1, 1 - (state.ultimateTimer / (state.ultimatePeriod || 1)))) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#a855f7,#22d3ee)' }} />
        </div>
      )}
      <div className={`mobile-canvas-wrap${zenResetting ? ' zen-clearing' : ''}`}>
        <GameCanvas state={state} onTap={() => triggerAction('rotateCW')}
          onTwoFingerTap={() => triggerAction('activateZone')}
          onDragBegin={handleDragBegin} onDragEnd={handleDragEnd} onHardDrop={handleHardDrop}
          boardAlpha={bgTheme ? 0.42 : undefined} />
        <GlitchOverlay active={glitchActive} />
        {renderOverlay(state, false)}
        {renderPauseOverlay(state)}
        {renderZoneEnd(state)}
        {renderCountdown()}

        {/* Fullscreen mini HUD — visible only when UI is hidden */}
        {isUiHidden && (
          <div className="fullscreen-mini-hud">
            <div className="fmh-hold">
              <div className="fmh-label">Hold</div>
              <PiecePreview type={state.hold} small />
            </div>
            {showZone && (
              <div className="fmh-zone-wrap">
                <div className={`fmh-zone-bar${state.zoneActive ? ' zone-active' : ''}${zoneReady && !state.zoneActive ? ' zone-ready' : ''}`}
                  style={{ height: `${zoneFillPct}%` }} />
              </div>
            )}
            <div className="fmh-next">
              <div className="fmh-label">Next</div>
              {state.queue.slice(0, 3).map((t, i) => <PiecePreview key={`${t}-${i}`} type={t} small />)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel: same controls as landscape */}
      <div className="pt-panel">
        {/* Pause */}
        <button type="button" className="ls-action-btn ls-pause-btn" style={{ gridColumn: '1 / -1' }} onClick={handlePauseToggle}>
          <span className="ls-btn-icon">{state.paused ? '▶' : '⏸'}</span>
          <span className="ls-btn-label">{state.paused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Zone */}
        {showZone && (
          <button type="button"
            className={`ls-zone-btn${state.zoneActive ? ' active' : ''}${zoneReady && !state.zoneActive ? ' ready' : ''}`}
            disabled={!zoneReady && !state.zoneActive}
            onClick={handleZoneActivate}>
            <span>⚡</span>
            <span className="ls-btn-label">{state.zoneActive ? 'ZONE ON' : zoneReady ? 'ZONE!' : `Zone ${state.zoneMeter}%`}</span>
          </button>
        )}

        {/* Utilities */}
        <div className="ls-util ls-util-4">
          <button type="button" className={`ls-util-btn${musicOn ? ' active' : ''}`} onClick={toggleMusic}>🎵</button>
          <button type="button" className="ls-util-btn" onClick={() => startGame(gameMode)}>↺</button>
          <button type="button" className="ls-util-btn" onClick={() => setShowAbout(true)}>ℹ</button>
          <button type="button" className="ls-util-btn" onClick={() => setShowSettings(true)}>⚙</button>
        </div>

        {/* Mode grid */}
        <div className="ls-modes">
          {[ 
            { mode: GAME_MODE.NORMAL, label: 'Normal' },
            { mode: GAME_MODE.SPRINT, label: 'Sprint' },
            { mode: GAME_MODE.BLITZ,  label: 'Blitz'  },
            { mode: GAME_MODE.ZEN,    label: 'Zen'    },
            { mode: GAME_MODE.PURIFY, label: 'Purify' },
            { mode: GAME_MODE.ULTIMATE, label: '⚡ Ultimate' },
          ].map(({ mode, label }) => (
            <button key={mode} type="button"
              className={`ls-mode-btn${gameMode === mode ? ' active' : ''}`}
              onClick={() => startGame(mode)}>
              <span>{label}</span>
              {mode === GAME_MODE.ULTIMATE && (
                <span style={{ marginLeft: 6, fontSize: '0.5rem', color: '#eab308', border: '1px solid rgba(234,179,8,0.45)', borderRadius: 8, padding: '0 5px', background: 'rgba(234,179,8,0.08)', textTransform: 'uppercase' }}>2×</span>
              )}
            </button>
          ))}
        </div>

      </div>

    </div>
  )

  // ─── Root render ─────────────────────────────────────────────────────────────
  return (
    <>
      {isLoading && <LoadingScreen onDone={() => setIsLoading(false)} />}
      <div className={`app${state.zoneActive ? ' zone-active' : ''}`} style={!isMobile ? { '--board-w': `calc(260px * ${zoom})` } : undefined}>
      {renderInstallBanner()}
      {isMobile
        ? (isLandscape ? renderMobileLandscape() : renderMobileNormal())
        : renderDesktop()
      }
      {showAbout && (
        <AboutPage
          onClose={() => setShowAbout(false)}
          installPrompt={installPrompt}
          onInstall={handleInstallFromAbout}
        />
      )}
      {showSettings && (
        <SettingsPage
          config={config}
          onConfig={setConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
    </>
  )
}
