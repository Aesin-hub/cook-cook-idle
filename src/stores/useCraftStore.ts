import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { CRAFT_RECIPES } from '../data'
import { useInventoryStore } from './useInventoryStore'
import type { CraftJob, CraftState, CraftResult } from '../types/craft'

const FIRST_TIME_DURATION_MS = 3000

interface CraftActions {
  enqueueCraft: (recipeId: string, quantity?: number) => { success: boolean; reason?: string }
  cancelCraft: (jobId: string) => void
  processTick: () => CraftResult[]
  getCurrentJob: () => CraftJob | null
  getQueueLength: () => number
  getProgress: () => number
}

export const useCraftStore = create<CraftState & CraftActions>()(
  persist(
    (set, get) => ({
      queue: [],
      totalXp: 0,
      craftedOnce: {},

      enqueueCraft: (recipeId, quantity = 1) => {
        const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId)
        if (!recipe) return { success: false, reason: 'Recette introuvable.' }

        const { removeResources, getAmount } = useInventoryStore.getState()
        const totalInputs = recipe.inputs.map((input) => ({
          resourceId: input.resourceId,
          amount: input.quantity * quantity,
        }))

        for (const { resourceId, amount } of totalInputs) {
          const have = getAmount(resourceId)
          if (have < amount) {
            return {
              success: false,
              reason: `Il te manque ${amount - have} × ${resourceId}.`,
            }
          }
        }

        removeResources(totalInputs)

        const { queue, craftedOnce } = get()
        const isFirstTime = recipe.firstTimeFast && !craftedOnce[recipeId]
        const isFirst = queue.length === 0
        const now = Date.now()
        const durationMs = isFirstTime ? FIRST_TIME_DURATION_MS : recipe.craftTimeSeconds * 1000

        const newJob: CraftJob = {
          id: uuidv4(),
          recipeId,
          quantity,
          isFirstTime,
          startedAt: isFirst ? now : 0,
          endsAt: isFirst ? now + durationMs : 0,
        }

        set({ queue: [...queue, newJob] })
        return { success: true }
      },

      cancelCraft: (jobId) => {
        const { queue } = get()
        const job = queue.find((j) => j.id === jobId)
        if (!job) return
        const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
        if (!recipe) return
        const refund = recipe.inputs.map((input) => ({
          resourceId: input.resourceId,
          amount: input.quantity * job.quantity,
        }))
        useInventoryStore.getState().addResources(refund)
        set({ queue: queue.filter((j) => j.id !== jobId) })
      },

      processTick: () => {
        const { queue, totalXp, craftedOnce } = get()
        if (queue.length === 0) return []

        const now = Date.now()
        const completedResults: CraftResult[] = []
        let currentQueue = [...queue]
        let newTotalXp = totalXp
        const newCraftedOnce = { ...craftedOnce }

        while (currentQueue.length > 0) {
          const job = currentQueue[0]

          if (job.startedAt === 0) {
            const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
            if (!recipe) { currentQueue.shift(); continue }
            const durationMs = job.isFirstTime ? FIRST_TIME_DURATION_MS : recipe.craftTimeSeconds * 1000
            currentQueue[0] = { ...job, startedAt: now, endsAt: now + durationMs }
            break
          }

          if (now < job.endsAt) break

          const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
          if (recipe) {
            const outputAmount = recipe.output.quantity * job.quantity
            const xpGained = recipe.xpReward * job.quantity
            useInventoryStore.getState().addResources([{ resourceId: recipe.output.resourceId, amount: outputAmount }])
            newTotalXp += xpGained
            newCraftedOnce[recipe.id] = true

            completedResults.push({
              recipeId: recipe.id,
              recipeName: recipe.name,
              recipeEmoji: recipe.emoji,
              output: { resourceId: recipe.output.resourceId, amount: outputAmount },
              xpGained,
            })
          }

          currentQueue.shift()

          if (currentQueue.length > 0 && currentQueue[0].startedAt === 0) {
            const nextRecipe = CRAFT_RECIPES.find((r) => r.id === currentQueue[0].recipeId)
            if (nextRecipe) {
              const durationMs = currentQueue[0].isFirstTime ? FIRST_TIME_DURATION_MS : nextRecipe.craftTimeSeconds * 1000
              currentQueue[0] = { ...currentQueue[0], startedAt: now, endsAt: now + durationMs }
            }
          }
        }

        set({ queue: currentQueue, totalXp: newTotalXp, craftedOnce: newCraftedOnce })
        return completedResults
      },

      getCurrentJob: () => get().queue[0] ?? null,
      getQueueLength: () => get().queue.length,
      getProgress: () => {
        const job = get().queue[0]
        if (!job || job.startedAt === 0) return 0
        const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
        if (!recipe) return 0
        const total = job.isFirstTime ? FIRST_TIME_DURATION_MS : recipe.craftTimeSeconds * 1000
        return Math.min((Date.now() - job.startedAt) / total, 1)
      },
    }),
    {
      name: 'cooking-fantasy-craft',
      partialize: (state) => ({ queue: state.queue, totalXp: state.totalXp, craftedOnce: state.craftedOnce }),
    }
  )
)
