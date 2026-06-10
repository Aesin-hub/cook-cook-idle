import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { COOK_RECIPES, FURNACE_LEVELS } from '../data'
import { useInventoryStore } from './useInventoryStore'
import { useCraftStore } from './useCraftStore'
import {
  checkCanProduce,
  calcProduction,
  calcIngredientConsumption,
  getSpeedMultiplier,
  getEfficiencyRate,
  getUnlockedFurnaceCount,
} from '../lib/cookHelpers'
import type { CookState, ProductionResult, ResourceConsumed } from '../types/cook'

const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000

interface CookActions {
  assignRecipe: (furnaceId: string, recipeId: string | null) => void
  assignMachine: (furnaceId: string, machineId: string | null) => void
  togglePause: (furnaceId: string) => void
  processTick: () => ProductionResult[]
  calculateOfflineProgress: () => {
    results: ProductionResult[]
    elapsedMs: number
    cappedAt8h: boolean
  }
  syncFurnaceCount: () => { newFurnaceUnlocked: boolean; unlockMessage?: string }
  getTotalXp: () => number
}

export const useCookStore = create<CookState & CookActions>()(
  persist(
    (set, get) => ({
      furnaces: [
        {
          id: uuidv4(),
          slotIndex: 0,
          recipeId: null,
          machineId: null,
          active: true,
          lastTickAt: Date.now(),
          pausedReason: 'no_recipe' as const,
          totalProduced: 0,
        },
      ],
      totalCookXp: 0,
      unlockedFurnaceCount: 1,

      assignRecipe: (furnaceId, recipeId) => {
        set((state) => ({
          furnaces: state.furnaces.map((f) =>
            f.id === furnaceId
              ? {
                  ...f,
                  recipeId,
                  lastTickAt: Date.now(),
                  pausedReason: recipeId ? null : 'no_recipe' as const,
                }
              : f
          ),
        }))
      },

      assignMachine: (furnaceId, machineId) => {
        set((state) => ({
          furnaces: state.furnaces.map((f) =>
            f.id === furnaceId ? { ...f, machineId } : f
          ),
        }))
      },

      togglePause: (furnaceId) => {
        set((state) => ({
          furnaces: state.furnaces.map((f) => {
            if (f.id !== furnaceId) return f
            const nowActive = !f.active
            return {
              ...f,
              active: nowActive,
              pausedReason: nowActive ? null : 'paused_by_player' as const,
              lastTickAt: nowActive ? Date.now() : f.lastTickAt,
            }
          }),
        }))
      },

      processTick: () => {
        const { furnaces, totalCookXp, unlockedFurnaceCount } = get()
        const inventory = useInventoryStore.getState()
        const now = Date.now()
        const results: ProductionResult[] = []
        let newTotalCookXp = totalCookXp

        const updatedFurnaces = furnaces.map((furnace) => {
          if (furnace.slotIndex >= unlockedFurnaceCount) return furnace

          const elapsedMs = now - furnace.lastTickAt
          if (elapsedMs <= 0) return furnace

          const pausedReason = checkCanProduce(furnace, inventory.resources, elapsedMs)

          if (pausedReason !== null) {
            return { ...furnace, pausedReason, lastTickAt: now }
          }

          const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)!
          const speedMultiplier = getSpeedMultiplier(furnace)
          const efficiencyRate = getEfficiencyRate(furnace)

          const outputAmount = calcProduction(
            recipe.outputPerBatch,
            recipe.cookTimeSeconds,
            elapsedMs,
            speedMultiplier
          )

          if (outputAmount <= 0) {
            return { ...furnace, pausedReason: null, lastTickAt: now }
          }

          const resourcesConsumed: ResourceConsumed[] = recipe.productionLine.map((step) => ({
            resourceId: step.resourceId,
            amount: calcIngredientConsumption(
              step.perMin, elapsedMs, speedMultiplier, efficiencyRate
            ),
          }))

          inventory.removeResources(
            resourcesConsumed.map((r) => ({ resourceId: r.resourceId, amount: r.amount }))
          )

          inventory.addResources([{ resourceId: recipe.id, amount: outputAmount }])

          const xpGained = Math.floor(outputAmount * recipe.xpReward)
          newTotalCookXp += xpGained

          results.push({
            furnaceId: furnace.id,
            recipeId: recipe.id,
            outputResourceId: recipe.id,
            outputName: recipe.name,
            outputEmoji: recipe.emoji,
            amount: outputAmount,
            resourcesConsumed,
            pausedReason: null,
            xpGained,
          })

          return {
            ...furnace,
            pausedReason: null,
            lastTickAt: now,
            totalProduced: furnace.totalProduced + outputAmount,
          }
        })

        set({ furnaces: updatedFurnaces, totalCookXp: newTotalCookXp })
        return results
      },

      calculateOfflineProgress: () => {
        const { furnaces, totalCookXp, unlockedFurnaceCount } = get()
        const inventory = useInventoryStore.getState()
        const now = Date.now()

        const oldestTickAt = furnaces.reduce(
          (min, f) => Math.min(min, f.lastTickAt),
          now
        )
        const rawElapsedMs = now - oldestTickAt
        const cappedAt8h = rawElapsedMs > OFFLINE_CAP_MS
        const elapsedMs = Math.min(rawElapsedMs, OFFLINE_CAP_MS)

        const results: ProductionResult[] = []
        let newTotalCookXp = totalCookXp

        const updatedFurnaces = furnaces.map((furnace) => {
          if (furnace.slotIndex >= unlockedFurnaceCount) return furnace
          if (!furnace.active || !furnace.recipeId) return { ...furnace, lastTickAt: now }

          const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)
          if (!recipe) return { ...furnace, lastTickAt: now }

          const speedMultiplier = getSpeedMultiplier(furnace)
          const efficiencyRate = getEfficiencyRate(furnace)

          const theoreticalConsumption = recipe.productionLine.map((step) => ({
            resourceId: step.resourceId,
            amount: calcIngredientConsumption(
              step.perMin, elapsedMs, speedMultiplier, efficiencyRate
            ),
          }))

          let productionRatio = 1
          for (const { resourceId, amount } of theoreticalConsumption) {
            if (amount > 0) {
              const available = inventory.resources[resourceId] ?? 0
              productionRatio = Math.min(productionRatio, available / amount)
            }
          }
          productionRatio = Math.max(0, productionRatio)

          if (productionRatio <= 0) {
            return { ...furnace, pausedReason: 'no_stock' as const, lastTickAt: now }
          }

          const outputAmount = calcProduction(
            recipe.outputPerBatch,
            recipe.cookTimeSeconds,
            elapsedMs,
            speedMultiplier
          ) * productionRatio

          const resourcesConsumed: ResourceConsumed[] = theoreticalConsumption.map((c) => ({
            ...c,
            amount: c.amount * productionRatio,
          }))

          inventory.removeResources(
            resourcesConsumed.map((r) => ({ resourceId: r.resourceId, amount: r.amount }))
          )
          inventory.addResources([{ resourceId: recipe.id, amount: outputAmount }])

          const xpGained = Math.floor(outputAmount * recipe.xpReward)
          newTotalCookXp += xpGained

          results.push({
            furnaceId: furnace.id,
            recipeId: recipe.id,
            outputResourceId: recipe.id,
            outputName: recipe.name,
            outputEmoji: recipe.emoji,
            amount: outputAmount,
            resourcesConsumed,
            pausedReason: null,
            xpGained,
          })

          return {
            ...furnace,
            pausedReason: null,
            lastTickAt: now,
            totalProduced: furnace.totalProduced + outputAmount,
          }
        })

        set({ furnaces: updatedFurnaces, totalCookXp: newTotalCookXp })
        return { results, elapsedMs, cappedAt8h }
      },

      syncFurnaceCount: () => {
        const { furnaces, totalCookXp, unlockedFurnaceCount } = get()
        const craftXp = useCraftStore.getState().totalXp
        const totalXp = craftXp + totalCookXp

        const newCount = getUnlockedFurnaceCount(totalXp)

        if (newCount <= unlockedFurnaceCount) {
          return { newFurnaceUnlocked: false }
        }

        const newFurnaces = [...furnaces]
        for (let i = unlockedFurnaceCount; i < newCount; i++) {
          newFurnaces.push({
            id: uuidv4(),
            slotIndex: i,
            recipeId: null,
            machineId: null,
            active: true,
            lastTickAt: Date.now(),
            pausedReason: 'no_recipe' as const,
            totalProduced: 0,
          })
        }

        const level = FURNACE_LEVELS.find((l) => l.furnaceCount === newCount)
        const unlockMessage = level?.unlockMessage

        set({ furnaces: newFurnaces, unlockedFurnaceCount: newCount })
        return { newFurnaceUnlocked: true, unlockMessage }
      },

      getTotalXp: () => {
        const craftXp = useCraftStore.getState().totalXp
        return craftXp + get().totalCookXp
      },
    }),
    {
      name: 'cooking-fantasy-cook',
      partialize: (state) => ({
        furnaces: state.furnaces,
        totalCookXp: state.totalCookXp,
        unlockedFurnaceCount: state.unlockedFurnaceCount,
      }),
    }
  )
)
