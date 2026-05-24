// ─── Season 3 — Temporal Fracture ─────────────────────────────────────────────
// 4 Epochs totaling 15 levels.
// Unlocked after beating Ophiuchus (Season 2 complete).
//
// Mechanic tags used in `mechanic` and `ability` fields:
//   time_dilation_intro       — introduce time-dilation rows (speed-shift rows)
//   time_dilation_zones       — more dilation rows, harder config
//   phantom_blocks_intro      — introduce phantom blocks
//   phantom_blocks_heavy      — more frequent phantoms
//   rewind_intro              — introduce the Rewind Gauge
//   rewind_heavy              — higher rewind pressure
//   all_mechanics_mixed       — all three passive mechanics simultaneously
//   shrinking_board           — visible ceiling lowers over time, combos push it back
//   hover_garbage             — (boss) garbage floats translucent 5s before landing
//   blind_queue               — (boss) Next Queue hidden unless Zone active
//   undo_clear                — (boss) 15% chance a cleared line snaps back
//   sticky_inputs             — (boss) simulated input delay; Zone restores crisp handling
//   worst_piece               — (boss) RNG biased toward worst-fit pieces
//   clear_lag                 — (boss) cleared lines stay visible 3s before disappearing
//   petrification             — (final boss) random block turns to stone every 15s; Zone cleanses

