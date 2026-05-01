// ─── Story chapter + level definitions ────────────────────────────────────────
// 7 chapters: 4 elements → 3 beyond-earth chapters
// targetLines: clear this many lines to pass the level
// gravityMult: multiplier on base gravity for this level

export const STORY_CHAPTERS = [
  // ── Chapter 1: EARTH ──────────────────────────────────────────────────────
  {
    id: 'ch1', title: 'EARTH', subtitle: 'From dust, all things begin.',
    mapX: 12, mapY: 82, color: '#78a046', glowColor: '#88cc44',
    levels: [
      {
        id: 'l1', title: 'BEDROCK', subtitle: 'The Foundation.',
        bgType: 'quake', gravityMult: 0.70, targetLines: 28, themeUnlock: 'theme_terracotta',
        storyBefore: 'Deep beneath the surface, tectonic pressure builds. The earth remembers every crack, every fault. Place your first stone.',
        storyAfter: 'A foundation takes shape. The earth accepts your presence.',
      },
      {
        id: 'l2', title: 'CRYSTAL VEINS', subtitle: 'Order hidden in chaos.',
        bgType: 'crystal', gravityMult: 0.85, targetLines: 30, themeUnlock: 'theme_amber',
        storyBefore: 'Mineral veins grow through rock over millennia. You compress that time. Each locked piece grows the lattice.',
        storyAfter: 'The crystals hum with stored energy. Something ancient resonates.',
      },
      {
        id: 'l3', title: 'THE FOREST', subtitle: 'Life reaches upward.',
        bgType: 'forest', gravityMult: 1.00, targetLines: 32,
        storyBefore: 'Above the stone, roots take hold. The canopy blocks the sky, but light still finds a way. Find yours.',
        storyAfter: 'The forest grows around your pattern. You are part of it now.',
      },
      {
        id: 'l4', title: 'TECTONIC', subtitle: 'The world reshapes itself.',
        bgType: 'lava', gravityMult: 1.20, targetLines: 36, isBoss: true, themeUnlock: 'theme_obsidian',
        storyBefore: 'EARTH FINALE — Magma breaks through. The old world burns to make way for the new.',
        storyAfter: 'EARTH MASTERED — You have spoken the language of the ground. The first seal breaks.',
      },
    ],
  },

  // ── Chapter 2: WATER ─────────────────────────────────────────────────────
  {
    id: 'ch2', title: 'WATER', subtitle: 'Flow around every obstacle.',
    mapX: 26, mapY: 68, color: '#2299dd', glowColor: '#44aaff',
    levels: [
      {
        id: 'l1', title: 'THE DEEP', subtitle: 'Pressure and silence.',
        bgType: 'ocean', gravityMult: 0.60, targetLines: 28,
        storyBefore: 'Kilometres below the surface. Cold, dark, absolute. The blocks drift like sediment.',
        storyAfter: 'The deep stirs. Something vast and patient opens one eye.',
      },
      {
        id: 'l2', title: 'CORAL BLOOM', subtitle: 'Life in full colour.',
        bgType: 'bubbles', gravityMult: 0.80, targetLines: 32,
        storyBefore: 'The reef bursts with impossible colour. Each piece placed is another creature finding its home.',
        storyAfter: 'The reef sings. Every locked block pulses with borrowed life.',
      },
      {
        id: 'l3', title: 'GLACIER', subtitle: 'Time frozen in ice.',
        bgType: 'glacier', gravityMult: 1.10, targetLines: 36, themeUnlock: 'theme_frozen',
        storyBefore: 'Ancient ice holds secrets thousands of years old. It moves — but so slowly. You will not be granted the same patience.',
        storyAfter: 'The glacier calves. Thunder rolls across the white world.',
      },
      {
        id: 'l4', title: 'THE STORM', subtitle: 'Water becomes wrath.',
        bgType: 'storm', gravityMult: 1.40, targetLines: 40, isBoss: true, themeUnlock: 'theme_biolume',
        storyBefore: 'WATER FINALE — The cyclone makes no distinction between life and debris. Speed is your only shelter.',
        storyAfter: 'WATER MASTERED — The storm passes. In the silence, a second seal breaks.',
      },
    ],
  },

  // ── Chapter 3: FIRE ──────────────────────────────────────────────────────
  {
    id: 'ch3', title: 'FIRE', subtitle: 'Destruction is just creation at speed.',
    mapX: 42, mapY: 55, color: '#e05020', glowColor: '#ff6622',
    levels: [
      {
        id: 'l1', title: 'EMBERS', subtitle: 'What survives the burn.',
        bgType: 'ember', gravityMult: 0.80, targetLines: 30, themeUnlock: 'theme_copper',
        storyBefore: 'After the fire, only embers remain. Each one a memory of flame. Stack them carefully — they are still alive.',
        storyAfter: 'The embers do not cool. They wait.',
      },
      {
        id: 'l2', title: 'LAVA FIELDS', subtitle: 'The earth bleeds.',
        bgType: 'lava', gravityMult: 1.00, targetLines: 34,
        storyBefore: 'Lava flows are slow but inevitable. You are not in a race against the lava. You are in a race against yourself.',
        storyAfter: 'New land forms behind you. You are building a continent.',
      },
      {
        id: 'l3', title: 'VOLCANO', subtitle: 'The mountain screams.',
        bgType: 'volcano', gravityMult: 1.30, targetLines: 38,
        storyBefore: 'The summit erupts. Pyroclastic fury fills the sky. You have seconds between bursts to think clearly.',
        storyAfter: 'The eruption subsides. You are coated in ash but the structure holds.',
      },
      {
        id: 'l4', title: 'INFERNO', subtitle: 'Everything. Burns.',
        bgType: 'inferno', gravityMult: 1.70, targetLines: 44, isBoss: true, themeUnlock: 'theme_stained',
        storyBefore: 'FIRE FINALE — The world is consumed. Nothing remains but heat and speed.',
        storyAfter: 'FIRE MASTERED — You walked through the inferno. The third seal breaks with a sound like a dying sun.',
      },
    ],
  },

  // ── Chapter 4: AIR (short — 3 levels) ───────────────────────────────────
  {
    id: 'ch4', title: 'AIR', subtitle: 'You cannot hold it. Only move with it.',
    mapX: 55, mapY: 42, color: '#88ccee', glowColor: '#aaddff',
    levels: [
      {
        id: 'l1', title: 'SKYWARD', subtitle: 'Above the clouds.',
        bgType: 'clouds', gravityMult: 0.70, targetLines: 32,
        storyBefore: 'High above the world, the air is thin. The blocks feel weightless. This is freedom — and freedom is terrifying.',
        storyAfter: 'The clouds part. What lies above cannot be named yet.',
      },
      {
        id: 'l2', title: 'TEMPEST', subtitle: 'The sky at war.',
        bgType: 'storm', gravityMult: 1.20, targetLines: 38,
        storyBefore: 'Wind shear tears at everything. A hundred storms all want to pull you in different directions. Commit.',
        storyAfter: 'You found the eye. For one moment, absolute stillness.',
      },
      {
        id: 'l3', title: 'AURORA', subtitle: 'Light given form.',
        bgType: 'aurora', gravityMult: 1.50, targetLines: 44, isBoss: true, themeUnlock: 'theme_ukiyo',
        storyBefore: 'AIR FINALE — The magnetosphere sings. Curtains of charged light ripple overhead. The fourth element reaches its crescendo.',
        storyAfter: 'AIR MASTERED — Four elements mastered. Four seals broken. The path beyond the world opens.',
      },
    ],
  },

  // ── Chapter 5: COSMOS ────────────────────────────────────────────────────
  {
    id: 'ch5', title: 'COSMOS', subtitle: 'There was never just one world.',
    mapX: 68, mapY: 28, color: '#a855f7', glowColor: '#cc44ff',
    levels: [
      {
        id: 'l1', title: 'ORBIT', subtitle: 'Weightless and watching.',
        bgType: 'stars', gravityMult: 0.50, targetLines: 34,
        storyBefore: 'Free of gravity. From here, your entire home world is the size of a marble. Keep playing.',
        storyAfter: 'From orbit, all the lines you drew on Earth look beautiful.',
      },
      {
        id: 'l2', title: 'NEBULA', subtitle: 'A nursery of stars.',
        bgType: 'nebula', gravityMult: 0.90, targetLines: 38,
        storyBefore: 'Gas and stellar dust spanning light-years. You compress those millennia into minutes. Each Tetris is a star being born.',
        storyAfter: 'You name the constellations after the patterns you cleared.',
      },
      {
        id: 'l3', title: 'WARP', subtitle: 'Space folds. Time forgets.',
        bgType: 'warp', gravityMult: 1.50, targetLines: 42,
        storyBefore: 'Faster than light. The stars smear into lines. Your body has no reference point. Only the falling pieces are real.',
        storyAfter: 'Normal space reassembles. Something on the other side was watching.',
      },
      {
        id: 'l4', title: 'EVENT HORIZON', subtitle: 'No exit.',
        bgType: 'blackhole', gravityMult: 2.00, targetLines: 48, isBoss: true, themeUnlock: 'theme_vaporwave',
        storyBefore: 'COSMOS FINALE — The singularity pulls everything. Time slows. The blocks fall faster than physics should allow.',
        storyAfter: 'COSMOS MASTERED — You cross the threshold. On the other side — the Void.',
      },
    ],
  },

  // ── Chapter 6: VOID (short — 3 levels) ───────────────────────────────────
  {
    id: 'ch6', title: 'VOID', subtitle: 'Nothing. And something worse than nothing.',
    mapX: 80, mapY: 17, color: '#8822cc', glowColor: '#aa44ee',
    levels: [
      {
        id: 'l1', title: 'ABYSS', subtitle: 'Looking back is not an option.',
        bgType: 'abyss', gravityMult: 1.00, targetLines: 38,
        storyBefore: 'Absolute void. No light. No reference. Just the blocks, falling. And something breathing in the dark.',
        storyAfter: 'It does not attack. It watches. That is worse.',
      },
      {
        id: 'l2', title: 'THE GRID', subtitle: 'Reality encoded.',
        bgType: 'matrix', gravityMult: 1.40, targetLines: 44, themeUnlock: 'theme_terminal',
        storyBefore: 'The void resolves into information. Raw data, cascading. Is this reality? Is this what reality always was?',
        storyAfter: 'You read the patterns between the patterns. A code within a code.',
      },
      {
        id: 'l3', title: 'SINGULARITY', subtitle: 'One point. All things.',
        bgType: 'blackhole', gravityMult: 2.00, targetLines: 50, isBoss: true,
        storyBefore: 'VOID FINALE — Everything converges. All the elements, all the worlds, collapsed to a single point.',
        storyAfter: 'VOID MASTERED — You did not break. The final gate appears.',
      },
    ],
  },

  // ── Chapter 7: CONVERGENCE (final — 5 levels) ─────────────────────────────
  {
    id: 'ch7', title: 'CONVERGENCE', subtitle: 'The last pattern. The first silence.',
    mapX: 91, mapY: 9, color: '#ffd700', glowColor: '#ffee44',
    levels: [
      {
        id: 'l1', title: 'GENESIS', subtitle: 'Return to the beginning.',
        bgType: 'crystal', gravityMult: 1.00, targetLines: 38,
        storyBefore: 'You have walked through fire, drowned in water, dissolved in the void. Now you begin again. But you remember.',
        storyAfter: 'The pieces fall differently now. You are different now.',
      },
      {
        id: 'l2', title: 'MAELSTROM', subtitle: 'All storms as one.',
        bgType: 'storm', gravityMult: 1.30, targetLines: 42,
        storyBefore: 'Every storm you have ever played converges. Rain, wind, lightning, sound — a symphony of destruction.',
        storyAfter: 'You have played this storm before. A hundred times. You know its rhythms.',
      },
      {
        id: 'l3', title: 'THE FORGE', subtitle: 'Burn away the impermanence.',
        bgType: 'inferno', gravityMult: 1.70, targetLines: 46,
        storyBefore: 'The final fire. It burns away not just matter, but memory. What remains after everything is reduced? Only the pattern.',
        storyAfter: 'You emerge without weight. The pattern is all that remains of you.',
      },
      {
        id: 'l4', title: 'COLLAPSE', subtitle: 'Everything falls.',
        bgType: 'blackhole', gravityMult: 2.10, targetLines: 50,
        storyBefore: 'The singularity swallows the last of the worlds. Gravity wins. It always wins. But you have faced it before.',
        storyAfter: 'In the moment before everything ends, you see the complete pattern. It is beautiful.',
      },
      {
        id: 'l5', title: 'TRANSCENDENCE', subtitle: 'Beyond the last line.',
        bgType: 'nebula', gravityMult: 2.50, targetLines: 56, isBoss: true, themeUnlock: 'theme_circuit',
        storyBefore: 'FINAL LEVEL — This is the last game. There is no world after this. Only the clearing of lines, forever, until you understand.',
        storyAfter: 'COMPLETE — You put down the last piece. The music stops. For one perfect moment, the board is clear.',
      },
    ],
  },
]

export function findLevel(chapterId, levelId) {
  const chapter = STORY_CHAPTERS.find(c => c.id === chapterId)
  if (!chapter) return null
  const level = chapter.levels.find(l => l.id === levelId)
  if (!level) return null
  return { chapter, level }
}

export function getNextLevel(chapterId, levelId) {
  const chIdx = STORY_CHAPTERS.findIndex(c => c.id === chapterId)
  if (chIdx < 0) return null
  const chapter = STORY_CHAPTERS[chIdx]
  const lvIdx = chapter.levels.findIndex(l => l.id === levelId)
  if (lvIdx < 0) return null
  if (lvIdx + 1 < chapter.levels.length) return { chapterId, levelId: chapter.levels[lvIdx + 1].id }
  if (chIdx + 1 < STORY_CHAPTERS.length) return { chapterId: STORY_CHAPTERS[chIdx + 1].id, levelId: STORY_CHAPTERS[chIdx + 1].levels[0].id }
  return null
}
