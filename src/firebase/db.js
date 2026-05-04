export { resetStoryProgress } from './resetStoryProgress'
import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, limit, getDocs, increment,
  serverTimestamp, addDoc, onSnapshot, runTransaction,
} from 'firebase/firestore'
import { db } from './config'
import { calculateCoinsEarned, applyDailyGameRewards } from '../logic/economy'

const FRIEND_REQUESTS = 'friend_requests'
const normalizeFriendCode = (value = '') => value.trim().toLowerCase()
const sanitizeDisplayName = (value = 'player') => {
  const base = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return base.replace(/^-+|-+$/g, '').slice(0, 18) || 'player'
}
const generateFriendSuffix = () => Math.random().toString(36).slice(2, 7).toUpperCase()
const buildFriendCode = (displayName, suffix = generateFriendSuffix()) => `${sanitizeDisplayName(displayName)}#${suffix}`
const publicProfileFromUser = (uid, data = {}) => ({
  uid,
  displayName: data.displayName || `player_${uid.slice(0, 5)}`,
  friendCode: data.friendCode,
  friendCodeLower: normalizeFriendCode(data.friendCode || ''),
  hasPlayedEasy: !!data.hasPlayedEasy,
  selectedBadge: data.selectedBadge || null,
  createdAt: data.createdAt || serverTimestamp(),
})

const syncPublicProfile = async (uid, userData) => {
  if (!uid || !userData) return
  await setDoc(doc(db, 'public_profiles', uid), publicProfileFromUser(uid, userData), { merge: true })
}

// ─── User profile ─────────────────────────────────────────────────────────────
export const createUserProfile = async (uid, data) => {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const profile = {
      ...data,
      displayName: data.displayName || `player_${uid.slice(0, 5)}`,
      friendCode: buildFriendCode(data.displayName || `player_${uid.slice(0, 5)}`, data.guestTag),
      coins: 200,
      inventory: ['theme_classic'],
      createdAt: serverTimestamp(),
    }
    await setDoc(ref, profile)
    await syncPublicProfile(uid, profile)
  }
}

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

export const updateUserProfile = async (uid, data) => {
  await updateDoc(doc(db, 'users', uid), data)
  const snap = await getDoc(doc(db, 'users', uid))
  if (snap.exists()) await syncPublicProfile(uid, snap.data())
}

export const ensureUserProfileIdentity = async (uid, profile, fallbackDisplayName) => {
  if (!uid) return profile
  const current = profile || {}
  const displayName = current.displayName || fallbackDisplayName || `player_${uid.slice(0, 5)}`
  const next = { ...current }
  let changed = false

  if (!next.displayName) {
    next.displayName = displayName
    changed = true
  }
  if (!next.friendCode) {
    next.friendCode = buildFriendCode(displayName)
    changed = true
  }
  if (!next.createdAt) {
    next.createdAt = serverTimestamp()
    changed = true
  }

  if (changed) {
    await setDoc(doc(db, 'users', uid), next, { merge: true })
  }
  await syncPublicProfile(uid, next)
  return next
}

// ─── Coins: ledger ──────────────────────────────────────────────────────────
/** Append a coin ledger entry under users/{uid}/coin_ledger. */
export const appendCoinLedger = async (uid, entry) => {
  const ref = collection(db, 'users', uid, 'coin_ledger')
  await addDoc(ref, { ...entry, createdAt: serverTimestamp() })
}

/** Atomic coin update with ledger; delta can be positive (earn) or negative (spend). */
export const addCoinsWithLedger = async (uid, delta, context = {}) => {
  if (!delta) return { balanceAfter: null }
  const userRef = doc(db, 'users', uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef)
    if (!snap.exists()) throw new Error('User not found')
    const prev = snap.data().coins || 0
    const next = prev + delta
    tx.update(userRef, { coins: next })
    const ledgerRef = doc(collection(db, 'users', uid, 'coin_ledger'))
    tx.set(ledgerRef, {
      type: delta >= 0 ? 'earn' : 'spend',
      amount: Math.abs(delta),
      balanceAfter: next,
      ...context,
      createdAt: serverTimestamp(),
    })
  })
}

