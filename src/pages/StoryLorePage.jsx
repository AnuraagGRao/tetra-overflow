import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import BackgroundCanvas from '../components/BackgroundCanvas'
import { STORY_CHAPTERS } from '../logic/storyData'
import homeIconUrl from '../icons/home-button-icon-for-tetris-mobile-game-ui--simple.png'

const CH_BG = (ch) => ch?.levels?.[0]?.bgType || 'abyss'

export default function StoryLorePage() {
  const navigate = useNavigate()
  const chapters = useMemo(() => STORY_CHAPTERS, [])
  const [idx, setIdx] = useState(0)
  const railRef = useRef(null)
  const secRefs = useRef([])
  secRefs.current = chapters.map((_, i) => secRefs.current[i] || createRef())

  useEffect(() => {
    const opts = { root: railRef.current, threshold: 0.52 }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const i = Number(e.target.getAttribute('data-i') || '0')
          setIdx(i)
        }
      })
    }, opts)
    secRefs.current.forEach(ref => { if (ref.current) io.observe(ref.current) })
    return () => io.disconnect()
  }, [chapters])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05050f', color: '#fff', fontFamily: '"Courier New", monospace', overflow: 'hidden' }}>
      {/* Live background follows the chapter in view */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <BackgroundCanvas bgType={CH_BG(chapters[idx])} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.3rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.14em', display: 'flex', alignItems: 'center', gap: 8 }}><img src={homeIconUrl} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} /><span>MENU</span></button>
          <div style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.3em' }}>LORE</div>
          <div style={{ width: 60 }} />
        </header>
        <div ref={railRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', contain: 'content', display: 'flex', scrollSnapType: 'x mandatory', touchAction: 'pan-x' }}>
          {chapters.map((ch, ci) => (
            <section key={ch.id} ref={secRefs.current[ci]} data-i={ci} style={{ position: 'relative', minWidth: '100%', scrollSnapAlign: 'start', padding: '1.1rem', height: '100%', overflowY: 'auto', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
              <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
                style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: '0.58rem', letterSpacing: '0.32em', color: '#888' }}>{`CHAPTER ${ci+1}`}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.14em', color: ch.color }}>{ch.title}</div>
                <div style={{ fontSize: '0.62rem', color: '#555', letterSpacing: '0.08em' }}>— {ch.subtitle}</div>
              </motion.div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.8rem' }}>
                {ch.levels.map((lv, li) => (
                  <motion.div key={`${ch.id}_${lv.id}`} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: 0.03*li }}
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 12, padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', letterSpacing: '0.14em', color: ch.color }}>{lv.title}</div>
                        <div style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '0.12em' }}>{lv.subtitle}</div>
                      </div>
                      <div style={{ fontSize: '0.58rem', color: '#999', letterSpacing: '0.08em' }}>{(lv.targetLines||0)} lines</div>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#ddd', lineHeight: 1.6, letterSpacing: '0.02em' }}>{lv.storyBefore}</div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0.4rem 0' }} />
                    <div style={{ fontSize: '0.65rem', color: '#9ab', lineHeight: 1.6, letterSpacing: '0.02em' }}>{lv.storyAfter}</div>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
