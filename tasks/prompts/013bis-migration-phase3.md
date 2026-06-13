# Prompt 013-bis — Migration stores Phase 2 → Phase 3

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 013 + AUDIT ont été exécutés. Début Phase 3.

Ce prompt est une **migration préparatoire** avant d'implémenter la carte, les classes
et le bestiaire. Il ne change pas le comportement visible du jeu — il prépare
l'architecture pour accueillir la Phase 3 sans casser ce qui existe.

## Pourquoi ce prompt

Les stores existants utilisent `RegionId` ('foret', 'caverne', 'marais', 'plaine')
comme identifiant de zone. En Phase 3, le camp et les expéditions se positionnent
sur des **coordonnées de tuile** (x, y) sur une grille 31×31.

La case de départ est **(15, 15)** — centre exact de la grille 31×31.

De plus, `useGameLoop` applique les yields directement sans aucun multiplicateur.
Les classes (Phase 3) devront modifier ces yields via des multiplicateurs configurables.
Il faut préparer ce point d'extension maintenant.

## Ce que ce prompt fait

1. Ajoute le type `TileCoord` et adapte `Camp` + `Expedition` pour supporter
   les coordonnées de tuile EN PLUS de `RegionId` (rétrocompatible)
2. Ajoute un système de multiplicateurs dans `useGameLoop` (valeur 1.0 par défaut)
3. Prépare `useHarvestStore` pour recevoir des coordonnées de tuile
4. Crée `src/types/map.ts` avec les types de base de la carte
5. Met à jour `CLAUDE.md` pour documenter les changements

## Règle absolue
**Zéro régression** — le jeu doit fonctionner exactement comme avant après ce prompt.
Les RegionId existants continuent de fonctionner. On ajoute, on ne remplace pas encore.

---

## Fichiers à créer / modifier

---

### `src/types/map.ts`

Types de base pour la carte Phase 3. Ce fichier sera enrichi par les prompts suivants.

```typescript
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
 * Utilisé par la classe Explorateur niveau 1.
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

  // Zone dominante selon la direction principale
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
```

---

### Mise à jour `src/types/harvest.ts`

Ajouter `tileCoord` optionnel sur `Camp` et `Expedition` pour la Phase 3.
Les champs existants (`regionId`) restent — rétrocompatibilité totale.

```typescript
import type { RegionId } from './game'
import type { TileCoord } from './map'

export interface Camp {
  regionId: RegionId
  startedAt: number
  lastTickAt: number
  // Phase 3 — position sur la carte (optionnel pour l'instant)
  tileCoord?: TileCoord
}

export type ExpeditionDuration = 15 | 30 | 60 | 120

export interface Expedition {
  id: string
  resourceId: string
  regionId: RegionId
  durationMinutes: ExpeditionDuration
  startedAt: number
  endsAt: number
  collected: boolean
  // Phase 3 — position sur la carte (optionnel pour l'instant)
  tileCoord?: TileCoord
}

export interface HarvestState {
  camp: Camp | null
  expeditions: Expedition[]
  lastSavedAt: number
}

export interface HarvestYield {
  resourceId: string
  amount: number
}

export interface OfflineProgressResult {
  yields: HarvestYield[]
  elapsedMs: number
  cappedAt8h: boolean
}
```

---

### Mise à jour `src/hooks/useGameLoop.ts`

Ajouter le support des multiplicateurs de classes.
Les multiplicateurs sont à 1.0 par défaut — aucun changement de comportement.

```typescript
import { useEffect, useRef } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCraftStore } from '../stores/useCraftStore'
import { useCookStore } from '../stores/useCookStore'
import { DEFAULT_HARVEST_MULTIPLIERS } from '../types/map'
import type { HarvestMultipliers } from '../types/map'
import type { ProductionResult } from '../types/cook'
import type { CraftResult } from '../types/craft'

const TICK_INTERVAL_MS = 1000

export function useGameLoop(
  onCraftComplete?: (results: CraftResult[]) => void,
  onCookComplete?: (results: ProductionResult[]) => void,
  onFurnaceUnlocked?: (message: string) => void,
  // Phase 3 — multiplicateurs de classes (1.0 par défaut = neutre)
  harvestMultipliers: HarvestMultipliers = DEFAULT_HARVEST_MULTIPLIERS,
) {
  const harvestTick = useHarvestStore((state) => state.tick)
  const addResources = useInventoryStore((state) => state.addResources)
  const craftTick = useCraftStore((state) => state.processTick)
  const cookTick = useCookStore((state) => state.processTick)
  const syncFurnaceCount = useCookStore((state) => state.syncFurnaceCount)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stocker les multiplicateurs dans une ref pour éviter de recréer l'interval
  const multipliersRef = useRef(harvestMultipliers)
  multipliersRef.current = harvestMultipliers

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // 1. Harvest — avec multiplicateur de yield
      const rawYields = harvestTick()
      if (rawYields.length > 0) {
        // Appliquer le multiplicateur de yield des classes
        const multipliedYields = rawYields.map((y) => ({
          ...y,
          amount: y.amount * multipliersRef.current.yieldMultiplier,
        }))
        addResources(multipliedYields)
      }

      // 2. Craft
      const craftResults = craftTick()
      if (craftResults.length > 0) {
        onCraftComplete?.(craftResults)
        const { newFurnaceUnlocked, unlockMessage } = syncFurnaceCount()
        if (newFurnaceUnlocked && unlockMessage) {
          onFurnaceUnlocked?.(unlockMessage)
        }
      }

      // 3. Cook
      const cookResults = cookTick()
      if (cookResults.length > 0) {
        onCookComplete?.(cookResults)
        const { newFurnaceUnlocked, unlockMessage } = syncFurnaceCount()
        if (newFurnaceUnlocked && unlockMessage) {
          onFurnaceUnlocked?.(unlockMessage)
        }
      }
    }, TICK_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [harvestTick, addResources, craftTick, cookTick, syncFurnaceCount,
      onCraftComplete, onCookComplete, onFurnaceUnlocked])
}
```

