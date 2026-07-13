import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BackgroundCanvas from '../components/BackgroundCanvas'
import StoryMapHUD from '../components/StoryMapHUD'
import { useAuth } from '../contexts/AuthContext'
import { getStoryProgress } from '../firebase/db'
import { PANTHEON_BOSSES, isPantheonLevelUnlocked, isPantheonUnlocked, isS5Complete } from '../logic/storyData_s5'
import { playBack, playTap, playZoomIn } from '../audio/uiSfx'

function EncounterDialog({ boss, completed, onClose, onPlay }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 10 }}
      onClick={event => event.stopPropagation()}
      style={{ width: 'min(92vw, 390px)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, border: `1px solid ${boss.color}77`, borderRadius: 8, background: 'rgba(7,8,13,0.97)', boxShadow: `0 20px 80px rgba(0,0,0,0.7), 0 0 34px ${boss.color}22`, fontFamily: '"Courier New", monospace' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ color: boss.color, fontSize: '2.8rem', lineHeight: 1, filter: `drop-shadow(0 0 12px ${boss.glowColor})` }}>{boss.glyph}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: boss.color, fontSize: '0.5rem', letterSpacing: '0.24em' }}>SEASON 5 · DIVINE ENCOUNTER</div>
          <div style={{ marginTop: 4, color: '#fff', fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.08em' }}>{boss.name.toUpperCase()}</div>
          <div style={{ marginTop: 2, color: '#777', fontSize: '0.64rem' }}>{boss.subtitle}</div>
        </div>
        {completed && <div style={{ marginLeft: 'auto', color: boss.color, fontSize: '1.3rem' }}>✦</div>}
      </div>

      <p style={{ margin: 0, paddingLeft: 10, borderLeft: `2px solid ${boss.color}66`, color: '#b8bbc4', fontSize: '0.7rem', fontStyle: 'italic', lineHeight: 1.65 }}>
        “{boss.storyBefore}”
      </p>

      <div style={{ padding: '10px 12px', borderTop: `1px solid ${boss.color}33`, borderBottom: `1px solid ${boss.color}33`, background: `${boss.color}0c` }}>
        <div style={{ color: boss.color, fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.2em' }}>{boss.abilityLabel}</div>
        <div style={{ marginTop: 5, color: '#9498a2', fontSize: '0.65rem', lineHeight: 1.55 }}>{boss.abilityDesc}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#686b74', fontSize: '0.56rem', letterSpacing: '0.1em' }}>
        <span>{boss.targetLines} LINES</span>
        <span>{boss.bpm} BPM</span>
        <span>{boss.gravityMult.toFixed(2)}× GRAVITY</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px', gap: 8 }}>
        <button onClick={() => { playTap(); onPlay() }} style={{ minHeight: 42, border: 'none', borderRadius: 6, background: boss.color, color: '#05060a', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.16em' }}>
          {completed ? 'REMATCH' : 'ASCEND'}
        </button>
        <button onClick={onClose} aria-label="Close encounter" title="Close" style={{ border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
      </div>
    </motion.div>
  )
}

export default function PantheonMapPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!user?.uid) return
    getStoryProgress(user.uid)
      .then(value => setProgress(value || {}))
      .catch(error => {
        console.error('Failed to load Pantheon progress:', error)
        setProgress({})
      })
      .finally(() => setLoading(false))
  }, [user])

  const seasonUnlocked = useMemo(() => isPantheonUnlocked(progress), [progress])
  const completedCount = useMemo(() => PANTHEON_BOSSES.filter(boss => progress[`pantheon_${boss.id}_completed`]).length, [progress])
  const seasonComplete = useMemo(() => isS5Complete(progress), [progress])
  const currentBoss = useMemo(() => PANTHEON_BOSSES.find(boss => isPantheonLevelUnlocked(boss.id, progress) && !progress[`pantheon_${boss.id}_completed`]) ?? PANTHEON_BOSSES.at(-1), [progress])
  const selectedBoss = PANTHEON_BOSSES.find(boss => boss.id === selectedId) ?? null

  useEffect(() => {
    if (!loading && seasonUnlocked && currentBoss) setSelectedId(currentBoss.id)
  }, [currentBoss, loading, seasonUnlocked])

  if (loading) {
    return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#05060a', color: '#b99b55', fontFamily: 'monospace', letterSpacing: '0.2em' }}>SUMMONING THE PANTHEON…</div>
  }

  if (!seasonUnlocked) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: '#05060a', color: '#fff', fontFamily: '"Courier New", monospace', textAlign: 'center' }}>
        <div>
          <div style={{ color: '#f0c96a', fontSize: '2.8rem' }}>Ω</div>
          <div style={{ marginTop: 12, fontWeight: 900, letterSpacing: '0.14em' }}>THE PANTHEON IS SEALED</div>
          <div style={{ marginTop: 8, color: '#777', fontSize: '0.7rem' }}>Complete the Genesis Protocol to approach the divine gates.</div>
          <button onClick={() => navigate('/s4')} style={{ marginTop: 20, padding: '9px 18px', border: '1px solid #a78bfa', borderRadius: 6, background: 'transparent', color: '#a78bfa', cursor: 'pointer', font: 'inherit' }}>← SEASON 4</button>
        </div>
      </div>
    )
  }

  return (
    <StoryMapHUD
      onHome={() => { playBack(); navigate('/seasons') }}
      onPreviousSeason={() => { playBack(); navigate('/s4') }}
      previousSeasonName="S4"
      onNextSeason={null}
      nextSeasonName="S6"
      seasonTitle="SEASON 5"
      seasonSubtitle="THE PANTHEON ARC"
      seasonColor="#f0c96a"
      currentProgress={completedCount}
      totalProgress={PANTHEON_BOSSES.length}
    >
      <div onClick={() => setSelectedId(null)} style={{ position: 'relative', minHeight: '100dvh', overflow: 'hidden', background: '#05060a', color: '#fff', fontFamily: '"Courier New", monospace' }}>
        <BackgroundCanvas bgType="prismatic_void" />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 52%, rgba(240,201,106,0.1), transparent 38%), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: 'auto, 34px 34px, 34px 34px', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', inset: '88px 0 48px', overflowY: 'auto', padding: '20px clamp(16px, 5vw, 64px) 48px' }}>
          <div style={{ width: 'min(920px, 100%)', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            {PANTHEON_BOSSES.map((boss, index) => {
              const unlocked = isPantheonLevelUnlocked(boss.id, progress)
              const completed = !!progress[`pantheon_${boss.id}_completed`]
              const active = currentBoss?.id === boss.id
              return (
                <div key={boss.id} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', gap: 14, minHeight: 90 }}>
                  {index < PANTHEON_BOSSES.length - 1 && <div style={{ position: 'absolute', left: 25, top: 48, bottom: -8, width: 2, background: completed ? `linear-gradient(${boss.color}, ${PANTHEON_BOSSES[index + 1].color})` : 'rgba(255,255,255,0.08)' }} />}
                  <motion.button
                    whileHover={unlocked ? { scale: 1.08 } : undefined}
                    whileTap={unlocked ? { scale: 0.94 } : undefined}
                    onClick={event => { event.stopPropagation(); if (unlocked) { playZoomIn(); setSelectedId(boss.id) } }}
                    disabled={!unlocked}
                    aria-label={`${boss.name}${unlocked ? '' : ' locked'}`}
                    style={{ position: 'relative', zIndex: 2, width: 52, height: 52, display: 'grid', placeItems: 'center', border: `1px solid ${unlocked ? boss.color : '#343741'}`, borderRadius: '50%', background: completed ? boss.color : active ? `${boss.color}22` : '#0b0c12', color: completed ? '#05060a' : unlocked ? boss.color : '#444751', cursor: unlocked ? 'pointer' : 'default', fontSize: '1.25rem', boxShadow: active ? `0 0 24px ${boss.color}66` : 'none' }}
                  >
                    {unlocked ? boss.glyph : '×'}
                  </motion.button>
                  <button
                    onClick={event => { event.stopPropagation(); if (unlocked) { playZoomIn(); setSelectedId(boss.id) } }}
                    disabled={!unlocked}
                    style={{ alignSelf: 'start', minHeight: 52, padding: '8px 12px', border: 'none', borderBottom: `1px solid ${unlocked ? `${boss.color}44` : 'rgba(255,255,255,0.06)'}`, background: 'transparent', color: unlocked ? '#fff' : '#4a4d56', cursor: unlocked ? 'pointer' : 'default', textAlign: 'left', font: 'inherit' }}
                  >
                    <span style={{ display: 'block', color: unlocked ? boss.color : '#4a4d56', fontSize: '0.48rem', letterSpacing: '0.18em' }}>THRONE {String(index + 1).padStart(2, '0')} {completed ? '· DEFEATED' : active ? '· CURRENT' : ''}</span>
                    <span style={{ display: 'block', marginTop: 5, fontSize: '0.82rem', fontWeight: 900, letterSpacing: '0.08em' }}>{boss.name.toUpperCase()}</span>
                    <span style={{ display: 'block', marginTop: 2, color: unlocked ? '#777b85' : '#3e4149', fontSize: '0.57rem' }}>{boss.subtitle}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center', padding: 16, pointerEvents: selectedBoss ? 'auto' : 'none', background: selectedBoss ? 'rgba(0,0,0,0.58)' : 'transparent' }}>
          <AnimatePresence>
            {selectedBoss && (
              <EncounterDialog
                boss={selectedBoss}
                completed={!!progress[`pantheon_${selectedBoss.id}_completed`]}
                onClose={() => setSelectedId(null)}
                onPlay={() => navigate(`/s5/${selectedBoss.id}`)}
              />
            )}
          </AnimatePresence>
        </div>

        {seasonComplete && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, padding: 10, borderTop: '1px solid rgba(240,201,106,0.3)', background: 'rgba(5,6,10,0.9)', color: '#f0c96a', textAlign: 'center', fontSize: '0.56rem', letterSpacing: '0.22em' }}>THE DIVINE ORDER HAS FALLEN · SEASON 6 COMING SOON</div>}
      </div>
    </StoryMapHUD>
  )
}