import { motion } from 'framer-motion'

export default function StoryBriefingModal({
  badge,
  title,
  story,
  targetLines,
  accentColor = '#00d4ff',
  onStart,
  onBack,
  backLabel = '← BACK',
  startLabel = 'START →',
  extraSlot = null,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        width: '100vw',
        background: 'radial-gradient(circle at 50% 40%, rgba(20,20,35,0.85), #000 85%)',
        color: '#fff',
        padding: '2rem',
        gap: '1.5rem',
        textAlign: 'center',
        fontFamily: 'monospace',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {badge && (
        <div
          style={{
            fontSize: '0.8rem',
            color: accentColor,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {badge}
        </div>
      )}

      {title && (
        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>
          {title}
        </div>
      )}

      {story && (
        <div
          style={{
            fontSize: '0.9rem',
            color: '#aaa',
            maxWidth: 600,
            lineHeight: 1.65,
            whiteSpace: 'pre-line',
          }}
        >
          {story}
        </div>
      )}

      {targetLines > 0 && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#777',
            marginTop: '0.5rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Target: <span style={{ color: '#fff', fontWeight: 700 }}>{targetLines} lines</span>
        </div>
      )}

      {extraSlot}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '0.65rem 1.4rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#ccc',
              cursor: 'pointer',
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              letterSpacing: '0.08em',
              transition: 'background 0.2s',
            }}
          >
            {backLabel}
          </button>
        )}
        {onStart && (
          <button
            type="button"
            onClick={onStart}
            style={{
              padding: '0.65rem 1.6rem',
              background: accentColor,
              border: `1px solid ${accentColor}`,
              color: '#000',
              cursor: 'pointer',
              borderRadius: 6,
              fontWeight: 800,
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              letterSpacing: '0.12em',
              boxShadow: `0 0 20px ${accentColor}44`,
            }}
          >
            {startLabel}
          </button>
        )}
      </div>
    </motion.div>
  )
}
