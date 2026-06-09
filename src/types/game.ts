export type RegionId = 'foret' | 'caverne' | 'marais' | 'plaine'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic'

export interface Resource {
  id: string
  name: string
  emoji: string
  region: RegionId
  rarity: Rarity
  rarityLabel: string
  baseYieldPerMin: number
  tooltip: string
}

export interface Region {
  id: RegionId
  name: string
  emoji: string
  unlocked: boolean
  description: string
  tooltip: string
  unlockCondition: string | null
}

export interface RecipeInput {
  resourceId: string
  quantity: number
}

export interface CraftRecipe {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  inputs: RecipeInput[]
  output: { resourceId: string; quantity: number }
  craftTimeSeconds: number
  firstTimeFast: boolean
  xpReward: number
}

export interface ProductionStep {
  resourceId: string
  perMin: number
}

export interface CookRecipe {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  inspired: string
  productionLine: ProductionStep[]
  optimalRatio: {
    description: string
    ratios: number[]
  }
  cookTimeSeconds: number
  outputPerBatch: number
  xpReward: number
  unlocked: boolean
}
