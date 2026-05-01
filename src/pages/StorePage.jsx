import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { purchaseItem } from '../firebase/db'
import { STORE_ITEMS, ITEM_TYPES } from '../logic/storeData'
import { useTheme } from '../contexts/ThemeContext'

const TAB_LABELS = { theme: 'THEMES', music: 'MUSIC', effect: 'EFFECTS' }

function CoinBadge({ coins }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: '0.82rem', color: '#eab308', fontWeight: 700 }}>
      ◆ {coins.toLocaleString()}
    </div>
  )
}

function ItemCard({ item, owned, active, onBuy, onEquip, coins }) {
  const [hovered, setHovered] = useState(false)
  const canAfford = coins >= item.price

  let actionLabel, actionFn, actionDisabled = false, actionColor = item.accent
  if (item.price === 0 || owned) {
    if (item.type === 'theme') {
      actionLabel = active ? 'EQUIPPED' : 'EQUIP'
      actionFn = onEquip
      actionDisabled = active
    } else {
      actionLabel = owned ? 'OWNED' : 'FREE'
      actionFn = owned ? null : onBuy
      actionDisabled = owned
    }
  } else {
    actionLabel = canAfford ? `◆ ${item.price}` : `◆ ${item.price}`
    actionFn = canAfford ? onBuy : null
    actionDisabled = !canAfford
    actionColor = canAfford ? item.accent : '#555'
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? `color-mix(in srgb, ${item.accent} 12%, #10101c)` : hovered ? 'rgba(255,255,255,0.04)' : '#10101c',
        border: `1px solid ${active ? item.accent : hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 12,
        padding: '1.1rem',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'all 0.18s ease',
        boxShadow: active ? `0 0 20px ${item.accent}22` : 'none',
        cursor: 'default',
        position: 'relative',
      }}
    >
      {active && (
        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.55rem', letterSpacing: '0.2em', color: item.accent, background: `${item.accent}20`, borderRadius: 4, padding: '2px 6px' }}>
          ACTIVE
        </div>
      )}

      <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>{item.emoji}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.12em', color: hovered || active ? item.accent : '#ddd', transition: 'color 0.18s' }}>
          {item.name}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 3, lineHeight: 1.4 }}>{item.description}</div>
      </div>

      <button
        onClick={actionFn || undefined}
        disabled={actionDisabled || !actionFn}
        style={{
          padding: '7px 10px', borderRadius: 7, border: `1px solid ${actionColor}`,
          background: actionDisabled ? 'transparent' : `${actionColor}18`,
          color: actionDisabled ? '#555' : actionColor,
          cursor: actionDisabled || !actionFn ? 'default' : 'pointer',
          fontSize: '0.72rem', letterSpacing: '0.12em', fontFamily: 'inherit',
          textTransform: 'uppercase', transition: 'all 0.15s', marginTop: 'auto',
          fontWeight: 600,
        }}
      >
        {actionLabel}
      </button>
    </motion.div>
  )
}

export default function StorePage() {
  const navigate = useNavigate()
  const { user, userProfile, refreshProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('theme')
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)

  const coins = userProfile?.coins ?? 0
  const inventory = userProfile?.inventory ?? ['theme_classic']

  const showToast = (msg, color = '#22c55e') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2600)
  }

  const handleBuy = async (item) => {
    if (busy || !user) return
    setBusy(true)
    try {
      await purchaseItem(user.uid, item.id, item.price)
      await refreshProfile()
      showToast(`Purchased: ${item.name}!`)
      if (item.type === 'theme') setTheme(item.themeKey)
    } catch (ex) {
      showToast(ex.message, '#f87171')
    } finally {
      setBusy(false)
    }
  }

  const handleEquip = (item) => {
    if (item.type === 'theme') setTheme(item.themeKey)
    showToast(`Theme applied: ${item.name}`)
  }

  // Story-unlocked items are not available in the store
  const filtered = STORE_ITEMS.filter(i => i.type === activeTab && !i.storyUnlock)

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a14', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace', color: '#fff' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, gap: 12 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.14em', fontFamily: 'inherit', padding: 0 }}>
          ← MENU
        </button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '0.2em', color: '#22c55e' }}>STORE</h1>
        <CoinBadge coins={coins} />
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '0 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 0, flexShrink: 0 }}>
        {ITEM_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? '#22c55e' : 'transparent'}`,
              color: activeTab === t ? '#22c55e' : '#555',
              padding: '10px 16px', cursor: 'pointer', fontSize: '0.72rem',
              letterSpacing: '0.16em', fontFamily: 'inherit', textTransform: 'uppercase', transition: 'all 0.18s',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Coins info */}
      <div style={{ padding: '10px 1.4rem', fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', flexShrink: 0 }}>
        Earn ◆ coins by playing — 1 coin per 1,000 score.
      </div>

      {/* Grid */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ flex: 1, padding: '0.75rem 1.4rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', alignContent: 'start', overflowY: 'auto' }}
      >
        {filtered.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            owned={item.price === 0 || inventory.includes(item.id)}
            active={item.type === 'theme' && item.themeKey === theme}
            coins={coins}
            onBuy={() => handleBuy(item)}
            onEquip={() => handleEquip(item)}
          />
        ))}
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#12121e', border: `1px solid ${toast.color}`, borderRadius: 8, padding: '10px 20px', color: toast.color, fontSize: '0.8rem', letterSpacing: '0.08em', zIndex: 500, whiteSpace: 'nowrap' }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
