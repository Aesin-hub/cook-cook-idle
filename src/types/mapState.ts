import type { TileCoord } from './map'

export type TileVisibility =
  | 'hidden'
  | 'biome_only'
  | 'biome_rarity'
  | 'resources_type'
  | 'resources_full'

export interface TilePlayerState {
  discoveryState: 'hidden' | 'revealed' | 'explored'
  quotaRemaining: Record<string, number>
  quotaLastReset: number
  familiarCaptured: boolean
}

export interface CampTravel {
  fromCoord: TileCoord
  toCoord: TileCoord
  startedAt: number
  arrivesAt: number
  isInTransit: boolean
}

export interface MapState {
  staticTiles: Record<string, import('./tile').TileStatic>
  tilesLoaded: boolean
  playerTiles: Record<string, TilePlayerState>
  campCoord: TileCoord | null
  campTravel: CampTravel | null
  searchQuery: string
  searchResult: TileCoord | null
  searchMessage: string
}
