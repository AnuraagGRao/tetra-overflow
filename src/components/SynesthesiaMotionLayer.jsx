import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { SYNESTHESIA_EVENT, useSynesthesiaEvent } from '../logic/synesthesiaBus'

const FLASH_BY_EVENT = {
  [SYNESTHESIA_EVENT.MOVE]:      { color: 'rgba(80, 220, 255, 0.12)', duration: 0.16 },
  [SYNESTHESIA_EVENT.ROTATE]:    { color: 'rgba(168, 85, 247, 0.16)', duration: 0.2 },
  [SYNESTHESIA_EVENT.SOFT_DROP]: { color: 'rgba(34, 211, 238, 0.1)', duration: 0.15 },
  [SYNESTHESIA_EVENT.HARD_DROP]: { color: 'rgba(255, 244, 173, 0.24)', duration: 0.24 },
  [SYNESTHESIA_EVENT.LINE_CLEAR]: { color: 'rgba(128, 255, 231, 0.26)', duration: 0.42 },
  [SYNESTHESIA_EVENT.T_SPIN]:    { color: 'rgba(220, 170, 255, 0.32)', duration: 0.5 },
}

function runBurst(controls, type, intensity = 1) {
  const i = Math.max(0.65, Math.min(1.7, intensity || 1))
  if (type === SYNESTHESIA_EVENT.HARD_DROP) {
    const s = i * 1.5
    controls.start({
      scale: [1, 1 + 0.018 * s, 0.996, 1],
      x: [0, -2.8 * s, 2.8 * s, -1.6 * s, 0.8 * s, 0],
      y: [0, -1.9 * s, 0.8 * s, -0.35 * s, 0],
      rotate: [0, -0.28 * s, 0.22 * s, -0.12 * s, 0],
      filter: ['brightness(1)', `brightness(${1 + 0.12 * s}) saturate(${1 + 0.18 * s})`, 'brightness(1) saturate(1)'],
      transition: { duration: 0.26, times: [0, 0.28, 0.56, 0.82, 1], ease: 'easeOut' },
    })
    return
  }

  if (type === SYNESTHESIA_EVENT.LINE_CLEAR || type === SYNESTHESIA_EVENT.T_SPIN) {
    const glow = type === SYNESTHESIA_EVENT.T_SPIN ? 0.22 : 0.16
    controls.start({
      scale: [1, 1 + 0.006 * i, 1],
      filter: ['brightness(1) saturate(1)', `brightness(${1 + glow * i}) saturate(${1 + 0.26 * i})`, 'brightness(1) saturate(1)'],
      transition: { duration: type === SYNESTHESIA_EVENT.T_SPIN ? 0.58 : 0.46, times: [0, 0.45, 1], ease: 'easeOut' },
    })
    return
  }

  if (type === SYNESTHESIA_EVENT.ROTATE) {
    controls.start({
      scale: [1, 1.006 * i, 1],
      rotate: [0, -0.2 * i, 0],
      transition: { duration: 0.2, ease: 'easeOut' },
    })
    return
  }

  if (type === SYNESTHESIA_EVENT.MOVE || type === SYNESTHESIA_EVENT.SOFT_DROP) {
    controls.start({
      x: [0, (type === SYNESTHESIA_EVENT.MOVE ? 1.6 : 0) * i, 0],
      y: [0, (type === SYNESTHESIA_EVENT.SOFT_DROP ? 1.8 : 0) * i, 0],
      transition: { duration: 0.14, ease: 'easeOut' },
    })
  }
}

export default function SynesthesiaMotionLayer({ children, className, style, enabled = true }) {
  const controls = useAnimationControls()
  const flashIdRef = useRef(0)
  const [flash, setFlash] = useState(null)

  const onEvent = useCallback((evt) => {
    if (!enabled || !evt?.type) return
    const intensity = evt?.payload?.intensity ?? 1
    runBurst(controls, evt.type, intensity)

    const cfg = FLASH_BY_EVENT[evt.type]
    if (!cfg) return
    const id = ++flashIdRef.current
    setFlash({ id, ...cfg, intensity })
  }, [controls, enabled])

  useSynesthesiaEvent(onEvent)

  return (
    <motion.div className={className} style={{ position: 'relative', ...style }} animate={controls}>
      {children}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.75 * Math.min(1.1, flash.intensity), 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: flash.duration, times: [0, 0.2, 1], ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 47,
              background: `radial-gradient(circle at 50% 45%, ${flash.color} 0%, rgba(255,255,255,0.02) 55%, rgba(0,0,0,0) 100%)`,
              mixBlendMode: 'screen',
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
