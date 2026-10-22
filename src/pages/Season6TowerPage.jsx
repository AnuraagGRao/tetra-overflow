import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import BackgroundCanvas from '../components/BackgroundCanvas'
import StoryMapHUD from '../components/StoryMapHUD'
import { useAuth } from '../contexts/AuthContext'
import { getStoryProgress } from '../firebase/db'
import { TOWER_STRATA, loadTowerRecord } from '../logic/storyData_s6'
import { playBack, playTap } from '../audio/uiSfx'

export default function Season6TowerPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [record, setRecord] = useState(loadTowerRecord)
  const [selectedStrata, setSelectedStrata] = useState(TOWER_STRATA[0])

  useEffect(() => {
    setRecord(loadTowerRecord())
    if (user?.uid) {
      getStoryProgress(user.uid).then(p => {
        if (p?.s6_highest_floor) {
          setRecord(prev => ({
            ...prev,
            highestFloor: Math.max(prev.highestFloor || 1, p.s6_highest_floor),
            bestScore: Math.max(prev.bestScore || 0, p.s6_best_score || 0),
          }))
        }
      }).catch(() => {})
    }
  }, [user])

  const handleStartClimb = () => {
    playTap()
    navigate('/s6/climb')
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#030712',
      color: '#f8fafc',
      fontFamily: '"Courier New", monospace',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Dynamic Background */}
      <BackgroundCanvas bgType={selectedStrata.bgType} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* Top HUD */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <StoryMapHUD
          title="SEASON 6 · THE ZENITH PROTOCOL"
          onBack={() => { playBack(); navigate('/seasons') }}
        />
      </div>

      {/* Main Content Area */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 20px 40px',
        gap: 20,
        boxSizing: 'border-box',
      }}>
        {/* Monolith Header Card */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            width: 'min(100%, 720px)',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 12,
            padding: '20px 24px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 24px rgba(56, 189, 248, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#38bdf8', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                INFINITE ASCENT ENGINE
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', letterSpacing: '0.08em', marginTop: 2 }}>
                THE ZENITH MONOLITH
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: 16,
              background: 'rgba(2, 6, 23, 0.7)',
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div>
                <div style={{ fontSize: '0.55rem', color: '#94a3b8', letterSpacing: '0.1em' }}>HIGHEST FLOOR</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8' }}>
                  F{String(record.highestFloor || 1).padStart(2, '0')}
                </div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div style={{ fontSize: '0.55rem', color: '#94a3b8', letterSpacing: '0.1em' }}>RECORD SCORE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b' }}>
                  {(record.bestScore || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            Scale the infinite monolithic tower inspired by TETR.IO Zenith. As you climb, gravity surges, atmospheric pressure intensifies, and soundtracks cross-fade dynamically between each strata layer. Tetrises and T-Spins delay rising garbage surges.
          </p>

          <button
            type="button"
            onClick={handleStartClimb}
            style={{
              marginTop: 6,
              padding: '14px 28px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              border: 'none',
              color: '#020617',
              fontSize: '0.85rem',
              fontWeight: 900,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 4px 20px rgba(56, 189, 248, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>⏏ INITIATE ZENITH ASCENT</span>
          </button>
        </motion.div>

        {/* Strata Layers Grid */}
        <div style={{ width: 'min(100%, 720px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            ATMOSPHERIC STRATA PROFILES ({TOWER_STRATA.length} LAYERS)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {TOWER_STRATA.map((strata) => {
              const isCurrent = (record.highestFloor || 1) >= strata.minFloor
              const isSelected = selectedStrata.tier === strata.tier

              return (
                <motion.div
                  key={strata.tier}
                  whileHover={{ scale: 1.015 }}
                  onClick={() => { playTap(); setSelectedStrata(strata) }}
                  style={{
                    background: isSelected ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.75)',
                    border: `1px solid ${isSelected ? strata.color : isCurrent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 10,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 0 20px ${strata.color}33` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: '0.6rem',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: `${strata.color}22`,
                        color: strata.color,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                      }}>
                        {strata.badge}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700 }}>
                        FLOORS {strata.minFloor}–{strata.maxFloor === 99999 ? '∞' : strata.maxFloor}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.6rem', color: strata.color, letterSpacing: '0.1em' }}>
                      {strata.gravityMult.toFixed(1)}× GRAVITY
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>
                      {strata.name}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2 }}>
                      {strata.subtitle}
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b', lineHeight: 1.5 }}>
                    {strata.lore}
                  </p>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: 6,
                    marginTop: 2,
                    fontSize: '0.58rem',
                    color: '#94a3b8',
                  }}>
                    <span>SURGE: EVERY {Math.round(strata.garbageIntervalMs / 1000)}s</span>
                    <span style={{ color: strata.color }}>THEME: {strata.pieceTheme.toUpperCase()}</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