// ─── Stats + scores ───────────────────────────────────────────────────────────
export const saveGameResult = async (uid, mode, score, extra = {}) => {
  const statsRef = doc(db, 'stats', uid)
  const statsSnap = await getDoc(statsRef)
  const existing = statsSnap.exists() ? statsSnap.data() : {}
  const bestKey = `best_${mode}`
  const isBest = score > (existing[bestKey] || 0)
  const floors = extra.floors || 0
  const isBestUltimateFloors = mode === 'ultimate' && floors > (existing.best_ultimate_floors || 0)

  await setDoc(statsRef, {
    totalGames: increment(1),
    totalLines: increment(extra.lines || 0),
    totalScore: increment(score),
    totalFloors: increment(floors || 0),
    ...(isBest ? { [bestKey]: score, [`${bestKey}_lines`]: extra.lines || 0, [`${bestKey}_at`]: serverTimestamp() } : {}),
    ...(isBestUltimateFloors ? { best_ultimate_floors: floors } : {}),
    lastPlayed: serverTimestamp(),
  }, { merge: true })

  // Score-based earnings with diminishing returns and per-match cap.
  const scoreCoins = calculateCoinsEarned(score)
  if (scoreCoins > 0) {
    await addCoinsWithLedger(uid, scoreCoins, {
      mode,
      source: 'score',
      score,
      lines: extra.lines || 0,
    })
  }

  // Daily system (local-time reset): first completion + daily challenges.
  const daily = applyDailyGameRewards({
    score,
    lines: extra.lines || 0,
    tSpins: extra.tSpins || 0,
    survivalMs: extra.survivalMs || 0,
    iPieceLines: extra.iPieceLines || 0,
    piecesPlaced: extra.piecesPlaced || 0,
    holdUses: extra.holdUses || 0,
    tetrisClears: extra.tetrisClears || 0,
    hardDrops: extra.hardDrops || 0,
    mode,
  })

  if (daily.firstWinCoins > 0) {
    await addCoinsWithLedger(uid, daily.firstWinCoins, {
      mode,
      source: 'first_win_daily',
      score,
      lines: extra.lines || 0,
    })
  }

  if (daily.challengeCoins > 0) {
    await addCoinsWithLedger(uid, daily.challengeCoins, {
      mode,
      source: 'daily_challenges',
      completedChallenges: daily.completedChallengeIds,
      score,
      lines: extra.lines || 0,
    })
  }

  await addDoc(collection(db, 'scores'), {
    uid,
    mode,
    score,
    lines: extra.lines || 0,
    level: extra.level || 1,
    floors,
    timestamp: serverTimestamp(),
  })

  return {
    isBest,
    coinsEarned: scoreCoins + daily.totalCoins,
    scoreCoins,
    dailyCoins: daily.totalCoins,
  }
}

export const awardStoryChapterMilestone = async (uid, chapterId) => {
  const bonus = 500
  const storyRef = doc(db, 'story', uid)
  const userRef = doc(db, 'users', uid)
  const awardKey = `${chapterId}_milestone_awarded`

  let awarded = false

  await runTransaction(db, async (tx) => {
    const [storySnap, userSnap] = await Promise.all([tx.get(storyRef), tx.get(userRef)])
    if (!userSnap.exists()) throw new Error('User not found')
    const story = storySnap.exists() ? storySnap.data() : {}
    if (story[awardKey]) return

    const prev = userSnap.data().coins || 0
    const next = prev + bonus

    tx.set(storyRef, { [awardKey]: true, lastUpdated: serverTimestamp() }, { merge: true })
    tx.update(userRef, { coins: next })
    const ledgerRef = doc(collection(db, 'users', uid, 'coin_ledger'))
    tx.set(ledgerRef, {
      type: 'earn',
      amount: bonus,
      source: 'story_chapter_milestone',
      chapterId,
      balanceAfter: next,
      createdAt: serverTimestamp(),
    })
    awarded = true
  })

  return { awarded, coins: awarded ? bonus : 0 }
}

export const getUserStats = async (uid) => {
  const snap = await getDoc(doc(db, 'stats', uid))
  return snap.exists() ? snap.data() : {}
}

