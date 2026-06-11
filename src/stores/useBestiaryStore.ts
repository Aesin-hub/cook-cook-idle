import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from './usePlayerStore'
import { useInventoryStore } from './useInventoryStore'
import { useMapStore } from './useMapStore'
import { useGameDataStore } from './useGameDataStore'
import type { BestiaryState, HuntResult, ActiveBoss, HuntHistoryEntry } from '../types/bestiary'
import type { Creature } from '../types/creature'

const BOSS_RELOAD_INTERVAL_MS = 30 * 60 * 1000
const MAX_HUNT_HISTORY = 20

interface BestiaryActions {
  loadBosses: () => Promise<void>
  loadPlayerSave: (userId: string) => Promise<void>
  saveToSupabase: (userId: string) => Promise<void>
  hunt: (tileX: number, tileY: number) => HuntResult | null
  setActiveFamiliar: (creatureId: string | null) => void
  getActiveFamiliar: () => Creature | null
  familiarTick: () => { resourceId: string; amount: number } | null
  getBossOnTile: (tileX: number, tileY: number) => ActiveBoss | null
  getActiveBosses: () => ActiveBoss[]
}

export const useBestiaryStore = create<BestiaryState & BestiaryActions>()(
  persist(
    (set, get) => ({
      capturedCreatureIds: [],
      activeFamiliarId: null,
      familiarLastTickAt: Date.now(),
      activeBosses: [],
      bossesLastLoadedAt: 0,
      huntHistory: [],

      loadBosses: async () => {
        if (Date.now() - get().bossesLastLoadedAt < BOSS_RELOAD_INTERVAL_MS) return

        const { data } = await supabase
          .from('game_boss_spawns')
          .select('*')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())

        const bosses: ActiveBoss[] = (data ?? []).map((row) => ({
          id: row.id,
          creatureId: row.creature_id,
          tileX: row.tile_x,
          tileY: row.tile_y,
          spawnedAt: new Date(row.spawned_at).getTime(),
          expiresAt: new Date(row.expires_at).getTime(),
          zone: row.zone,
        }))

        set({ activeBosses: bosses, bossesLastLoadedAt: Date.now() })
      },

      loadPlayerSave: async (userId) => {
        const { data } = await supabase
          .from('save_bestiary')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!data) return

        set({
          capturedCreatureIds: data.captured_creature_ids ?? [],
          activeFamiliarId: data.active_familiar_id ?? null,
          familiarLastTickAt: data.familiar_last_tick_at ?? Date.now(),
          huntHistory: data.hunt_history ?? [],
        })
      },

      saveToSupabase: async (userId) => {
        const { capturedCreatureIds, activeFamiliarId, familiarLastTickAt, huntHistory } = get()
        const { error } = await supabase.from('save_bestiary').upsert({
          user_id: userId,
          captured_creature_ids: capturedCreatureIds,
          active_familiar_id: activeFamiliarId,
          familiar_last_tick_at: familiarLastTickAt,
          hunt_history: huntHistory.slice(0, MAX_HUNT_HISTORY),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        if (error) console.error('[BestiaryStore] saveToSupabase error:', error.message)
      },

      hunt: (tileX, tileY) => {
        const tile = useMapStore.getState().getStaticTile({ x: tileX, y: tileY })
        if (!tile?.creatureId) return null

        const creatures = useGameDataStore.getState().creatures
        const creature = creatures.find((c) => c.id === tile.creatureId)
        if (!creature) return null

        const chasseurLevel = usePlayerStore.getState().getClassLevel('chasseur')

        let successRate = 0.1
        for (const entry of creature.huntSuccessRate) {
          if (chasseurLevel >= entry.chasseurLevel) {
            successRate = entry.successRate
          }
        }

        const dropMultiplier = usePlayerStore.getState()
          .getActiveBonuses('chasseur')
          .filter((b) => b.type === 'drop_rate_multiplier')
          .reduce((acc, b) => acc * b.value, 1.0)

        const isSuccess = Math.random() < successRate

        if (isSuccess) {
          const drops: { resourceId: string; amount: number }[] = []
          for (const drop of creature.dropResources) {
            if (Math.random() < drop.chance * dropMultiplier) {
              const amount = Math.floor(
                drop.minAmount + Math.random() * (drop.maxAmount - drop.minAmount + 1)
              )
              drops.push({ resourceId: drop.resourceId, amount })
            }
          }

          if (drops.length > 0) {
            useInventoryStore.getState().addResources(drops)
          }

          const xpGained = creature.xpOnSuccess
          usePlayerStore.getState().addXp('hunt', xpGained)

          let familiarCaptured = false
          const { capturedCreatureIds } = get()
          if (
            creature.isFamiliar &&
            !capturedCreatureIds.includes(creature.id) &&
            Math.random() < creature.captureChance
          ) {
            familiarCaptured = true
            set({ capturedCreatureIds: [...capturedCreatureIds, creature.id] })
          }

          const msgs = creature.successMessages
          const message = msgs[Math.floor(Math.random() * msgs.length)]

          const entry: HuntHistoryEntry = {
            timestamp: Date.now(),
            creatureId: creature.id,
            success: true,
            xpGained,
          }
          set((s) => ({
            huntHistory: [entry, ...s.huntHistory].slice(0, MAX_HUNT_HISTORY),
          }))

          return {
            success: true,
            creatureId: creature.id,
            creatureName: creature.name,
            creatureEmoji: creature.emoji,
            drops,
            xpGained,
            familiarCaptured,
            message: familiarCaptured
              ? `${message} 🎉 Tu as capturé ${creature.emoji} ${creature.name} comme familier !`
              : message,
          }
        } else {
          const xpGained = creature.xpOnFailure
          usePlayerStore.getState().addXp('hunt', xpGained)

          const msgs = creature.failMessages
          const message = msgs[Math.floor(Math.random() * msgs.length)]

          const entry: HuntHistoryEntry = {
            timestamp: Date.now(),
            creatureId: creature.id,
            success: false,
            xpGained,
          }
          set((s) => ({
            huntHistory: [entry, ...s.huntHistory].slice(0, MAX_HUNT_HISTORY),
          }))

          return {
            success: false,
            creatureId: creature.id,
            creatureName: creature.name,
            creatureEmoji: creature.emoji,
            drops: [],
            xpGained,
            familiarCaptured: false,
            message: `${message} (+${xpGained} XP Chasseur)`,
          }
        }
      },

      setActiveFamiliar: (creatureId) => {
        set({ activeFamiliarId: creatureId, familiarLastTickAt: Date.now() })
      },

      getActiveFamiliar: () => {
        const { activeFamiliarId } = get()
        if (!activeFamiliarId) return null
        const creatures = useGameDataStore.getState().creatures
        return creatures.find((c) => c.id === activeFamiliarId) ?? null
      },

      familiarTick: () => {
        const familiar = get().getActiveFamiliar()
        if (!familiar?.familiarBonus) return null

        const { familiarLastTickAt } = get()
        const now = Date.now()
        const elapsedMin = (now - familiarLastTickAt) / 60000
        const amount = familiar.familiarBonus.amountPerMin * elapsedMin

        set({ familiarLastTickAt: now })

        if (amount <= 0) return null
        return { resourceId: familiar.familiarBonus.resourceId, amount }
      },

      getBossOnTile: (tileX, tileY) => {
        const now = Date.now()
        return get().activeBosses.find(
          (b) => b.tileX === tileX && b.tileY === tileY && b.expiresAt > now
        ) ?? null
      },

      getActiveBosses: () => {
        const now = Date.now()
        return get().activeBosses.filter((b) => b.expiresAt > now)
      },
    }),
    {
      name: 'cooking-fantasy-bestiary',
      partialize: (state) => ({
        capturedCreatureIds: state.capturedCreatureIds,
        activeFamiliarId: state.activeFamiliarId,
        familiarLastTickAt: state.familiarLastTickAt,
        huntHistory: state.huntHistory,
      }),
    }
  )
)
