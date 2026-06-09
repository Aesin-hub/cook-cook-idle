import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HarvestYield } from '../types/harvest'

interface InventoryState {
  resources: Record<string, number>
}

interface InventoryActions {
  addResources: (yields: HarvestYield[]) => void
  removeResources: (yields: HarvestYield[]) => boolean
  getAmount: (resourceId: string) => number
  reset: () => void
}

export const useInventoryStore = create<InventoryState & InventoryActions>()(
  persist(
    (set, get) => ({
      resources: {},
      addResources: (yields) => set((state) => {
        const updated = { ...state.resources }
        yields.forEach(({ resourceId, amount }) => { updated[resourceId] = (updated[resourceId] ?? 0) + amount })
        return { resources: updated }
      }),
      removeResources: (yields) => {
        const { resources } = get()
        const canAfford = yields.every(({ resourceId, amount }) => (resources[resourceId] ?? 0) >= amount)
        if (!canAfford) return false
        set((state) => {
          const updated = { ...state.resources }
          yields.forEach(({ resourceId, amount }) => { updated[resourceId] = (updated[resourceId] ?? 0) - amount })
          return { resources: updated }
        })
        return true
      },
      getAmount: (resourceId) => get().resources[resourceId] ?? 0,
      reset: () => set({ resources: {} }),
    }),
    { name: 'cooking-fantasy-inventory' }
  )
)