export const SEASON3_EPOCHS = [
  // ── Epoch 1: SYSTEM DEGRADATION (The Present) ─────────────────────────────
  {
    id: 'e1',
    title: 'SYSTEM DEGRADATION',
    subtitle: 'The timeline begins to fracture.',
    mapX: 10, mapY: 85,
    color: '#00ffff', glowColor: '#55ffff',
    levels: [
      {
        id: 'l1', title: 'LATENCY', subtitle: 'A slight delay.',
        bgType: 'glitch_light', bpm: 100, gravityMult: 1.00,
        targetLines: 32, easyTargetLines: 24,
        mechanic: 'time_dilation_intro',
        storyBefore: 'The matrix is stuttering. It starts small — a skipped frame, a delayed input. The Chrono-Stabilizer detects an anomaly.',
        storyAfter: 'The desynchronization is spreading to the outer edges of the grid.',
      },
      {
        id: 'l2', title: 'PACKET LOSS', subtitle: 'Information drops out.',
        bgType: 'glitch_med', bpm: 115, gravityMult: 1.15,
        targetLines: 36, easyTargetLines: 26,
        themeUnlock: 'theme_cyber_blue',
        mechanic: 'time_dilation_zones',
        storyBefore: 'Certain rows now actively warp time. Pieces will fast-forward or float. Adapt to the fluctuating speeds.',
        storyAfter: 'You navigated the broken rows, but the core is waking up to stop you.',
      },
      {
        id: 'l3', title: 'THE DESYNC', subtitle: 'Reality hovering.',
        bgType: 'matrix_distorted', bpm: 130, gravityMult: 1.25,
        targetLines: 40, easyTargetLines: 30,
        isBoss: true,
        ability: 'hover_garbage', abilityLabel: 'HOVER GARBAGE',
        abilityDesc: 'Garbage lines float as transparent holograms for 5 seconds before solidifying into the board.',
        storyBefore: 'MINI-BOSS: THE DESYNC. It attacks from a future that has not yet rendered. Build where the floor will be, not where it is.',
        storyAfter: 'The Desync collapses into raw data. But a larger shadow looms in the memory bank.',
      },
      {
        id: 'l4', title: 'BUFFER OVERRUN', subtitle: 'Blind faith in the algorithm.',
        bgType: 'error_cyan', bpm: 145, gravityMult: 1.40,
        targetLines: 44, easyTargetLines: 32,
        isBoss: true,
        ability: 'blind_queue', abilityLabel: 'BLIND QUEUE',
        abilityDesc: 'The "Next Piece" queue is completely hidden unless the Chrono-Stabilizer (Zone) is active.',
        storyBefore: 'BOSS: THE BUFFER OVERRUN. It has corrupted your UI. You are flying blind. Trust your instincts and use the Zone to see clearly.',
        storyAfter: 'EPOCH 1 MASTERED. The present is secured, but the fracture has pulled you backward into the ancient source code.',
      },
    ],
  },

  // ── Epoch 2: THE REGRESSION (The Past) ────────────────────────────────────
  {
    id: 'e2',
    title: 'THE REGRESSION',
    subtitle: 'Ghosts in the old machine.',
    mapX: 35, mapY: 70,
    color: '#ffaa00', glowColor: '#ffcc44',
    levels: [
      {
        id: 'l1', title: 'CATHODE', subtitle: 'Heavy light.',
        bgType: 'crt_scanline', bpm: 90, gravityMult: 0.90,
        targetLines: 34, easyTargetLines: 24,
        mechanic: 'phantom_blocks_intro',
        storyBefore: 'The environment has downgraded. Scanlines bleed across the matrix. Phantom outlines of future pieces haunt the board.',
        storyAfter: 'The phantoms solidified precisely where they were predicted. Time is rigid here.',
      },
      {
        id: 'l2', title: 'ROM CHIP', subtitle: 'Read only.',
        bgType: 'retro_grid', bpm: 95, gravityMult: 1.00,
        targetLines: 38, easyTargetLines: 28,
        themeUnlock: 'theme_amber_monochrome',
        mechanic: 'phantom_blocks_heavy',
        storyBefore: 'The ghosts are increasing in number. Do not build where they will manifest, or your stack will shatter when they become real.',
        storyAfter: 'You read the patterns of the past perfectly.',
      },
      {
        id: 'l3', title: 'THE ROLLBACK', subtitle: 'What is done is undone.',
        bgType: 'vhs_tracking', bpm: 110, gravityMult: 1.10,
        targetLines: 42, easyTargetLines: 32,
        isBoss: true,
        ability: 'undo_clear', abilityLabel: 'FALSE CLEAR',
        abilityDesc: 'Every line clear has a 15% chance to glitch, leaving the blocks on the board but granting the points.',
        storyBefore: 'MINI-BOSS: THE ROLLBACK. It refuses to let the blocks disappear. It wants the board full, choked with the weight of history.',
        storyAfter: 'You forced the system to execute the deletions. The memory clears.',
      },
      {
        id: 'l4', title: 'LEGACY CONSTRAINT', subtitle: 'Trapped in amber.',
        bgType: '8bit_dungeon', bpm: 125, gravityMult: 1.30,
        targetLines: 46, easyTargetLines: 34,
        isBoss: true,
        ability: 'sticky_inputs', abilityLabel: 'HARDWARE LAG',
        abilityDesc: 'Controls suffer from simulated input delay. Activating the Zone restores crisp, modern handling for its duration.',
        storyBefore: 'BOSS: THE LEGACY CONSTRAINT. You are fighting the limitations of old hardware. The controls resist you. Break free.',
        storyAfter: 'EPOCH 2 MASTERED. You have shattered the constraints of the past. The timeline accelerates violently forward.',
      },
    ],
  },

  // ── Epoch 3: THE OVERCLOCK (The Accelerated Future) ───────────────────────
  {
    id: 'e3',
    title: 'THE OVERCLOCK',
    subtitle: 'Pushing beyond parameters.',
    mapX: 65, mapY: 45,
    color: '#ff007f', glowColor: '#ff44aa',
    levels: [
      {
        id: 'l1', title: 'THREADING', subtitle: 'Concurrent execution.',
        bgType: 'neon_wireframe', bpm: 160, gravityMult: 1.60,
        targetLines: 40, easyTargetLines: 30,
        mechanic: 'rewind_intro',
        storyBefore: 'Welcome to the future. Everything is moving too fast. The system grants you the Rewind gauge. Use it when the speed betrays you.',
        storyAfter: 'You stepped backward to move forward. A vital skill here.',
      },
      {
        id: 'l2', title: 'HEURISTICS', subtitle: 'Educated guesses at lightspeed.',
        bgType: 'synthwave_city', bpm: 175, gravityMult: 1.80,
        targetLines: 44, easyTargetLines: 32,
        themeUnlock: 'theme_outrun',
        mechanic: 'rewind_heavy',
        storyBefore: 'The drops are relentless. Mistakes are inevitable. Rely on your Rewind to undo fatal misplacements.',
        storyAfter: 'You outpaced the algorithm\'s expectations.',
      },
      {
        id: 'l3', title: 'THE PREDICTOR', subtitle: 'It knows your weakness.',
        bgType: 'ai_eye', bpm: 185, gravityMult: 1.95,
        targetLines: 48, easyTargetLines: 34,
        isBoss: true,
        ability: 'worst_piece', abilityLabel: 'SABOTAGE RNG',
        abilityDesc: 'The RNG analyzes your stack and actively gives you the most unhelpful pieces.',
        storyBefore: 'MINI-BOSS: THE PREDICTOR. It sees the gaps you need and denies you the pieces to fill them. Bait it, then Rewind to break its logic.',
        storyAfter: 'The AI logic loops back on itself and crashes. A hollow victory.',
      },
      {
        id: 'l4', title: 'RACE CONDITION', subtitle: 'Outrunning the execution.',
        bgType: 'lightspeed_tunnel', bpm: 200, gravityMult: 2.20,
        targetLines: 52, easyTargetLines: 38,
        isBoss: true,
        ability: 'clear_lag', abilityLabel: 'CLEAR LAG',
        abilityDesc: 'Lines take 3 full seconds to visually disappear from the board after being cleared, obstructing your view.',
        storyBefore: 'BOSS: THE RACE CONDITION. The board logic cannot keep up with the drop speed. You are building on top of ghosts. Do not lose your place.',
        storyAfter: 'EPOCH 3 MASTERED. The overclock has burned out the motherboard. The timelines are colliding.',
      },
    ],
  },

  // ── Epoch 4: KERNEL PANIC (The Climax) ────────────────────────────────────
  {
    id: 'e4',
    title: 'KERNEL PANIC',
    subtitle: 'Fatal system error.',
    mapX: 90, mapY: 20,
    color: '#ff0000', glowColor: '#ff3333',
    levels: [
      {
        id: 'l1', title: 'MEMORY LEAK', subtitle: 'The foundation dissolves.',
        bgType: 'red_hex', bpm: 140, gravityMult: 1.50,
        targetLines: 44, easyTargetLines: 32,
        mechanic: 'all_mechanics_mixed',
        storyBefore: 'The matrix is dying. Phantom blocks from the past, time-dilation from the present, and blinding speed from the future. All at once.',
        storyAfter: 'You survived the first wave of the collapse.',
      },
      {
        id: 'l2', title: 'THE DEADLOCK', subtitle: 'Total gridlock.',
        bgType: 'corrupted_code', bpm: 165, gravityMult: 1.80,
        targetLines: 50, easyTargetLines: 36,
        themeUnlock: 'theme_panic_red',
        mechanic: 'shrinking_board',
        storyBefore: 'The ceiling is lowering. The system is trying to crush you out of its memory. Force the ceiling up with massive combos.',
        storyAfter: 'The grid is stabilized just enough to isolate the core anomaly.',
      },
      {
        id: 'l3', title: 'ABSOLUTE OVERFLOW', subtitle: 'The end of the line.',
        bgType: 'shattered_glass', bpm: 210, gravityMult: 2.50,
        targetLines: 60, easyTargetLines: 42,
        isBoss: true,
        themeUnlock: 'theme_overflow_ultra',
        ability: 'petrification', abilityLabel: 'PETRIFY',
        abilityDesc: 'Every 15 seconds, a randomly placed block turns to unbreakable stone. Only the Chrono-Stabilizer can cleanse the board.',
        storyBefore: 'FINAL BOSS: THE ABSOLUTE OVERFLOW. It is corrupting your very foundation. Execute the final synchronization protocol or be erased.',
        storyAfter: 'SEASON 3 COMPLETE — The fracture seals. The timeline resets to zero. You are the Architect now.',
      },
    ],
  },
]

