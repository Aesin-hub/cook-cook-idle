import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { CRAFT_RECIPES } from '../data'
import { useInventoryStore } from './useInventoryStore'
import { useCraftStore } from './useCraftStore'
import type { CraftAutoState } from '../types/craftAuto'

interface CraftAutoActions {
  setStockThreshold: (recipeId: string, targetStock: number) => void
  toggleThreshold: (recipeId: string) => void
  removeThreshold: (recipeId: string) => void
  reorderThresholds: (fromIndex: number, toIndex: number) => void

  addFeedChain: (resourceId: string, furnaceId: string) => void
  toggleFeedChain: (chainId: string) => void
  removeFeedChain: (chainId: string) => void

  toggleAutoEnabled: () => void
  processTick: () => void
}

export const useCraftAutoStore = create<CraftAutoState & CraftAutoActions>()(
  persist(
    (set, get) => ({
      stockThresholds: [],
      feedChains: [],
      autoEnabled: false,

      setStockThreshold: (recipeId, targetStock) => {
        const { stockThresholds } = get()
        const existing = stockThresholds.find((t) => t.recipeId === recipeId)
        if (existing) {
          set({
            stockThresholds: stockThresholds.map((t) =>
              t.recipeId === recipeId ? { ...t, targetStock } : t
            ),
          })
        } else {
          const maxPriority = stockThresholds.reduce((m, t) => Math.max(m, t.priority), 0)
          set({
            stockThresholds: [
              ...stockThresholds,
              { recipeId, targetStock, enabled: true, priority: maxPriority + 1 },
            ],
          })
        }
      },

      toggleThreshold: (recipeId) => {
        set((s) => ({
          stockThresholds: s.stockThresholds.map((t) =>
            t.recipeId === recipeId ? { ...t, enabled: !t.enabled } : t
          ),
        }))
      },

      removeThreshold: (recipeId) => {
        set((s) => ({
          stockThresholds: s.stockThresholds.filter((t) => t.recipeId !== recipeId),
        }))
      },

      reorderThresholds: (fromIndex, toIndex) => {
        set((s) => {
          const sorted = [...s.stockThresholds].sort((a, b) => a.priority - b.priority)
          const [moved] = sorted.splice(fromIndex, 1)
          sorted.splice(toIndex, 0, moved)
          return {
            stockThresholds: sorted.map((t, i) => ({ ...t, priority: i + 1 })),
          }
        })
      },

      addFeedChain: (resourceId, furnaceId) => {
        set((s) => ({
          feedChains: [
            ...s.feedChains,
            { id: uuidv4(), resourceId, furnaceId, enabled: true },
          ],
        }))
      },

      toggleFeedChain: (chainId) => {
        set((s) => ({
          feedChains: s.feedChains.map((c) =>
            c.id === chainId ? { ...c, enabled: !c.enabled } : c
          ),
        }))
      },

      removeFeedChain: (chainId) => {
        set((s) => ({
          feedChains: s.feedChains.filter((c) => c.id !== chainId),
        }))
      },

      toggleAutoEnabled: () => set((s) => ({ autoEnabled: !s.autoEnabled })),

      processTick: () => {
        const { stockThresholds, autoEnabled } = get()
        if (!autoEnabled) return

        const inventory = useInventoryStore.getState()
        const craftStore = useCraftStore.getState()

        const sorted = [...stockThresholds]
          .filter((t) => t.enabled)
          .sort((a, b) => a.priority - b.priority)

        for (const threshold of sorted) {
          const recipe = CRAFT_RECIPES.find((r) => r.id === threshold.recipeId)
          if (!recipe) continue

          const currentStock = inventory.getAmount(recipe.output.resourceId)
          if (currentStock >= threshold.targetStock) continue

          const canAfford = recipe.inputs.every(
            (input) => inventory.getAmount(input.resourceId) >= input.quantity
          )
          if (!canAfford) continue

          const needed = Math.ceil(
            (threshold.targetStock - currentStock) / recipe.output.quantity
          )
          craftStore.enqueueCraft(recipe.id, Math.min(needed, 5))
          return // max 1 craft auto par tick
        }
      },
    }),
    {
      name: 'cooking-fantasy-craft-auto',
      partialize: (state) => ({
        stockThresholds: state.stockThresholds,
        feedChains: state.feedChains,
        autoEnabled: state.autoEnabled,
      }),
    }
  )
)
