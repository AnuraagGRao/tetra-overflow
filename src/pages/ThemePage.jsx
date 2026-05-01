import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useTheme, THEMES } from '../contexts/ThemeContext'
import { STORE_ITEMS } from '../logic/storeData'
import BackgroundCanvas from '../components/BackgroundCanvas'

const BG_ITEMS = STORE_ITEMS.filter(i => i.type === 'bg')
const THEME_STORE_ITEMS = STORE_ITEMS.filter(i => i.type === 'theme')
// Map themeId → store item (for lock/unlock info)
const THEME_STORE_MAP = Object.fromEntries(THEME_STORE_ITEMS.map(i => [i.themeKey, i]))
const MAX_FAVS = 7

export default function ThemePage() {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const { theme, setTheme, bgTheme, setBgTheme, favThemes, setFavThemes } = useTheme()

  // Which favorite slot is currently selected for assignment (-1 = none)
  const [selectedSlot, setSelectedSlot] = useState(-1)

  const inventory = userProfile?.inventory || []

  const handleSlotClick = (idx) => {
    if (selectedSlot === idx) {
      // Deselect
      setSelectedSlot(-1)
    } else if (favThemes[idx]) {
      // Remove filled slot
      const next = [...favThemes]
      next.splice(idx, 1)
      setFavThemes(next)
      setSelectedSlot(-1)
    } else {
      setSelectedSlot(idx)
    }
  }

  const assignToSlot = (id) => {
    if (selectedSlot < 0) return
    const next = [...favThemes]
    next[selectedSlot] = id
    setFavThemes(next)
    setSelectedSlot(-1)
  }

  const applyTheme = (id) => {
    if (id.startsWith('bg_')) {
      setBgTheme(id.replace('bg_', ''))
    } else {
      setTheme(id)
      setBgTheme(null)
    }
  }

  const slotItems = Array.from({ length: MAX_FAVS }, (_, i) => favThemes[i] || null)

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#05050f',
      color: '#ccc',
      fontFamily: '"Courier New", monospace',
      overflowY: 'auto',
    }}>
      {/* Live bg preview */}
      {bgTheme && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <BackgroundCanvas bgType={bgTheme} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.8rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', letterSpacing: '0.12em' }}
          >← MENU</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.3em', color: '#fff' }}>
            THEMES
          </div>
          <div style={{ width: 60 }} />
        </div>

        {/* ── Favorites ──────────────────────────────────────────────────── */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.35em', color: '#888', marginBottom: 10, textTransform: 'uppercase' }}>
            Favorites — click a filled slot to remove · click empty slot to assign
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {slotItems.map((id, idx) => {
              const isSelected = selectedSlot === idx
              const isFilled = !!id
              const isBg = id?.startsWith('bg_')
              const item = isBg ? BG_ITEMS.find(i => i.id === id) : THEMES.find(t => t.id === id)
              return (
                <motion.button
                  key={idx}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleSlotClick(idx)}
                  style={{
                    width: 52, height: 52, borderRadius: 10,
                    border: isSelected ? '2px solid #fff' : `1px solid ${isFilled ? (item?.accent || '#555') : '#333'}`,
                    background: isFilled ? 'rgba(255,255,255,0.06)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, position: 'relative',
                    boxShadow: isSelected ? '0 0 12px rgba(255,255,255,0.4)' : 'none',
                  }}
                >
                  {isFilled ? (
                    <>
                      <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{item?.emoji || '?'}</span>
                      <span style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: item?.accent || '#aaa', textTransform: 'uppercase', maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item?.name || id}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#444', fontWeight: 700 }}>{idx + 1}</span>
                  )}
                </motion.button>
              )
            })}
          </div>
          {selectedSlot >= 0 && (
            <div style={{ fontSize: '0.55rem', color: '#f59e0b', letterSpacing: '0.15em', marginTop: 8 }}>
              Slot {selectedSlot + 1} selected — pick a theme below to assign
            </div>
          )}
        </section>

        {/* ── Piece Themes ───────────────────────────────────────────────── */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.35em', color: '#888', marginBottom: 10, textTransform: 'uppercase' }}>
            Piece Themes
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {THEMES.map(t => {
              const storeItem = THEME_STORE_MAP[t.id]
              // classic is always free; store items need inventory check
              const isOwned = t.id === 'classic' || !storeItem || inventory.includes(storeItem.id)
              const isActive = theme === t.id && !bgTheme
              const isAssigning = selectedSlot >= 0
              const accent = storeItem?.accent
              return (
                <motion.button
                  key={t.id}
                  whileTap={isOwned ? { scale: 0.94 } : {}}
                  onClick={() => {
                    if (!isOwned) return
                    isAssigning ? assignToSlot(t.id) : applyTheme(t.id)
                  }}
                  title={!isOwned && storeItem?.unlockCondition
                    ? `🔒 ${storeItem.unlockCondition}${storeItem.price > 0 ? ` or ◆ ${storeItem.price}` : ''}`
                    : undefined}
                  style={{
                    flex: '1 1 calc(25% - 8px)', minWidth: 70, height: 72, borderRadius: 10,
                    border: isActive ? `2px solid ${accent || '#fff'}` : `1px solid ${isOwned ? (accent ? accent + '55' : '#333') : '#222'}`,
                    background: isActive ? `${accent || '#fff'}15` : isOwned ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.35)',
                    cursor: isOwned ? 'pointer' : 'not-allowed',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    opacity: isOwned ? 1 : 0.45,
                    boxShadow: isActive ? `0 0 14px ${accent || '#fff'}55` : 'none',
                    transition: 'all 0.18s ease', position: 'relative',
                  }}
                >
                  {!isOwned && (
                    <div style={{ position: 'absolute', top: 4, right: 6, fontSize: '0.5rem', color: '#555' }}>🔒</div>
                  )}
                  {isOwned && isActive && (
                    <div style={{ position: 'absolute', top: 3, right: 5, fontSize: '0.42rem', letterSpacing: '0.15em', color: accent || '#fff', opacity: 0.8 }}>ON</div>
                  )}
                  <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{t.emoji}</span>
                  <span style={{ fontSize: '0.45rem', letterSpacing: '0.12em', color: isActive ? (accent || '#fff') : isOwned ? '#888' : '#444', textTransform: 'uppercase' }}>{t.label}</span>
                  {!isOwned && storeItem?.price > 0 && (
                    <span style={{ fontSize: '0.4rem', color: '#eab308', letterSpacing: '0.1em' }}>◆ {storeItem.price}</span>
                  )}
                  {!isOwned && storeItem?.storyUnlock && (
                    <span style={{ fontSize: '0.38rem', color: '#a855f7', letterSpacing: '0.08em' }}>STORY</span>
                  )}
                </motion.button>
              )
            })}
          </div>
        </section>

        {/* ── World (BG) Themes ──────────────────────────────────────────── */}
        <section>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.35em', color: '#888', marginBottom: 10, textTransform: 'uppercase' }}>
            World Themes — unlock by clearing story levels
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BG_ITEMS.map(item => {
              const unlocked = inventory.includes(item.id)
              const isActive = bgTheme === item.bgType
              const isAssigning = selectedSlot >= 0
              return (
                <motion.button
                  key={item.id}
                  whileTap={unlocked ? { scale: 0.94 } : {}}
                  onClick={() => {
                    if (!unlocked) return
                    isAssigning ? assignToSlot(item.id) : applyTheme(item.id)
                  }}
                  style={{
                    flex: '1 1 calc(25% - 8px)', minWidth: 70, height: 72, borderRadius: 10,
                    border: isActive ? `2px solid ${item.accent}` : `1px solid ${unlocked ? item.accent + '55' : '#222'}`,
                    background: isActive ? `${item.accent}15` : unlocked ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.4)',
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    opacity: unlocked ? 1 : 0.45,
                    boxShadow: isActive ? `0 0 14px ${item.accent}55` : 'none',
                    transition: 'all 0.18s ease', position: 'relative',
                  }}
                >
                  {!unlocked && (
                    <div style={{ position: 'absolute', top: 4, right: 6, fontSize: '0.5rem', color: '#555' }}>🔒</div>
                  )}
                  <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{item.emoji}</span>
                  <span style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: isActive ? item.accent : '#888', textTransform: 'uppercase', maxWidth: 62, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                </motion.button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