export const getLeaderboard = async (mode, lim = 10) => {
  const q = query(
    collection(db, 'scores'),
    where('mode', '==', mode),
    orderBy('score', 'desc'),
    limit(lim)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const purchaseItem = async (uid, itemId, cost) => {
  const userRef = doc(db, 'users', uid)
  // Use a transaction to prevent TOCTOU race condition on coin deduction
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef)
    if (!snap.exists()) throw new Error('User not found')
    const profile = snap.data()
    if ((profile.coins || 0) < cost) throw new Error('Not enough coins')
    if ((profile.inventory || []).includes(itemId)) throw new Error('Already owned')
    const next = (profile.coins || 0) - cost
    tx.update(userRef, { coins: next, inventory: [...(profile.inventory || []), itemId] })
    // Append spend entry in the same transaction
    const ledgerRef = doc(collection(db, 'users', uid, 'coin_ledger'))
    tx.set(ledgerRef, { type: 'spend', amount: cost, itemId, balanceAfter: next, createdAt: serverTimestamp() })
  })
}

/** Get latest N coin ledger entries (desc). */
export const getCoinHistory = async (uid, lim = 20) => {
  const q = query(collection(db, 'users', uid, 'coin_ledger'), orderBy('createdAt', 'desc'), limit(lim))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** Admin/test: refund the last spend entry and record a refund entry. */
// Admin refund API removed for production safety.

// ─── Story progress ───────────────────────────────────────────────────────────
export const saveStoryProgress = async (uid, chapterId, levelId, score, lines = 0) => {
  const ref = doc(db, 'story', uid)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? snap.data() : {}

  const levelScoreKey = `${chapterId}_${levelId}_score`
  const levelLinesKey = `${chapterId}_${levelId}_lines`
  const levelDoneKey = `${chapterId}_${levelId}_completed`
  const chapterScoreKey = `${chapterId}_chapter_score`
  const chapterLinesKey = `${chapterId}_chapter_lines`

  const prevLevelScore = Number(existing[levelScoreKey] || 0)
  const prevLevelLines = Number(existing[levelLinesKey] || 0)
  const prevChapterScore = Number(existing[chapterScoreKey] || 0)
  const prevChapterLines = Number(existing[chapterLinesKey] || 0)

  // Keep chapter totals stable when replaying levels by replacing only this level's contribution.
  const nextChapterScore = Math.max(0, prevChapterScore - prevLevelScore + Math.max(0, Number(score || 0)))
  const nextChapterLines = Math.max(0, prevChapterLines - prevLevelLines + Math.max(0, Number(lines || 0)))

  await setDoc(ref, {
    [levelScoreKey]: score,
    [levelLinesKey]: lines,
    [levelDoneKey]: true,
    [chapterScoreKey]: nextChapterScore,
    [chapterLinesKey]: nextChapterLines,
    total_story_score: increment(Math.max(0, Number(score || 0)) - prevLevelScore),
    total_story_lines: increment(Math.max(0, Number(lines || 0)) - prevLevelLines),
    lastUpdated: serverTimestamp(),
  }, { merge: true })
}

export const unlockItem = async (uid, itemId) => {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  if (!snap.exists()) return
  const profile = snap.data()
  if ((profile.inventory || []).includes(itemId)) return
  await updateDoc(userRef, { inventory: [...(profile.inventory || []), itemId] })
}

export const getStoryProgress = async (uid) => {
  const snap = await getDoc(doc(db, 'story', uid))
  return snap.exists() ? snap.data() : {}
}

// ─── Multiplayer lobbies ──────────────────────────────────────────────────────
const genCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase().replace(/[0O]/g, 'X')

const MAX_LOBBY_PLAYERS = 8

export const createLobby = async (uid, displayName, { bestOf = 3 } = {}) => {
  const code = genCode()
  await setDoc(doc(db, 'lobbies', code), {
    code,
    hostUid: uid,
    status: 'waiting',
    bestOf,
    currentRound: 1,
    roundWins: {},
    matchWinner: null,
    players: [{ uid, displayName: displayName || 'Player 1', ready: false, score: 0, gameOver: false, boardSnapshot: null, garbageSentTo: {} }],
    createdAt: serverTimestamp(),
  })
  return code
}

export const joinLobby = async (code, uid, displayName) => {
  const ref = doc(db, 'lobbies', code)
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Lobby not found')
    const lobby = snap.data()
    if (lobby.status !== 'waiting') throw new Error('Game already started')
    const players = Array.isArray(lobby.players) ? lobby.players.slice() : []
    if (players.length >= MAX_LOBBY_PLAYERS) throw new Error('Lobby is full')
    if (players.some(p => p.uid === uid)) return lobby
    const name = displayName || `Player ${players.length + 1}`
    players.push({ uid, displayName: name, ready: false, score: 0, gameOver: false, boardSnapshot: null, garbageSentTo: {} })
    tx.update(ref, { players })
    return { ...lobby, players }
  })
}

