import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/DownloadPage.css';

const SERVER_URL = import.meta.env.VITE_BUILD_SERVER_URL || 'http://localhost:3001';
const BASE_URL = import.meta.env.BASE_URL || '/';

// Pre-built APKs available in public/downloads
const PREBUILD_APKS = [
  {
    buildType: 'release',
    name: 'Production Release (Recommended)',
    description: 'Full-screen TWA with Digital Asset Links verification. Best experience.',
    filename: 'tetra-overflow-ultra-release.apk',
    icon: '🚀'
  }
];

export default function DownloadPage() {
  const navigate = useNavigate();
  const isAndroid = /Android/i.test(navigator.userAgent);

  return (
    <div className="download-page">
      <div className="download-container">
        <h1>📱 Download Tetra Overflow Ultra</h1>
        
        <div className="download-intro">
          <p>Get the native Android app (APK) for the best experience!</p>
          {isAndroid && (
            <div className="android-notice">
              ✅ Android device detected! You can install the APK directly.
            </div>
          )}
        </div>

        {/* Pre-built Release APKs */}
        <div className="prebuilt-apks">
          <h2>📥 Download APK</h2>
          <p className="section-note">Choose your preferred version</p>
          <div className="apk-list">
            {PREBUILD_APKS.map((apk) => (
              <div key={apk.filename} className="apk-card prebuilt">
                <div className="apk-info">
                  <div className="apk-icon">{apk.icon}</div>
                  <div className="apk-details">
                    <h3>{apk.name}</h3>
                    <p className="apk-description">{apk.description}</p>
                  </div>
                </div>
                <a 
                  href={`${BASE_URL}downloads/${apk.filename}`}
                  download={apk.filename}
                  className={`download-button ${apk.buildType}`}
                >
                  ⬇️ Download
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Installation Instructions */}
        <div className="instructions">
          <h2>Installation Instructions</h2>
          <ol>
            <li>Download the APK file above</li>
            <li>Open the downloaded file on your Android device</li>
            <li>If prompted, enable "Install from Unknown Sources" in your device settings</li>
            <li>Follow the installation prompts</li>
            <li>Launch Tetra Overflow Ultra from your app drawer!</li>
          </ol>
          
          <div className="security-note">
            <strong>⚠️ Security Note:</strong> This APK is self-signed and not distributed through 
            Google Play Store. Your device may show warnings during installation. This is normal 
            for sideloaded apps.
          </div>
        </div>

        {/* What's a TWA? */}
        <details className="twa-info">
          <summary>What is a Trusted Web Activity (TWA)?</summary>
          <p>
            This APK uses Google's Trusted Web Activity technology, which wraps the Progressive Web 
            App in a native Android container. When installed, it:
          </p>
          <ul>
            <li>Appears as a native app in your app drawer</li>
            <li>Runs in full-screen without browser UI</li>
            <li>Has its own icon and splash screen</li>
            <li>Can be updated by simply updating the web app</li>
            <li>Uses less storage than a traditional native app</li>
          </ul>
        </details>

        <div className="back-link">
          <button 
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit', textDecoration: 'none' }}
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
