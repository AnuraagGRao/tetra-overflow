// ─── Store catalog ─────────────────────────────────────────────────────────────
// itemId matches the key used in user.inventory array in Firestore
// type: 'theme' | 'badge' | 'effect' | 'bg'
// themeKey (for type==='theme'): value passed to setTheme()

export const STORE_ITEMS = [
  // ── UI Themes (Changes the menu/surrounding board) ──────────────────────────
  {
    id: 'theme_classic', type: 'piece_theme', themeKey: 'classic',
    name: 'CLASSIC', description: 'Clean neon glow. The standard.',
    price: 0, emoji: '🎮', accent: '#00d4ff', tier: 'common',
  },
  {
    id: 'theme_dmg', type: 'piece_theme', themeKey: 'dmg',
    name: 'DMG', description: 'Game Boy green phosphor. Pure nostalgia.',
    price: 1000, emoji: '🟢', accent: '#9bbc0f', tier: 'rare',
  },
  {
    id: 'theme_blueprint', type: 'piece_theme', themeKey: 'blueprint',
    name: 'BLUEPRINT', description: 'Technical drawings on indigo.',
    price: 1500, emoji: '📐', accent: '#88DDFF', tier: 'rare',
  },
  {
    id: 'theme_sketch', type: 'piece_theme', themeKey: 'sketch',
    name: 'SKETCH', description: 'Hand-drawn, imperfect, alive.',
    price: 1500, emoji: '✏️', accent: '#C08AE0', tier: 'rare',
  },
  {
    id: 'theme_bauhaus', type: 'piece_theme', themeKey: 'bauhaus',
    name: 'BAUHAUS', description: 'Primary geometry. Form follows function.',
    price: 2000, emoji: '🔴', accent: '#E81414', tier: 'epic',
  },
  {
    id: 'theme_stone', type: 'piece_theme', themeKey: 'stone',
    name: 'STONE', description: 'Grayscale monolith. Brutalist.',
    price: 2000, emoji: '🪨', accent: '#B4B4B4', tier: 'epic',
  },
  {
    id: 'theme_wood', type: 'piece_theme', themeKey: 'wood',
    name: 'WOOD', description: 'Warm grain and amber tones.',
    price: 2000, emoji: '🪵', accent: '#C8A96E', tier: 'epic',
  },
  {
    id: 'theme_midnight', type: 'piece_theme', themeKey: 'midnight',
    name: 'MIDNIGHT', description: 'Deep blue neon on starless skies.',
    price: 2200, emoji: '🌌', accent: '#4fd1ff', tier: 'epic',
  },
  {
    id: 'theme_pastel', type: 'piece_theme', themeKey: 'pastel',
    name: 'PASTEL', description: 'Soft hues with gentle contrast.',
    price: 2200, emoji: '🧁', accent: '#a7f3d0', tier: 'epic',
  },

  // ── Badges / Titles (purchasable) ───────────────────────────────────────────
  { id: 'badge_champion',    type: 'badge', name: 'CHAMPION',    description: 'Wear your crown in leaderboards.',        price: 4000, emoji: '👑', accent: '#ffd700', tier: 'legendary' },
  { id: 'badge_speedrunner', type: 'badge', name: 'SPEEDRUNNER', description: 'Sprint addict — fast hands, fast mind.',  price: 3000, emoji: '🏎️', accent: '#f97316', tier: 'epic' },
  { id: 'badge_blitzlord',   type: 'badge', name: 'BLITZ LORD',  description: 'Master of the 120s frenzy.',              price: 3000, emoji: '⚡', accent: '#22c55e', tier: 'epic' },
  { id: 'badge_zenmaster',   type: 'badge', name: 'ZEN MASTER',  description: 'Calm stacker with perfect flow.',         price: 2500, emoji: '🧘', accent: '#60a5fa', tier: 'epic' },
  { id: 'badge_purifier',    type: 'badge', name: 'PURIFIER',    description: 'Kept the infection at bay.',              price: 2500, emoji: '☣️', accent: '#a855f7', tier: 'epic' },
  { id: 'badge_ultra',       type: 'badge', name: 'ULTRA',       description: 'For those who beat the ultimate.',        price: 5000, emoji: '💀', accent: '#ef4444', tier: 'legendary' },
  { id: 'badge_noob',        type: 'badge', name: 'NOOB',        description: 'Played story on easy mode. At least you tried.', price: 5000, emoji: '🐣', accent: '#a855f7', tier: 'legendary' },

  // ── Badges / Titles (Playstyles) ──────────────────────────────────────────
  { id: 'badge_metronome',   type: 'badge', name: 'THE METRONOME',     description: 'Flawless rhythm. The combos never drop.',       price: 2500, emoji: '⏱️', accent: '#f43f5e', tier: 'epic' },
  { id: 'badge_tabularasa',  type: 'badge', name: 'TABULA RASA',       description: 'Seeker of the Perfect Clear. A clean slate.',   price: 3000, emoji: '🧼', accent: '#38bdf8', tier: 'epic' },
  { id: 'badge_cultist',     type: 'badge', name: 'I-PIECE CULTIST',   description: 'Build the tower. Pray for the line.',           price: 1500, emoji: '🛐', accent: '#0ea5e9', tier: 'rare' },
  { id: 'badge_geometry',    type: 'badge', name: 'GEOMETRICIAN',      description: 'T-Spins are not a tactic, they are a lifestyle.', price: 2800, emoji: '📐', accent: '#d946ef', tier: 'epic' },

  // ── Badges / Titles (Grind & Dedication) ──────────────────────────────────
  { id: 'badge_architect',   type: 'badge', name: 'THE ARCHITECT',     description: 'A million blocks placed. A million lines cleared.', price: 3500, emoji: '🏗️', accent: '#f59e0b', tier: 'legendary' },
  { id: 'badge_insomniac',   type: 'badge', name: 'INSOMNIAC',         description: 'Just one more game. The sun is rising.',        price: 2000, emoji: '🦉', accent: '#6366f1', tier: 'epic' },
  { id: 'badge_highroller',  type: 'badge', name: 'HIGH ROLLER',       description: 'I bought this because I had too many coins.',   price: 8000, emoji: '💸', accent: '#10b981', tier: 'legendary' },

  // ── Badges / Titles (Memes & Fails) ───────────────────────────────────────
  { id: 'badge_panic',       type: 'badge', name: 'PANIC DROPPER',     description: 'Oops. That wasn\'t supposed to go there.',      price: 800,  emoji: '💦', accent: '#94a3b8', tier: 'common' },
  { id: 'badge_bricked',     type: 'badge', name: 'BRICKED',           description: 'The stack is ruined. Time to top out.',         price: 800,  emoji: '🧱', accent: '#dc2626', tier: 'common' },
  { id: 'badge_drought',     type: 'badge', name: 'DROUGHT SURVIVOR',  description: '74 pieces without a line. I am still breathing.', price: 1200, emoji: '🏜️', accent: '#d97706', tier: 'rare' },

  // ── Badges / Titles (Lore & Story) ────────────────────────────────────────
  { id: 'badge_voidwalker',  type: 'badge', name: 'VOID WALKER',       description: 'Comfortable in the crushing dark.',             price: 3500, emoji: '🌌', accent: '#7c3aed', tier: 'legendary' },
  { id: 'badge_anomaly',     type: 'badge', name: 'THE ANOMALY',       description: 'A ghost in the system\'s code.',                price: 4000, emoji: '👾', accent: '#22c55e', tier: 'legendary' },

  // ── Effects ──────────────────────────────────────────────────────────────────
  {
    id: 'effect_trails', type: 'effect',
    name: 'PARTICLE TRAILS', description: 'Pieces leave glowing trails as they move.',
    price: 2500, emoji: '✨', accent: '#eab308', tier: 'epic',
  },
  {
    id: 'effect_holographic', type: 'effect',
    name: 'HOLOGRAPHIC BOARD', description: 'The board shimmers with iridescent light.',
    price: 3500, emoji: '💠', accent: '#00d4ff', tier: 'legendary',
  },
  {
    id: 'effect_retro_crt', type: 'effect',
    name: 'RETRO CRT', description: 'Scanlines and screen curvature filter.',
    price: 2000, emoji: '📺', accent: '#22c55e', tier: 'epic',
  },
  {
    id: 'effect_gridpulse', type: 'effect',
    name: 'GRID PULSE', description: 'Subtle pulsing grid overlay effect.',
    price: 1800, emoji: '🧭', accent: '#60a5fa', tier: 'rare',
  },
  {
    id: 'effect_sparkles', type: 'effect',
    name: 'SPARKLES', description: 'Tiny twinkles across the matrix.',
    price: 1600, emoji: '✨', accent: '#a855f7', tier: 'rare',
  },
  {
    id: 'effect_illusion', type: 'effect',
    name: 'ILLUSION', description: 'Cycle all piece colors through every hue as you play. The Pisces gift.',
    price: 3000, emoji: '🌈', accent: '#ff77ee', tier: 'epic',
  },

  // ─── World / background themes (unlocked via story, not purchasable) ──────
  { id: 'bg_quake',     type: 'bg', bgType: 'quake',     name: 'QUAKE',      description: 'Cracked earth glowing with magma veins.',   price: 0, emoji: '🪨', accent: '#c87820', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.1 — EARTH' },
  { id: 'bg_crystal',   type: 'bg', bgType: 'crystal',   name: 'CRYSTAL',    description: 'Shimmering ice-blue crystal cavern.',        price: 0, emoji: '💎', accent: '#00c8ff', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.1 — EARTH' },
  { id: 'bg_forest',    type: 'bg', bgType: 'forest',    name: 'FOREST',     description: 'Dark woodland with fireflies and leaves.',   price: 0, emoji: '🌲', accent: '#4ade80', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.1 — EARTH' },
  { id: 'bg_lava',      type: 'bg', bgType: 'lava',      name: 'LAVA',       description: 'Molten lava rivers and ember showers.',      price: 0, emoji: '🌋', accent: '#ef4444', tier: 'story', storyUnlock: true, unlockCondition: 'Defeat Ch.1 Boss — Tectonic' },
  { id: 'bg_ocean',     type: 'bg', bgType: 'ocean',     name: 'OCEAN',      description: 'Deep ocean with caustic light and waves.',   price: 0, emoji: '🌊', accent: '#0ea5e9', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.2 — WATER' },
  { id: 'bg_bubbles',   type: 'bg', bgType: 'bubbles',   name: 'BUBBLES',    description: 'Colorful bubble streams in deep water.',     price: 0, emoji: '🫧', accent: '#38bdf8', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.2 — WATER' },
  { id: 'bg_glacier',   type: 'bg', bgType: 'glacier',   name: 'GLACIER',    description: 'Frozen tundra with ice crystals and snow.',  price: 0, emoji: '🧊', accent: '#93c5fd', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.2 — WATER' },
  { id: 'bg_storm',     type: 'bg', bgType: 'storm',     name: 'STORM',      description: 'Raging lightning storm with rain streaks.',  price: 0, emoji: '⛈️', accent: '#818cf8', tier: 'story', storyUnlock: true, unlockCondition: 'Defeat Ch.2 Boss — The Storm' },
  { id: 'bg_ember',     type: 'bg', bgType: 'ember',     name: 'EMBER',      description: 'Glowing embers drifting through heat haze.', price: 0, emoji: '🔥', accent: '#fb923c', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.3 — FIRE' },
  { id: 'bg_volcano',   type: 'bg', bgType: 'volcano',   name: 'VOLCANO',    description: 'Active eruption with lava bombs and smoke.', price: 0, emoji: '🌋', accent: '#dc2626', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.3 — FIRE' },
  { id: 'bg_inferno',   type: 'bg', bgType: 'inferno',   name: 'INFERNO',    description: 'Hellish fire waves and flame tongues.',      price: 0, emoji: '😈', accent: '#f97316', tier: 'story', storyUnlock: true, unlockCondition: 'Defeat Ch.3 Boss — Inferno' },
  { id: 'bg_clouds',    type: 'bg', bgType: 'clouds',    name: 'CLOUDS',     description: 'Aurora ribbons through night clouds.',       price: 0, emoji: '☁️', accent: '#60a5fa', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.4 — AIR' },
  { id: 'bg_aurora',    type: 'bg', bgType: 'aurora',    name: 'AURORA',     description: 'Dancing aurora borealis over star fields.',  price: 0, emoji: '🌌', accent: '#a78bfa', tier: 'story', storyUnlock: true, unlockCondition: 'Defeat Ch.4 Boss — Aurora' },
  { id: 'bg_stars',     type: 'bg', bgType: 'stars',     name: 'STARS',      description: 'Deep space star field with milky way.',      price: 0, emoji: '✨', accent: '#e2e8f0', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.5 — COSMOS' },
  { id: 'bg_nebula',    type: 'bg', bgType: 'nebula',    name: 'NEBULA',     description: 'Colorful cosmic nebula and star dust.',      price: 0, emoji: '🌠', accent: '#c084fc', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.5 — COSMOS' },
  { id: 'bg_warp',      type: 'bg', bgType: 'warp',      name: 'WARP',       description: 'Hyperspace warp streaks from center.',       price: 0, emoji: '🚀', accent: '#818cf8', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.5 — COSMOS' },
  { id: 'bg_blackhole', type: 'bg', bgType: 'blackhole', name: 'BLACK HOLE', description: 'Accretion disk orbiting a singularity.',     price: 0, emoji: '🕳️', accent: '#a855f7', tier: 'story', storyUnlock: true, unlockCondition: 'Defeat Ch.5 Boss — Event Horizon' },
  { id: 'bg_abyss',     type: 'bg', bgType: 'abyss',     name: 'ABYSS',      description: 'Breathing darkness with ghost wisps.',       price: 0, emoji: '👁️', accent: '#6366f1', tier: 'story', storyUnlock: true, unlockCondition: 'Complete Ch.6 — VOID' },
  { id: 'bg_matrix',    type: 'bg', bgType: 'matrix',    name: 'MATRIX',     description: 'Cascading katakana in the digital rain.',    price: 0, emoji: '🟩', accent: '#22c55e', tier: 'story', storyUnlock: true, unlockCondition: 'Secret — Clear THE MATRIX' },
  
  // ── Purchasable Backgrounds ───────────────────────────────────────────────
  { id: 'bg_ritual',   type: 'bg', bgType: 'ritual',    name: 'DIGITAL RITUAL', description: 'Gold fog over violet dunes.',              price: 3400, emoji: '🏜️', accent: '#ffd700', tier: 'epic' },
  { id: 'bg_geometry', type: 'bg', bgType: 'geometry',  name: 'GEOMETRY OF THE SOUL', description: 'Neon net of the connected.',       price: 3200, emoji: '🕸️', accent: '#ff00cc', tier: 'epic' },
  { id: 'bg_oiia',     type: 'bg', bgType: 'oiia',      name: 'OIIA CAT',   description: 'OIIA OIIA spinning cats everywhere.',        price: 3600, emoji: '🐱', accent: '#ff6eb4', tier: 'legendary' },
  { id: 'bg_deepsea',  type: 'bg', bgType: 'deepsea',   name: 'DEEP SEA',   description: 'Bioluminescent drift in the abyss.',         price: 3600, emoji: '🐋', accent: '#00f2ff', tier: 'legendary' },
  { id: 'bg_stellar',  type: 'bg', bgType: 'stellar',   name: 'STELLAR NURSERY', description: 'Pulsing halo of a newborn star.',         price: 3800, emoji: '✨', accent: '#ffd599', tier: 'legendary' },
  { id: 'bg_nyancat',  type: 'bg', bgType: 'nyancat',   name: 'NYAN CAT',   description: 'Rainbow trails across the stars. Meow!',     price: 4000, emoji: '🌈', accent: '#ff66cc', tier: 'legendary' },
  { id: 'bg_cyberpunk', type: 'bg', bgType: 'cyberpunk', name: 'CYBERPUNK', description: 'Neon grid and synth sweep.',                  price: 3200, emoji: '💾', accent: '#ff003c', tier: 'epic' },
  { id: 'bg_twilight',  type: 'bg', bgType: 'twilight',  name: 'TWILIGHT',  description: 'Sunset bands over deep violet.',              price: 2800, emoji: '🌇', accent: '#ff6b35', tier: 'rare' },
  { id: 'bg_quantum',   type: 'bg', bgType: 'quantum',   name: 'QUANTUM',   description: 'Pulsing quantum field of nodes.',            price: 3400, emoji: '🧬', accent: '#00ffcc', tier: 'epic' },
  { id: 'bg_custom',   type: 'bg', bgType: 'custom',    name: 'CUSTOM IMAGE', description: 'Unlock the ability to apply any image/GIF.', price: 10000, emoji: '🖼️', accent: '#eab308', tier: 'legendary' },

  // ── Story Piece Themes (Changes the actual falling blocks) ────────────────
  {
    id: 'theme_terracotta', type: 'piece_theme', themeKey: 'terracotta',
    name: 'TERRACOTTA', description: 'Matte clay and ancient earth tones.',
    price: 0, emoji: '🏺', accent: '#d46a38', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.1 L.1 — Bedrock',
  },
  {
    id: 'theme_amber', type: 'piece_theme', themeKey: 'amber',
    name: 'AMBER FOSSIL', description: 'Warm amber glow with fossilized traces.',
    price: 0, emoji: '🪲', accent: '#f0a020', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.1 L.2 — Crystal Veins',
  },
  {
    id: 'theme_obsidian', type: 'piece_theme', themeKey: 'obsidian',
    name: 'OBSIDIAN MIRROR', description: 'Volcanic glass. Dark, sharp, glowing.',
    price: 0, emoji: '🔮', accent: '#aa44ff', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.1 Boss — Tectonic',
  },
  {
    id: 'theme_frozen', type: 'piece_theme', themeKey: 'frozen',
    name: 'FROZEN TUNDRA', description: 'Icy translucent blocks with bevel light.',
    price: 0, emoji: '🧊', accent: '#a8d8f0', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.2 L.3 — Glacier',
  },
  {
    id: 'theme_biolume', type: 'piece_theme', themeKey: 'biolume',
    name: 'DEEP SEA BIOLUME', description: 'Glowing life in the dark ocean depths.',
    price: 0, emoji: '🌊', accent: '#00ffcc', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.2 Boss — The Storm',
  },
  {
    id: 'theme_copper', type: 'piece_theme', themeKey: 'copper',
    name: 'COPPER STEAM', description: 'Forged metal with metallic gradient sheen.',
    price: 0, emoji: '⚙️', accent: '#b87333', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.3 L.1 — Embers',
  },
  {
    id: 'theme_stained', type: 'piece_theme', themeKey: 'stained',
    name: 'STAINED GLASS', description: 'Cathedral light through leaded glass.',
    price: 0, emoji: '🪟', accent: '#ffcc00', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.3 Boss — Inferno',
  },
  {
    id: 'theme_ukiyo', type: 'piece_theme', themeKey: 'ukiyo',
    name: 'UKIYO-E', description: 'Japanese woodblock waves with ink outlines.',
    price: 0, emoji: '🎴', accent: '#4060c8', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.4 Boss — Aurora',
  },
  {
    id: 'theme_vaporwave', type: 'piece_theme', themeKey: 'vaporwave',
    name: 'VAPORWAVE STATUES', description: 'Marble gradients in pastel neon.',
    price: 0, emoji: '🗿', accent: '#ff88cc', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.5 Boss — Event Horizon',
  },
  {
    id: 'theme_terminal', type: 'piece_theme', themeKey: 'terminal',
    name: 'TERMINAL', description: 'Green phosphor on absolute black.',
    price: 0, emoji: '💻', accent: '#00ff41', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.6 L.2 — The Grid',
  },
  {
    id: 'theme_circuit', type: 'piece_theme', themeKey: 'circuit',
    name: 'CIRCUIT BOARD', description: 'PCB traces in gold on dark green substrate.',
    price: 0, emoji: '⚡', accent: '#ffd700', tier: 'story', storyUnlock: true,
    unlockCondition: 'Complete Ch.7 — Transcendence',
  },

  // ── Store Piece Themes (purchasable with coins) ───────────────────────────
  {
    id: 'theme_lego', type: 'piece_theme', themeKey: 'lego',
    name: 'LEGO BRICKS', description: 'Glossy plastic with circular studs.',
    price: 2500, emoji: '🧱', accent: '#d01010', tier: 'epic',
  },
  {
    id: 'theme_popart', type: 'piece_theme', themeKey: 'popart',
    name: 'POP ART', description: 'Ben-Day dots, bold outlines, primary colors.',
    price: 3000, emoji: '💥', accent: '#e01010', tier: 'epic',
  },
];

export const ITEM_TYPES = ['theme', 'badge', 'effect', 'bg']
