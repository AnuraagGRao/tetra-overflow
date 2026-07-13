export const BACKGROUND_THEME_PROFILES = {
  quake: {
    category: 'aggressive',
    cssClass: 'bg-theme-quake bg-cat-aggressive bg-heat-haze',
    parallax: 11,
  },
  lava: {
    category: 'aggressive',
    cssClass: 'bg-theme-lava bg-cat-aggressive bg-heat-haze',
    parallax: 12,
  },
  inferno: {
    category: 'aggressive',
    cssClass: 'bg-theme-inferno bg-cat-aggressive bg-heat-haze',
    parallax: 13,
  },
  storm: {
    category: 'aggressive',
    cssClass: 'bg-theme-storm bg-cat-aggressive',
    parallax: 10,
    preferCanvas: true,
    vanta: {
      type: 'waves',
      color: 0x3f246a,
      backgroundColor: 0x020205,
      shininess: 50, // Reduced from 62 for better performance
      waveHeight: 35, // Reduced from 42 to lower poly strain
      waveSpeed: 3.4,
      zoom: 0.65, // Increased zoom slightly to render fewer total waves
    },
  },
  serpent: {
    category: 'cosmic', 
    cssClass: 'bg-theme-serpent bg-cat-cosmic', 
    parallax: 8,
  },
  maelstorm: {
    category: 'aggressive',
    cssClass: 'bg-theme-storm bg-cat-aggressive',
    parallax: 11,
  },
  ember: {
    category: 'aggressive',
    cssClass: 'bg-theme-ember bg-cat-aggressive bg-heat-haze',
    parallax: 10,
  },
  volcano: {
    category: 'aggressive',
    cssClass: 'bg-theme-volcano bg-cat-aggressive bg-heat-haze',
    parallax: 11,
  },

  ocean: {
    category: 'fluid',
    cssClass: 'bg-theme-ocean bg-cat-fluid bg-depth-soft',
    parallax: 8,
    preferCanvas: true,
    vanta: {
      type: 'waves',
      color: 0x0d5e89,
      backgroundColor: 0x01070f,
      shininess: 40, // Optimized
      waveHeight: 15,
      waveSpeed: 0.42,
      zoom: 0.9, // Optimized
    },
  },
  bubbles: {
    category: 'fluid',
    cssClass: 'bg-theme-bubbles bg-cat-fluid bg-depth-soft',
    parallax: 8,
    preferCanvas: true,
    vanta: {
      type: 'waves',
      color: 0x0d95a7,
      backgroundColor: 0x021018,
      shininess: 55, // Optimized
      waveHeight: 12,
      waveSpeed: 0.5,
      zoom: 1.0, // Optimized
    },
  },
  glacier: {
    category: 'fluid',
    cssClass: 'bg-theme-glacier bg-cat-fluid bg-depth-soft',
    parallax: 7,
    preferCanvas: true,
    vanta: {
      type: 'cells',
      color1: 0x7ea4c7,
      color2: 0xc5eeff,
      size: 3.2, // Increased from 2.7 (fewer cells = better FPS)
      speed: 0.18,
    },
  },
  clouds: {
    category: 'fluid',
    cssClass: 'bg-theme-clouds bg-cat-fluid bg-depth-soft',
    parallax: 7,
    vanta: {
      type: 'fog',
      backgroundColor: 0x5ba4f8,
      skyColor: 0xbfe7ff,
      cloudColor: 0xffffff,
      speed: 0.56,
      zoom: 1.02,
    },
  },
  deepsea: {
    category: 'fluid',
    cssClass: 'bg-theme-deepsea bg-cat-fluid bg-depth-soft',
    parallax: 8,
    preferCanvas: true,
    vanta: {
      type: 'waves',
      color: 0x14cddd,
      backgroundColor: 0x092060,
      shininess: 45, // Optimized
      waveHeight: 19,
      waveSpeed: 0.14,
      zoom: 0.85 // Optimized
    },
  },

  stars: {
    category: 'cosmic',
    cssClass: 'bg-theme-stars bg-cat-cosmic',
    parallax: 6,
    preferCanvas: true,
    vanta: {
      type: 'dots',
      backgroundColor: 0x000000,
      color: 0xe8f3ff,
      color2: 0x99f7ff,
      size: 2.1,
      spacing: 18, // Increased spacing for better performance
      showLines: false,
    },
  },
  nebula: {
    category: 'cosmic',
    cssClass: 'bg-theme-nebula bg-cat-cosmic',
    parallax: 7,
    vanta: {
      type: 'fog',
      highlightColor: 0x8ad4ff,
      midtoneColor: 0x2e1762,
      lowlightColor: 0x060211,
      baseColor: 0x000000,
      blurFactor: 0.62,
      speed: 0.6,
      zoom: 1.18,
    },
  },
  warp: {
    category: 'cosmic',
    cssClass: 'bg-theme-warp bg-cat-cosmic bg-center-pull',
    parallax: 9,
    preferCanvas: true,
    vanta: {
      type: 'halo',
      backgroundColor: 0x000003,
      amplitude: 3.0,
      size: 0.95,
      xOffset: 0,
      yOffset: 0,
      color: 0x9ad5ff,
    },
  },
  blackhole: {
    category: 'cosmic',
    cssClass: 'bg-theme-blackhole bg-cat-cosmic bg-center-pull',
    parallax: 9,
    preferCanvas: true,
    vanta: {
      type: 'halo',
      backgroundColor: 0x000000,
      amplitude: 3.45,
      size: 0.78,
      xOffset: 0,
      yOffset: 0,
      color: 0xcf89ff,
    },
  },
  abyss: {
    category: 'cosmic',
    cssClass: 'bg-theme-abyss bg-cat-cosmic',
    parallax: 6,
    vanta: {
      type: 'fog',
      // Dark, near-black base for a true dark theme
      baseColor: 0x000000,
      lowlightColor: 0x000103,
      backgroundColor: 0x000000,
      size: 1.25,
      speed: 0.25,
      zoom: 1.45,
    },
  },
  stellar: {
    category: 'cosmic',
    cssClass: 'bg-theme-stellar bg-cat-cosmic',
    parallax: 8,
    vanta: {
      type: 'halo',
      backgroundColor: 0x000000,
      amplitude: 2.9,
      size: 1.25,
      xOffset: 0.05,
      yOffset: -0.02,
      color: 0xffe4ba,
    },
  },

  matrix: {
    category: 'digital',
    cssClass: 'bg-theme-matrix bg-cat-digital',
    parallax: 6,
    preferCanvas: true,
    vanta: {
      type: 'net',
      color: 0x39ff72,
      backgroundColor: 0x000500,
      points: 18, // Reduced from 24 for significant performance boost
      maxDistance: 22, // Reduced from 26
      spacing: 14, // Increased spacing
      showDots: true,
    },
  },
  grid: {
    category: 'digital',
    cssClass: 'bg-theme-grid bg-cat-digital',
    parallax: 7,
    preferCanvas: true,
    vanta: {
      type: 'net',
      color: 0x66d9ff,
      backgroundColor: 0x020912,
      points: 14, // Reduced from 18
      maxDistance: 20, // Reduced from 22
      spacing: 20, // Increased spacing
      showDots: true,
    },
  },
  geometry: {
    category: 'digital',
    cssClass: 'bg-theme-geometry bg-cat-digital',
    parallax: 9,
    vanta: {
      type: 'net',
      color: 0xff2fb4,
      backgroundColor: 0x030007,
      points: 12, // Reduced from 15
      maxDistance: 22, // Reduced from 26
      spacing: 22, // Increased spacing
      showDots: true,
    },
  },
  ritual: {
    category: 'digital',
    cssClass: 'bg-theme-ritual bg-cat-digital',
    parallax: 8,
    vanta: {
      type: 'fog',
      highlightColor: 0xffd75b,
      midtoneColor: 0x4a125d,
      lowlightColor: 0x170426,
      baseColor: 0x010001,
      speed: 1.9,
      zoom: 1.52,
    },
  },
  oiia: {
    category: 'digital',
    cssClass: 'bg-theme-oiia bg-cat-digital bg-meme-kaleido',
    parallax: 10,
  },
  nyancat: {
    category: 'digital',
    cssClass: 'bg-theme-nyancat bg-cat-digital bg-meme-stripes',
    parallax: 10,
  },

  crystal: {
    category: 'other',
    cssClass: 'bg-theme-crystal bg-cat-fluid bg-depth-soft',
    parallax: 8,
    preferCanvas: true,
    vanta: {
      type: 'cells',
      color1: 0x2f57b8,
      color2: 0x65edff,
      size: 2.2, // Increased from 1.8 for performance
      speed: 0.44,
    },
  },
  forest: {
    category: 'other',
    cssClass: 'bg-theme-forest bg-cat-fluid',
    parallax: 8,
  },
  aurora: {
    category: 'other',
    cssClass: 'bg-theme-aurora bg-cat-fluid bg-depth-soft',
    parallax: 8,
    preferCanvas: true,
    vanta: {
      type: 'cells',
      color1: 0x0b3b4c,
      color2: 0x3affbe,
      size: 1.8, // Increased from 1.38 for performance
      speed: 0.36,
    },
  },
  custom: {
    category: 'other',
    cssClass: 'bg-theme-custom',
    parallax: 6,
  },

  // --- NEW THEMES ADDED BELOW ---

  cyberpunk: {
    category: 'digital',
    cssClass: 'bg-theme-cyberpunk bg-cat-digital',
    parallax: 8,
    vanta: {
      type: 'net',
      color: 0xff003c, // Neon pink/red
      backgroundColor: 0x0b001a, // Very dark purple/blue
      points: 12, // Low point count for excellent performance
      maxDistance: 24,
      spacing: 25, // Wide spacing for a structured, retro-tech feel
      showDots: true,
    },
  },
  twilight: {
    category: 'fluid',
    cssClass: 'bg-theme-twilight bg-cat-fluid bg-depth-soft',
    parallax: 7,
    vanta: {
      type: 'fog', // Fog is highly performant
      highlightColor: 0xff6b35, // Sunset orange
      midtoneColor: 0x7b2cbf, // Deep purple
      lowlightColor: 0x240046, // Dark violet background
      baseColor: 0x10002b,
      blurFactor: 0.75,
      speed: 0.4, // Slow, relaxing movement
      zoom: 1.2,
    },
  },
  quantum: {
    category: 'cosmic',
    cssClass: 'bg-theme-quantum bg-cat-cosmic',
    parallax: 9,
    vanta: {
      type: 'dots', // Extremely lightweight on the GPU
      backgroundColor: 0x02050a, 
      color: 0x00ffcc, // Quantum cyan
      color2: 0x7000ff, // Deep ultraviolet
      size: 1.8,
      spacing: 22,
      showLines: true, // Lines connecting sparse dots creates a great tech/physics web
    },
  },
};

export const BACKGROUND_DEFAULT_PROFILE = {
  category: 'other',
  cssClass: 'bg-theme-default',
  parallax: 7,
}

export const BGTYPE_VANTA_CONFIG = Object.fromEntries(
  Object.entries(BACKGROUND_THEME_PROFILES)
    .filter(([, profile]) => profile?.vanta?.type)
    .map(([bgType, profile]) => [bgType, profile.vanta]),
)

export function getBackgroundProfile(bgType) {
  return BACKGROUND_THEME_PROFILES[bgType] || BACKGROUND_DEFAULT_PROFILE
}
