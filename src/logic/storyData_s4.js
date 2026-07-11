// ─── Season 4 — The Genesis Protocol ──────────────────────────────────────────
// 4 Sectors totaling 14 levels.
// Unlocked after beating Absolute Overflow (Season 3 complete).
//
// Mechanic tags used in `mechanic` and `ability` fields:
//   void_zones_intro        — grid spots that delete any block placed on them
//   void_zones_heavy        — dynamic, moving void spots
//   mirage_blocks           — pieces appear as a different shape until locked
//   hyper_density           — specific rows require being cleared twice to disappear
//   gravity_inversion       — pieces fall up instead of down (board inverted)
//   echo_drops              — dropping a piece creates a phantom block on the opposite side
//   boss_code_injection     — (boss) garbage spawns mid-air while your piece is falling
//   boss_dimension_shatter  — (boss) board visually splits in two; pieces wrap around the split
//   boss_mirror_shadow      — (final boss) mimics your exact placements to build their own attack gauge
//   zone_purification       — using Zone actively deletes void zones and cures mirages

import { isDevMode } from './devMode'

export const SEASON4_SECTORS = [
  // ── Sector 1: THE BLANK CANVAS (Creation) ─────────────────────────────────
  {
    id: 's1',
    title: 'THE BLANK CANVAS',
    subtitle: 'A new universe awaits execution.',
    mapX: 15,
    mapY: 85,
    color: '#ffffff',
    glowColor: '#e0e7ff',
    levels: [
      {
        id: 'l1',
        title: 'HELLO WORLD',
        subtitle: 'The first keystroke.',
        bgType: 'pure_white_grid',
        bpm: 100,
        gravityMult: 1.0,
        targetLines: 32,
        easyTargetLines: 24,
        mechanic: 'hyper_density',
        storyBefore:
          'The timeline has reset to zero. You are the Architect. The matrix is pristine, but the new code is dense. Some lines will require double the effort to clear.',
        storyAfter: 'The foundation holds. The first blocks of the new reality are set.',
      },
      {
        id: 'l2',
        title: 'COMPILATION',
        subtitle: 'Building the framework.',
        bgType: 'gold_wireframe',
        bpm: 115,
        gravityMult: 1.15,
        targetLines: 36,
        easyTargetLines: 26,
        themeUnlock: 'theme_genesis_gold',
        mechanic: 'mirage_blocks',
        storyBefore:
          'The renderer is still calibrating. Pieces may appear distorted—an I-piece might look like a T-piece until it locks. Trust the queue, not your eyes.',
        storyAfter: 'Your intuition bypassed the visual bugs. The system is learning.',
      },
      {
        id: 'l3',
        title: 'THE ROGUE SEED',
        subtitle: 'A glitch in the new world.',
        bgType: 'corrupted_white',
        bpm: 135,
        gravityMult: 1.3,
        targetLines: 40,
        easyTargetLines: 30,
        isBoss: true,
        ability: 'boss_code_injection',
        abilityLabel: 'CODE INJECTION',
        abilityDesc: 'Scattered garbage blocks spawn mid-air while your active piece is falling.',
        storyBefore:
          'MINI-BOSS: THE ROGUE SEED. A remnant of the old timeline survived the reset. It is injecting malicious code directly into the atmosphere.',
        storyAfter:
          'SECTOR 1 MASTERED. The rogue code is quarantined, but it points to a larger infection in the null sectors.',
      },
    ],
  },

  // ── Sector 2: THE NULL SECTOR (The Space Between) ─────────────────────────
  {
    id: 's2',
    title: 'THE NULL SECTOR',
    subtitle: 'Where deleted data goes to die.',
    mapX: 40,
    mapY: 70,
    color: '#8b5cf6',
    glowColor: '#a78bfa',
    levels: [
      {
        id: 'l1',
        title: 'ABYSS WAKE',
        subtitle: 'Empty variables.',
        bgType: 'void_purple',
        bpm: 120,
        gravityMult: 1.25,
        targetLines: 34,
        easyTargetLines: 26,
        mechanic: 'void_zones_intro',
        storyBefore:
          'You have entered the Null Sector to hunt the remaining anomalies. Beware the Void Zones—they will devour any block placed upon them, breaking your lines.',
        storyAfter: 'You navigated the emptiness. The structure remains intact.',
      },
      {
        id: 'l2',
        title: 'EVENT HORIZON',
        subtitle: 'No way back.',
        bgType: 'black_hole_swirl',
        bpm: 135,
        gravityMult: 1.4,
        targetLines: 40,
        easyTargetLines: 30,
        themeUnlock: 'theme_dark_matter',
        mechanic: 'void_zones_heavy',
        storyBefore:
          'The void is shifting. The deletion zones are moving across the grid. Use the Zone feature to temporarily freeze and purify them.',
        storyAfter: 'The event horizon is stabilized. But the gravity here is... wrong.',
      },
      {
        id: 'l3',
        title: 'THE INVERTED',
        subtitle: 'Falling upwards.',
        bgType: 'upside_down_matrix',
        bpm: 150,
        gravityMult: 1.6,
        targetLines: 44,
        easyTargetLines: 32,
        mechanic: 'gravity_inversion',
        storyBefore:
          'The physics engine has collapsed in this sector. Up is down. Pieces spawn at the bottom and fall towards the ceiling. Adjust your perspective.',
        storyAfter: 'You conquered the inversion. Your mind is adapting faster than the system can break.',
      },
      {
        id: 'l4',
        title: 'THE FRACTAL BEAST',
        subtitle: 'Infinite recursion.',
        bgType: 'fractal_madness',
        bpm: 165,
        gravityMult: 1.8,
        targetLines: 50,
        easyTargetLines: 36,
        isBoss: true,
        ability: 'boss_dimension_shatter',
        abilityLabel: 'DIMENSION SHATTER',
        abilityDesc:
          'The board splits down the middle. Pieces cut by the rift are severed, wrapping to the other side of the matrix.',
        storyBefore:
          'BOSS: THE FRACTAL BEAST. It lives in the split spaces of the code. It will tear your board in half. Build across the rift.',
        storyAfter: 'SECTOR 2 MASTERED. The beast is shattered into raw polygons. You are approaching the core of the infection.',
      },
    ],
  },

  // ── Sector 3: ASYMMETRY (The Warped Logic) ────────────────────────────────
  {
    id: 's3',
    title: 'ASYMMETRY',
    subtitle: 'Every action has a twisted reaction.',
    mapX: 70,
    mapY: 50,
    color: '#f43f5e',
    glowColor: '#fb7185',
    levels: [
      {
        id: 'l1',
        title: 'ECHO CHAMBER',
        subtitle: 'Doppelgänger blocks.',
        bgType: 'mirror_dimension',
        bpm: 150,
        gravityMult: 1.7,
        targetLines: 42,
        easyTargetLines: 30,
        mechanic: 'echo_drops',
        storyBefore:
          'In this sector, the code reflects itself. Dropping a piece on the left will drop a phantom "echo" piece on the right. Use this to clear lines twice as fast, or drown in your own echoes.',
        storyAfter: 'Symmetry achieved. You have weaponized the echo.',
      },
      {
        id: 'l2',
        title: 'FALSE POSITIVES',
        subtitle: 'Lies in the UI.',
        bgType: 'glitch_red',
        bpm: 175,
        gravityMult: 1.9,
        targetLines: 46,
        easyTargetLines: 34,
        mechanic: 'mirage_blocks',
        storyBefore:
          'The corruption is fighting back. The pieces, the queue, and even the hold box are lying to you. Trust nothing but the collision boxes.',
        storyAfter: 'You saw through the illusions.',
      },
      {
        id: 'l3',
        title: 'THE DOPPELGÄNGER',
        subtitle: 'Your worst enemy is you.',
        bgType: 'shattered_mirror',
        bpm: 195,
        gravityMult: 2.1,
        targetLines: 54,
        easyTargetLines: 40,
        isBoss: true,
        ability: 'boss_mirror_shadow',
        abilityLabel: 'SHADOW MIMIC',
        abilityDesc:
          'The boss mirrors your exact placements. The better you play, the faster its attack gauge fills. Force it into bad placements.',
        storyBefore:
          'MINI-BOSS: THE DOPPELGÄNGER. It learned from your replays. It plays exactly like you. You must play sub-optimally to break its logic, then use the Zone to finish it.',
        storyAfter: 'SECTOR 3 MASTERED. You outsmarted your own algorithms. The path to the Zenith is open.',
      },
    ],
  },

  // ── Sector 4: THE ZENITH (The Ultimate Test) ──────────────────────────────
  {
    id: 's4',
    title: 'THE ZENITH',
    subtitle: 'Two Architects cannot share one sky.',
    mapX: 85,
    mapY: 20,
    color: '#10b981',
    glowColor: '#34d399',
    levels: [
      {
        id: 'l1',
        title: 'GOD MODE',
        subtitle: 'Maximum throughput.',
        bgType: 'matrix_green_rain',
        bpm: 180,
        gravityMult: 2.0,
        targetLines: 50,
        easyTargetLines: 36,
        themeUnlock: 'theme_architect_green',
        mechanic: 'echo_drops',
        storyBefore:
          'You have full access to the system resources, but so does the corruption. The board is moving at blistering speeds. Maintain the flow state.',
        storyAfter: 'Your APM is off the charts. You are ready.',
      },
      {
        id: 'l2',
        title: 'THE CRUCIBLE',
        subtitle: 'All mechanics engaged.',
        bgType: 'obsidian_core',
        bpm: 200,
        gravityMult: 2.4,
        targetLines: 55,
        easyTargetLines: 40,
        mechanic: 'void_zones_heavy',
        storyBefore:
          'Void zones, inverted gravity, and hyper-dense rows. This is the crucible. Prove you deserve the title of Architect.',
        storyAfter: 'You survived the fire. The core is exposed.',
      },
      {
        id: 'l3',
        title: 'THE SHADOW ARCHITECT',
        subtitle: 'The final deletion.',
        bgType: 'prismatic_void',
        bpm: 230,
        gravityMult: 2.8,
        targetLines: 65,
        easyTargetLines: 46,
        isBoss: true,
        themeUnlock: 'theme_genesis_ultimate',
        ability: 'zone_purification',
        abilityLabel: 'TOTAL ECLIPSE',
        abilityDesc:
          'The boss will randomly lock your controls and flip the board. Your only defense is a fully charged Chrono-Stabilizer (Zone) to purge the corruption.',
        storyBefore:
          'FINAL BOSS: THE SHADOW ARCHITECT. The manifestation of every misdrop, every topped-out board, and every glitch from the old timelines. Erase it. Build the perfect world.',
        storyAfter:
          'SEASON 4 COMPLETE — The Shadow is deleted. The matrix is pure. You sit on the throne of a flawless universe. Tetra Overflow Ultra is yours.',
      },
    ],
  },
]

