import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes dans .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface SaveInventoryRow {
  user_id: string
  resources: Record<string, number>
  updated_at?: string
}

export interface SaveHarvestRow {
  user_id: string
  camp: import('../types/harvest').Camp | null
  expeditions: import('../types/harvest').Expedition[]
  last_saved_at: number
  updated_at?: string
}

export interface SaveCraftRow {
  user_id: string
  queue: import('../types/craft').CraftJob[]
  total_xp: number
  crafted_once: Record<string, boolean>
  updated_at?: string
}
