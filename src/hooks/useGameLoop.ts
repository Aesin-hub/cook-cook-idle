import { useEffect, useRef } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCraftStore } from '../stores/useCraftStore'
import { useCookStore } from '../stores/useCookStore'
import type { ProductionResult } from '../types/cook'
import type { CraftResult } from '../types/craft'

const TICK_INTERVAL_MS = 1000

export function useGameLoop(
  onCraftComplete?: (results: CraftResult[]) => void,
  onCookComplete?: (results: ProductionResult[]) => void,
  onFurnaceUnlocked?: (message: string) => void,
) {
  const harvestTick = useHarvestStore((state) => state.tick)
  const addResources = useInventoryStore((state) => state.addResources)
  const craftTick = useCraftStore((state) => state.processTick)
  const cookTick = useCookStore((state) => state.processTick)
  const syncFurnaceCount = useCookStore((state) => state.syncFurnaceCount)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const harvestYields = harvestTick()
      if (harvestYields.length > 0) addResources(harvestYields)

      const craftResults = craftTick()
      if (craftResults.length > 0) {
        onCraftComplete?.(craftResults)
        const { newFurnaceUnlocked, unlockMessage } = syncFurnaceCount()
        if (newFurnaceUnlocked && unlockMessage) {
          onFurnaceUnlocked?.(unlockMessage)
        }
      }

      const cookResults = cookTick()
      if (cookResults.length > 0) {
        onCookComplete?.(cookResults)
        const { newFurnaceUnlocked, unlockMessage } = syncFurnaceCount()
        if (newFurnaceUnlocked && unlockMessage) {
          onFurnaceUnlocked?.(unlockMessage)
        }
      }
    }, TICK_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [harvestTick, addResources, craftTick, cookTick, syncFurnaceCount,
      onCraftComplete, onCookComplete, onFurnaceUnlocked])
}
