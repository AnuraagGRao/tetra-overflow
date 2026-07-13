import { useEffect, useState } from 'react'
import { getStoryProgress } from '../firebase/db'

export function useStoryProgress(userId, reloadKey = null) {
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    if (!userId) {
      setProgress({})
      setError(null)
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    setError(null)
    getStoryProgress(userId)
      .then(value => {
        if (active) setProgress(value || {})
      })
      .catch(nextError => {
        if (!active) return
        setError(nextError)
        setProgress({})
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [reloadKey, userId])

  return { progress, setProgress, loading, error }
}
