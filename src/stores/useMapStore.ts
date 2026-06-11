import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { loadMapTiles } from '../lib/mapAdminService'
import { usePlayerStore } from './usePlayerStore'
import { useHarvestStore } from './useHarvestStore'
import { RESOURCES } from '../data'
import {
  MAP_CENTER, travelTimeMs, getAdjacentTiles,
  type TileCoord,
} from '../types/map'
import type { TileStatic } from '../types/tile'
import type {
  MapState, TilePlayerState, TileVisibility,
} from '../types/mapState'

function getMidnightToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function tileKey(coord: TileCoord): string {
  return `${coord.x}_${coord.y}`
}

function defaultPlayerState(tile: TileStatic): TilePlayerState {
  const quota: Record<string, number> = {}
  for (const r of tile.resources) {
    quota[r.resourceId] = r.dailyQuota
  }
  return {
    discoveryState: 'hidden',
    quotaRemaining: quota,
    quotaLastReset: getMidnightToday(),
    familiarCaptured: false,
  }
}

const BIOME_TO_REGION: Record<string, string> = {
  forest: 'foret', cave: 'caverne', swamp: 'marais',
  plain: 'plaine', mountain: 'caverne', desert: 'plaine',
  volcano: 'caverne', ruins: 'foret', village: 'plaine', empty: 'foret',
}

interface MapActions {
  loadTiles: () => Promise<void>
  loadPlayerSave: (userId: string) => Promise<void>
  saveToSupabase: (userId: string) => Promise<void>
  moveCamp: (to: TileCoord) => { success: boolean; reason?: string; travelMs?: number }
  checkArrival: () => boolean
  exploreTile: (coord: TileCoord) => void
  revealAdjacentTiles: (coord: TileCoord) => void
  consumeQuota: (coord: TileCoord, resourceId: string, amount: number) => number
  resetQuotasIfNeeded: () => void
  getTileVisibility: (coord: TileCoord) => TileVisibility
  searchResource: (query: string) => void
  getTilePlayerState: (coord: TileCoord) => TilePlayerState | null
  getStaticTile: (coord: TileCoord) => TileStatic | null
  isTileQuotaEmpty: (coord: TileCoord) => boolean
  getQuotaResetLabel: () => string
}

