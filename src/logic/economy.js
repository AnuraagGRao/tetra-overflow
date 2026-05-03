const DAILY_ECONOMY_KEY = 'daily-economy-state-v1'
const SKILL_PROFILE_KEY = 'daily-economy-skill-v1'
const MS_24H = 24 * 60 * 60 * 1000

export const CHALLENGE_POOL = [
  // ── Easy (beginner-friendly) ────────────────────────────────────────────────
  { id: 'games_2', metric: 'gamesCompleted', target: 2, label: 'Play 2 games', difficulty: 'easy' },
  { id: 'lines_10', metric: 'lines', target: 10, label: 'Clear 10 lines', difficulty: 'easy' },
  { id: 'survive_60', metric: 'survivalMs', target: 60000, label: 'Survive for 1 minute', difficulty: 'easy' },
  { id: 'score_8k', metric: 'score', target: 8000, label: 'Score 8,000 points', difficulty: 'easy' },
  { id: 'lines_20', metric: 'lines', target: 20, label: 'Clear 20 lines', difficulty: 'easy' },
  { id: 'place_50', metric: 'piecesPlaced', target: 50, label: 'Place 50 blocks', difficulty: 'easy' },
  { id: 'hold_5', metric: 'holdUses', target: 5, label: 'Use the Hold queue 5 times', difficulty: 'easy' },

  // ── Medium ──────────────────────────────────────────────────────────────────
  { id: 'games_4', metric: 'gamesCompleted', target: 4, label: 'Play 4 games', difficulty: 'medium' },
  { id: 'survive_150', metric: 'survivalMs', target: 150000, label: 'Survive for 2.5 minutes', difficulty: 'medium' },
  { id: 'score_40k', metric: 'score', target: 40000, label: 'Score 40,000 points', difficulty: 'medium' },
  { id: 'i_lines_12', metric: 'iPieceLines', target: 12, label: 'Clear 12 lines using I-pieces', difficulty: 'medium' },
  { id: 'lines_35', metric: 'lines', target: 35, label: 'Clear 35 lines', difficulty: 'medium' },
  { id: 'tetris_1', metric: 'tetrisClears', target: 1, label: 'Clear a Tetris (4 lines at once)', difficulty: 'medium' },
  { id: 'place_150', metric: 'piecesPlaced', target: 150, label: 'Place 150 blocks', difficulty: 'medium' },

  // ── Hard (experienced players) ──────────────────────────────────────────────
  { id: 'tspins_2', metric: 'tSpins', target: 2, label: 'Perform 2 T-Spins', difficulty: 'hard' },
  { id: 'tspins_4', metric: 'tSpins', target: 4, label: 'Perform 4 T-Spins', difficulty: 'hard' },
  { id: 'survive_240', metric: 'survivalMs', target: 240000, label: 'Survive for 4 minutes', difficulty: 'hard' },
  { id: 'score_90k', metric: 'score', target: 90000, label: 'Score 90,000 points', difficulty: 'hard' },
  { id: 'lines_60', metric: 'lines', target: 60, label: 'Clear 60 lines', difficulty: 'hard' },
  { id: 'tetris_4', metric: 'tetrisClears', target: 4, label: 'Clear 4 Tetrises', difficulty: 'hard' },
  { id: 'hard_drop_50', metric: 'hardDrops', target: 50, label: 'Perform 50 Hard Drops', difficulty: 'hard' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const num = (v) => Math.max(0, Number(v) || 0)

const getDayKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const shuffle = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const createDefaultSkillProfile = (now = Date.now()) => ({
  gamesPlayed: 0,
  emaScore: 0,
  emaLines: 0,
  emaSurvivalMs: 0,
  emaTSpins: 0,
  emaIPieceLines: 0,
  skillRating: 0,
  skillBracket: 'beginner',
  updatedAt: now,
})

const computeSkillRating = (profile) => {
  const scoreN = clamp(profile.emaScore / 120000, 0, 1)
  const linesN = clamp(profile.emaLines / 45, 0, 1)
  const survivalN = clamp(profile.emaSurvivalMs / 240000, 0, 1)
  const tSpinsN = clamp(profile.emaTSpins / 3, 0, 1)
  const iLinesN = clamp(profile.emaIPieceLines / 20, 0, 1)
  const gamesN = clamp(profile.gamesPlayed / 50, 0, 1)

  const score = (
    scoreN * 0.3 +
    linesN * 0.2 +
    survivalN * 0.2 +
    tSpinsN * 0.15 +
    iLinesN * 0.1 +
    gamesN * 0.05
  ) * 100
  return Math.round(clamp(score, 0, 100))
}

const getSkillBracket = (profile) => {
  if (profile.gamesPlayed < 10) return 'beginner'
  if (profile.skillRating < 35) return 'beginner'
  if (profile.skillRating < 70) return 'intermediate'
  return 'pro'
}

export const loadSkillProfile = (now = Date.now()) => {
  try {
    const raw = localStorage.getItem(SKILL_PROFILE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed) {
      const fresh = createDefaultSkillProfile(now)
      localStorage.setItem(SKILL_PROFILE_KEY, JSON.stringify(fresh))
      return fresh
    }
    return parsed
  } catch {
    const fresh = createDefaultSkillProfile(now)
    try { localStorage.setItem(SKILL_PROFILE_KEY, JSON.stringify(fresh)) } catch {}
    return fresh
  }
}

export const saveSkillProfile = (profile) => {
  try { localStorage.setItem(SKILL_PROFILE_KEY, JSON.stringify(profile)) } catch {}
}

export const updateSkillProfileFromGame = (summary = {}, now = Date.now()) => {
  const profile = loadSkillProfile(now)
  const alpha = 0.2
  const ewma = (prev, next) => prev > 0 ? (prev * (1 - alpha) + next * alpha) : next

  const next = {
    ...profile,
    gamesPlayed: num(profile.gamesPlayed) + 1,
    emaScore: ewma(num(profile.emaScore), num(summary.score)),
    emaLines: ewma(num(profile.emaLines), num(summary.lines)),
    emaSurvivalMs: ewma(num(profile.emaSurvivalMs), num(summary.survivalMs)),
    emaTSpins: ewma(num(profile.emaTSpins), num(summary.tSpins)),
    emaIPieceLines: ewma(num(profile.emaIPieceLines), num(summary.iPieceLines)),
    updatedAt: now,
  }
  next.skillRating = computeSkillRating(next)
  next.skillBracket = getSkillBracket(next)
  saveSkillProfile(next)
  return next
}

const chooseDailyChallenges = (profile) => {
  const easy = CHALLENGE_POOL.filter(c => c.difficulty === 'easy')
  const medium = CHALLENGE_POOL.filter(c => c.difficulty === 'medium')
  const hard = CHALLENGE_POOL.filter(c => c.difficulty === 'hard')

  const picked = []
  const used = new Set()

  const take = (pool, count) => {
    for (const c of shuffle(pool)) {
      if (picked.length >= 3 || count <= 0) break
      if (used.has(c.id)) continue
      picked.push(c)
      used.add(c.id)
      count -= 1
    }
  }

  if (profile.skillBracket === 'beginner') {
    take(easy, 3)
  } else if (profile.skillBracket === 'intermediate') {
    take(medium, 2)
    take(easy, 1)
  } else {
    take(hard, 2)
    take(medium, 1)
  }

  if (picked.length < 3) take(CHALLENGE_POOL, 3 - picked.length)
  return picked.slice(0, 3)
}

const makeChallenge = (tmpl) => ({
  id: tmpl.id,
  metric: tmpl.metric,
  target: tmpl.target,
  reward: 150,
  label: tmpl.label,
  difficulty: tmpl.difficulty || 'easy',
  progress: 0,
  completed: false,
  claimed: false,
})

const createFreshDailyState = (now = Date.now()) => {
  const profile = loadSkillProfile(now)
  const selected = chooseDailyChallenges(profile).map(makeChallenge)
  return {
    dayKey: getDayKey(new Date(now)),
    lastResetTs: now,
    lastPlayedTs: 0,
    skillBracket: profile.skillBracket,
    skillRating: profile.skillRating,
    firstWinAwarded: false,
    challenges: selected,
  }
}

const isResetDue = (state, now = Date.now()) => {
  if (!state || !state.lastResetTs) return true
  if ((now - state.lastResetTs) >= MS_24H) return true
  const today = getDayKey(new Date(now))
  return state.dayKey !== today
}

export const loadDailyEconomyState = (now = Date.now()) => {
  try {
    const raw = localStorage.getItem(DAILY_ECONOMY_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const next = isResetDue(parsed, now) ? createFreshDailyState(now) : parsed
    if (!raw || next !== parsed) localStorage.setItem(DAILY_ECONOMY_KEY, JSON.stringify(next))
    return next
  } catch {
    const next = createFreshDailyState(now)
    try { localStorage.setItem(DAILY_ECONOMY_KEY, JSON.stringify(next)) } catch {}
    return next
  }
}

export const saveDailyEconomyState = (state) => {
  try { localStorage.setItem(DAILY_ECONOMY_KEY, JSON.stringify(state)) } catch {}
}

export const calculateCoinsEarned = (score = 0) => {
  const s = Math.max(0, Number(score) || 0)
  let coins = 0

  const b1 = Math.min(s, 100000)
  coins += Math.floor(b1 / 1000)

  if (s > 100000) {
    const b2 = Math.min(s, 250000) - 100000
    coins += Math.floor(b2 / 2000)
  }

  if (s > 250000) {
    const b3 = s - 250000
    coins += Math.floor(b3 / 5000)
  }

  return clamp(coins, 0, 350)
}

const getMetricDelta = (summary, metric) => {
  switch (metric) {
    case 'lines': return num(summary.lines)
    case 'tSpins': return num(summary.tSpins)
    case 'survivalMs': return num(summary.survivalMs)
    case 'score': return num(summary.score)
    case 'iPieceLines': return num(summary.iPieceLines)
    case 'piecesPlaced': return num(summary.piecesPlaced)
    case 'holdUses': return num(summary.holdUses)
    case 'tetrisClears': return num(summary.tetrisClears)
    case 'hardDrops': return num(summary.hardDrops)
    case 'gamesCompleted': return 1
    default: return 0
  }
}

export const applyDailyGameRewards = (summary = {}, now = Date.now()) => {
  const skillProfile = updateSkillProfileFromGame(summary, now)
  const state = loadDailyEconomyState(now)
  let firstWinCoins = 0
  let challengeCoins = 0
  const completedChallengeIds = []

  if (!state.firstWinAwarded) {
    firstWinCoins = 200
    state.firstWinAwarded = true
  }

  state.challenges = (state.challenges || []).map((ch) => {
    if (!ch || ch.claimed) return ch
    const delta = Math.max(0, getMetricDelta(summary, ch.metric))
    const progress = Math.min(ch.target, (ch.progress || 0) + delta)
    const completed = progress >= ch.target
    if (completed && !ch.claimed) {
      challengeCoins += Number(ch.reward || 150)
      completedChallengeIds.push(ch.id)
    }
    return { ...ch, progress, completed, claimed: completed || ch.claimed }
  })

  state.lastPlayedTs = now
  state.skillBracket = skillProfile.skillBracket
  state.skillRating = skillProfile.skillRating
  saveDailyEconomyState(state)

  return {
    state,
    skillProfile,
    firstWinCoins,
    challengeCoins,
    completedChallengeIds,
    totalCoins: firstWinCoins + challengeCoins,
  }
}

export const getDailyCountdownMs = () => {
  const state = loadDailyEconomyState(Date.now())
  const nextAt = (state.lastResetTs || Date.now()) + MS_24H
  return Math.max(0, nextAt - Date.now())
}
