import type { TileBiome, TileCulture, TileDifficulty } from './map'

export interface CreatureDrop {
  resourceId: string
  chance: number
  minAmount: number
  maxAmount: number
}

export interface HuntSuccessEntry {
  chasseurLevel: number
  successRate: number
}

export interface FamiliarBonus {
  resourceId: string
  amountPerMin: number
}

export interface Creature {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  rarityLabel: string

  compatibleBiomes: TileBiome[]
  compatibleCultures: TileCulture[]

  difficulty: TileDifficulty
  isBoss: boolean
  bossRespawnHoursMin: number
  bossRespawnHoursMax: number
  huntSuccessRate: HuntSuccessEntry[]
  captureChance: number

  xpOnSuccess: number
  xpOnFailure: number

  dropResources: CreatureDrop[]

  isFamiliar: boolean
  familiarBonus: FamiliarBonus | null

  successMessages: string[]
  failMessages: string[]
}
