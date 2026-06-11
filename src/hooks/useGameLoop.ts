import { useEffect, useRef } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCraftStore } from '../stores/useCraftStore'
import { useCookStore } from '../stores/useCookStore'
import { DEFAULT_HARVEST_MULTIPLIERS } from '../types/map'
import type { HarvestMultipliers } from '../types/map'
import type { ProductionResult } from '../types/cook'
import type { CraftResult } from '../types/craft'

const TICK_INTERVAL_MS = 1000

export function useGameLoop(
  onCraftComplete?: (results: CraftResult[]) => void,
  onCookComplete?: (results: ProductionResult[]) => void,
  onFurnaceUnlocked?: (message: string) => void,
  // Phase 3 — multiplicateurs de classes (1.0 par défaut = neutre)
  harvestMultipliers: HarvestMultipliers = DEFAULT_HARVEST_MULTIPLIERS,
) {
  const harvestTick = useHarvestStore((state) => state.tick)
  const addResources = useInventoryStore((state) => state.addResources)
  const craftTick = useCraftStore((state) => state.processTick)
  const cookTick = useCookStore((state) => state.processTick)
  const syncFurnaceCount = useCookStore((state) => state.syncFurnaceCount)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stocker les multiplicateurs dans une ref pour éviter de recréer l'interval
  const multipliersRef = useRef(harvestMultipliers)
  multipliersRef.current = harvestMultipliers

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // 1. Harvest — avec multiplicateur de yield
      const rawYields = harvestTick()
      if (rawYields.length > 0) {
        const multipliedYields = rawYields.map((y) => ({
          ...y,
          amount: y.amount * multipliersRef.current.yieldMultiplier,
        }))
        addResources(multipliedYields)
      }

      // 2. Craft
      const craftResults = craftTick()
      if (craftResults.length > 0) {
        onCraftComplete?.(craftResults)
        const { newFurnaceUnlocked, unlockMessage } = syncFurnaceCount()
        if (newFurnaceUnlocked && unlockMessage) {
          onFurnaceUnlocked?.(unlockMessage)
        }
      }

      // 3. Cook
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
