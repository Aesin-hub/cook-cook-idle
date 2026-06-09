import { CRAFT_RECIPES, RESOURCES } from '../data'
import type { CraftRecipe } from '../types/game'

export function getAllCraftRecipes(): CraftRecipe[] {
  return CRAFT_RECIPES
}

export function canAffordRecipe(recipeId: string, inventory: Record<string, number>, quantity = 1): boolean {
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId)
  if (!recipe) return false
  return recipe.inputs.every((input) => (inventory[input.resourceId] ?? 0) >= input.quantity * quantity)
}

export function getMissingReason(recipeId: string, inventory: Record<string, number>, quantity = 1): string | null {
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId)
  if (!recipe) return null
  for (const input of recipe.inputs) {
    const have = inventory[input.resourceId] ?? 0
    const need = input.quantity * quantity
    if (have < need) {
      const res = RESOURCES.find((r) => r.id === input.resourceId)
      return `Il te manque ${need - have} ${res?.emoji ?? ''} ${res?.name ?? input.resourceId}.`
    }
  }
  return null
}

export function getRemainingSeconds(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

export function formatCraftTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}
