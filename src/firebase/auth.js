import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously as fbSignInAnonymously,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from './config'
import { createUserProfile } from './db'

const googleProvider = new GoogleAuthProvider()

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

export const signInWithGoogle = async () => {
  const cred = await signInWithPopup(auth, googleProvider)
  await createUserProfile(cred.user.uid, {
    displayName: cred.user.displayName,
    email: cred.user.email,
  })
  return cred.user
}

export const signInAsGuest = async () => {
  const cred = await fbSignInAnonymously(auth)
  await createUserProfile(cred.user.uid, { displayName: 'Guest', email: null })
  return cred.user
}

export const signOut = () => fbSignOut(auth)
