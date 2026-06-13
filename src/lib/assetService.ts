import { supabase } from './supabase'
import type { GameAsset, AssetCategory, AssetFormat } from '../types/asset'

export async function uploadAsset(
  file: File,
  name: string,
  category: AssetCategory,
  options: { isAnimated?: boolean; frameCount?: number; frameRate?: number } = {}
): Promise<GameAsset> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${category}/${Date.now()}_${name.replace(/\s+/g, '_')}.${ext}`

  const { data: storageData, error: storageError } = await supabase.storage
    .from('game-assets')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (storageError) throw new Error(`Upload Storage : ${storageError.message}`)

  const { data: urlData } = supabase.storage
    .from('game-assets')
    .getPublicUrl(storageData.path)

  const dimensions = await getImageDimensions(file)

  const format = ext as AssetFormat
  const isAnimated = options.isAnimated ?? false
  const frameCount = isAnimated ? (options.frameCount ?? 1) : 1
  const frameRate = options.frameRate ?? 8

  const { data, error } = await supabase
    .from('game_assets')
    .insert({
      name,
      url: urlData.publicUrl,
      category,
      format,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      is_animated: isAnimated,
      frame_count: frameCount,
      frame_rate: frameRate,
    })
    .select()
    .single()

  if (error) throw new Error(`Création asset : ${error.message}`)
  return mapAsset(data)
}

export async function fetchAssets(category?: AssetCategory): Promise<GameAsset[]> {
  let query = supabase.from('game_assets').select('*').order('created_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw new Error(`fetchAssets : ${error.message}`)
  return (data ?? []).map(mapAsset)
}

export async function fetchAssetById(id: string): Promise<GameAsset | null> {
  const { data } = await supabase.from('game_assets').select('*').eq('id', id).single()
  return data ? mapAsset(data) : null
}

export async function deleteAsset(asset: GameAsset): Promise<void> {
  const url = new URL(asset.url)
  const path = url.pathname.split('/game-assets/')[1]
  await supabase.storage.from('game-assets').remove([path])
  await supabase.from('game_assets').delete().eq('id', asset.id)
}

export async function assignSprite(
  table: string,
  elementId: string,
  assetId: string | null
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ sprite_id: assetId })
    .eq('id', elementId)
  if (error) throw new Error(`assignSprite : ${error.message}`)
}

function mapAsset(row: Record<string, unknown>): GameAsset {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    category: row.category as AssetCategory,
    format: row.format as AssetFormat,
    width: row.width as number | null,
    height: row.height as number | null,
    isAnimated: row.is_animated as boolean,
    frameCount: row.frame_count as number,
    frameRate: row.frame_rate as number,
    createdAt: row.created_at as string,
  }
}

function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}