export const updateLobbyPlayer = async (code, uid, update) => {
  const ref = doc(db, 'lobbies', code)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const lobby = snap.data()
  const players = lobby.players.map(p => p.uid === uid ? { ...p, ...update } : p)
  await updateDoc(ref, { players })
}

export const updateLobby = async (code, update) =>
  updateDoc(doc(db, 'lobbies', code), update)

export const setLobbyBestOf = async (code, bestOf) =>
  updateDoc(doc(db, 'lobbies', code), { bestOf })

export const setLobbyStatus = async (code, status) =>
  updateDoc(doc(db, 'lobbies', code), { status })

export const subscribeLobby = (code, callback) =>
  onSnapshot(
    doc(db, 'lobbies', code),
    (snap) => { if (snap.exists()) callback(snap.data()) },
    (err) => {
      // Non-fatal: extensions/ad-blockers can interfere with the listen channel.
      // Fall back to a one-shot fetch so the UI still has data.
      console.warn('Lobby subscribe error (non-fatal):', err?.code || err?.message)
      getDoc(doc(db, 'lobbies', code)).then(s => { if (s.exists()) callback(s.data()) }).catch(() => {})
    }
  )

// ─── Lobby archival / cleanup ────────────────────────────────────────────────
export const archiveLobby = async (code, extra = {}) => {
  const ref = doc(db, 'lobbies', code)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const archived = {
    ...data,
    archivedAt: serverTimestamp(),
    expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days TTL (configure TTL on this field)
    ...extra,
  }
  await setDoc(doc(db, 'lobbies_archive', code), archived)
  await updateDoc(ref, { status: 'archived' }).catch(() => {})
  // Best-effort delete; you may tighten rules to host-only
  try { await (await import('firebase/firestore')).deleteDoc(ref) } catch {}
}

// ─── Artwork voting ───────────────────────────────────────────────────────────
const DISLIKE_ALERT_THRESHOLD = 0.75  // 75% dislikes
const DISLIKE_MIN_VOTES       = 5     // minimum total votes before alert triggers

export const getArtworkVotes = async (trackId) => {
  const snap = await getDoc(doc(db, 'artwork_votes', trackId))
  return snap.exists() ? snap.data() : { up: 0, down: 0, userVotes: {} }
}

export const getAllArtworkVotes = async () => {
  const snap = await getDocs(collection(db, 'artwork_votes'))
  const result = {}
  snap.docs.forEach(d => { result[d.id] = d.data() })
  return result
}

export const voteArtwork = async (uid, trackId, vote) => {
  if (!['up', 'down'].includes(vote)) throw new Error('Invalid vote')
  const ref = doc(db, 'artwork_votes', trackId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists() ? snap.data() : { up: 0, down: 0, userVotes: {} }
    const prev = data.userVotes?.[uid]
    const userVotes = { ...(data.userVotes || {}), [uid]: vote }
    let up   = data.up   || 0
    let down = data.down || 0
    // Remove old vote
    if (prev === 'up')   up   = Math.max(0, up   - 1)
    if (prev === 'down') down = Math.max(0, down - 1)
    // Add new vote
    if (vote === 'up')   up   += 1
    if (vote === 'down') down += 1
    tx.set(ref, { up, down, userVotes, trackId, updatedAt: serverTimestamp() })

    // Check if dislike alert should fire
    const total = up + down
    if (total >= DISLIKE_MIN_VOTES && down / total >= DISLIKE_ALERT_THRESHOLD) {
      const alertRef = doc(collection(db, 'admin_alerts'))
      tx.set(alertRef, {
        type: 'artwork_dislike',
        trackId,
        up, down, total,
        dislikeRatio: Math.round((down / total) * 100),
        triggeredBy: uid,
        createdAt: serverTimestamp(),
        resolved: false,
      })
    }
  })
}

