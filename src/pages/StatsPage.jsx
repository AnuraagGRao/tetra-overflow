import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getUserStats, getLeaderboard, getCoinHistory } from '../firebase/db'
import { GAME_MODE } from '../logic/gameEngine'

// Include all solo modes (excluding multiplayer/versus)
const MODES = [
  { key: GAME_MODE.NORMAL,   label: 'NORMAL',   color: '#00d4ff' },
  { key: GAME_MODE.SPRINT,   label: 'SPRINT',   color: '#22c55e' },
  { key: GAME_MODE.BLITZ,    label: 'BLITZ',    color: '#f97316' },
  { key: GAME_MODE.MASTER,   label: 'MASTER',   color: '#eab308' },
  { key: GAME_MODE.PURIFY,   label: 'PURIFY',   color: '#a855f7' },
  { key: GAME_MODE.ULTIMATE, label: 'ULTIMATE', color: '#ef4444' },
  { key: 'story',            label: 'STORY',    color: '#ffd700' },
  // ZEN is endless and does not auto-submit scores; included for completeness
  { key: GAME_MODE.ZEN,      label: 'ZEN',      color: '#60a5fa' },
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
  const [lbLimit, setLbLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 420 : false))
  const [coinHistory, setCoinHistory] = useState([])

  // Responsive flag for very small screens to avoid horizontal overflow
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 420)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!user) return
    Promise.all([
      getUserStats(user.uid),
      getLeaderboard(lbMode, lbLimit),
      getCoinHistory(user.uid, 25),
    ]).then(([s, lb, hist]) => {
      setStats(s)
      setLeaderboard(lb)
      setCoinHistory(hist)
      setLoading(false)
    })
  }, [user, lbMode, lbLimit])

  const displayName = userProfile?.displayName || user?.displayName || 'Player'
  const bestScores = MODES.map(m => ({ ...m, score: stats?.[`best_${m.key}`] || 0 }))
  const maxBest = Math.max(...bestScores.map(m => m.score), 1)

  const relTime = (d) => {
    if (!d) return ''
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    const m = Math.floor(diff / 60); if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
    const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div style={{ height: '100dvh', background: '#0a0a14', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace', color: '#fff', position: 'fixed', inset: 0, overflow: 'hidden', touchAction: 'pan-y' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.14em', fontFamily: 'inherit', padding: 0 }}>
          ← MENU
        </button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '0.2em', color: '#eab308' }}>STATS</h1>
        <div style={{ width: 60 }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1.4rem', maxWidth: '100%', contain: 'content' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: '#555', flexShrink: 0 }}>Global Leaderboard</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', padding: '2px 0', scrollbarWidth: 'none' }}>
                      {MODES.map(m => (
                        <button
                          key={m.key}
                          onClick={() => { setLbMode(m.key); setLbLimit(10) }}
                          style={{ flex: '0 0 auto', background: lbMode === m.key ? `${m.color}22` : 'none', border: `1px solid ${lbMode === m.key ? m.color : 'rgba(255,255,255,0.1)'}`, color: lbMode === m.key ? m.color : '#555', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '0.6rem', letterSpacing: '0.1em', fontFamily: 'inherit', textTransform: 'uppercase' }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setLbLimit(l => (l === 10 ? 25 : 10))} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: '#888', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.6rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>{lbLimit === 10 ? 'Show Top 25' : 'Show Top 10'}</button>
                </div>
              </div>
              <div style={{ background: '#0f1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', maxWidth: '100%' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: narrow ? '32px minmax(0,1fr) auto' : '40px minmax(0,1fr) 110px 80px 86px', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.60rem', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  <div>#</div>
                  <div style={{ minWidth: 0 }}>Player</div>
                  <div style={{ textAlign: 'right' }}>Score</div>
                  {!narrow && <div style={{ textAlign: 'right' }}>Lines</div>}
                  {!narrow && <div style={{ textAlign: 'right' }}>When</div>}
                </div>
                {/* Rows */}
                {leaderboard.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.72rem', color: '#555', letterSpacing: '0.1em' }}>NO SCORES YET</div>
                ) : leaderboard.map((entry, i) => {
                  const isMe = entry.uid === user?.uid
                  const ts = entry.timestamp
                  const dt = ts?.toDate ? ts.toDate() : (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : null)
                  const bg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                  const rankColor = i === 0 ? '#eab308' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#555'
                  const name = isMe ? (userProfile?.displayName || 'You') : `player_${(entry.uid||'').slice(0,5)}`
                  return (
                    <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: narrow ? '32px minmax(0,1fr) auto' : '40px minmax(0,1fr) 110px 80px 86px', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: bg }}>
                      <div style={{ color: rankColor, fontWeight: 700, fontSize: '0.75rem' }}>#{i + 1}</div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: isMe ? '#00d4ff' : '#ddd' }}>
                        {name}
                        {narrow && (
                          <div style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '0.06em', marginTop: 2 }}>
                            L {entry.lines ?? '—'} • {relTime(dt)}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', color: '#eee', fontWeight: 700 }}>{(entry.score||0).toLocaleString()}</div>
                      {!narrow && <div style={{ textAlign: 'right', color: '#aaa' }}>{entry.lines ?? '—'}</div>}
                      {!narrow && <div style={{ textAlign: 'right', color: '#777', fontSize: '0.7rem' }}>{relTime(dt)}</div>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Coin history */}
            <div>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: '#555', margin: '0.75rem 0' }}>Coin History</div>
              <div style={{ background: '#0f1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', maxWidth: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr auto' : '140px 1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.60rem', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {!narrow && <div>When</div>}
                  <div>Source</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                </div>
                {coinHistory.length === 0 ? (
                  <div style={{ padding: '1.2rem', textAlign: 'center', fontSize: '0.72rem', color: '#555', letterSpacing: '0.1em' }}>NO ENTRIES</div>
                ) : coinHistory.map((e, i) => {
                  const isEarn = e.type === 'earn'
                  const when = e.createdAt?.toDate ? e.createdAt.toDate() : (typeof e.createdAt?.seconds === 'number' ? new Date(e.createdAt.seconds * 1000) : null)
                  const label = isEarn ? (e.mode ? `Game — ${String(e.mode).toUpperCase()}${e.score ? ` (${(e.score||0).toLocaleString()} pts)` : ''}` : 'Game') : (e.itemId ? `Store — ${e.itemId}` : 'Store')
                  const bg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                  return (
                    <div key={e.id} style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr auto' : '140px 1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: i < coinHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: bg }}>
                      {!narrow && <div style={{ color: '#777', fontSize: '0.7rem' }}>{relTime(when)}</div>}
                      <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isEarn ? '#22c55e' : '#eab308' }}>{label}</div>
                      <div style={{ textAlign: 'right', fontWeight: 700, color: isEarn ? '#22c55e' : '#eab308' }}>{isEarn ? '+' : '-'}{(e.amount||0).toLocaleString()}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
