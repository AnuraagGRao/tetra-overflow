import { doc, writeBatch, getFirestore, getDoc, updateDoc } from 'firebase/firestore'
import { STORY_CHAPTERS } from '../logic/storyData'

const db = getFirestore()

// Derive the full list of story-unlocked themes from storyData at module load time,
// so this list never goes out of sync when new levels/unlocks are added.
const STORY_THEME_UNLOCKS = [
  ...new Set(
    STORY_CHAPTERS.flatMap(ch =>
      ch.levels.flatMap(lv => {
        const u = lv.themeUnlock
        if (!u) return []
        return Array.isArray(u) ? u : [u]
      })
    )
  ),
]

// WARNING: DANGEROUS! This erases all Story progress and relocks story-unlocked themes.
export async function resetStoryProgress(uid) {
  if (!uid) throw new Error('No user')
  const batch = writeBatch(db)

  // Wipe out story doc
  const storyDocRef = doc(db, 'story', uid)
  batch.set(storyDocRef, {}, { merge: false })

  await batch.commit()

  // Remove story-unlocked themes from the user's inventory
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  if (userSnap.exists()) {
    const inventory = userSnap.data().inventory || []
    const filteredInventory = inventory.filter(item => !STORY_THEME_UNLOCKS.includes(item))
    if (filteredInventory.length !== inventory.length) {
      await updateDoc(userRef, { inventory: filteredInventory })
    }
  }

  return true
}
