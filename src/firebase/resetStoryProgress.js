import { doc, writeBatch, getFirestore, getDoc, updateDoc } from 'firebase/firestore'

const db = getFirestore()

// All themes unlocked by story progress — must mirror themeUnlock fields in storyData.js
const STORY_THEME_UNLOCKS = [
  'theme_terracotta',
  'theme_amber',
  'theme_obsidian',
  'theme_frozen',
  'theme_biolume',
  'theme_copper',
  'theme_stained',
  'theme_ukiyo',
  'theme_vaporwave',
  'theme_terminal',
  'theme_circuit',
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
