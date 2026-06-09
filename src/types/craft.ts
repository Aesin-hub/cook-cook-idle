export interface CraftJob {
  id: string
  recipeId: string
  startedAt: number
  endsAt: number
  quantity: number
  isFirstTime: boolean
}

export interface CraftState {
  queue: CraftJob[]
  totalXp: number
  craftedOnce: Record<string, boolean>
}

export interface CraftResult {
  recipeId: string
  recipeName: string
  recipeEmoji: string
  output: { resourceId: string; amount: number }
  xpGained: number
}
