export interface StockThreshold {
  recipeId: string
  targetStock: number
  enabled: boolean
  priority: number
}

export interface FeedChain {
  id: string
  resourceId: string
  furnaceId: string
  enabled: boolean
}

export interface CraftAutoState {
  stockThresholds: StockThreshold[]
  feedChains: FeedChain[]
  autoEnabled: boolean
}
