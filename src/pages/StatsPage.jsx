import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getUserStats, getLeaderboard } from '../firebase/db'
import { GAME_MODE } from '../logic/gameEngine'

const MODES = [
  { key: GAME_MODE.NORMAL,  label: 'NORMAL',  color: '#00d4ff' },
  { key: GAME_MODE.SPRINT,  label: 'SPRINT',  color: '#22c55e' },
  { key: GAME_MODE.BLITZ,   label: 'BLITZ',   color: '#f97316' },
  { key: GAME_MODE.PURIFY,  label: 'PURIFY',  color: '#a855f7' },
]

function StatCard({ label, value, sub, color = '#00d4ff' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color, letterSpacing: '0.04em' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: '#555' }}>{sub}</div>}
    </motion.div>
  )
}

function BarChart({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: 3 }}
      />
    </div>
  )
}

function BestScoreRow({ mode, score, max }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.7rem', color: mode.color, letterSpacing: '0.14em' }}>{mode.label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eee' }}>{(score || 0).toLocaleString()}</span>
      </div>
      <BarChart value={score || 0} max={max} color={mode.color} />
    </div>
  )
}

export default function StatsPage() {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const [stats, setStats] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [lbMode, setLbMode] = useState(GAME_MODE.NORMAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      getUserStats(user.uid),
      getLeaderboard(lbMode, 10),
    ]).then(([s, lb]) => {
      setStats(s)
      setLeaderboard(lb)
      setLoading(false)
    })
  }, [user, lbMode])

  const displayName = userProfile?.displayName || user?.displayName || 'Player'
  const bestScores = MODES.map(m => ({ ...m, score: stats?.[`best_${m.key}`] || 0 }))
  const maxBest = Math.max(...bestScores.map(m => m.score), 1)

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a14', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace', color: '#fff' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.14em', fontFamily: 'inherit', padding: 0 }}>
          ← MENU
        </button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '0.2em', color: '#eab308' }}>STATS</h1>
        <div style={{ width: 60 }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.4rem' }}>
        {loading ? (
          <div style={{ color: '#555', fontSize: '0.8rem', letterSpacing: '0.16em', textAlign: 'center', padding: '3rem' }}>LOADING…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 640, margin: '0 auto' }}>
            {/* Player card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1.2rem' }}
            >
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4ff,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900, flexShrink: 0 }}>
                {displayName[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em' }}>{displayName}</div>
                <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 3, letterSpacing: '0.12em' }}>
                  {stats?.totalGames || 0} GAMES PLAYED
                </div>
              </div>
            </motion.div>

            {/* Overview grid */}
            <div>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: '#555', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                <StatCard label="Total Score" value={(stats?.totalScore || 0).toLocaleString()} color="#00d4ff" />
                <StatCard label="Total Lines" value={(stats?.totalLines || 0).toLocaleString()} color="#a855f7" />
                <StatCard label="Games" value={stats?.totalGames || 0} color="#f97316" />
                <StatCard label="Coins Earned" value={(userProfile?.coins || 0).toLocaleString()} color="#eab308" sub="current balance" />
              </div>
            </div>

            {/* Best scores */}
            <div>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: '#555', marginBottom: '0.75rem' }}>Best Scores by Mode</div>
              <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {bestScores.map(m => <BestScoreRow key={m.key} mode={m} score={m.score} max={maxBest} />)}
              </div>
            </div>

            {/* Leaderboard */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: '#555' }}>Global Leaderboard</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {MODES.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setLbMode(m.key)}
                      style={{ background: lbMode === m.key ? `${m.color}22` : 'none', border: `1px solid ${lbMode === m.key ? m.color : 'rgba(255,255,255,0.1)'}`, color: lbMode === m.key ? m.color : '#555', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '0.6rem', letterSpacing: '0.1em', fontFamily: 'inherit', textTransform: 'uppercase' }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                {leaderboard.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.72rem', color: '#555', letterSpacing: '0.1em' }}>NO SCORES YET</div>
                ) : leaderboard.map((entry, i) => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', gap: 12 }}>
                    <span style={{ width: 20, fontSize: '0.7rem', fontWeight: 700, color: i === 0 ? '#eab308' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#555', flexShrink: 0 }}>#{i + 1}</span>
                    <span style={{ flex: 1, fontSize: '0.78rem', color: entry.uid === user?.uid ? '#00d4ff' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.uid === user?.uid ? displayName : `player_${entry.uid.slice(0, 5)}`}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eee' }}>{entry.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
