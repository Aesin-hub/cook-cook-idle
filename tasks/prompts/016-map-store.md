# Prompt 016 — useMapStore (brouillard de guerre + déplacement + quotas)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 015 ont été exécutés.

Structure existante pertinente :
- `src/types/map.ts` — `TileCoord`, `MAP_SIZE`, `MAP_CENTER`, `tileDistance()`,
  `travelTimeMs()`, `getAdjacentTiles()`, `getTileCulture()`, `getTileRarity()`
- `src/types/tile.ts` — `TileStatic`, `TileDynamic`, `TileFull`, `TILE_RARITY_COLORS`
- `src/lib/mapAdminService.ts` — `loadMapTiles()`
- `src/lib/supabase.ts` — client Supabase
- `src/stores/useHarvestStore.ts` — `camp`, `setCamp()`, `tick()`
- `src/stores/usePlayerStore.ts` — `isFeatureUnlocked()`, `getClassLevel()`
- `src/hooks/useGameLoop.ts` — tick 1s

## Corrections importantes à appliquer (décisions de game design)

### Explorateur niv 1 — PAS de diagonales
Le dévoilement reste toujours en 4 cardinaux uniquement (jamais de diagonales).
L'Explorateur niv 1 donne un bonus différent : révèle la **rareté** des tuiles
cardinales adjacentes sans les explorer (pas le biome, pas les ressources).

### Reset quota à minuit fixe
Le quota journalier des tuiles se réinitialise à **minuit chaque jour** (pas 24h glissantes).
Calcul : si `lastReset < minuit d'aujourd'hui` → quota reset.

### Mettre à jour `src/data/classes.json`
Modifier le niveau 1 de la classe `explorateur` :
```json
{
  "level": 1,
  "xpRequired": 50,
  "bonus": { "type": "unlock_feature", "value": 1, "feature": "reveal_adjacent_rarity" },
  "description": "Révèle la rareté des tuiles adjacentes sans les explorer"
}
```
(remplace `"feature": "reveal_diagonals"`)

---

## Objectif
Créer `useMapStore` — le store de la carte côté joueur.

Gère :
1. Chargement des tuiles statiques depuis Supabase
2. État de découverte des tuiles (hidden / revealed / explored)
3. Déplacement du camp sur la carte (avec timer de trajet)
4. Quotas journaliers par tuile (reset à minuit)
5. Barre de recherche de ressource
6. Pont avec `useHarvestStore` (les ressources de la tuile du camp)
7. Sauvegarde / chargement depuis `save_map` Supabase

---

## Règles de découverte des tuiles

### Dévoilement de base (sans classe)
- Camp posé sur tuile (x,y) → les 4 cardinaux passent en `revealed`
  - `revealed` = biome visible, rareté cachée, ressources cachées
- Tuile `explored` = biome + ressources visibles (selon difficulté, voir ci-dessous)

### Niveaux de visibilité selon la difficulté et les classes

| État tuile | ⭐ difficulté | ⭐⭐ difficulté | ⭐⭐⭐ difficulté |
|---|---|---|---|
| `revealed` (base) | Biome visible | Biome visible | Biome visible |
| `revealed` + Explorateur niv 1 | Biome + rareté | Biome + rareté | Biome seulement |
| `revealed` + Explorateur niv 2 | Biome + rareté | Biome + rareté | Biome + rareté |
| `explored` (base) | Ressources visibles | Types de ressources (pas quantités) | Biome seulement |
| `explored` + Chasseur niv requis | Ressources visibles | Ressources visibles | Ressources visibles |
| `explored` + Érudit niv 6 | Tout visible | Tout visible | Tout visible |

### Pas de diagonales — jamais
Le dévoilement se fait UNIQUEMENT en 4 cardinaux (haut, bas, gauche, droite).
Aucune classe ne débloque les diagonales. C'est une décision de game design définitive.

---

## Fichiers à créer / modifier

---

### `src/types/mapState.ts`

