import { supabase } from './supabase'
import type { SaveInventoryRow, SaveHarvestRow, SaveCraftRow } from './supabase'

// ─── SAUVEGARDE ───────────────────────────────────────────────

export async function saveInventory(
  userId: string,
  resources: Record<string, number>
): Promise<void> {
  const { error } = await supabase
    .from('save_inventory')
    .upsert(
      { user_id: userId, resources, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) console.error('[SaveService] saveInventory error:', error.message)
}

export async function saveHarvest(
  userId: string,
  camp: SaveHarvestRow['camp'],
  expeditions: SaveHarvestRow['expeditions'],
  lastSavedAt: number
): Promise<void> {
  const { error } = await supabase
    .from('save_harvest')
    .upsert(
      {
        user_id: userId,
        camp,
        expeditions,
        last_saved_at: lastSavedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  if (error) console.error('[SaveService] saveHarvest error:', error.message)
}

export async function saveCraft(
  userId: string,
  queue: SaveCraftRow['queue'],
  craftedOnce: Record<string, boolean>
): Promise<void> {
  const { error } = await supabase
    .from('save_craft')
    .upsert(
      {
        user_id: userId,
        queue,
        crafted_once: craftedOnce,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  if (error) console.error('[SaveService] saveCraft error:', error.message)
}

export async function saveAll(userId: string): Promise<void> {
  const { useInventoryStore } = await import('../stores/useInventoryStore')
  const { useHarvestStore } = await import('../stores/useHarvestStore')
  const { useCraftStore } = await import('../stores/useCraftStore')
  const { useMapStore } = await import('../stores/useMapStore')

  const inventory = useInventoryStore.getState()
  const harvest = useHarvestStore.getState()
  const craft = useCraftStore.getState()

  await Promise.all([
    saveInventory(userId, inventory.resources),
    saveHarvest(userId, harvest.camp, harvest.expeditions, harvest.lastSavedAt),
    saveCraft(userId, craft.queue, craft.craftedOnce),
    useMapStore.getState().saveToSupabase(userId),
  ])
}

// ─── CHARGEMENT ───────────────────────────────────────────────

export async function loadSave(userId: string): Promise<{
  inventory: SaveInventoryRow | null
  harvest: SaveHarvestRow | null
  craft: SaveCraftRow | null
}> {
  const [inventoryRes, harvestRes, craftRes] = await Promise.all([
    supabase.from('save_inventory').select('*').eq('user_id', userId).single(),
    supabase.from('save_harvest').select('*').eq('user_id', userId).single(),
    supabase.from('save_craft').select('*').eq('user_id', userId).single(),
  ])

  return {
    inventory: inventoryRes.data ?? null,
    harvest: harvestRes.data ?? null,
    craft: craftRes.data ?? null,
  }
}

export async function applyLoadedSave(
  inventory: SaveInventoryRow | null,
  harvest: SaveHarvestRow | null,
  craft: SaveCraftRow | null
): Promise<void> {
  const { useInventoryStore } = await import('../stores/useInventoryStore')
  const { useHarvestStore } = await import('../stores/useHarvestStore')
  const { useCraftStore } = await import('../stores/useCraftStore')

  if (inventory) {
    useInventoryStore.setState({ resources: inventory.resources })
  }

  if (harvest) {
    useHarvestStore.setState({
      camp: harvest.camp,
      expeditions: harvest.expeditions,
      lastSavedAt: harvest.last_saved_at,
    })
  }

  if (craft) {
    useCraftStore.setState({
      queue: craft.queue,
      craftedOnce: craft.crafted_once,
    })
  }
}
