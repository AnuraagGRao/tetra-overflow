import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from './config'
import { createUserProfile } from './db'

const randomTag = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const makeGuestName = () => `guest-${Math.floor(100000 + Math.random() * 900000)}`

export const signUpWithEmail = async (email, password, displayName) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  await createUserProfile(cred.user.uid, { displayName, email })
  return cred.user
}

export const signInWithEmail = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export const signInGuest = async () => {
  const cred = await signInAnonymously(auth)
  const displayName = makeGuestName()
  await updateProfile(cred.user, { displayName })
  await createUserProfile(cred.user.uid, {
    displayName,
    email: null,
    isGuest: true,
    guestTag: randomTag(),
  })
  return cred.user
}

export const signOut = () => fbSignOut(auth)

export const sendPasswordReset = async (email) => {
  if (!email) throw new Error('auth/missing-email')
  await sendPasswordResetEmail(auth, email)
}