```typescript
import type { TileCoord } from './map'

// Visibilité calculée d'une tuile (ce que le joueur voit réellement)
export type TileVisibility =
  | 'hidden'           // invisible — dans le brouillard
  | 'biome_only'       // biome visible seulement
  | 'biome_rarity'     // biome + rareté visibles
  | 'resources_type'   // biome + rareté + types de ressources (pas quantités)
  | 'resources_full'   // tout visible

// État d'une tuile dans le save joueur
export interface TilePlayerState {
  discoveryState: 'hidden' | 'revealed' | 'explored'
  quotaRemaining: Record<string, number>  // resourceId → quantité restante aujourd'hui
  quotaLastReset: number                  // timestamp du dernier reset (minuit)
  familiarCaptured: boolean
}

// État du déplacement du camp
export interface CampTravel {
  fromCoord: TileCoord
  toCoord: TileCoord
  startedAt: number     // timestamp départ
  arrivesAt: number     // timestamp arrivée
  isInTransit: boolean
}

// État global du store carte
export interface MapState {
  // Tuiles statiques chargées depuis Supabase
  staticTiles: Record<string, import('./tile').TileStatic>  // "x_y" → TileStatic
  tilesLoaded: boolean

  // État joueur par tuile
  playerTiles: Record<string, TilePlayerState>  // "x_y" → TilePlayerState

  // Position actuelle du camp sur la carte
  campCoord: TileCoord | null

  // Déplacement en cours
  campTravel: CampTravel | null

  // Recherche
  searchQuery: string
  searchResult: TileCoord | null  // null = pas trouvé / pas encore cherché
  searchMessage: string           // message affiché au joueur
}
```

---

### `src/stores/useMapStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { loadMapTiles } from '../lib/mapAdminService'
import { usePlayerStore } from './usePlayerStore'
import { useHarvestStore } from './useHarvestStore'
import { RESOURCES } from '../data'
import {
  MAP_CENTER, tileDistance, travelTimeMs, getAdjacentTiles,
  type TileCoord,
} from '../types/map'
import type { TileStatic } from '../types/tile'
import type {
  MapState, TilePlayerState, CampTravel, TileVisibility
} from '../types/mapState'

// Minuit du jour actuel en timestamp
function getMidnightToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Clé d'une tuile : "x_y"
function tileKey(coord: TileCoord): string {
  return `${coord.x}_${coord.y}`
}

// État player par défaut pour une tuile
function defaultPlayerState(tile: TileStatic): TilePlayerState {
  const quota: Record<string, number> = {}
  for (const r of tile.resources) {
    quota[r.resourceId] = r.dailyQuota
  }
  return {
    discoveryState: 'hidden',
    quotaRemaining: quota,
    quotaLastReset: getMidnightToday(),
    familiarCaptured: false,
  }
}

interface MapActions {
  // Chargement
  loadTiles: () => Promise<void>
  loadPlayerSave: (userId: string) => Promise<void>
  saveToSupabase: (userId: string) => Promise<void>

  // Déplacement du camp
  moveCamp: (to: TileCoord) => { success: boolean; reason?: string; travelMs?: number }
  checkArrival: () => boolean  // appelé par useGameLoop — retourne true si arrivée

  // Découverte
  exploreTile: (coord: TileCoord) => void
  revealAdjacentTiles: (coord: TileCoord) => void

  // Quota
  consumeQuota: (coord: TileCoord, resourceId: string, amount: number) => number  // retourne montant réel consommé
  resetQuotasIfNeeded: () => void  // appelé au chargement + minuit

  // Visibilité calculée (selon classes du joueur)
  getTileVisibility: (coord: TileCoord) => TileVisibility

  // Recherche
  searchResource: (query: string) => void

  // Getters
  getTilePlayerState: (coord: TileCoord) => TilePlayerState | null
  getStaticTile: (coord: TileCoord) => TileStatic | null
  isTileQuotaEmpty: (coord: TileCoord) => boolean
  getQuotaResetLabel: () => string  // "Reset à minuit (dans Xh Xmin)"
}

