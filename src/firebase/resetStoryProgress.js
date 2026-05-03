import { doc, writeBatch, getFirestore } from 'firebase/firestore'

const db = getFirestore()

// WARNING: DANGEROUS! This erases all Story progress and unclaims story chapter milestone rewards (not coins!).
export async function resetStoryProgress(uid) {
  if (!uid) throw new Error('No user')
  const batch = writeBatch(db)

  // Wipe out story doc
  const storyDocRef = doc(db, 'story', uid)
  batch.set(storyDocRef, {}, { merge: false })

  // Optionally, you might want to reset user-level bests, or stats tied to story here
  // or erase progress flags etc, but this is the main progress doc.

  await batch.commit()
  return true
}
