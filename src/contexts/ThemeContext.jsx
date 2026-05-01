import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = [
  { id: 'classic',    label: 'Classic',           emoji: '🎮' },
  { id: 'dmg',        label: 'Game Boy DMG',       emoji: '🟢' },
  { id: 'blueprint',  label: 'Blueprint',          emoji: '📐' },
  { id: 'sketch',     label: 'Sketchbook',         emoji: '✏️' },
  { id: 'bauhaus',    label: 'Bauhaus',            emoji: '🔴' },
  { id: 'stone',      label: 'Brutalist Stone',    emoji: '🪨' },
  { id: 'wood',       label: 'Veneer',             emoji: '🪵' },
  // ── Natural & Elemental ──────────────────────────────────────────────────
  { id: 'obsidian',   label: 'Obsidian Mirror',    emoji: '🔮' },
  { id: 'biolume',    label: 'Deep Sea / Biolume', emoji: '🌊' },
  { id: 'frozen',     label: 'Frozen Tundra',      emoji: '🧊' },
  { id: 'terracotta', label: 'Terracotta Garden',  emoji: '🏺' },
  { id: 'amber',      label: 'Amber Fossil',       emoji: '🪲' },
  // ── Art & Design ────────────────────────────────────────────────────────
  { id: 'ukiyo',      label: 'Ukiyo-e',            emoji: '🎴' },
  { id: 'vaporwave',  label: 'Vaporwave Statues',  emoji: '🗿' },
  { id: 'stained',    label: 'Stained Glass',      emoji: '🪟' },
  { id: 'popart',     label: 'Pop Art',            emoji: '💥' },
  // ── Tech & Overflow ──────────────────────────────────────────────────────
  { id: 'terminal',   label: 'Terminal / Mainframe', emoji: '💻' },
  { id: 'circuit',    label: 'Circuit Board',      emoji: '⚡' },
  { id: 'lego',       label: 'Lego / Plastic',     emoji: '🧱' },
  { id: 'copper',     label: 'Copper Steam',       emoji: '⚙️' },
]

const VALID_THEME_IDS = new Set(THEMES.map(t => t.id))

const ThemeContext = createContext({ theme: 'classic', setTheme: () => {}, colorMode: 'dark', setColorMode: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tetris-theme')
    // Migrate old theme names
    if (saved === 'zen' || saved === 'neon') return 'classic'
    return saved && VALID_THEME_IDS.has(saved) ? saved : 'classic'
  })

  const [colorMode, setColorMode] = useState(
    () => localStorage.getItem('tetris-color-mode') ?? 'dark'
  )

  const [bgTheme, setBgThemeRaw] = useState(() => localStorage.getItem('tetris-bg-theme') || null)
  const setBgTheme = (id) => {
    setBgThemeRaw(id || null)
    if (id) localStorage.setItem('tetris-bg-theme', id)
    else localStorage.removeItem('tetris-bg-theme')
  }

  const [favThemes, setFavThemes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tetris-fav-themes') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('tetris-fav-themes', JSON.stringify(favThemes)) }, [favThemes])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tetris-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', colorMode)
    localStorage.setItem('tetris-color-mode', colorMode)
  }, [colorMode])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorMode, setColorMode, bgTheme, setBgTheme, favThemes, setFavThemes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
