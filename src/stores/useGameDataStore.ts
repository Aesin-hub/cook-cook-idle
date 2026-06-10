import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Imports JSON directs pour le fallback (pas via index.ts pour éviter la dépendance circulaire)
import resourcesData from '../data/resources.json'
import regionsData from '../data/regions.json'
import craftRecipesData from '../data/craft-recipes.json'
import cookRecipesData from '../data/cook-recipes.json'
import machinesData from '../data/machines.json'
import furnaceLevelsData from '../data/furnace-levels.json'

import type { Resource, Region, CraftRecipe, CookRecipe } from '../types/game'
import type { Machine, FurnaceLevel } from '../types/cook'

interface GameDataState {
  resources: Resource[]
  regions: Region[]
  craftRecipes: CraftRecipe[]
  cookRecipes: CookRecipe[]
  machines: Machine[]
  furnaceLevels: FurnaceLevel[]
  loaded: boolean
  source: 'supabase' | 'local' | 'none'
}

interface GameDataActions {
  loadFromSupabase: () => Promise<void>
}

const LOCAL_DEFAULTS: Omit<GameDataState, 'loaded' | 'source'> = {
  resources: resourcesData.resources as Resource[],
  regions: regionsData.regions as Region[],
  craftRecipes: craftRecipesData.craftRecipes as CraftRecipe[],
  cookRecipes: cookRecipesData.cookRecipes as CookRecipe[],
  machines: machinesData.machines as Machine[],
  furnaceLevels: furnaceLevelsData.furnaceLevels as FurnaceLevel[],
}

export const useGameDataStore = create<GameDataState & GameDataActions>((set) => ({
  ...LOCAL_DEFAULTS,
  loaded: false,
  source: 'none',

  loadFromSupabase: async () => {
    try {
      const [
        regionsRes,
        resourcesRes,
        craftRes,
        cookRes,
        machinesRes,
        furnaceRes,
      ] = await Promise.all([
        supabase.from('game_regions').select('data').order('id'),
        supabase.from('game_resources').select('data').order('id'),
        supabase.from('game_craft_recipes').select('data').order('id'),
        supabase.from('game_cook_recipes').select('data').order('id'),
        supabase.from('game_machines').select('data').order('id'),
        supabase.from('game_furnace_levels').select('data').order('id'),
      ])

      const hasError = [regionsRes, resourcesRes, craftRes, cookRes, machinesRes, furnaceRes]
        .some((r) => r.error)

      if (hasError) {
        console.warn('[GameData] Erreur Supabase — fallback sur données locales')
        set({ ...LOCAL_DEFAULTS, loaded: true, source: 'local' })
        return
      }

      const resources = resourcesRes.data!.map((r) => r.data) as Resource[]
      const regions = regionsRes.data!.map((r) => r.data) as Region[]
      const craftRecipes = craftRes.data!.map((r) => r.data) as CraftRecipe[]
      const cookRecipes = cookRes.data!.map((r) => r.data) as CookRecipe[]
      const machines = machinesRes.data!.map((r) => r.data) as Machine[]
      const furnaceLevels = furnaceRes.data!.map((r) => r.data) as FurnaceLevel[]

      if (resources.length === 0) {
        console.warn('[GameData] Tables vides — fallback sur données locales. Lance seedGameData() dans la console.')
        set({ ...LOCAL_DEFAULTS, loaded: true, source: 'local' })
        return
      }

      set({ regions, resources, craftRecipes, cookRecipes, machines, furnaceLevels, loaded: true, source: 'supabase' })
      console.log('[GameData] ✅ Données chargées depuis Supabase')

    } catch (err) {
      console.warn('[GameData] Exception — fallback sur données locales:', err)
      set({ ...LOCAL_DEFAULTS, loaded: true, source: 'local' })
    }
  },
}))