// ─── Easy mode NOOB brand ─────────────────────────────────────────────────────
/** Mark that this user has played Easy mode (shows NOOB badge on their profile). */
export const markEasyModePlayed = async (uid) => {
  await updateDoc(doc(db, 'users', uid), { hasPlayedEasy: true })
  const snap = await getDoc(doc(db, 'users', uid))
  if (snap.exists()) await syncPublicProfile(uid, snap.data())
}

// ─── Public profiles ──────────────────────────────────────────────────────────
/** Fetch only the public fields of a user's profile. */
export const getPublicProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'public_profiles', uid))
  if (!snap.exists()) return null
  const { displayName, hasPlayedEasy, selectedBadge, createdAt, friendCode } = snap.data()
  return { uid, displayName: displayName || `player_${uid.slice(0, 5)}`, hasPlayedEasy: !!hasPlayedEasy, selectedBadge: selectedBadge || null, createdAt, friendCode }
}

/** Batch-fetch public profiles for a list of UIDs. */
export const getPublicProfiles = async (uids) => {
  const results = {}
  await Promise.all(uids.map(async (uid) => {
    const snap = await getDoc(doc(db, 'public_profiles', uid))
    if (snap.exists()) {
      const { displayName, hasPlayedEasy, selectedBadge, friendCode } = snap.data()
      results[uid] = { uid, displayName: displayName || `player_${uid.slice(0, 5)}`, hasPlayedEasy: !!hasPlayedEasy, selectedBadge: selectedBadge || null, friendCode }
    } else {
      results[uid] = { uid, displayName: `player_${uid.slice(0, 5)}`, hasPlayedEasy: false, selectedBadge: null, friendCode: null }
    }
  }))
  return results
}

export const findPublicProfileByFriendCode = async (friendCode) => {
  const normalized = normalizeFriendCode(friendCode)
  if (!normalized.includes('#')) throw new Error('Invalid friend ID')
  const snap = await getDocs(query(collection(db, 'public_profiles'), where('friendCodeLower', '==', normalized), limit(1)))
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { uid: docSnap.id, ...docSnap.data() }
}

/** Get public stats (best scores) for any user. */
export const getPublicStats = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'stats', uid))
    if (snap.exists()) return snap.data()
  } catch (err) {
    // stats/{uid} is owner-only by rules; fall back to public scores aggregation.
    if (err?.code !== 'permission-denied') throw err
  }

  // Public fallback: aggregate from readable scores docs for this user.
  const q = query(collection(db, 'scores'), where('uid', '==', uid), limit(200))
  const snap = await getDocs(q)
  const aggregated = {
    totalGames: 0,
    totalLines: 0,
    totalScore: 0,
    totalFloors: 0,
  }

  snap.docs.forEach((d) => {
    const s = d.data() || {}
    const mode = String(s.mode || '')
    const score = Number(s.score || 0)
    const lines = Number(s.lines || 0)
    const floors = Number(s.floors || 0)
    aggregated.totalGames += 1
    aggregated.totalLines += lines
    aggregated.totalScore += score
    aggregated.totalFloors += floors
    const key = `best_${mode}`
    if (!aggregated[key] || score > aggregated[key]) aggregated[key] = score
  })

  return aggregated
}

// ─── Friends system ───────────────────────────────────────────────────────────
/** Send a friend request to another user. */
export const sendFriendRequest = async (fromUid, toUid, fromName) => {
  if (!fromUid || !toUid) throw new Error('Missing users')
  if (fromUid === toUid) throw new Error('You cannot add yourself')
  const friendDoc = await getDoc(doc(db, 'users', fromUid, 'friends', toUid))
  if (friendDoc.exists()) throw new Error('Already friends')
  const existing = await getDocs(query(collection(db, FRIEND_REQUESTS), where('fromUid', '==', fromUid), limit(20)))
  const pending = existing.docs.find((d) => {
    const data = d.data()
    return data.toUid === toUid && data.status === 'pending'
  })
  if (pending) throw new Error('Request already sent')
  const reqRef = doc(collection(db, FRIEND_REQUESTS))
  await setDoc(reqRef, { fromUid, toUid, fromName, status: 'pending', createdAt: serverTimestamp() })
  return reqRef.id
}

