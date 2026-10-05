import { motion } from 'framer-motion'

export default function PauseMenuModal({
  isOpen = true,
  title = 'PAUSED',
  subtitle,
  statsText,
  accentColor = '#00d4ff',
  onResume,
  onRestart,
  onExitMap,
  mapLabel = '← MAP',
  onOpenSettings,
  musicManager,
  config,
  onConfigChange,
  extraSlot = null,
}) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150,
        backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        style={{
          textAlign: 'center',
          gap: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: 'monospace',
          padding: '2rem',
          maxWidth: 420,
          width: '90%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.2em', color: '#fff' }}>
          {title}
        </div>

        {subtitle && (
          <div style={{ fontSize: '0.68rem', color: accentColor, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {subtitle}
          </div>
        )}

        {statsText && (
          <div style={{ fontSize: '0.62rem', color: '#777' }}>
            {statsText}
          </div>
        )}

        {musicManager && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => musicManager.prev?.()}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#ccc',
                  padding: '5px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={() => musicManager.pause?.()}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#ccc',
                  padding: '5px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                ⏸
              </button>
              <button
                type="button"
                onClick={() => musicManager.resume?.()}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#ccc',
                  padding: '5px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                ▶
              </button>
              <button
                type="button"
                onClick={() => musicManager.next?.()}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#ccc',
                  padding: '5px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                ⏭
              </button>
            </div>

            {config && onConfigChange && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6rem', color: '#888' }}>
                Vol
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.musicVolume ?? 1.0}
                  onChange={e => {
                    const value = +e.target.value
                    onConfigChange(prev => ({ ...prev, musicVolume: value }))
                    musicManager.setVolume?.(value)
                  }}
                  style={{ accentColor }}
                />
              </label>
            )}
          </div>
        )}

        {extraSlot}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: '0.6rem' }}>
          {onResume && (
            <button
              type="button"
              onClick={onResume}
              style={{
                padding: '0.75rem 2rem',
                background: 'none',
                border: `1px solid ${accentColor}`,
                color: accentColor,
                fontWeight: 800,
                cursor: 'pointer',
                borderRadius: 6,
                fontSize: '0.95rem',
                letterSpacing: '0.1em',
                boxShadow: `0 0 16px ${accentColor}33`,
              }}
            >
              ▶ RESUME
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#ccc',
                padding: '8px 16px',
                cursor: 'pointer',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                letterSpacing: '0.08em',
              }}
            >
              ⚙ SETTINGS
            </button>
          )}

          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#aaa',
                padding: '8px 16px',
                cursor: 'pointer',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
              }}
            >
              RESTART LEVEL
            </button>
          )}

          {onExitMap && (
            <button
              type="button"
              onClick={onExitMap}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.16)',
                color: '#888',
                padding: '8px 16px',
                cursor: 'pointer',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
              }}
            >
              {mapLabel}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
