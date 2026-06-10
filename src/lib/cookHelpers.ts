import { COOK_RECIPES, MACHINES, FURNACE_LEVELS } from '../data'
import type { Furnace, Machine, PausedReason } from '../types/cook'

export function getMachineForFurnace(furnace: Furnace): Machine | null {
  if (!furnace.machineId) return null
  return MACHINES.find((m) => m.id === furnace.machineId) ?? null
}

export function getSpeedMultiplier(furnace: Furnace): number {
  const machine = getMachineForFurnace(furnace)
  if (!machine) return 1.0
  if (!furnace.recipeId) return 1.0

  if (machine.compatibleRecipes && !machine.compatibleRecipes.includes(furnace.recipeId)) {
    return 1.0
  }

  return machine.speedMultiplier
}

export function getEfficiencyRate(furnace: Furnace): number {
  const machine = getMachineForFurnace(furnace)
  if (!machine) return 0

  if (machine.compatibleRecipes && furnace.recipeId &&
      !machine.compatibleRecipes.includes(furnace.recipeId)) {
    return 0
  }

  return machine.efficiencyBonus
}

export function calcIngredientConsumption(
  perMin: number,
  elapsedMs: number,
  speedMultiplier: number,
  efficiencyRate: number
): number {
  const elapsedMin = elapsedMs / 60000
  const base = perMin * elapsedMin * speedMultiplier
  return base * (1 - efficiencyRate)
}

export function calcProduction(
  outputPerBatch: number,
  cookTimeSeconds: number,
  elapsedMs: number,
  speedMultiplier: number
): number {
  const elapsedSec = elapsedMs / 1000
  const batchesPerSec = (1 / cookTimeSeconds) * speedMultiplier
  return outputPerBatch * batchesPerSec * elapsedSec
}

export function checkCanProduce(
  furnace: Furnace,
  inventory: Record<string, number>,
  elapsedMs: number
): PausedReason {
  if (!furnace.active) return 'paused_by_player'
  if (!furnace.recipeId) return 'no_recipe'

  const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)
  if (!recipe) return 'no_recipe'

  const speedMultiplier = getSpeedMultiplier(furnace)
  const efficiencyRate = getEfficiencyRate(furnace)

  for (const step of recipe.productionLine) {
    const needed = calcIngredientConsumption(
      step.perMin, elapsedMs, speedMultiplier, efficiencyRate
    )
    if ((inventory[step.resourceId] ?? 0) < needed) {
      return 'no_stock'
    }
  }

  return null
}

export function getUnlockedFurnaceCount(totalXp: number): number {
  let count = 1
  for (const level of FURNACE_LEVELS) {
    if (totalXp >= level.requiredXp) {
      count = level.furnaceCount
    }
  }
  return count
}

export function getNextFurnaceUnlock(totalXp: number): typeof FURNACE_LEVELS[0] | null {
  return FURNACE_LEVELS.find((l) => l.requiredXp > totalXp) ?? null
}

export function isMachineCompatible(machineId: string, recipeId: string): boolean {
  const machine = MACHINES.find((m) => m.id === machineId)
  if (!machine) return false
  if (!machine.compatibleRecipes) return true
  return machine.compatibleRecipes.includes(recipeId)
}

export function getUnlockedMachines(totalXp: number): Machine[] {
  return MACHINES.filter((m) => m.unlockXp <= totalXp)
}

export function formatProductionRate(
  outputPerBatch: number,
  cookTimeSeconds: number,
  speedMultiplier: number
): string {
  const perMin = (outputPerBatch / cookTimeSeconds) * 60 * speedMultiplier
  return `${perMin.toFixed(1)}/min`
}