---

### Mise à jour `src/App.tsx`

Passer les multiplicateurs par défaut à `useGameLoop`.
Aucun changement de comportement — juste préparation pour Phase 3.

```tsx
// Dans GameApp(), modifier l'appel useGameLoop :
// Ajouter l'import :
import { DEFAULT_HARVEST_MULTIPLIERS } from './types/map'

// L'appel useGameLoop reçoit maintenant les multiplicateurs :
useGameLoop(
  (craftResults) => { /* ... toast craft ... */ },
  (cookResults) => { /* ... toast cook ... */ },
  (message) => { addToast(`🍳 ${message}`, 'success') },
  DEFAULT_HARVEST_MULTIPLIERS  // Phase 3 : sera remplacé par useClassStore.getHarvestMultipliers()
)
```

---

### Mise à jour `CLAUDE.md`

Ajouter la section Phase 3 dans le fichier CLAUDE.md à la racine :

```markdown
## Phase 3 — Architecture (en cours)

### Carte 31×31
- Centre : { x: 15, y: 15 }
- Types dans `src/types/map.ts`
- `TileCoord`, `TileRarity`, `TileDifficulty`, `TileBiome`, `TileCulture`
- Fonctions utilitaires : `tileDistance()`, `travelTimeMs()`, `getAdjacentTiles()`,
  `getTileCulture()`, `getTileRarity()`

### Multiplicateurs de classes
- `HarvestMultipliers` dans `src/types/map.ts`
- `DEFAULT_HARVEST_MULTIPLIERS` : toutes les valeurs à 1.0 (neutre)
- Passés à `useGameLoop()` comme 4ème paramètre
- Seront fournis par `useClassStore.getHarvestMultipliers()` (prompt 017)

### Rétrocompatibilité
- `Camp.tileCoord` et `Expedition.tileCoord` sont optionnels
- `RegionId` existant continue de fonctionner
- Les stores Phase 1-2 ne sont pas modifiés en profondeur
```

---

## Critères de succès
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] Le jeu fonctionne exactement comme avant (zéro régression visible)
- [ ] `src/types/map.ts` existe avec tous les types et fonctions utilitaires
- [ ] `tileDistance({ x: 15, y: 15 }, { x: 15, y: 15 })` retourne `0`
- [ ] `tileDistance({ x: 15, y: 15 }, { x: 18, y: 19 })` retourne `7`
- [ ] `getTileCulture({ x: 15, y: 15 })` retourne `'center'`
- [ ] `getTileCulture({ x: 15, y: 0 })` retourne `'north'`
- [ ] `getTileRarity({ x: 15, y: 15 })` retourne `'common'`
- [ ] `getTileRarity({ x: 0, y: 0 })` retourne `'legendary'`
- [ ] `getAdjacentTiles({ x: 0, y: 0 })` retourne exactement 2 tuiles (pas de tuiles hors grille)
- [ ] `useGameLoop` accepte le 4ème paramètre `harvestMultipliers` sans erreur
- [ ] `Camp` et `Expedition` compilent avec le champ `tileCoord` optionnel
- [ ] `CLAUDE.md` contient la section Phase 3

## Notes pour la suite
- Le prompt 014 (`usePlayerStore`) utilisera `HarvestMultipliers` pour calculer
  les bonus des classes et les passer à `useGameLoop`
- `travelTimeMs()` sera utilisé par `useMapStore` (prompt 016) pour calculer
  le temps de déplacement entre tuiles
- `getTileCulture()` et `getTileRarity()` seront utilisés par le générateur de carte
  (prompt 015) pour assigner automatiquement les propriétés des tuiles
- La carte 31×31 = 961 tuiles — le store `useMapStore` sera optimisé pour éviter
  de stocker l'état complet de chaque tuile inutilement
