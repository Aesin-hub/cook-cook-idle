// Coordonnées d'une tuile sur la grille 31×31
// Centre de la carte : { x: 15, y: 15 }
export interface TileCoord {
  x: number  // 0 à 30
  y: number  // 0 à 30
}

// Rareté d'une tuile (couleur)
export type TileRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

// Difficulté d'une tuile (étoiles)
export type TileDifficulty = 1 | 2 | 3

// Biome d'une tuile
export type TileBiome =
  | 'forest'
  | 'cave'
  | 'swamp'
  | 'plain'
  | 'mountain'
  | 'desert'
  | 'volcano'
  | 'ruins'
  | 'village'
  | 'empty'

// Zone culturelle (direction cardinale)
export type TileCulture =
  | 'center'   // neutre, zone de départ
  | 'north'    // Nordique / Viking
  | 'east'     // Asiatique
  | 'south'    // Arabe / Africain / Aztèque
  | 'west'     // Celtique / Médiéval

// État de découverte d'une tuile
export type TileDiscoveryState =
  | 'hidden'      // dans le brouillard, invisible
  | 'revealed'    // silhouette visible (rareté + étoiles) mais ressources cachées
  | 'explored'    // ressources connues (camp ou expédition passée)

// Multiplicateurs de bonus — appliqués par les classes (Phase 3)
// Toutes les valeurs à 1.0 par défaut (neutre)
export interface HarvestMultipliers {
  yieldMultiplier: number       // multiplicateur global de yield (Récolteur)
  expeditionMultiplier: number  // multiplicateur rendement expéditions
  travelTimeMultiplier: number  // multiplicateur temps de déplacement (< 1 = plus rapide)
  offlineCapMultiplier: number  // multiplicateur du plafond offline (1.0 = 8h)
}

// Valeurs par défaut des multiplicateurs (sans aucune classe)
export const DEFAULT_HARVEST_MULTIPLIERS: HarvestMultipliers = {
  yieldMultiplier: 1.0,
  expeditionMultiplier: 1.0,
  travelTimeMultiplier: 1.0,
  offlineCapMultiplier: 1.0,
}

// Constantes de la carte
export const MAP_SIZE = 31
export const MAP_CENTER: TileCoord = { x: 15, y: 15 }
export const BASE_TRAVEL_TIME_MS = 5 * 60 * 1000  // 5 min par case

/**
 * Calcule la distance de Manhattan entre deux tuiles.
 * Utilisée pour le temps de trajet.
 */
export function tileDistance(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Calcule le temps de trajet en ms entre deux tuiles.
 * Tient compte du multiplicateur de vitesse.
 */
export function travelTimeMs(
  from: TileCoord,
  to: TileCoord,
  travelTimeMultiplier = 1.0
): number {
  const distance = tileDistance(from, to)
  return Math.floor(BASE_TRAVEL_TIME_MS * distance * travelTimeMultiplier)
}

/**
 * Retourne les 4 tuiles adjacentes (cardinaux) d'une position.
 * Filtre les positions hors grille.
 */
export function getAdjacentTiles(pos: TileCoord): TileCoord[] {
  const candidates = [
    { x: pos.x - 1, y: pos.y },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x, y: pos.y + 1 },
  ]
  return candidates.filter(
    (c) => c.x >= 0 && c.x < MAP_SIZE && c.y >= 0 && c.y < MAP_SIZE
  )
}

/**
 * Retourne les 8 tuiles adjacentes (cardinaux + diagonales).
 * Utilisé uniquement en interne — le dévoilement reste toujours en 4 cardinaux.
 */
export function getAllAdjacentTiles(pos: TileCoord): TileCoord[] {
  const candidates: TileCoord[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue
      const nx = pos.x + dx
      const ny = pos.y + dy
      if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
        candidates.push({ x: nx, y: ny })
      }
    }
  }
  return candidates
}

/**
 * Détermine la zone culturelle d'une tuile selon sa position sur la grille.
 * Le centre (rayon 5) est neutre. Les zones s'étendent vers les bords.
 */
export function getTileCulture(pos: TileCoord): TileCulture {
  const cx = MAP_CENTER.x
  const cy = MAP_CENTER.y
  const dx = pos.x - cx
  const dy = pos.y - cy
  const dist = Math.max(Math.abs(dx), Math.abs(dy))

  if (dist <= 5) return 'center'

  if (Math.abs(dy) > Math.abs(dx)) {
    return dy < 0 ? 'north' : 'south'
  } else {
    return dx > 0 ? 'east' : 'west'
  }
}

/**
 * Détermine la rareté d'une tuile selon sa distance au centre.
 * Structure concentrique : commun au centre, légendaire aux bords.
 */
export function getTileRarity(pos: TileCoord): TileRarity {
  const dist = tileDistance(pos, MAP_CENTER)
  if (dist <= 4)  return 'common'
  if (dist <= 8)  return 'uncommon'
  if (dist <= 13) return 'rare'
  if (dist <= 18) return 'epic'
  return 'legendary'
}
