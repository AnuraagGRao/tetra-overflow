import { useState } from 'react'

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

export default function AboutPage({ onClose, installPrompt, onInstall }) {
  const [installed, setInstalled] = useState(isStandalone())
  const GPay_UPI  = "anuraag7rao@oksbi"
  const GPay_NAME = 'Tetra Overflow Ultra'
  const gpayUrl   = GPay_UPI ? `upi://pay?pa=${encodeURIComponent(GPay_UPI)}&pn=${encodeURIComponent(GPay_NAME)}&cu=INR` : ''
  const [copied, setCopied] = useState(false)

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
          Tetr<span className="about-logo-i">a</span> O<span className="about-logo-i">v</span>erflow
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
          Swipe mechanics, mobile-friendly UI, and a curated set of solo modes. Built with React and the Web Audio API, Tetra Overflow delivers a premium Tetris experience right in your browser. No ads, no distractions — just pure, unadulterated block-dropping fun.
        </p>

        {/* Solo Modes (concise) */}
        <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', margin: '10px 0' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: '#00d4ff', marginBottom: 6, textTransform: 'uppercase' }}>Solo Modes</div>
          {[ 
            { label: 'Normal',   desc: 'Classic free-play. Chase high score and lines.' },
            { label: 'Sprint',   desc: 'Clear 40 lines as fast as possible.' },
            { label: 'Blitz',    desc: '120s timer with 1.25× gravity.' },
            { label: 'Purify',   desc: '180s with infection — clear contaminated lines.' },
            { label: 'Zen',      desc: 'Endless, no top-out. Relax and practice.' },
            { label: 'Ultimate', desc: 'Maximum gravity and strict timing.' },
          ].map((m, i) => (
            <div key={m.label} style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: i===0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, minWidth: 64, color: '#e2e8f0' }}>{m.label}</div>
              <div style={{ fontSize: '0.6rem', color: '#7c8aa5' }}>{m.desc}</div>
            </div>
          ))}
        </div>

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
        {/* Support the Dev */}
        <div className="about-install-box" style={{ marginTop: 12 }}>
          <div className="about-install-title">🙏 Support the Dev</div>
          <div style={{ fontSize: '0.7rem', color: '#7c8aa5', lineHeight: 1.5, marginBottom: 10 }}>
            If you enjoy Tetra Overflow Ultra, you can support future updates via PayPal or Google Pay (UPI).
          </div>
          {/* PayPal */}
          <a
            href="https://paypal.me/RadiCalzMad"
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(0,112,243,0.08)', border: '1px solid rgba(0,112,243,0.3)', borderRadius: 8, textDecoration: 'none', marginBottom: 10 }}
          >
            <span style={{ fontSize: '1.2rem' }}>🅿</span>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.08em' }}>PayPal</div>
              <div style={{ fontSize: '0.58rem', color: '#556' }}>paypal.me/RadiCalzMad</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#666' }}>↗</span>
          </a>
          {/* Google Pay (UPI) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(52,168,83,0.10)', border: '1px solid rgba(52,168,83,0.35)', borderRadius: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🅖</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.08em' }}>Google Pay (UPI)</div>
              <div style={{ fontSize: '0.58rem', color: '#7c8aa5', overflow: 'hidden', textOverflow: 'ellipsis' }}>{GPay_UPI || 'Set VITE_GPAY_UPI in .env'}</div>
            </div>
            <button
              onClick={async () => { if (!GPay_UPI) return; try { await navigator.clipboard?.writeText(GPay_UPI); setCopied(true); setTimeout(()=>setCopied(false), 1400) } catch {} }}
              disabled={!GPay_UPI}
              style={{ background: 'rgba(52,168,83,0.15)', border: '1px solid rgba(52,168,83,0.45)', color: '#34d399', borderRadius: 8, padding: '6px 10px', fontSize: '0.62rem', cursor: GPay_UPI ? 'pointer' : 'not-allowed', fontFamily: 'inherit', letterSpacing: '0.08em' }}
            >{copied ? '✓ Copied' : 'Copy UPI'}</button>
            <a
              href={gpayUrl || undefined}
              onClick={(e) => { if (!gpayUrl) e.preventDefault() }}
              style={{ marginLeft: 6, background: 'linear-gradient(135deg,#34d399,#22c55e)', border: 'none', color: '#000', borderRadius: 8, padding: '7px 10px', fontSize: '0.62rem', textDecoration: 'none', cursor: gpayUrl ? 'pointer' : 'not-allowed', opacity: gpayUrl ? 1 : 0.6, fontWeight: 700, letterSpacing: '0.08em' }}
            >Pay with GPay</a>
          </div>
        </div>
        
      </div>
    </div>
  )
}
