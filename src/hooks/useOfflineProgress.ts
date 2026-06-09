import { useEffect, useState } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { RESOURCES } from '../data'
import type { OfflineProgressResult } from '../types/harvest'

export interface OfflineProgressDisplay extends OfflineProgressResult {
  yieldsDisplay: { name: string; emoji: string; amount: number }[]
  elapsedLabel: string
  dismiss: () => void
}

function formatElapsed(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin}min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function useOfflineProgress(): OfflineProgressDisplay | null {
  const calculateOfflineProgress = useHarvestStore((state) => state.calculateOfflineProgress)
  const addResources = useInventoryStore((state) => state.addResources)
  const [result, setResult] = useState<OfflineProgressDisplay | null>(null)

  useEffect(() => {
    const { yields, elapsedMs, cappedAt8h } = calculateOfflineProgress()
    if (elapsedMs < 60000 || yields.length === 0) return

    addResources(yields)

    const yieldsDisplay = yields
      .map((y) => {
        const resource = RESOURCES.find((r) => r.id === y.resourceId)
        return { name: resource?.name ?? y.resourceId, emoji: resource?.emoji ?? '📦', amount: Math.floor(y.amount) }
      })
      .filter((y) => y.amount > 0)

    setResult({
      yields,
      yieldsDisplay,
      elapsedMs,
      cappedAt8h,
      elapsedLabel: formatElapsed(elapsedMs),
      dismiss: () => setResult(null),
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