/** Get pending friend requests for a user (inbox). */
export const getFriendRequests = async (uid) => {
  const snap = await getDocs(query(collection(db, FRIEND_REQUESTS), where('toUid', '==', uid), limit(40)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((d) => d.status === 'pending')
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export const getSentFriendRequests = async (uid) => {
  const snap = await getDocs(query(collection(db, FRIEND_REQUESTS), where('fromUid', '==', uid), limit(40)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((d) => d.status === 'pending')
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

/** Accept a pending friend request — adds both users to each other's friends list. */
export const acceptFriendRequest = async (uid, requestId, request, myDisplayName) => {
  const reqRef = doc(db, FRIEND_REQUESTS, requestId)
  await updateDoc(reqRef, { status: 'accepted' })
  await Promise.all([
    setDoc(doc(db, 'users', uid, 'friends', request.fromUid), {
      uid: request.fromUid, displayName: request.fromName, addedAt: serverTimestamp(),
    }),
    setDoc(doc(db, 'users', request.fromUid, 'friends', uid), {
      uid, displayName: myDisplayName || `player_${uid.slice(0, 5)}`, addedAt: serverTimestamp(),
    }),
  ])
}

/** Decline a pending friend request. */
export const declineFriendRequest = async (uid, requestId) => {
  const reqRef = doc(db, FRIEND_REQUESTS, requestId)
  const snap = await getDoc(reqRef)
  if (!snap.exists()) return
  const data = snap.data()
  if (data.toUid !== uid && data.fromUid !== uid) throw new Error('Not allowed')
  await updateDoc(reqRef, { status: 'declined' })
}

/** Get the accepted friends list for a user. */
export const getFriends = async (uid) => {
  const snap = await getDocs(collection(db, 'users', uid, 'friends'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── Profile badges ──────────────────────────────────────────────────────────
/** Set the active badge (title) on the user's profile. */
export const setActiveBadge = async (uid, badgeId) => {
  await updateDoc(doc(db, 'users', uid), { selectedBadge: badgeId })
  const snap = await getDoc(doc(db, 'users', uid))
  if (snap.exists()) await syncPublicProfile(uid, snap.data())
}

/** Set the active visual effect on the user's profile. */
export const setActiveEffect = async (uid, effectId) => {
  await updateDoc(doc(db, 'users', uid), { selectedEffect: effectId })
}

/** Replace the user's active effects (multi-select). */
export const setActiveEffects = async (uid, effects) => {
  await updateDoc(doc(db, 'users', uid), { selectedEffects: Array.isArray(effects) ? effects : [] })
}

/** Toggle a single effect on/off in the user's active effects. */
export const toggleEffect = async (uid, effectId, enable) => {
  const ref = doc(db, 'users', uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('User not found')
    const cur = snap.data().selectedEffects || []
    const next = enable ? (cur.includes(effectId) ? cur : [...cur, effectId]) : cur.filter(e => e !== effectId)
    tx.update(ref, { selectedEffects: next })
  })
}

// ─── Lobby invites ────────────────────────────────────────────────────────────
/** Send a lobby invite to a friend. */
export const sendLobbyInvite = async (fromUid, toUid, lobbyCode, fromName) => {
  const invRef = doc(collection(db, 'users', toUid, 'lobby_invites'))
  await setDoc(invRef, { fromUid, fromName, lobbyCode, createdAt: serverTimestamp() })
}

/** Get unread lobby invites for a user (last 10). */
export const getLobbyInvites = async (uid) => {
  const q = query(collection(db, 'users', uid, 'lobby_invites'), orderBy('createdAt', 'desc'), limit(10))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** Delete a lobby invite (dismiss). */
export const dismissLobbyInvite = async (uid, inviteId) => {
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'users', uid, 'lobby_invites', inviteId))
}
