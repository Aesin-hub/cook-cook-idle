export type AssetCategory =
  | 'tileset'
  | 'resource'
  | 'creature'
  | 'dish'
  | 'machine'
  | 'effect'

export type AssetFormat = 'png' | 'jpg' | 'webp' | 'gif'

export interface GameAsset {
  id: string
  name: string
  url: string
  category: AssetCategory
  format: AssetFormat
  width: number | null
  height: number | null
  isAnimated: boolean
  frameCount: number
  frameRate: number
  createdAt: string
}

export function getFrameWidth(asset: GameAsset): number {
  if (!asset.width || !asset.isAnimated) return asset.width ?? 32
  return Math.floor(asset.width / asset.frameCount)
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  tileset:  '🗺️ Tilesets',
  resource: '🌿 Ressources',
  creature: '🐉 Créatures',
  dish:     '🍽️ Plats',
  machine:  '⚙️ Machines',
  effect:   '✨ Effets',
}

export const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const MAX_FILE_SIZE_MB = 2
