import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { getUserProfile } from '../firebase/db'
import { signUpWithEmail, signInWithEmail, signInWithGoogle, signInAsGuest, signOut } from '../firebase/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profile = await getUserProfile(user.uid)
      setUserProfile(profile)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      refreshProfile,
      signUp: signUpWithEmail,
      signIn: signInWithEmail,
      signInGoogle: signInWithGoogle,
      signInGuest: signInAsGuest,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
