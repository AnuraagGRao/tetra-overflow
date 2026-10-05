import { motion } from 'framer-motion'

export default function RewindGauge({ fill = 0, ready = false, onActivate = () => {} }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: ready ? 1.05 : 1 }}
      whileTap={{ scale: ready ? 0.95 : 1 }}
      onClick={() => {
        if (ready) onActivate()
      }}
      disabled={!ready}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: ready ? 'rgba(100,180,255,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${ready ? '#64b4ff' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8,
        padding: '5px 9px',
        cursor: ready ? 'pointer' : 'default',
        fontFamily: 'inherit',
        boxShadow: ready ? '0 0 12px rgba(100,180,255,0.35)' : 'none',
        transition: 'all 0.2s',
      }}
      title="REWIND (Press R)"
    >
      <div
        style={{
          fontSize: '0.48rem',
          letterSpacing: '0.18em',
          color: ready ? '#64b4ff' : '#666',
          fontWeight: 700,
        }}
      >
        ⏪ REWIND
      </div>
      <div
        style={{
          width: 44,
          height: 3,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{ height: '100%', borderRadius: 2, background: ready ? '#64b4ff' : '#335577' }}
          animate={{ width: `${Math.min(100, fill * 100)}%` }}
          transition={{ duration: 0.15 }}
        />
      </div>
    </motion.button>
  )
}
