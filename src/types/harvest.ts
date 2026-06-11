import type { RegionId } from './game'
import type { TileCoord } from './map'

export interface Camp {
  regionId: RegionId
  startedAt: number
  lastTickAt: number
  // Phase 3 — position sur la carte (optionnel pour l'instant)
  tileCoord?: TileCoord
}

export type ExpeditionDuration = 15 | 30 | 60 | 120

export interface Expedition {
  id: string
  resourceId: string
  regionId: RegionId
  durationMinutes: ExpeditionDuration
  startedAt: number
  endsAt: number
  collected: boolean
  // Phase 3 — position sur la carte (optionnel pour l'instant)
  tileCoord?: TileCoord
}

export interface HarvestState {
  camp: Camp | null
  expeditions: Expedition[]
  lastSavedAt: number
}

export interface HarvestYield {
  resourceId: string
  amount: number
}

export interface OfflineProgressResult {
  yields: HarvestYield[]
  elapsedMs: number
  cappedAt8h: boolean
}
