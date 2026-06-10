import resourcesData from './resources.json'
import regionsData from './regions.json'
import craftRecipesData from './craft-recipes.json'
import cookRecipesData from './cook-recipes.json'
import machinesData from './machines.json'
import furnaceLevelsData from './furnace-levels.json'

import type { Resource, Region, CraftRecipe, CookRecipe } from '../types/game'
import type { Machine, FurnaceLevel } from '../types/cook'

export const RESOURCES: Resource[] = resourcesData.resources as Resource[]
export const REGIONS: Region[] = regionsData.regions as Region[]
export const CRAFT_RECIPES: CraftRecipe[] = craftRecipesData.craftRecipes as CraftRecipe[]
export const COOK_RECIPES: CookRecipe[] = cookRecipesData.cookRecipes as CookRecipe[]
export const MACHINES: Machine[] = machinesData.machines as Machine[]
export const FURNACE_LEVELS: FurnaceLevel[] = furnaceLevelsData.furnaceLevels as FurnaceLevel[]
