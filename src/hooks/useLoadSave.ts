import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { loadSave, applyLoadedSave } from '../lib/saveService'

export type LoadStatus = 'idle' | 'loading' | 'done' | 'error'

export function useLoadSave(): LoadStatus {
  const user = useAuthStore((state) => state.user)
  const [status, setStatus] = useState<LoadStatus>('idle')

  useEffect(() => {
    if (!user) {
      setStatus('idle')
      return
    }

    setStatus('loading')

    loadSave(user.id)
      .then(({ inventory, harvest, craft }) => {
        return applyLoadedSave(inventory, harvest, craft)
      })
      .then(() => setStatus('done'))
      .catch((err) => {
        console.error('[useLoadSave] Erreur chargement:', err)
        setStatus('error')
      })
  }, [user?.id])

  return status
}
