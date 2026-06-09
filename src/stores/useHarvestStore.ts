import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { RESOURCES } from '../data'
import type { HarvestState, HarvestYield, Expedition, ExpeditionDuration, OfflineProgressResult } from '../types/harvest'
import type { RegionId } from '../types/game'

const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
const CAMP_MULTIPLIER = 1.0
const EXPEDITION_MULTIPLIER = 0.6
const MAX_EXPEDITIONS = 3

interface HarvestActions {
  setCamp: (regionId: RegionId) => void
  removeCamp: () => void
  startExpedition: (resourceId: string, regionId: RegionId, durationMinutes: ExpeditionDuration) => { success: boolean; reason?: string }
  collectExpedition: (expeditionId: string) => HarvestYield | null
  cancelExpedition: (expeditionId: string) => void
  tick: () => HarvestYield[]
  calculateOfflineProgress: () => OfflineProgressResult
}

type HarvestStore = HarvestState & HarvestActions

export const useHarvestStore = create<HarvestStore>()(
  persist(
    (set, get) => ({
      camp: null,
      expeditions: [],
      lastSavedAt: Date.now(),

      setCamp: (regionId) => {
        set({ camp: { regionId, startedAt: Date.now(), lastTickAt: Date.now() } })
      },

      removeCamp: () => set({ camp: null }),

      startExpedition: (resourceId, regionId, durationMinutes) => {
        const { expeditions } = get()
        const activeExpeditions = expeditions.filter((e) => !e.collected)
        if (activeExpeditions.length >= MAX_EXPEDITIONS) {
          return { success: false, reason: `Maximum ${MAX_EXPEDITIONS} expéditions simultanées.` }
        }
        const resource = RESOURCES.find((r) => r.id === resourceId && r.region === regionId)
        if (!resource) return { success: false, reason: 'Ressource introuvable dans cette région.' }

        const now = Date.now()
        const newExpedition: Expedition = {
          id: uuidv4(), resourceId, regionId, durationMinutes,
          startedAt: now, endsAt: now + durationMinutes * 60 * 1000, collected: false,
        }
        set({ expeditions: [...expeditions, newExpedition] })
        return { success: true }
      },

      collectExpedition: (expeditionId) => {
        const { expeditions } = get()
        const expedition = expeditions.find((e) => e.id === expeditionId)
        if (!expedition || expedition.collected) return null
        if (Date.now() < expedition.endsAt) return null

        const resource = RESOURCES.find((r) => r.id === expedition.resourceId)
        if (!resource) return null

        const amount = Math.floor(resource.baseYieldPerMin * expedition.durationMinutes * EXPEDITION_MULTIPLIER)
        set({ expeditions: expeditions.map((e) => e.id === expeditionId ? { ...e, collected: true } : e) })
        return { resourceId: expedition.resourceId, amount }
      },

      cancelExpedition: (expeditionId) => {
        set({ expeditions: get().expeditions.filter((e) => e.id !== expeditionId) })
      },

      tick: () => {
        const { camp } = get()
        if (!camp) return []
        const now = Date.now()
        const elapsedMin = (now - camp.lastTickAt) / 60000
        const regionResources = RESOURCES.filter((r) => r.region === camp.regionId)
        const yields: HarvestYield[] = regionResources
          .map((r) => ({ resourceId: r.id, amount: r.baseYieldPerMin * elapsedMin * CAMP_MULTIPLIER }))
          .filter((y) => y.amount > 0)
        set({ camp: { ...camp, lastTickAt: now } })
        return yields
      },

      calculateOfflineProgress: () => {
        const { camp, expeditions, lastSavedAt } = get()
        const now = Date.now()
        const rawElapsedMs = now - lastSavedAt
        const cappedAt8h = rawElapsedMs > OFFLINE_CAP_MS
        const elapsedMs = Math.min(rawElapsedMs, OFFLINE_CAP_MS)
        const elapsedMin = elapsedMs / 60000
        const allYields: HarvestYield[] = []

        if (camp) {
          const regionResources = RESOURCES.filter((r) => r.region === camp.regionId)
          regionResources.forEach((r) => allYields.push({
            resourceId: r.id,
            amount: r.baseYieldPerMin * elapsedMin * CAMP_MULTIPLIER,
          }))
          set({ camp: { ...camp, lastTickAt: now } })
        }

        const updatedExpeditions = expeditions.map((expedition) => {
          if (expedition.collected || expedition.endsAt > now) return expedition
          const resource = RESOURCES.find((r) => r.id === expedition.resourceId)
          if (!resource) return expedition
          allYields.push({
            resourceId: expedition.resourceId,
            amount: Math.floor(resource.baseYieldPerMin * expedition.durationMinutes * EXPEDITION_MULTIPLIER),
          })
          return { ...expedition, collected: true }
        })

        set({ expeditions: updatedExpeditions, lastSavedAt: now })

        const mergedYields = allYields.reduce<HarvestYield[]>((acc, y) => {
          const existing = acc.find((a) => a.resourceId === y.resourceId)
          if (existing) { existing.amount += y.amount } else { acc.push({ ...y }) }
          return acc
        }, [])

        return { yields: mergedYields, elapsedMs, cappedAt8h }
      },
    }),
    {
      name: 'cooking-fantasy-harvest',
      partialize: (state) => ({ camp: state.camp, expeditions: state.expeditions, lastSavedAt: Date.now() }),
    }
  )
)
