// ─── Store catalog ─────────────────────────────────────────────────────────────
// itemId matches the key used in user.inventory array in Firestore
// type: 'theme' | 'badge' | 'effect' | 'bg'
// themeKey (for type==='theme'): value passed to setTheme()

export const STORE_ITEMS = [
  // ── Themes ──────────────────────────────────────────────────────────────────
  {
    id: 'theme_classic', type: 'theme', themeKey: 'classic',
    name: 'CLASSIC', description: 'Clean neon glow. The standard.',
    price: 0, emoji: '🎮', accent: '#00d4ff',
  },
  {
    id: 'theme_dmg', type: 'theme', themeKey: 'dmg',
    name: 'DMG', description: 'Game Boy green phosphor. Pure nostalgia.',
    price: 1000, emoji: '🟢', accent: '#9bbc0f',
  },
  {
    id: 'theme_blueprint', type: 'theme', themeKey: 'blueprint',
    name: 'BLUEPRINT', description: 'Technical drawings on indigo.',
    price: 1500, emoji: '📐', accent: '#88DDFF',
  },
  {
    id: 'theme_sketch', type: 'theme', themeKey: 'sketch',
    name: 'SKETCH', description: 'Hand-drawn, imperfect, alive.',
    price: 1500, emoji: '✏️', accent: '#C08AE0',
  },
  {
    id: 'theme_bauhaus', type: 'theme', themeKey: 'bauhaus',
    name: 'BAUHAUS', description: 'Primary geometry. Form follows function.',
    price: 2000, emoji: '🔴', accent: '#E81414',
  },
  {
    id: 'theme_stone', type: 'theme', themeKey: 'stone',
    name: 'STONE', description: 'Grayscale monolith. Brutalist.',
    price: 2000, emoji: '🪨', accent: '#B4B4B4',
  },
  {
    id: 'theme_wood', type: 'theme', themeKey: 'wood',
    name: 'WOOD', description: 'Warm grain and amber tones.',
    price: 2000, emoji: '🪵', accent: '#C8A96E',
  },
  // New purchasable themes
  {
    id: 'theme_midnight', type: 'theme', themeKey: 'midnight',
    name: 'MIDNIGHT', description: 'Deep blue neon on starless skies.',
    price: 2200, emoji: '🌌', accent: '#4fd1ff',
  },
  {
    id: 'theme_pastel', type: 'theme', themeKey: 'pastel',
    name: 'PASTEL', description: 'Soft hues with gentle contrast.',
    price: 2200, emoji: '🧁', accent: '#a7f3d0',
  },

  // ── Badges / Titles (purchasable) ───────────────────────────────────────────
  { id: 'badge_champion',    type: 'badge', name: 'CHAMPION',    description: 'Wear your crown in leaderboards.',        price: 4000, emoji: '👑', accent: '#ffd700' },
  { id: 'badge_speedrunner', type: 'badge', name: 'SPEEDRUNNER', description: 'Sprint addict — fast hands, fast mind.',  price: 3000, emoji: '🏎️', accent: '#f97316' },
  { id: 'badge_blitzlord',   type: 'badge', name: 'BLITZ LORD',  description: 'Master of the 120s frenzy.',            price: 3000, emoji: '⚡', accent: '#22c55e' },
  { id: 'badge_zenmaster',   type: 'badge', name: 'ZEN MASTER',  description: 'Calm stacker with perfect flow.',       price: 2500, emoji: '🧘', accent: '#60a5fa' },
  { id: 'badge_purifier',    type: 'badge', name: 'PURIFIER',    description: 'Kept the infection at bay.',            price: 2500, emoji: '☣️', accent: '#a855f7' },
  { id: 'badge_ultra',       type: 'badge', name: 'ULTRA',       description: 'For those who beat the ultimate.',     price: 5000, emoji: '💀', accent: '#ef4444' },
  { id: 'badge_noob',        type: 'badge', name: 'NOOB',        description: 'Played story on easy mode. At least you tried.', price: 5000, emoji: '🐣', accent: '#a855f7' },

  // ── Effects ──────────────────────────────────────────────────────────────────
  {
    id: 'effect_trails', type: 'effect',
    name: 'PARTICLE TRAILS', description: 'Pieces leave glowing trails as they move.',
    price: 2500, emoji: '✨', accent: '#eab308',
  },
  {
    id: 'effect_holographic', type: 'effect',
    name: 'HOLOGRAPHIC BOARD', description: 'The board shimmers with iridescent light.',
    price: 3500, emoji: '💠', accent: '#00d4ff',
  },
  {
    id: 'effect_retro_crt', type: 'effect',
    name: 'RETRO CRT', description: 'Scanlines and screen curvature filter.',
    price: 2000, emoji: '📺', accent: '#22c55e',
  },
  {
    id: 'effect_gridpulse', type: 'effect',
    name: 'GRID PULSE', description: 'Subtle pulsing grid overlay effect.',
    price: 1800, emoji: '🧭', accent: '#60a5fa',
  },
  {
    id: 'effect_sparkles', type: 'effect',
    name: 'SPARKLES', description: 'Tiny twinkles across the matrix.',
    price: 1600, emoji: '✨', accent: '#a855f7',
  },
  // ─── World / background themes (unlocked via story, not purchasable) ──────
  { id: 'bg_quake',     type: 'bg', bgType: 'quake',     name: 'QUAKE',      description: 'Cracked earth glowing with magma veins.',   price: 0, emoji: '🪨', accent: '#c87820', storyUnlock: true },
  { id: 'bg_crystal',   type: 'bg', bgType: 'crystal',   name: 'CRYSTAL',    description: 'Shimmering ice-blue crystal cavern.',        price: 0, emoji: '💎', accent: '#00c8ff', storyUnlock: true },
  { id: 'bg_forest',    type: 'bg', bgType: 'forest',    name: 'FOREST',     description: 'Dark woodland with fireflies and leaves.',   price: 0, emoji: '🌲', accent: '#4ade80', storyUnlock: true },
  { id: 'bg_lava',      type: 'bg', bgType: 'lava',      name: 'LAVA',       description: 'Molten lava rivers and ember showers.',      price: 0, emoji: '🌋', accent: '#ef4444', storyUnlock: true },
  { id: 'bg_ocean',     type: 'bg', bgType: 'ocean',     name: 'OCEAN',      description: 'Deep ocean with caustic light and waves.',   price: 0, emoji: '🌊', accent: '#0ea5e9', storyUnlock: true },
  { id: 'bg_bubbles',   type: 'bg', bgType: 'bubbles',   name: 'BUBBLES',    description: 'Colorful bubble streams in deep water.',     price: 0, emoji: '🫧', accent: '#38bdf8', storyUnlock: true },
  { id: 'bg_glacier',   type: 'bg', bgType: 'glacier',   name: 'GLACIER',    description: 'Frozen tundra with ice crystals and snow.',  price: 0, emoji: '🧊', accent: '#93c5fd', storyUnlock: true },
  { id: 'bg_storm',     type: 'bg', bgType: 'storm',     name: 'STORM',      description: 'Raging lightning storm with rain streaks.',  price: 0, emoji: '⛈️', accent: '#818cf8', storyUnlock: true },
  { id: 'bg_ember',     type: 'bg', bgType: 'ember',     name: 'EMBER',      description: 'Glowing embers drifting through heat haze.', price: 0, emoji: '🔥', accent: '#fb923c', storyUnlock: true },
  { id: 'bg_volcano',   type: 'bg', bgType: 'volcano',   name: 'VOLCANO',    description: 'Active eruption with lava bombs and smoke.', price: 0, emoji: '🌋', accent: '#dc2626', storyUnlock: true },
  { id: 'bg_inferno',   type: 'bg', bgType: 'inferno',   name: 'INFERNO',    description: 'Hellish fire waves and flame tongues.',      price: 0, emoji: '😈', accent: '#f97316', storyUnlock: true },
  { id: 'bg_clouds',    type: 'bg', bgType: 'clouds',    name: 'CLOUDS',     description: 'Aurora ribbons through night clouds.',       price: 0, emoji: '☁️', accent: '#60a5fa', storyUnlock: true },
  { id: 'bg_aurora',    type: 'bg', bgType: 'aurora',    name: 'AURORA',     description: 'Dancing aurora borealis over star fields.',  price: 0, emoji: '🌌', accent: '#a78bfa', storyUnlock: true },
  { id: 'bg_stars',     type: 'bg', bgType: 'stars',     name: 'STARS',      description: 'Deep space star field with milky way.',      price: 0, emoji: '✨', accent: '#e2e8f0', storyUnlock: true },
  { id: 'bg_nebula',    type: 'bg', bgType: 'nebula',    name: 'NEBULA',     description: 'Colorful cosmic nebula and star dust.',      price: 0, emoji: '🌠', accent: '#c084fc', storyUnlock: true },
  { id: 'bg_warp',      type: 'bg', bgType: 'warp',      name: 'WARP',       description: 'Hyperspace warp streaks from center.',       price: 0, emoji: '🚀', accent: '#818cf8', storyUnlock: true },
  { id: 'bg_blackhole', type: 'bg', bgType: 'blackhole', name: 'BLACK HOLE', description: 'Accretion disk orbiting a singularity.',     price: 0, emoji: '🕳️', accent: '#a855f7', storyUnlock: true },
  { id: 'bg_abyss',     type: 'bg', bgType: 'abyss',     name: 'ABYSS',      description: 'Breathing darkness with ghost wisps.',       price: 0, emoji: '👁️', accent: '#6366f1', storyUnlock: true },
  { id: 'bg_matrix',    type: 'bg', bgType: 'matrix',    name: 'MATRIX',     description: 'Cascading katakana in the digital rain.',    price: 0, emoji: '🟩', accent: '#22c55e', storyUnlock: true },
  { id: 'bg_oiia',      type: 'bg', bgType: 'oiia',      name: 'OIIA CAT',   description: 'OIIA OIIA spinning cats everywhere.',        price: 3600, emoji: '🐱', accent: '#ff6eb4' },
  { id: 'bg_nyancat',  type: 'bg', bgType: 'nyancat',   name: 'NYAN CAT',   description: 'Rainbow trails across the stars. Meow!',     price: 4000, emoji: '🌈', accent: '#ff66cc' },
  { id: 'bg_custom',    type: 'bg', bgType: 'custom',    name: 'CUSTOM IMAGE', description: 'Apply any image/GIF as your background (cost per image).',  price: 600, emoji: '🖼️', accent: '#eab308' },

  // ── Story Piece Themes (unlocked by completing specific levels) ───────────
  {
    id: 'theme_terracotta', type: 'theme', themeKey: 'terracotta',
    name: 'TERRACOTTA', description: 'Matte clay and ancient earth tones.',
    price: 0, emoji: '🏺', accent: '#d46a38', storyUnlock: true,
    unlockCondition: 'Complete Ch.1 L.1 — Bedrock',
  },
  {
    id: 'theme_amber', type: 'theme', themeKey: 'amber',
    name: 'AMBER FOSSIL', description: 'Warm amber glow with fossilized traces.',
    price: 0, emoji: '🪲', accent: '#f0a020', storyUnlock: true,
    unlockCondition: 'Complete Ch.1 L.2 — Crystal Veins',
  },
  {
    id: 'theme_obsidian', type: 'theme', themeKey: 'obsidian',
    name: 'OBSIDIAN MIRROR', description: 'Volcanic glass. Dark, sharp, glowing.',
    price: 0, emoji: '🔮', accent: '#aa44ff', storyUnlock: true,
    unlockCondition: 'Complete Ch.1 Boss — Tectonic',
  },
  {
    id: 'theme_frozen', type: 'theme', themeKey: 'frozen',
    name: 'FROZEN TUNDRA', description: 'Icy translucent blocks with bevel light.',
    price: 0, emoji: '🧊', accent: '#a8d8f0', storyUnlock: true,
    unlockCondition: 'Complete Ch.2 L.3 — Glacier',
  },
  {
    id: 'theme_biolume', type: 'theme', themeKey: 'biolume',
    name: 'DEEP SEA BIOLUME', description: 'Glowing life in the dark ocean depths.',
    price: 0, emoji: '🌊', accent: '#00ffcc', storyUnlock: true,
    unlockCondition: 'Complete Ch.2 Boss — The Storm',
  },
  {
    id: 'theme_copper', type: 'theme', themeKey: 'copper',
    name: 'COPPER STEAM', description: 'Forged metal with metallic gradient sheen.',
    price: 0, emoji: '⚙️', accent: '#b87333', storyUnlock: true,
    unlockCondition: 'Complete Ch.3 L.1 — Embers',
  },
  {
    id: 'theme_stained', type: 'theme', themeKey: 'stained',
    name: 'STAINED GLASS', description: 'Cathedral light through leaded glass.',
    price: 0, emoji: '🪟', accent: '#ffcc00', storyUnlock: true,
    unlockCondition: 'Complete Ch.3 Boss — Inferno',
  },
  {
    id: 'theme_ukiyo', type: 'theme', themeKey: 'ukiyo',
    name: 'UKIYO-E', description: 'Japanese woodblock waves with ink outlines.',
    price: 0, emoji: '🎴', accent: '#4060c8', storyUnlock: true,
    unlockCondition: 'Complete Ch.4 Boss — Aurora',
  },
  {
    id: 'theme_vaporwave', type: 'theme', themeKey: 'vaporwave',
    name: 'VAPORWAVE STATUES', description: 'Marble gradients in pastel neon.',
    price: 0, emoji: '🗿', accent: '#ff88cc', storyUnlock: true,
    unlockCondition: 'Complete Ch.5 Boss — Event Horizon',
  },
  {
    id: 'theme_terminal', type: 'theme', themeKey: 'terminal',
    name: 'TERMINAL', description: 'Green phosphor on absolute black.',
    price: 0, emoji: '💻', accent: '#00ff41', storyUnlock: true,
    unlockCondition: 'Complete Ch.6 L.2 — The Grid',
  },
  {
    id: 'theme_circuit', type: 'theme', themeKey: 'circuit',
    name: 'CIRCUIT BOARD', description: 'PCB traces in gold on dark green substrate.',
    price: 0, emoji: '⚡', accent: '#ffd700', storyUnlock: true,
    unlockCondition: 'Complete Ch.7 — Transcendence',
  },

  // ── Store Piece Themes (purchasable with coins) ───────────────────────────
  {
    id: 'theme_popart', type: 'theme', themeKey: 'popart',
    name: 'POP ART', description: 'Ben-Day dots, bold outlines, primary colors.',
    price: 300, emoji: '💥', accent: '#e01010',
  },
  {
    id: 'theme_lego', type: 'theme', themeKey: 'lego',
    name: 'LEGO BRICKS', description: 'Glossy plastic with circular studs.',
    price: 250, emoji: '🧱', accent: '#d01010',
  },
]

export const ITEM_TYPES = ['theme', 'badge', 'effect', 'bg']
