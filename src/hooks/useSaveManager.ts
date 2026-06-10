import { useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { saveAll } from '../lib/saveService'

const AUTOSAVE_INTERVAL_MS = 30_000

export function useSaveManager() {
  const user = useAuthStore((state) => state.user)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      saveAll(user.id).catch(console.error)
    }, AUTOSAVE_INTERVAL_MS)

    const handleUnload = () => saveAll(user.id)
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [user])
}