export const useMapStore = create<MapState & MapActions>()(
  persist(
    (set, get) => ({
      staticTiles: {},
      tilesLoaded: false,
      playerTiles: {},
      campCoord: null,
      campTravel: null,
      searchQuery: '',
      searchResult: null,
      searchMessage: '',

      // ─── Chargement ───────────────────────────────────────────────────────

      loadTiles: async () => {
        if (get().tilesLoaded) return
        try {
          const tiles = await loadMapTiles()
          set({ staticTiles: tiles, tilesLoaded: true })

          // Initialiser la tuile de départ si première connexion
          const { playerTiles } = get()
          const centerKey = tileKey(MAP_CENTER)
          if (!playerTiles[centerKey]) {
            const centerTile = tiles[centerKey]
            if (centerTile) {
              set({
                playerTiles: {
                  ...playerTiles,
                  [centerKey]: {
                    ...defaultPlayerState(centerTile),
                    discoveryState: 'explored',
                  },
                },
                campCoord: MAP_CENTER,
              })
            }
          }
        } catch (err) {
          console.error('[MapStore] loadTiles error:', err)
        }
      },

      loadPlayerSave: async (userId) => {
        const { data } = await supabase
          .from('save_map')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!data) return

        // Reconstruire playerTiles depuis le save
        const playerTiles: Record<string, TilePlayerState> = {}
        const explored: string[] = data.explored_tiles ?? []
        const revealed: string[] = data.discovered_tiles ?? []
        const quotas: Record<string, any> = data.tile_quotas ?? {}
        const { staticTiles } = get()

        for (const key of [...explored, ...revealed]) {
          const tile = staticTiles[key]
          const base = tile ? defaultPlayerState(tile) : {
            discoveryState: 'hidden' as const,
            quotaRemaining: {},
            quotaLastReset: getMidnightToday(),
            familiarCaptured: false,
          }
          playerTiles[key] = {
            ...base,
            discoveryState: explored.includes(key) ? 'explored' : 'revealed',
            ...(quotas[key] ?? {}),
            familiarCaptured: (data.captured_familiars ?? []).includes(key),
          }
        }

        set({
          playerTiles,
          campCoord: data.camp_coord ?? MAP_CENTER,
        })

        // Réinitialiser les quotas si nécessaire
        get().resetQuotasIfNeeded()
      },

      saveToSupabase: async (userId) => {
        const { playerTiles, campCoord } = get()
        const exploredTiles = Object.entries(playerTiles)
          .filter(([, s]) => s.discoveryState === 'explored')
          .map(([k]) => k)
        const discoveredTiles = Object.entries(playerTiles)
          .filter(([, s]) => s.discoveryState === 'revealed')
          .map(([k]) => k)
        const tileQuotas: Record<string, any> = {}
        for (const [key, state] of Object.entries(playerTiles)) {
          if (Object.keys(state.quotaRemaining).length > 0) {
            tileQuotas[key] = {
              quotaRemaining: state.quotaRemaining,
              quotaLastReset: state.quotaLastReset,
            }
          }
        }
        const capturedFamiliars = Object.entries(playerTiles)
          .filter(([, s]) => s.familiarCaptured)
          .map(([k]) => k)

        await supabase.from('save_map').upsert({
          user_id: userId,
          explored_tiles: exploredTiles,
          discovered_tiles: discoveredTiles,
          tile_quotas: tileQuotas,
          captured_familiars: capturedFamiliars,
          camp_coord: campCoord,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      },

      // ─── Déplacement du camp ──────────────────────────────────────────────

      moveCamp: (to) => {
        const { campCoord, campTravel, playerTiles, staticTiles } = get()

        if (campTravel?.isInTransit) {
          return { success: false, reason: 'Le camp est déjà en déplacement.' }
        }

        const toKey = tileKey(to)
        const toState = playerTiles[toKey]

        if (!toState || toState.discoveryState === 'hidden') {
          return { success: false, reason: 'Cette tuile n\'est pas encore découverte.' }
        }

        const from = campCoord ?? MAP_CENTER
        const multiplier = usePlayerStore.getState().getHarvestMultipliers().travelTimeMultiplier
        const travelMs = travelTimeMs(from, to, multiplier)
        const now = Date.now()

        // Arrêter la production du camp (en transit)
        useHarvestStore.getState().removeCamp()

        set({
          campTravel: {
            fromCoord: from,
            toCoord: to,
            startedAt: now,
            arrivesAt: now + travelMs,
            isInTransit: true,
          },
        })

        return { success: true, travelMs }
      },

      checkArrival: () => {
        const { campTravel, staticTiles } = get()
        if (!campTravel?.isInTransit) return false
        if (Date.now() < campTravel.arrivesAt) return false

        // Arrivée !
        const { toCoord } = campTravel
        const toKey = tileKey(toCoord)
        const tile = staticTiles[toKey]

        // Poser le camp sur la nouvelle tuile
        // Trouver un RegionId compatible pour useHarvestStore
        // Pour l'instant on mappe biome → regionId existant
        const biomeToRegion: Record<string, string> = {
          forest: 'foret', cave: 'caverne', swamp: 'marais',
          plain: 'plaine', mountain: 'caverne', desert: 'plaine',
          volcano: 'caverne', ruins: 'foret', village: 'plaine', empty: 'foret',
        }
        const regionId = (biomeToRegion[tile?.biome ?? 'forest'] ?? 'foret') as any
        useHarvestStore.getState().setCamp(regionId)

        // Explorer la tuile + révéler les adjacentes
        get().exploreTile(toCoord)

        set({
          campCoord: toCoord,
          campTravel: null,
        })

        return true
      },

      // ─── Découverte ────────────────────────────────────────────────────────

      exploreTile: (coord) => {
        const key = tileKey(coord)
        set((state) => ({
          playerTiles: {
            ...state.playerTiles,
            [key]: {
              ...(state.playerTiles[key] ?? defaultPlayerState(state.staticTiles[key])),
              discoveryState: 'explored',
            },
          },
        }))
        // Révéler les 4 cardinaux
        get().revealAdjacentTiles(coord)
      },

      revealAdjacentTiles: (coord) => {
        const adjacent = getAdjacentTiles(coord)  // 4 cardinaux uniquement — jamais de diagonales
        const { playerTiles, staticTiles } = get()
        const updates: Record<string, TilePlayerState> = {}

        for (const adj of adjacent) {
          const key = tileKey(adj)
          const current = playerTiles[key]
          // Ne passe en revealed que si actuellement hidden
          if (!current || current.discoveryState === 'hidden') {
            const tile = staticTiles[key]
            updates[key] = {
              ...(tile ? defaultPlayerState(tile) : {
                discoveryState: 'hidden',
                quotaRemaining: {},
                quotaLastReset: getMidnightToday(),
                familiarCaptured: false,
              }),
              discoveryState: 'revealed',
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          set((state) => ({
            playerTiles: { ...state.playerTiles, ...updates },
          }))
        }
      },

      // ─── Quota ────────────────────────────────────────────────────────────

      consumeQuota: (coord, resourceId, amount) => {
        const key = tileKey(coord)
        const { playerTiles } = get()
        const state = playerTiles[key]
        if (!state) return 0

        const current = state.quotaRemaining[resourceId] ?? 0
        const consumed = Math.min(current, amount)

        set((s) => ({
          playerTiles: {
            ...s.playerTiles,
            [key]: {
              ...state,
              quotaRemaining: {
                ...state.quotaRemaining,
                [resourceId]: Math.max(0, current - consumed),
              },
            },
          },
        }))

        return consumed
      },

      resetQuotasIfNeeded: () => {
        const { playerTiles, staticTiles } = get()
        const midnight = getMidnightToday()
        let hasChanges = false
        const updated = { ...playerTiles }

        for (const [key, state] of Object.entries(playerTiles)) {
          if (state.quotaLastReset < midnight) {
            const tile = staticTiles[key]
            const freshQuota: Record<string, number> = {}
            for (const r of tile?.resources ?? []) {
              freshQuota[r.resourceId] = r.dailyQuota
            }
            updated[key] = {
              ...state,
              quotaRemaining: freshQuota,
              quotaLastReset: midnight,
            }
            hasChanges = true
          }
        }

        if (hasChanges) set({ playerTiles: updated })
      },

      // ─── Visibilité calculée ──────────────────────────────────────────────

      getTileVisibility: (coord): TileVisibility => {
        const key = tileKey(coord)
        const { playerTiles, staticTiles } = get()
        const playerState = playerTiles[key]

        if (!playerState || playerState.discoveryState === 'hidden') return 'hidden'

        const tile = staticTiles[key]
        if (!tile) return 'biome_only'

        const player = usePlayerStore.getState()
        const explorateurLevel = player.getClassLevel('explorateur')
        const eruditLevel = player.getClassLevel('erudit')
        const discoveryState = playerState.discoveryState

        // Tuile juste révélée (pas encore explorée)
        if (discoveryState === 'revealed') {
          if (explorateurLevel >= 2) return 'biome_rarity'
          if (explorateurLevel >= 1) {
            // Niv 1 : rareté visible seulement sur tuiles ⭐
            return tile.difficulty === 1 ? 'biome_rarity' : 'biome_only'
          }
          return 'biome_only'
        }

        // Tuile explorée
        if (discoveryState === 'explored') {
          // Érudit niv 6 : tout visible
          if (eruditLevel >= 6) return 'resources_full'

          // Selon difficulté
          if (tile.difficulty === 1) return 'resources_full'
          if (tile.difficulty === 2) return 'resources_type'
          if (tile.difficulty === 3) return 'biome_rarity'
        }

        return 'biome_only'
      },

      // ─── Recherche ────────────────────────────────────────────────────────

      searchResource: (query) => {
        if (!query.trim()) {
          set({ searchQuery: '', searchResult: null, searchMessage: '' })
          return
        }

        const { playerTiles, staticTiles } = get()
        const q = query.toLowerCase().trim()

        // Chercher dans les ressources des tuiles explorées
        for (const [key, playerState] of Object.entries(playerTiles)) {
          if (playerState.discoveryState !== 'explored') continue
          const tile = staticTiles[key]
          if (!tile) continue

          for (const tr of tile.resources) {
            const resource = RESOURCES.find((r) => r.id === tr.resourceId)
            if (resource?.name.toLowerCase().includes(q)) {
              const [x, y] = key.split('_').map(Number)
              set({
                searchQuery: query,
                searchResult: { x, y },
                searchMessage: `${resource.emoji} ${resource.name} trouvée en (${x}, ${y})`,
              })
              return
            }
          }
        }

        // Vérifier si la ressource existe mais n'est pas encore découverte
        const existsInGame = RESOURCES.some((r) => r.name.toLowerCase().includes(q))
        set({
          searchQuery: query,
          searchResult: null,
          searchMessage: existsInGame
            ? '🌫️ Explore davantage pour trouver cette ressource !'
            : '❌ Ressource introuvable.',
        })
      },

      // ─── Getters ──────────────────────────────────────────────────────────

      getTilePlayerState: (coord) => get().playerTiles[tileKey(coord)] ?? null,
      getStaticTile: (coord) => get().staticTiles[tileKey(coord)] ?? null,

      isTileQuotaEmpty: (coord) => {
        const state = get().playerTiles[tileKey(coord)]
        if (!state) return false
        return Object.values(state.quotaRemaining).every((q) => q === 0)
      },

      getQuotaResetLabel: () => {
        const now = new Date()
        const midnight = new Date()
        midnight.setDate(midnight.getDate() + 1)
        midnight.setHours(0, 0, 0, 0)
        const diffMs = midnight.getTime() - now.getTime()
        const h = Math.floor(diffMs / 3600000)
        const m = Math.floor((diffMs % 3600000) / 60000)
        return `Reset à minuit (dans ${h}h ${m}min)`
      },
    }),
    {
      name: 'cooking-fantasy-map',
      partialize: (state) => ({
        playerTiles: state.playerTiles,
        campCoord: state.campCoord,
        campTravel: state.campTravel,
      }),
    }
  )
)
```

---

### Mise à jour `src/hooks/useGameLoop.ts`

Ajouter la vérification d'arrivée du camp et le reset des quotas.

```typescript
// Ajouter les imports :
import { useMapStore } from '../stores/useMapStore'

// Dans l'interval, après le cook tick :
// 4. Vérifier arrivée du camp
const justArrived = useMapStore.getState().checkArrival()
if (justArrived) {
  // Le camp vient d'arriver — toast géré dans App.tsx via callback
  onCampArrived?.()
}

// 5. Reset quotas à minuit (vérification légère)
useMapStore.getState().resetQuotasIfNeeded()

// Ajouter le paramètre optionnel :
onCampArrived?: () => void
```

---

### Mise à jour `src/hooks/useLoadSave.ts`

Charger le save de la carte après le login.

```typescript
// Après applyLoadedSave(), ajouter :
import { useMapStore } from '../stores/useMapStore'

// Dans useEffect, après le chargement :
await useMapStore.getState().loadTiles()
await useMapStore.getState().loadPlayerSave(user.id)
```

---

### Mise à jour `src/lib/saveService.ts`

Sauvegarder la carte dans l'autosave.

```typescript
// Ajouter dans saveAll() :
import { useMapStore } from '../stores/useMapStore'

// Dans Promise.all([...]) :
useMapStore.getState().saveToSupabase(userId),
```

---

### Mise à jour `src/App.tsx`

Câbler le callback d'arrivée du camp.

```tsx
import { useMapStore } from './stores/useMapStore'

// Dans GameApp() :
const searchResult = useMapStore((state) => state.searchResult)

useGameLoop(
  (craftResults) => { /* toasts craft */ },
  (cookResults) => { /* toasts cook */ },
  (message) => { addToast(`🍳 ${message}`, 'success') },
  getHarvestMultipliers(),
  // Nouveau callback arrivée camp :
  () => { addToast('⛺ Camp installé ! Nouvelles ressources disponibles.', 'success') }
)
```

---

## Critères de succès

### Chargement
- [ ] `npm run build` passe sans erreur
- [ ] `useMapStore.loadTiles()` charge les tuiles depuis Supabase
- [ ] La tuile (15,15) est en état `explored` au premier chargement
- [ ] Les 4 cardinaux de (15,15) sont en état `revealed`

### Déplacement
- [ ] `moveCamp({ x: 16, y: 15 })` → `campTravel.isInTransit = true`
- [ ] Pendant le transit → `useHarvestStore.camp = null` (pas de production)
- [ ] Après `arrivesAt` → `checkArrival()` retourne `true` + camp posé
- [ ] Tuile d'arrivée passe en `explored` + ses cardinaux en `revealed`
- [ ] Impossible de déplacer le camp sur une tuile `hidden`

### Quota
- [ ] `consumeQuota()` réduit bien le quota restant
- [ ] Si quota = 0 → `isTileQuotaEmpty()` retourne `true`
- [ ] Simuler minuit (modifier `quotaLastReset` à hier) → `resetQuotasIfNeeded()` recharge les quotas
- [ ] `getQuotaResetLabel()` affiche "Reset à minuit (dans Xh Ymin)"

### Visibilité
- [ ] Tuile `revealed` sans classe → `getTileVisibility()` = `'biome_only'`
- [ ] Tuile `revealed` + Explorateur niv 1 + difficulté ⭐ → `'biome_rarity'`
- [ ] Tuile `revealed` + Explorateur niv 1 + difficulté ⭐⭐⭐ → `'biome_only'`
- [ ] Tuile `explored` + difficulté ⭐ → `'resources_full'`
- [ ] Tuile `explored` + difficulté ⭐⭐⭐ sans classe → `'biome_rarity'`

### Recherche
- [ ] `searchResource('herbe')` → `searchResult` pointe vers la tuile explorée
- [ ] `searchResource('herbe')` si non explorée → message "Explore davantage"
- [ ] `searchResource('xyz')` → message "Ressource introuvable"

### Pas de diagonales — vérification critique
- [ ] `getAdjacentTiles({ x: 5, y: 5 })` retourne exactement 4 tuiles (haut/bas/gauche/droite)
- [ ] Aucun endroit dans le code n'appelle `getAllAdjacentTiles()` pour le dévoilement

## Notes pour la suite
- Le pont `biomeToRegion` dans `checkArrival()` est temporaire — en Phase 3
  les ressources viendront directement de `tile.resources` et `useHarvestStore`
  sera mis à jour pour accepter une liste de ressources custom
- `useBestiaryStore` (prompt 018) lira `useMapStore.getStaticTile()` pour
  connaître la créature d'une tuile avant une expédition de chasse
- `save_map` est sauvegardé toutes les 30s via `useSaveManager` — cohérent
  avec les autres stores
