import { useState, useEffect } from 'react';
import '../styles/DownloadPage.css';

const SERVER_URL = import.meta.env.VITE_BUILD_SERVER_URL || 'http://localhost:3001';

export default function DownloadPage() {
  const [apks, setApks] = useState([]);
  const [buildStatus, setBuildStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchApks();
    const interval = setInterval(() => {
      if (building) {
        fetchBuildStatus();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [building]);

  const fetchApks = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/apks`);
      const data = await response.json();
      setApks(data.apks || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load APKs. Is the build server running?');
      setLoading(false);
    }
  };

  const fetchBuildStatus = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/build-status`);
      const data = await response.json();
      setBuildStatus(data);
      
      if (data.inProgress) {
        setBuilding(true);
      } else if (building && !data.inProgress) {
        setBuilding(false);
        fetchApks(); // Refresh APK list
      }
    } catch (err) {
      console.error('Failed to fetch build status:', err);
    }
  };

  const triggerBuild = async (buildType) => {
    setBuilding(true);
    setError(null);

    try {
      const response = await fetch(`${SERVER_URL}/api/build-apk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          buildType,
          apiKey: import.meta.env.VITE_BUILD_API_KEY 
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Build failed');
      }

      const data = await response.json();
      setBuildStatus({ inProgress: true, type: buildType, log: [data.message] });
      
    } catch (err) {
      setError(err.message);
      setBuilding(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

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

        {/* Available APKs */}
        {loading ? (
          <div className="loading">Loading available downloads...</div>
        ) : apks.length > 0 ? (
          <div className="apk-list">
            <h2>Available Downloads</h2>
            {apks.map((apk) => (
              <div key={apk.filename} className="apk-card">
                <div className="apk-info">
                  <div className="apk-icon">📦</div>
                  <div className="apk-details">
                    <h3>{apk.buildType === 'release' ? 'Production Release' : 'Debug Build'}</h3>
                    <p className="apk-meta">
                      Size: {apk.size} · Updated: {formatDate(apk.modified)}
                    </p>
                  </div>
                </div>
                <a 
                  href={`${SERVER_URL}${apk.downloadUrl}`}
                  download
                  className="download-button"
                >
                  Download APK
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-apks">
            <p>No APKs available yet. Build one below!</p>
          </div>
        )}

        {/* Build Controls */}
        <div className="build-section">
          <h2>Build New APK</h2>
          <p className="build-note">
            Builds typically take 2-5 minutes depending on server resources.
          </p>
          
          <div className="build-buttons">
            <button
              onClick={() => triggerBuild('debug')}
              disabled={building}
              className="build-button debug"
            >
              {building && buildStatus?.type === 'debug' ? '⏳ Building...' : '🔧 Build Debug'}
            </button>
            <button
              onClick={() => triggerBuild('release')}
              disabled={building}
              className="build-button release"
            >
              {building && buildStatus?.type === 'release' ? '⏳ Building...' : '🚀 Build Release'}
            </button>
          </div>

          {building && buildStatus && (
            <div className="build-status">
              <h3>Build Status: {buildStatus.type}</h3>
              <div className="build-log">
                {buildStatus.log && buildStatus.log.map((line, i) => (
                  <div key={i} className="log-line">{line}</div>
                ))}
              </div>
              {buildStatus.inProgress && (
                <div className="build-progress">
                  <div className="spinner"></div>
                  <span>Building in progress...</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
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
          <a href="/tetra-overflow/">← Back to Game</a>
        </div>
      </div>
    </div>
  );
}