export const useMapStore = create<MapState & MapActions>()(
  persist(
    (set, get) => ({
      staticTiles: {},
      tilesLoaded: false,
      playerTiles: {},
      campCoord: null,
      campTravel: null,
      searchQuery: '',
      searchResult: null,
      searchMessage: '',

      loadTiles: async () => {
        if (get().tilesLoaded) return
        try {
          const tiles = await loadMapTiles()
          set({ staticTiles: tiles, tilesLoaded: true })

          const { playerTiles } = get()
          const centerKey = tileKey(MAP_CENTER)
          if (!playerTiles[centerKey]) {
            const centerTile = tiles[centerKey]
            if (centerTile) {
              set({
                playerTiles: {
                  ...playerTiles,
                  [centerKey]: {
                    ...defaultPlayerState(centerTile),
                    discoveryState: 'explored',
                  },
                },
                campCoord: MAP_CENTER,
              })
              get().revealAdjacentTiles(MAP_CENTER)
            }
          }
        } catch (err) {
          console.error('[MapStore] loadTiles error:', err)
        }
      },

      loadPlayerSave: async (userId) => {
        const { data } = await supabase
          .from('save_map')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!data) return

        const playerTiles: Record<string, TilePlayerState> = {}
        const explored: string[] = data.explored_tiles ?? []
        const revealed: string[] = data.discovered_tiles ?? []
        const quotas: Record<string, Record<string, unknown>> = data.tile_quotas ?? {}
        const { staticTiles } = get()

        for (const key of [...explored, ...revealed]) {
          const tile = staticTiles[key]
          const base: TilePlayerState = tile ? defaultPlayerState(tile) : {
            discoveryState: 'hidden',
            quotaRemaining: {},
            quotaLastReset: getMidnightToday(),
            familiarCaptured: false,
          }
          playerTiles[key] = {
            ...base,
            discoveryState: explored.includes(key) ? 'explored' : 'revealed',
            ...(quotas[key] ?? {}),
            familiarCaptured: ((data.captured_familiars ?? []) as string[]).includes(key),
          }
        }

        set({
          playerTiles,
          campCoord: data.camp_coord ?? MAP_CENTER,
        })

        get().resetQuotasIfNeeded()
      },

      saveToSupabase: async (userId) => {
        const { playerTiles, campCoord } = get()
        const exploredTiles = Object.entries(playerTiles)
          .filter(([, s]) => s.discoveryState === 'explored')
          .map(([k]) => k)
        const discoveredTiles = Object.entries(playerTiles)
          .filter(([, s]) => s.discoveryState === 'revealed')
          .map(([k]) => k)
        const tileQuotas: Record<string, { quotaRemaining: Record<string, number>; quotaLastReset: number }> = {}
        for (const [key, state] of Object.entries(playerTiles)) {
          if (Object.keys(state.quotaRemaining).length > 0) {
            tileQuotas[key] = {
              quotaRemaining: state.quotaRemaining,
              quotaLastReset: state.quotaLastReset,
            }
          }
        }
        const capturedFamiliars = Object.entries(playerTiles)
          .filter(([, s]) => s.familiarCaptured)
          .map(([k]) => k)

        const { error } = await supabase.from('save_map').upsert({
          user_id: userId,
          explored_tiles: exploredTiles,
          discovered_tiles: discoveredTiles,
          tile_quotas: tileQuotas,
          captured_familiars: capturedFamiliars,
          camp_coord: campCoord,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        if (error) console.error('[MapStore] saveToSupabase error:', error.message)
      },

      moveCamp: (to) => {
        const { campCoord, campTravel, playerTiles } = get()

        if (campTravel?.isInTransit) {
          return { success: false, reason: 'Le camp est déjà en déplacement.' }
        }

        const toKey = tileKey(to)
        const toState = playerTiles[toKey]

        if (!toState || toState.discoveryState === 'hidden') {
          return { success: false, reason: "Cette tuile n'est pas encore découverte." }
        }

        const from = campCoord ?? MAP_CENTER
        const multiplier = usePlayerStore.getState().getHarvestMultipliers().travelTimeMultiplier
        const travelMs = travelTimeMs(from, to, multiplier)
        const now = Date.now()

        useHarvestStore.getState().removeCamp()

        set({
          campTravel: {
            fromCoord: from,
            toCoord: to,
            startedAt: now,
            arrivesAt: now + travelMs,
            isInTransit: true,
          },
        })

        return { success: true, travelMs }
      },

      checkArrival: () => {
        const { campTravel, staticTiles } = get()
        if (!campTravel?.isInTransit) return false
        if (Date.now() < campTravel.arrivesAt) return false

        const { toCoord } = campTravel
        const tile = staticTiles[tileKey(toCoord)]
        const regionId = (BIOME_TO_REGION[tile?.biome ?? 'forest'] ?? 'foret') as any
        useHarvestStore.getState().setCamp(regionId)

        get().exploreTile(toCoord)

        set({
          campCoord: toCoord,
          campTravel: null,
        })

        return true
      },

      exploreTile: (coord) => {
        const key = tileKey(coord)
        set((state) => {
          const existing = state.playerTiles[key]
          const tile = state.staticTiles[key]
          const base = existing ?? (tile ? defaultPlayerState(tile) : {
            discoveryState: 'hidden' as const,
            quotaRemaining: {},
            quotaLastReset: getMidnightToday(),
            familiarCaptured: false,
          })
          return {
            playerTiles: {
              ...state.playerTiles,
              [key]: { ...base, discoveryState: 'explored' },
            },
          }
        })
        get().revealAdjacentTiles(coord)
      },

      revealAdjacentTiles: (coord) => {
        const adjacent = getAdjacentTiles(coord)
        const { playerTiles, staticTiles } = get()
        const updates: Record<string, TilePlayerState> = {}

        for (const adj of adjacent) {
          const key = tileKey(adj)
          const current = playerTiles[key]
          if (!current || current.discoveryState === 'hidden') {
            const tile = staticTiles[key]
            updates[key] = {
              ...(tile ? defaultPlayerState(tile) : {
                discoveryState: 'hidden' as const,
                quotaRemaining: {},
                quotaLastReset: getMidnightToday(),
                familiarCaptured: false,
              }),
              discoveryState: 'revealed',
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          set((state) => ({
            playerTiles: { ...state.playerTiles, ...updates },
          }))
        }
      },

      consumeQuota: (coord, resourceId, amount) => {
        const key = tileKey(coord)
        const { playerTiles } = get()
        const state = playerTiles[key]
        if (!state) return 0

        const current = state.quotaRemaining[resourceId] ?? 0
        const consumed = Math.min(current, amount)

        set((s) => ({
          playerTiles: {
            ...s.playerTiles,
            [key]: {
              ...state,
              quotaRemaining: {
                ...state.quotaRemaining,
                [resourceId]: Math.max(0, current - consumed),
              },
            },
          },
        }))

        return consumed
      },

      resetQuotasIfNeeded: () => {
        const { playerTiles, staticTiles } = get()
        const midnight = getMidnightToday()
        let hasChanges = false
        const updated = { ...playerTiles }

        for (const [key, state] of Object.entries(playerTiles)) {
          if (state.quotaLastReset < midnight) {
            const tile = staticTiles[key]
            const freshQuota: Record<string, number> = {}
            for (const r of tile?.resources ?? []) {
              freshQuota[r.resourceId] = r.dailyQuota
            }
            updated[key] = {
              ...state,
              quotaRemaining: freshQuota,
              quotaLastReset: midnight,
            }
            hasChanges = true
          }
        }

        if (hasChanges) set({ playerTiles: updated })
      },

      getTileVisibility: (coord): TileVisibility => {
        const key = tileKey(coord)
        const { playerTiles, staticTiles } = get()
        const playerState = playerTiles[key]

        if (!playerState || playerState.discoveryState === 'hidden') return 'hidden'

        const tile = staticTiles[key]
        if (!tile) return 'biome_only'

        const player = usePlayerStore.getState()
        const explorateurLevel = player.getClassLevel('explorateur')
        const eruditLevel = player.getClassLevel('erudit')
        const { discoveryState } = playerState

        if (discoveryState === 'revealed') {
          if (explorateurLevel >= 2) return 'biome_rarity'
          if (explorateurLevel >= 1) {
            return tile.difficulty === 1 ? 'biome_rarity' : 'biome_only'
          }
          return 'biome_only'
        }

        if (discoveryState === 'explored') {
          if (eruditLevel >= 6) return 'resources_full'
          if (tile.difficulty === 1) return 'resources_full'
          if (tile.difficulty === 2) return 'resources_type'
          if (tile.difficulty === 3) return 'biome_rarity'
        }

        return 'biome_only'
      },

      searchResource: (query) => {
        if (!query.trim()) {
          set({ searchQuery: '', searchResult: null, searchMessage: '' })
          return
        }

        const { playerTiles, staticTiles } = get()
        const q = query.toLowerCase().trim()

        for (const [key, playerState] of Object.entries(playerTiles)) {
          if (playerState.discoveryState !== 'explored') continue
          const tile = staticTiles[key]
          if (!tile) continue

          for (const tr of tile.resources) {
            const resource = RESOURCES.find((r) => r.id === tr.resourceId)
            if (resource?.name.toLowerCase().includes(q)) {
              const [x, y] = key.split('_').map(Number)
              set({
                searchQuery: query,
                searchResult: { x, y },
                searchMessage: `${resource.emoji} ${resource.name} trouvée en (${x}, ${y})`,
              })
              return
            }
          }
        }

        const existsInGame = RESOURCES.some((r) => r.name.toLowerCase().includes(q))
        set({
          searchQuery: query,
          searchResult: null,
          searchMessage: existsInGame
            ? '🌫️ Explore davantage pour trouver cette ressource !'
            : '❌ Ressource introuvable.',
        })
      },

      getTilePlayerState: (coord) => get().playerTiles[tileKey(coord)] ?? null,
      getStaticTile: (coord) => get().staticTiles[tileKey(coord)] ?? null,

      isTileQuotaEmpty: (coord) => {
        const state = get().playerTiles[tileKey(coord)]
        if (!state) return false
        return Object.values(state.quotaRemaining).every((q) => q === 0)
      },

      getQuotaResetLabel: () => {
        const midnight = new Date()
        midnight.setDate(midnight.getDate() + 1)
        midnight.setHours(0, 0, 0, 0)
        const diffMs = midnight.getTime() - Date.now()
        const h = Math.floor(diffMs / 3600000)
        const m = Math.floor((diffMs % 3600000) / 60000)
        return `Reset à minuit (dans ${h}h ${m}min)`
      },
    }),
    {
      name: 'cooking-fantasy-map',
      partialize: (state) => ({
        playerTiles: state.playerTiles,
        campCoord: state.campCoord,
        campTravel: state.campTravel,
      }),
    }
  )
)
