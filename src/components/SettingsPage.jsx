import { useTheme } from '../contexts/ThemeContext'
import settingsIconUrl from '../icons/settings-button.png'
import soundIconUrl from '../icons/sound-button.png'

export default function SettingsPage({ config, onConfig, onClose, onClearCache }) {
  const set = (key, val) => onConfig(prev => ({ ...prev, [key]: val }))
  const { colorMode: _colorMode, setColorMode: _setColorMode } = useTheme()

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal settings-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="about-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="settings-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <img src={settingsIconUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <span>Settings</span>
        </div>

        {/* Display section (light mode removed) */}

        {/* Sound section */}
        <div className="settings-section">
          <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={soundIconUrl} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            <span>Sound</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Music Volume</span>
            <div className="settings-slider-wrap">
              <input
                type="range" min="0" max="1" step="0.05"
                value={config.musicVolume}
                onChange={e => set('musicVolume', +e.target.value)}
                className="settings-slider"
              />
              <span className="settings-val">{Math.round(config.musicVolume * 100)}%</span>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">SFX Volume</span>
            <div className="settings-slider-wrap">
              <input
                type="range" min="0" max="1" step="0.05"
                value={config.sfxVolume ?? 1.0}
                onChange={e => set('sfxVolume', +e.target.value)}
                className="settings-slider"
              />
              <span className="settings-val">{Math.round((config.sfxVolume ?? 1.0) * 100)}%</span>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Sound Effects</span>
            <button
              type="button"
              className={`settings-toggle${config.sfxEnabled ? ' on' : ''}`}
              onClick={() => set('sfxEnabled', !config.sfxEnabled)}
            >
              {config.sfxEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="settings-row">
            <span className="settings-label">Haptic Feedback</span>
            <button
              type="button"
              className={`settings-toggle${config.hapticEnabled ? ' on' : ''}`}
              onClick={() => set('hapticEnabled', !config.hapticEnabled)}
            >
              {config.hapticEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Controls section */}
        <div className="settings-section">
          <div className="settings-section-title">Controls</div>

          <div className="settings-row">
            <span className="settings-label">DAS <span className="settings-val">{config.das}ms</span></span>
            <div className="settings-slider-wrap">
              <input
                type="range" min="30" max="220" step="5"
                value={config.das}
                onChange={e => set('das', +e.target.value)}
                className="settings-slider"
              />
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">ARR <span className="settings-val">{config.arr}ms</span></span>
            <div className="settings-slider-wrap">
              <input
                type="range" min="0" max="80" step="5"
                value={config.arr}
                onChange={e => set('arr', +e.target.value)}
                className="settings-slider"
              />
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">On-Screen Buttons</span>
            <button
              type="button"
              className={`settings-toggle${config.showOnScreenControls ? ' on' : ''}`}
              onClick={() => set('showOnScreenControls', !config.showOnScreenControls)}
            >
              {config.showOnScreenControls ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Touch Controls Reference */}
        <div className="settings-section">
          <div className="settings-section-title">Touch Controls</div>
          <div className="touch-controls-grid">
            <div className="touch-ctrl-card">
              <span className="touch-ctrl-icon">👆</span>
              <span className="touch-ctrl-action">Tap</span>
              <span className="touch-ctrl-desc">Rotate CW</span>
            </div>
            <div className="touch-ctrl-card touch-ctrl-card--accent">
              <span className="touch-ctrl-icon">👆👆</span>
              <span className="touch-ctrl-action">Two-Finger Tap</span>
              <span className="touch-ctrl-desc">Activate Zone</span>
            </div>
            <div className="touch-ctrl-card">
              <span className="touch-ctrl-icon">←→</span>
              <span className="touch-ctrl-action">Swipe ← →</span>
              <span className="touch-ctrl-desc">Move</span>
            </div>
            <div className="touch-ctrl-card">
              <span className="touch-ctrl-icon">↑</span>
              <span className="touch-ctrl-action">Swipe Up</span>
              <span className="touch-ctrl-desc">Hold Piece</span>
            </div>
            <div className="touch-ctrl-card">
              <span className="touch-ctrl-icon">↓</span>
              <span className="touch-ctrl-action">Swipe Down</span>
              <span className="touch-ctrl-desc">Soft Drop</span>
            </div>
            <div className="touch-ctrl-card">
              <span className="touch-ctrl-icon">⚡↓</span>
              <span className="touch-ctrl-action">Fling Down</span>
              <span className="touch-ctrl-desc">Hard Drop</span>
            </div>
          </div>
        </div>

        {/* Graphics section */}
        <div className="settings-section">
          <div className="settings-section-title">Graphics</div>
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <span className="settings-label" style={{ fontSize: '0.68rem', color: '#888' }}>Render Quality — higher looks sharper on HiDPI screens but uses more GPU</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'performance', label: 'Performance', desc: '1× — best for older devices' },
                { key: 'balanced',    label: 'Balanced',    desc: 'up to 1.5×' },
                { key: 'quality',     label: 'Quality',     desc: 'up to 2× (HiDPI)' },
                { key: 'ultra',       label: 'Ultra',       desc: 'up to 3× (4K)' },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  title={desc}
                  onClick={() => set('renderQuality', key)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: `1px solid ${config.renderQuality === key ? '#00d4ff' : 'rgba(255,255,255,0.12)'}`,
                    background: config.renderQuality === key ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                    color: config.renderQuality === key ? '#00d4ff' : '#888',
                    fontSize: '0.65rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Update / cache tools */}
        {typeof onClearCache === 'function' && (
          <div className="settings-section">
            <div className="settings-section-title">Update</div>
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <span className="settings-label" style={{ fontSize: '0.68rem', color: '#888' }}>
                If updates look stale, run a hard reset (cache, storage, cookies) and reload.
              </span>
              <button
                type="button"
                className="about-install-btn"
                onClick={() => onClearCache?.()}
                style={{ marginTop: 0, width: '100%' }}
              >
                Hard Reset + Reload
              </button>
            </div>
          </div>
        )}

        <button type="button" className="about-install-btn" onClick={onClose}>
          Done
        </button>


        <div className="settings-version">
          Tetra Overflow<sup className="settings-version-ultra">Ultra</sup> v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
        </div>
      </div>
    </div>
  )
}
