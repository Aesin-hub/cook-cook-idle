import { useEffect, useState } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCookStore } from '../stores/useCookStore'
import { useBestiaryStore } from '../stores/useBestiaryStore'
import { RESOURCES } from '../data'
import type { OfflineProgressResult } from '../types/harvest'

export interface OfflineProgressDisplay extends OfflineProgressResult {
  yieldsDisplay: { name: string; emoji: string; amount: number }[]
  cookResultsDisplay: { name: string; emoji: string; amount: number }[]
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
  const calculateHarvestOffline = useHarvestStore((state) => state.calculateOfflineProgress)
  const calculateCookOffline = useCookStore((state) => state.calculateOfflineProgress)
  const addResources = useInventoryStore((state) => state.addResources)
  const [result, setResult] = useState<OfflineProgressDisplay | null>(null)

  useEffect(() => {
    const { yields, elapsedMs, cappedAt8h } = calculateHarvestOffline()
    const { results: cookResults } = calculateCookOffline()
    const familiarYield = useBestiaryStore.getState().familiarTick()

    if (elapsedMs < 60000 && cookResults.length === 0) return

    const allYields = [...yields]
    if (familiarYield && familiarYield.amount > 0) {
      allYields.push(familiarYield)
    }

    if (allYields.length > 0) addResources(allYields)

    const yieldsDisplay = allYields
      .map((y) => {
        const resource = RESOURCES.find((r) => r.id === y.resourceId)
        return {
          name: resource?.name ?? y.resourceId,
          emoji: resource?.emoji ?? '📦',
          amount: Math.floor(y.amount),
        }
      })
      .filter((y) => y.amount > 0)

    const cookResultsDisplay = cookResults
      .filter((r) => r.amount >= 0.1)
      .map((r) => ({
        name: r.outputName,
        emoji: r.outputEmoji,
        amount: Math.floor(r.amount),
      }))

    if (yieldsDisplay.length === 0 && cookResultsDisplay.length === 0) return

    setResult({
      yields,
      yieldsDisplay,
      cookResultsDisplay,
      elapsedMs,
      cappedAt8h,
      elapsedLabel: formatElapsed(elapsedMs),
      dismiss: () => setResult(null),
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
