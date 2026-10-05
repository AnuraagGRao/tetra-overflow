import { motion, AnimatePresence } from 'framer-motion'
import SettingsPage from '../SettingsPage'

export default function SettingsModal({ isOpen = false, config, onConfig, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 250,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2rem',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            boxSizing: 'border-box',
          }}
        >
          <SettingsPage config={config} onConfig={onConfig} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
