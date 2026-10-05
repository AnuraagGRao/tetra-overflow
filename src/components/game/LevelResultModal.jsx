import { motion } from 'framer-motion'

export default function LevelResultModal({
  type = 'complete', // 'complete' | 'fail'
  title,
  subtitle,
  message,
  stats = {},
  accentColor = '#00d4ff',
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel = '← MAP',
  extraSlot = null,
}) {
  const isComplete = type === 'complete'

  if (isComplete) {
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
          background: 'radial-gradient(circle at 50% 35%, rgba(0,212,255,0.12), #000 80%)',
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
        <motion.div
          initial={{ scale: 0.8, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', maxWidth: 540 }}
        >
          <div
            style={{
              fontSize: '2.2rem',
              fontWeight: 900,
              letterSpacing: '0.15em',
              color: '#fff',
              textShadow: `0 0 30px ${accentColor}88`,
            }}
          >
            {title || '✓ CLEARED'}
          </div>

          {subtitle && (
            <div style={{ fontSize: '0.75rem', color: accentColor, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {subtitle}
            </div>
          )}

          {message && (
            <div style={{ fontSize: '0.88rem', color: '#aaa', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {message}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '12px 24px',
              marginTop: '0.5rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div>
              <div style={{ fontSize: '0.52rem', color: '#777', letterSpacing: '0.12em' }}>SCORE</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>
                {(stats.score ?? 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.52rem', color: '#777', letterSpacing: '0.12em' }}>LEVEL</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: accentColor }}>
                {stats.level ?? 1}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.52rem', color: '#777', letterSpacing: '0.12em' }}>LINES</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>
                {stats.linesThisLevel ?? stats.lines ?? 0}
              </div>
            </div>
          </div>

          {extraSlot}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {onSecondary && (
              <button
                type="button"
                onClick={onSecondary}
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
                }}
              >
                {secondaryLabel}
              </button>
            )}
            {onPrimary && (
              <button
                type="button"
                onClick={onPrimary}
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
                {primaryLabel || 'NEXT →'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // Defeat / Collapse screen
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        width: '100vw',
        background: 'radial-gradient(circle at 50% 42%, rgba(255,55,55,0.16), transparent 48%), #030006',
        color: '#fff',
        padding: '2rem',
        textAlign: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: 'monospace',
        zIndex: 50,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(255,70,70,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,70,70,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
        }}
      />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{
          position: 'relative',
          width: 'min(380px, 100%)',
          background: 'rgba(10,0,8,0.94)',
          border: `1px solid ${accentColor}66`,
          borderRadius: 16,
          padding: '2rem',
          boxShadow: `0 0 48px ${accentColor}22`,
        }}
      >
        <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>☠</div>
        <div style={{ fontSize: '0.55rem', color: '#ff5b66', letterSpacing: '0.3em', marginBottom: 8 }}>
          {title || 'SIGNAL COLLAPSE'}
        </div>
        {subtitle && (
          <div style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.1em', marginBottom: 6 }}>
            {subtitle}
          </div>
        )}
        <div style={{ fontSize: '0.66rem', color: '#999', lineHeight: 1.6, marginBottom: 18 }}>
          {message || 'The structure exceeded its stability threshold. Recompile the tower and try again.'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.12em' }}>SCORE</div>
            <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 900 }}>
              {(stats.score ?? 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.12em' }}>LEVEL</div>
            <div style={{ fontSize: '1rem', color: accentColor, fontWeight: 900 }}>
              {stats.level ?? 1}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.48rem', color: '#666', letterSpacing: '0.12em' }}>LINES</div>
            <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 900 }}>
              {stats.linesThisLevel ?? stats.lines ?? 0}
            </div>
          </div>
        </div>

        {extraSlot}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: '0.5rem' }}>
          {onPrimary && (
            <button
              type="button"
              onClick={onPrimary}
              style={{
                background: '#ff5b66',
                border: 'none',
                color: '#160006',
                borderRadius: 8,
                padding: '11px 0',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 900,
                letterSpacing: '0.18em',
                fontFamily: 'inherit',
              }}
            >
              {primaryLabel || 'RETRY LEVEL'}
            </button>
          )}
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.16)',
                color: '#aaa',
                borderRadius: 8,
                padding: '9px 0',
                cursor: 'pointer',
                fontSize: '0.7rem',
                letterSpacing: '0.12em',
                fontFamily: 'inherit',
              }}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
