import { useEffect } from 'react'

export default function ZoomControl({ zoom, onChange }) {
  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault()
      const delta = event.deltaY < 0 ? 0.05 : -0.05
      onChange(Math.max(0.5, Math.min(2, Math.round((zoom + delta) * 100) / 100)))
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [onChange, zoom])

  return (
    <label
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 180,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.78)',
        border: '1px solid rgba(255,255,255,0.22)',
        borderRadius: 7,
        color: '#ccc',
        fontFamily: 'monospace',
        fontSize: '0.62rem',
        letterSpacing: '0.08em',
        backdropFilter: 'blur(8px)',
      }}
      title="Use Ctrl + mouse wheel or the slider to change zoom"
    >
      <span>ZOOM</span>
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.05"
        value={zoom}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Board zoom"
        style={{ width: 'clamp(90px, 18vw, 170px)', accentColor: '#00d4ff' }}
      />
      <output style={{ minWidth: 38, textAlign: 'right', color: '#fff' }}>{Math.round(zoom * 100)}%</output>
    </label>
  )
}
