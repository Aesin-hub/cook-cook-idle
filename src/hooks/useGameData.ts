import { useEffect } from 'react'
import { useGameDataStore } from '../stores/useGameDataStore'

export function useGameData(): { loaded: boolean; source: 'supabase' | 'local' | 'none' } {
  const loaded = useGameDataStore((state) => state.loaded)
  const source = useGameDataStore((state) => state.source)
  const loadFromSupabase = useGameDataStore((state) => state.loadFromSupabase)

  useEffect(() => {
    if (!loaded) {
      loadFromSupabase()
    }
  }, [loaded, loadFromSupabase])

  return { loaded, source }
}
