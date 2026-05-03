
import { useEffect, useMemo, useState } from 'react'
import { loadDailyEconomyState, saveDailyEconomyState, getDailyCountdownMs, CHALLENGE_POOL } from '../logic/economy'
import { useAuth } from '../contexts/AuthContext'
import { addCoinsWithLedger } from '../firebase/db'


function fmtCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Helper: Get today's key for free reroll tracking
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `challenge-free-changes-${y}-${m}-${d}`
}

export default function DailyChallengesMenu() {

  const { user, userProfile, refreshProfile } = useAuth();
  const [state, setState] = useState(() => loadDailyEconomyState(Date.now()));
  const [leftMs, setLeftMs] = useState(() => getDailyCountdownMs());
  const [message, setMessage] = useState("");

  // Free change tracker in localStorage (per slot)
  const todayKey = getTodayKey();
  const [freeChange, setFreeChange] = useState(() => {
    try {
      const raw = localStorage.getItem(todayKey)
      return raw ? JSON.parse(raw) : [false, false, false]
    } catch { return [false, false, false]; }
  });

  // UI auto-refresh for challenge state/free tracker
  useEffect(() => {
    const id = setInterval(() => {
      setState(loadDailyEconomyState(Date.now()));
      setLeftMs(getDailyCountdownMs());
      try {
        const raw = localStorage.getItem(todayKey)
        setFreeChange(raw ? JSON.parse(raw) : [false, false, false])
      } catch {}
    }, 1000)
    return () => clearInterval(id)
  }, [todayKey])

  const completed = useMemo(() => (state.challenges || []).filter(c => c.completed).length, [state]);

  // Challenge change handler
  async function handleChangeChallenge(idx) {
    setMessage("");
    // Is free?
    const alreadyUsedFree = !!freeChange[idx];
    // If not free, check coins
    if (alreadyUsedFree) {
      if (!userProfile || (userProfile.coins ?? 0) < 50) {
        setMessage("Not enough coins! (50 needed)");
        return;
      }
    }

    // Old challenge id
    const currentId = state.challenges[idx]?.id;
    // Get pool of all IDs not currently in use (never pick current one, nor any already-active)
    const usedIds = new Set((state.challenges || []).map(c => c.id));
    usedIds.delete(currentId);
    const available = CHALLENGE_POOL.filter(c => !usedIds.has(c.id));
    let pool = available.length > 0 ? available : CHALLENGE_POOL.filter(c => c.id !== currentId);
    if(pool.length === 0) {
      setMessage("No available challenge to swap in!");
      return;
    }
    // Pick new challenge randomly
    const newC = pool[Math.floor(Math.random()*pool.length)];
    // Substitute in state
    const newChallenges = [...(state.challenges || [])];
    newChallenges[idx] = {
      ...newC,
      progress: 0,
      completed: false,
      claimed: false,
    };
    // Update freeChange array
    const newFreeChange = [...freeChange];
    if (!alreadyUsedFree) newFreeChange[idx] = true;

    // Save in daily economy state
    const newState = { ...state, challenges: newChallenges };
    saveDailyEconomyState(newState);
    setState(newState);

    // Save free change usage
    try { localStorage.setItem(todayKey, JSON.stringify(newFreeChange)); } catch {}
    setFreeChange(newFreeChange);

    // Deduct coins if not free
    if (alreadyUsedFree && user && userProfile) {
      try {
        await addCoinsWithLedger(user.uid, -50, { source: 'reroll_challenge', challengeChanged: currentId, newChallenge: newC.id });
        await refreshProfile(); // Refresh coins
      } catch (err) {
        setMessage("Could not deduct coins: " + (err?.message || "error"));
      }
    }
    setMessage("Challenge changed!");
  }

  return (
    <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: '0.66rem', letterSpacing: '0.2em', color: '#22c55e' }}>DAILY CHALLENGES</div>
        <div style={{ fontSize: '0.58rem', color: '#666', letterSpacing: '0.08em' }}>Resets in {fmtCountdown(leftMs)}</div>
      </div>

      <div style={{ marginBottom: 8, fontSize: '0.58rem', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Skill tier: {String(state.skillBracket || 'beginner')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(state.challenges || []).map((ch, idx) => {
          const pct = Math.max(0, Math.min(100, ((ch.progress || 0) / Math.max(1, ch.target || 1)) * 100));
          const isFree = !freeChange[idx];
          const disableBtn = ch.completed;
          return (
            <div key={ch.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${ch.completed ? '#22c55e55' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: '0.72rem', color: '#ddd', letterSpacing: '0.02em' }}>{ch.label}</div>
                <div style={{ fontSize: '0.62rem', color: ch.completed ? '#22c55e' : '#eab308', whiteSpace: 'nowrap' }}>+{ch.reward || 150} coins</div>
              </div>
              <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: ch.completed ? '#22c55e' : '#00d4ff', transition: 'width 0.22s ease' }} />
              </div>
              <div style={{ marginTop: 5, fontSize: '0.58rem', color: '#666', letterSpacing: '0.06em' }}>
                {Math.min(ch.progress || 0, ch.target || 0)} / {ch.target}
              </div>
              {/* Change challenge button (disabled if completed) */}
              <button
                style={{
                  marginTop: 6,
                  fontSize: '0.63rem',
                  padding: '5px 11px',
                  borderRadius: 7,
                  border: '1px solid #eab308',
                  color: disableBtn ? '#7e7e7e' : isFree ? '#eab308' : '#fff',
                  background: disableBtn ? 'rgba(0,0,0,0.09)' : isFree ? 'rgba(234,179,8,0.08)' : '#202c14',
                  cursor: disableBtn ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  marginRight: 8,
                  transition: 'all 0.15s',
                  outline: 'none',
                  minWidth: 74
                }}
                disabled={disableBtn}
                onClick={() => handleChangeChallenge(idx)}
              >
                {isFree ? 'Change' : 'Change (50◆)'}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 8, fontSize: '0.58rem', color: '#555', letterSpacing: '0.1em' }}>
        {completed}/3 completed today
      </div>

      {message && (
        <div style={{ marginTop: 10, color: message.startsWith('Challenge changed!') ? '#22c55e' : '#f87171', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.07em' }}>{message}</div>
      )}
    </div>
  )
}
