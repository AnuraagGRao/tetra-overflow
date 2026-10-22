// Season 6: THE ZENITH PROTOCOL (TETR.IO Style Infinite Tower Climb)
// Players scale the monolith floor by floor with escalating speed, garbage pressure,
// synesthesia beats, and dynamic visual strata.

import { isDevMode } from './devMode'

export const S6_STORAGE_KEY = 'tetris_s6_tower_record'

export const TOWER_STRATA = [
  {
    tier: 1,
    minFloor: 1,
    maxFloor: 10,
    name: 'LATTICE FOUNDATION',
    subtitle: 'Low Orbit / Monolith Spire',
    bgType: 'cyberpunk',
    pieceTheme: 'neon',
    gravityMult: 1.0,
    linesPerFloor: 4,
    garbageIntervalMs: 14000,
    color: '#00d4ff',
    badge: 'LAYER I',
    lore: 'The base of the spire hums with auxiliary power. Foundations built from ancient mainframe blocks.',
  },
  {
    tier: 2,
    minFloor: 11,
    maxFloor: 25,
    name: 'MESOSPHERE LATTICE',
    subtitle: 'Pressurized Glass & Frost',
    bgType: 'glacier',
    pieceTheme: 'frozen',
    gravityMult: 1.45,
    linesPerFloor: 5,
    garbageIntervalMs: 11000,
    color: '#38bdf8',
    badge: 'LAYER II',
    lore: 'Atmosphere thins as you cross into the freezing glass elevator shafts. Condensation freezes on the matrix.',
  },
  {
    tier: 3,
    minFloor: 26,
    maxFloor: 45,
    name: 'IONIC STRATOSPHERE',
    subtitle: 'Cosmic Radiation & Ion Fields',
    bgType: 'nebula',
    pieceTheme: 'crystal',
    gravityMult: 2.2,
    linesPerFloor: 6,
    garbageIntervalMs: 9000,
    color: '#c084fc',
    badge: 'LAYER III',
    lore: 'High-energy cosmic rays penetrate the hull. Tetrises and T-Spins delay incoming garbage waves.',
  },
  {
    tier: 4,
    minFloor: 46,
    maxFloor: 70,
    name: 'THERMAL EXOSPHERE',
    subtitle: 'Solar Flares & Thermal Drag',
    bgType: 'stellar',
    pieceTheme: 'obsidian',
    gravityMult: 3.5,
    linesPerFloor: 7,
    garbageIntervalMs: 7500,
    color: '#f59e0b',
    badge: 'LAYER IV',
    lore: 'Unfiltered stellar radiation scorches the hull. Pieces drop with brutal velocity; precision is survival.',
  },
  {
    tier: 5,
    minFloor: 71,
    maxFloor: 99,
    name: 'SINGULARITY SHELF',
    subtitle: 'Gravitational Event Horizon',
    bgType: 'blackhole',
    pieceTheme: 'terminal',
    gravityMult: 5.5,
    linesPerFloor: 8,
    garbageIntervalMs: 6000,
    color: '#ef4444',
    badge: 'LAYER V',
    lore: 'Gravity distorts the playing field into an intense vortex. Entry delay is near zero; lock delay requires instant sliding.',
  },
  {
    tier: 6,
    minFloor: 100,
    maxFloor: 99999,
    name: 'THE ZENITH APEX',
    subtitle: 'Infinite Apex Beyond Space',
    bgType: 'warp',
    pieceTheme: 'blueprint',
    gravityMult: 9.0,
    linesPerFloor: 9,
    garbageIntervalMs: 4800,
    color: '#f43f5e',
    badge: 'THE APEX',
    lore: 'The top of the infinite tower where time dissolves. An endless test of human reaction against absolute entropy.',
  },
]

export function getStrataForFloor(floor = 1) {
  const f = Math.max(1, Number(floor) || 1)
  return TOWER_STRATA.find(s => f >= s.minFloor && f <= s.maxFloor) || TOWER_STRATA[TOWER_STRATA.length - 1]
}

export function isS6Unlocked(progress = {}) {
  if (isDevMode()) return true
  // Unlocked once Pantheon (Season 5) is beaten, or if developer/early access flag is set
  return Boolean(
    progress.s5_completed ||
    progress.pantheon_cleared ||
    progress.aetherion_beaten ||
    progress.ch8_l1_completed // Graceful unlock for seasoned players
  )
}

export function loadTowerRecord() {
  try {
    const raw = localStorage.getItem(S6_STORAGE_KEY)
    if (!raw) return { highestFloor: 1, bestScore: 0, totalClimbs: 0, bestLines: 0 }
    return JSON.parse(raw)
  } catch {
    return { highestFloor: 1, bestScore: 0, totalClimbs: 0, bestLines: 0 }
  }
}

export function saveTowerRecord({ floor = 1, score = 0, lines = 0 }) {
  try {
    const current = loadTowerRecord()
    const updated = {
      highestFloor: Math.max(current.highestFloor || 1, floor),
      bestScore: Math.max(current.bestScore || 0, score),
      bestLines: Math.max(current.bestLines || 0, lines),
      totalClimbs: (current.totalClimbs || 0) + 1,
      lastPlayed: Date.now(),
    }
    localStorage.setItem(S6_STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return null
  }
}
