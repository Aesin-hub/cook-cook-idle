import { supabase } from './supabase'
import resourcesData from '../data/resources.json'
import regionsData from '../data/regions.json'
import craftRecipesData from '../data/craft-recipes.json'
import cookRecipesData from '../data/cook-recipes.json'
import machinesData from '../data/machines.json'
import furnaceLevelsData from '../data/furnace-levels.json'

/**
 * Insère toutes les données de jeu dans Supabase.
 * Utilise upsert — peut être relancé sans risque.
 * À appeler depuis la console du navigateur en dev : await seedGameData()
 */
export async function seedGameData(): Promise<void> {
  console.log('[Seed] Début de la migration des données de jeu...')

  const regions = regionsData.regions.map((r) => ({ id: r.id, data: r }))
  const { error: regionsError } = await supabase
    .from('game_regions')
    .upsert(regions, { onConflict: 'id' })
  if (regionsError) console.error('[Seed] Régions:', regionsError.message)
  else console.log(`[Seed] ✅ ${regions.length} régions migrées`)

  const resources = resourcesData.resources.map((r) => ({ id: r.id, data: r }))
  const { error: resourcesError } = await supabase
    .from('game_resources')
    .upsert(resources, { onConflict: 'id' })
  if (resourcesError) console.error('[Seed] Ressources:', resourcesError.message)
  else console.log(`[Seed] ✅ ${resources.length} ressources migrées`)

  const craftRecipes = craftRecipesData.craftRecipes.map((r) => ({ id: r.id, data: r }))
  const { error: craftError } = await supabase
    .from('game_craft_recipes')
    .upsert(craftRecipes, { onConflict: 'id' })
  if (craftError) console.error('[Seed] Craft recipes:', craftError.message)
  else console.log(`[Seed] ✅ ${craftRecipes.length} recettes craft migrées`)

  const cookRecipes = cookRecipesData.cookRecipes.map((r) => ({ id: r.id, data: r }))
  const { error: cookError } = await supabase
    .from('game_cook_recipes')
    .upsert(cookRecipes, { onConflict: 'id' })
  if (cookError) console.error('[Seed] Cook recipes:', cookError.message)
  else console.log(`[Seed] ✅ ${cookRecipes.length} recettes cook migrées`)

  const machines = machinesData.machines.map((m) => ({ id: m.id, data: m }))
  const { error: machinesError } = await supabase
    .from('game_machines')
    .upsert(machines, { onConflict: 'id' })
  if (machinesError) console.error('[Seed] Machines:', machinesError.message)
  else console.log(`[Seed] ✅ ${machines.length} machines migrées`)

  const furnaceLevels = furnaceLevelsData.furnaceLevels.map((f, i) => ({
    id: i + 1,
    data: f,
  }))
  const { error: furnaceError } = await supabase
    .from('game_furnace_levels')
    .upsert(furnaceLevels, { onConflict: 'id' })
  if (furnaceError) console.error('[Seed] Furnace levels:', furnaceError.message)
  else console.log(`[Seed] ✅ ${furnaceLevels.length} paliers fourneaux migrés`)

  console.log('[Seed] Migration terminée !')
}
