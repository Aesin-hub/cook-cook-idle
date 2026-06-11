import type { TileRarity, TileDifficulty, TileBiome, TileCulture } from './map'

export type TileSpecialType = 'ruins' | 'boss_zone' | 'village' | null

export interface TileResource {
  resourceId: string
  dailyQuota: number
}

export interface TileStatic {
  id: string
  x: number
  y: number
  rarity: TileRarity
  difficulty: TileDifficulty
  biome: TileBiome
  culture: TileCulture
  specialType: TileSpecialType
  resources: TileResource[]
  creatureId: string | null
  isEnabled: boolean
}

export interface TileDynamic {
  tileId: string
  discoveryState: 'hidden' | 'revealed' | 'explored'
  quotaRemaining: number
  quotaResetAt: number
  familiarCaptured: boolean
}

export interface TileFull extends TileStatic {
  dynamic: TileDynamic
}

export const TILE_RARITY_COLORS: Record<TileRarity, string> = {
  common:    '#636e8a',
  uncommon:  '#30d158',
  rare:      '#00d2ff',
  epic:      '#bf5af2',
  legendary: '#ff9500',
}

export const TILE_RARITY_LABELS: Record<TileRarity, string> = {
  common:    'Commun',
  uncommon:  'Peu commun',
  rare:      'Rare',
  epic:      'Épique',
  legendary: 'Légendaire',
}

export const TILE_BIOME_LABELS: Record<TileBiome, string> = {
  forest:   'Forêt',
  cave:     'Caverne',
  swamp:    'Marais',
  plain:    'Plaine',
  mountain: 'Montagne',
  desert:   'Désert',
  volcano:  'Volcan',
  ruins:    'Ruines',
  village:  'Village',
  empty:    'Terrain vide',
}

export const TILE_CULTURE_LABELS: Record<TileCulture, string> = {
  center: 'Neutre',
  north:  'Nordique',
  east:   'Asiatique',
  south:  'Arabe / Africain',
  west:   'Celtique / Médiéval',
}

