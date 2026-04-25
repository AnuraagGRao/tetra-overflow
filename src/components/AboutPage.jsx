import { useState } from 'react'

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

export default function AboutPage({ onClose, installPrompt, onInstall }) {
  const [installed, setInstalled] = useState(isStandalone())

  const handleInstall = async () => {
    await onInstall()
    setInstalled(true)
  }

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={e => e.stopPropagation()}>
        <button className="about-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Logo */}
        <div className="about-logo">
          TETR<span className="about-logo-i">I</span>S
        </div>
        <div className="about-tagline">Mobile-first Tetris PWA</div>

        {/* Dev card */}
        <div className="about-dev-card">
          <div className="about-avatar">👾</div>
          <div className="about-dev-info">
            <div className="about-dev-name">Anuraag G Rao</div>
            <div className="about-dev-role">Developer &amp; Designer</div>
          </div>
        </div>

        <p className="about-desc">
          Guideline-accurate Tetris with 7 game modes, Zone mechanic,
          SRS+ rotation, procedural BGM, custom themes, and full touch support.
        </p>

        {/* Install box */}
        <div className="about-install-box">
          <div className="about-install-title">📲 Install App</div>

          {installed ? (
            <div className="about-installed">✓ App is installed — enjoy!</div>
          ) : isIOS() ? (
            <ol className="about-ios-steps">
              <li>
                Tap the <strong>Share</strong> button
                <span className="about-share-icon"> ⬆ </span>
                in Safari
              </li>
              <li>
                Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
              </li>
              <li>
                Tap <strong>&quot;Add&quot;</strong> to confirm
              </li>
            </ol>
          ) : installPrompt ? (
            <button className="about-install-btn" onClick={handleInstall}>
              ⬇ Install on this device
            </button>
          ) : (
            <div className="about-no-prompt">
              Open in <strong>Chrome</strong> (Android) or{' '}
              <strong>Safari</strong> (iOS) then use the browser&apos;s
              &quot;Add to Home Screen&quot; option.
            </div>
          )}
        </div>

        {/* Tech stack */}
        <div className="about-stack">
          <span>React</span>
          <span className="about-stack-dot">·</span>
          <span>Vite</span>
          <span className="about-stack-dot">·</span>
          <span>Web Audio API</span>
          <span className="about-stack-dot">·</span>
          <span>Canvas 2D</span>
        </div>
      </div>
    </div>
  )
}
