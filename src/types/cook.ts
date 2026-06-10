// ─── DONNÉES JSON (lecture seule) ───────────────────────────────────────────

export interface Machine {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  tier: number
  speedMultiplier: number
  efficiencyBonus: number
  compatibleRecipes: string[] | null
  unlockLevel: number
  unlockXp: number
}

export interface FurnaceLevel {
  furnaceCount: number
  requiredXp: number
  unlockMessage: string
}

// ─── ÉTAT JOUEUR (store Zustand) ─────────────────────────────────────────────

export type PausedReason =
  | null
  | 'no_recipe'
  | 'no_machine'
  | 'no_stock'
  | 'paused_by_player'

export interface Furnace {
  id: string
  slotIndex: number
  recipeId: string | null
  machineId: string | null
  active: boolean
  lastTickAt: number
  pausedReason: PausedReason
  totalProduced: number
}

// ─── RÉSULTATS DE TICK ────────────────────────────────────────────────────────

export interface ResourceConsumed {
  resourceId: string
  amount: number
}

export interface ProductionResult {
  furnaceId: string
  recipeId: string
  outputResourceId: string
  outputName: string
  outputEmoji: string
  amount: number
  resourcesConsumed: ResourceConsumed[]
  pausedReason: PausedReason
  xpGained: number
}

// ─── ÉTAT GLOBAL DU STORE ────────────────────────────────────────────────────

export interface CookState {
  furnaces: Furnace[]
  totalCookXp: number
  unlockedFurnaceCount: number
}
