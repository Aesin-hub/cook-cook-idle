import { useEffect, useRef } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCraftStore } from '../stores/useCraftStore'
import type { CraftResult } from '../types/craft'

const TICK_INTERVAL_MS = 1000

export function useGameLoop(onCraftComplete?: (results: CraftResult[]) => void) {
  const harvestTick = useHarvestStore((state) => state.tick)
  const addResources = useInventoryStore((state) => state.addResources)
  const craftTick = useCraftStore((state) => state.processTick)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const harvestYields = harvestTick()
      if (harvestYields.length > 0) addResources(harvestYields)

      const craftResults = craftTick()
      if (craftResults.length > 0 && onCraftComplete) {
        onCraftComplete(craftResults)
      }
    }, TICK_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [harvestTick, addResources, craftTick, onCraftComplete])
}
