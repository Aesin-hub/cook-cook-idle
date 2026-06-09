import resourcesData from './resources.json'
import regionsData from './regions.json'
import craftRecipesData from './craft-recipes.json'
import cookRecipesData from './cook-recipes.json'

import type { Resource, Region, CraftRecipe, CookRecipe } from '../types/game'

export const RESOURCES: Resource[] = resourcesData.resources as Resource[]
export const REGIONS: Region[] = regionsData.regions as Region[]
export const CRAFT_RECIPES: CraftRecipe[] = craftRecipesData.craftRecipes as CraftRecipe[]
export const COOK_RECIPES: CookRecipe[] = cookRecipesData.cookRecipes as CookRecipe[]
