import { supabase } from './supabase'

type TableName =
  | 'game_regions'
  | 'game_resources'
  | 'game_craft_recipes'
  | 'game_cook_recipes'
  | 'game_machines'
  | 'game_furnace_levels'

export async function fetchAll<T>(table: TableName): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id, data, updated_at')
    .order('id')
  if (error) throw new Error(`[Admin] fetchAll ${table}: ${error.message}`)
  return data.map((row) => ({ ...row.data, _updatedAt: row.updated_at })) as T[]
}

export async function createEntry(table: TableName, id: string, data: object): Promise<void> {
  const { error } = await supabase
    .from(table)
    .insert({ id, data, updated_at: new Date().toISOString() })
  if (error) throw new Error(`[Admin] create ${table}: ${error.message}`)
}

export async function updateEntry(table: TableName, id: string, data: object): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`[Admin] update ${table}: ${error.message}`)
}

export async function deleteEntry(table: TableName, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
  if (error) throw new Error(`[Admin] delete ${table}: ${error.message}`)
}

export async function upsertEntry(table: TableName, id: string, data: object): Promise<void> {
  const { error } = await supabase
    .from(table)
    .upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw new Error(`[Admin] upsert ${table}: ${error.message}`)
}
