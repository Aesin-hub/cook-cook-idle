import { supabase } from './supabase'
import type { TileStatic } from '../types/tile'
import type { Creature } from '../types/creature'

// ─── CARTE ────────────────────────────────────────────────────────────────────

export async function loadMapTiles(): Promise<Record<string, TileStatic>> {
  const { data, error } = await supabase
    .from('game_map')
    .select('id, x, y, data')
    .order('id')

  if (error) throw new Error(`[MapAdmin] loadMapTiles: ${error.message}`)

  const result: Record<string, TileStatic> = {}
  for (const row of data ?? []) {
    result[row.id] = { ...row.data, id: row.id, x: row.x, y: row.y }
  }
  return result
}

export async function saveTile(tile: TileStatic): Promise<void> {
  const { error } = await supabase
    .from('game_map')
    .upsert(
      { id: tile.id, x: tile.x, y: tile.y, data: tile, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  if (error) throw new Error(`[MapAdmin] saveTile: ${error.message}`)
}

export async function clearTile(tileId: string, x: number, y: number): Promise<void> {
  const emptyTile: TileStatic = {
    id: tileId, x, y,
    rarity: 'common', difficulty: 1,
    biome: 'empty', culture: 'center',
    specialType: null, resources: [],
    creatureId: null, isEnabled: false,
  }
  await saveTile(emptyTile)
}

// ─── CRÉATURES ────────────────────────────────────────────────────────────────

export async function loadCreatures(): Promise<Creature[]> {
  const { data, error } = await supabase
    .from('game_creatures')
    .select('data')
    .order('id')
  if (error) throw new Error(`[MapAdmin] loadCreatures: ${error.message}`)
  return (data ?? []).map((r) => r.data as Creature)
}

export async function saveCreature(creature: Creature): Promise<void> {
  const { error } = await supabase
    .from('game_creatures')
    .upsert(
      { id: creature.id, data: creature, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  if (error) throw new Error(`[MapAdmin] saveCreature: ${error.message}`)
}

export async function deleteCreature(id: string): Promise<void> {
  const { error } = await supabase.from('game_creatures').delete().eq('id', id)
  if (error) throw new Error(`[MapAdmin] deleteCreature: ${error.message}`)
}
