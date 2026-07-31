import { Component } from 'react'

/**
 * Error Boundary to catch and handle React component errors
 * Prevents the entire app from crashing due to component errors
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('React Error Boundary caught:', error, errorInfo)
    
    // You can also log the error to an error reporting service here
    // Example: errorTrackingService.logError(error, errorInfo)
    
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          background: '#0a0a12',
          color: '#fff',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '500px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '2rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              marginBottom: '1rem',
              color: '#ff6b9d'
            }}>
              Oops! Something went wrong
            </h2>
            
            <p style={{
              marginBottom: '1.5rem',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.6
            }}>
              The game encountered an unexpected error. You can try reloading the page or clearing your cache.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details style={{
                marginBottom: '1.5rem',
                textAlign: 'left',
                background: 'rgba(0,0,0,0.3)',
                padding: '1rem',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                  Error Details (Dev Mode)
                </summary>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#ff6b6b',
                  margin: 0
                }}>
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  background: '#00d4ff',
                  color: '#0a0a12',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Reload Game
              </button>
              
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