// ── Progress keys ──────────────────────────────────────────────────────────────
// Progress is stored as `s3_e1_l1_completed`, `s3_e1_l1_score`, etc.

/** Find epoch + level data by IDs */
export function findS3Level(epochId, levelId) {
  const epoch = SEASON3_EPOCHS.find(e => e.id === epochId)
  if (!epoch) return null
  const level = epoch.levels.find(l => l.id === levelId)
  if (!level) return null
  return { epoch, level }
}

/** Return the next {epochId, levelId} pair after the given one, or null if it's the last */
export function getNextS3Level(epochId, levelId) {
  const epIdx = SEASON3_EPOCHS.findIndex(e => e.id === epochId)
  if (epIdx < 0) return null
  const epoch = SEASON3_EPOCHS[epIdx]
  const lvIdx = epoch.levels.findIndex(l => l.id === levelId)
  if (lvIdx < 0) return null
  if (lvIdx + 1 < epoch.levels.length) {
    return { epochId, levelId: epoch.levels[lvIdx + 1].id }
  }
  if (epIdx + 1 < SEASON3_EPOCHS.length) {
    return { epochId: SEASON3_EPOCHS[epIdx + 1].id, levelId: SEASON3_EPOCHS[epIdx + 1].levels[0].id }
  }
  return null
}

/** True if first level of an epoch is unlocked (prior epoch fully beaten or first epoch) */
export function isEpochUnlocked(epochId, progress) {
  const idx = SEASON3_EPOCHS.findIndex(e => e.id === epochId)
  if (idx === 0) return true
  const prevEpoch = SEASON3_EPOCHS[idx - 1]
  return prevEpoch.levels.every(l => !!progress[`s3_${prevEpoch.id}_${l.id}_completed`])
}

/** True if a specific level is unlocked */
export function isS3LevelUnlocked(epochId, levelId, progress) {
  const epoch = SEASON3_EPOCHS.find(e => e.id === epochId)
  if (!epoch) return false
  const lvIdx = epoch.levels.findIndex(l => l.id === levelId)
  if (lvIdx < 0) return false
  if (lvIdx === 0) return isEpochUnlocked(epochId, progress)
  const prevLevel = epoch.levels[lvIdx - 1]
  return !!progress[`s3_${epochId}_${prevLevel.id}_completed`]
}

/** True once all 15 S3 levels are beaten */
export function isS3Complete(progress) {
  return SEASON3_EPOCHS.every(epoch =>
    epoch.levels.every(l => !!progress[`s3_${epoch.id}_${l.id}_completed`])
  )
}

/** S3 unlocks after Ophiuchus (Season 2 final boss) is beaten */
export function isS3Unlocked(progress) {
  return !!progress['zodiac_ophiuchus_completed']
}
