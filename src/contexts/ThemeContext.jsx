import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = [
  { id: 'classic',   label: 'Classic',         emoji: '🎮' },
  { id: 'dmg',       label: 'Game Boy DMG',    emoji: '🟢' },
  { id: 'blueprint', label: 'Blueprint',       emoji: '📐' },
  { id: 'sketch',    label: 'Sketchbook',      emoji: '✏️' },
  { id: 'bauhaus',   label: 'Bauhaus',         emoji: '🔴' },
  { id: 'stone',     label: 'Brutalist Stone', emoji: '🪨' },
  { id: 'wood',      label: 'Veneer',          emoji: '🪵' },
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tetris-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', colorMode)
    localStorage.setItem('tetris-color-mode', colorMode)
  }, [colorMode])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorMode, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
