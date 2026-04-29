import { useTheme } from '../contexts/ThemeContext'

export default function SettingsPage({ config, onConfig, onClose }) {
  const set = (key, val) => onConfig(prev => ({ ...prev, [key]: val }))
  const { colorMode, setColorMode } = useTheme()

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal settings-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="about-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="settings-title">⚙ Settings</div>

        {/* Display section */}
        <div className="settings-section">
          <div className="settings-section-title">Display</div>
          <div className="settings-row">
            <span className="settings-label">Light Mode</span>
            <button
              type="button"
              className={`settings-toggle${colorMode === 'light' ? ' on' : ''}`}
              onClick={() => setColorMode(colorMode === 'light' ? 'dark' : 'light')}
            >
              {colorMode === 'light' ? '☀ ON' : '☾ OFF'}
            </button>
          </div>
        </div>

        {/* Sound section */}
        <div className="settings-section">
          <div className="settings-section-title">Sound</div>

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
        </div>

        <button type="button" className="about-install-btn" onClick={onClose}>
          Done
        </button>

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
              <span className="touch-ctrl-icon">👆×3</span>
              <span className="touch-ctrl-action">Triple Tap</span>
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
        <div className="settings-version">
          Tetra Overflow<sup className="settings-version-ultra">Ultra</sup> v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
        </div>
      </div>
    </div>
  )
}