/** Find sector + level data by IDs */
export function findS4Level(sectorId, levelId) {
  const sector = SEASON4_SECTORS.find(s => s.id === sectorId)
  if (!sector) return null
  const level = sector.levels.find(l => l.id === levelId)
  if (!level) return null
  return { sector, level }
}

/** Return the next {sectorId, levelId} pair after the given one, or null if it's the last */
export function getNextS4Level(sectorId, levelId) {
  const secIdx = SEASON4_SECTORS.findIndex(s => s.id === sectorId)
  if (secIdx < 0) return null
  const sector = SEASON4_SECTORS[secIdx]
  const lvIdx = sector.levels.findIndex(l => l.id === levelId)
  if (lvIdx < 0) return null
  if (lvIdx + 1 < sector.levels.length) {
    return { sectorId, levelId: sector.levels[lvIdx + 1].id }
  }
  if (secIdx + 1 < SEASON4_SECTORS.length) {
    return { sectorId: SEASON4_SECTORS[secIdx + 1].id, levelId: SEASON4_SECTORS[secIdx + 1].levels[0].id }
  }
  return null
}

/** True if first level of a sector is unlocked (prior sector fully beaten or first sector) */
export function isSectorUnlocked(sectorId, progress) {
  if (isDevMode()) return true
  const idx = SEASON4_SECTORS.findIndex(s => s.id === sectorId)
  if (idx === 0) return true
  const prevSector = SEASON4_SECTORS[idx - 1]
  return prevSector.levels.every(l => !!progress[`s4_${prevSector.id}_${l.id}_completed`])
}

/** True if a specific level is unlocked */
export function isS4LevelUnlocked(sectorId, levelId, progress) {
  if (isDevMode()) return true
  const sector = SEASON4_SECTORS.find(s => s.id === sectorId)
  if (!sector) return false
  const lvIdx = sector.levels.findIndex(l => l.id === levelId)
  if (lvIdx < 0) return false
  if (lvIdx === 0) return isSectorUnlocked(sectorId, progress)
  const prevLevel = sector.levels[lvIdx - 1]
  return !!progress[`s4_${sectorId}_${prevLevel.id}_completed`]
}

/** True once all 14 S4 levels are beaten */
export function isS4Complete(progress) {
  return SEASON4_SECTORS.every(sector =>
    sector.levels.every(l => !!progress[`s4_${sector.id}_${l.id}_completed`])
  )
}

/** S4 unlocks after Absolute Overflow (Season 3 final boss) is beaten (or in dev mode) */
export function isS4Unlocked(progress) {
  return isDevMode() || !!progress['s3_e4_l3_completed']
}
