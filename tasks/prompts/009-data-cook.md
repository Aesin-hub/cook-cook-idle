# Prompt 009 — Données JSON Cook (machines + fourneaux + niveaux)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 008 ont été exécutés. Phase 2 — Cook layer.

Structure existante pertinente :
- `src/data/cook-recipes.json` — 3 recettes avec `productionLine`, `optimalRatio`, `xpReward`
- `src/types/game.ts` — `CookRecipe`, `ProductionStep`
- `src/data/index.ts` — exports centralisés

## Objectif
Créer les fichiers de données de la Phase 2 :
- Les **machines** de cuisine (Four, Couteau, Pétrin...)
- Les **niveaux de déblocage** des fourneaux
- Les **types TypeScript** correspondants
- Mettre à jour `src/data/index.ts`

## Décisions d'architecture
- **Tout est configurable en JSON** — ajouter une machine = ajouter une entrée JSON, zéro code
- **`speedMultiplier`** sur chaque machine — prévu pour les upgrades futurs (valeur 1.0 pour l'instant)
- **`efficiencyBonus`** sur chaque machine — prévu pour les bonus futurs (valeur 0 pour l'instant)
- **`compatibleRecipes`** — `null` = compatible avec tout, sinon liste d'IDs de recettes
- **`furnace-levels.json`** — définit à quel XP total on débloque le Nième fourneau
- Les machines sont des **amplificateurs** de ligne, pas des prérequis :
  une ligne sans machine tourne à 100% — une machine améliore la vitesse ou l'efficacité

---

## Fichiers à créer

---

### `src/data/machines.json`

```json
{
  "machines": [
    {
      "id": "four_basique",
      "name": "Four Basique",
      "emoji": "🔥",
      "description": "Un four en pierre rudimentaire. Chauffe lentement mais efficacement.",
      "tooltip": "Augmente la vitesse de cuisson de 20%. Compatible avec toutes les recettes chaudes.",
      "tier": 1,
      "speedMultiplier": 1.2,
      "efficiencyBonus": 0,
      "compatibleRecipes": null,
      "unlockLevel": 1,
      "unlockXp": 0
    },
    {
      "id": "couteau_cuisine",
      "name": "Couteau de Cuisine",
      "emoji": "🔪",
      "description": "Un couteau bien aiguisé pour découper les ingrédients avec précision.",
      "tooltip": "Réduit la consommation d'ingrédients de 10% grâce à une découpe optimale.",
      "tier": 1,
      "speedMultiplier": 1.0,
      "efficiencyBonus": 0.1,
      "compatibleRecipes": null,
      "unlockLevel": 2,
      "unlockXp": 50
    },
    {
      "id": "petrin_bois",
      "name": "Pétrin en Bois",
      "emoji": "🪵",
      "description": "Un pétrin artisanal pour travailler les pâtes.",
      "tooltip": "Spécialisé dans les recettes à base de farine. +30% de vitesse sur ces recettes.",
      "tier": 1,
      "speedMultiplier": 1.3,
      "efficiencyBonus": 0,
      "compatibleRecipes": ["pizza_fantastique"],
      "unlockLevel": 3,
      "unlockXp": 150
    },
    {
      "id": "chaudron_cuivre",
      "name": "Chaudron en Cuivre",
      "emoji": "🫕",
      "description": "Un grand chaudron pour les soupes et bouillons en grande quantité.",
      "tooltip": "Double la quantité produite par batch pour les recettes de soupe et bouillon.",
      "tier": 2,
      "speedMultiplier": 1.0,
      "efficiencyBonus": 0,
      "compatibleRecipes": ["soupe_champignons", "gelee_slime"],
      "unlockLevel": 5,
      "unlockXp": 400
    },
    {
      "id": "four_magique",
      "name": "Four Magique",
      "emoji": "✨",
      "description": "Un four enchanté aux runes elfiques. Sa chaleur est constante et parfaite.",
      "tooltip": "Vitesse ×1.5 et efficacité +15% sur toutes les recettes. Machine de tier 3.",
      "tier": 3,
      "speedMultiplier": 1.5,
      "efficiencyBonus": 0.15,
      "compatibleRecipes": null,
      "unlockLevel": 10,
      "unlockXp": 1200
    }
  ]
}
```

---

### `src/data/furnace-levels.json`

Définit combien de fourneaux sont disponibles selon le niveau XP du joueur.
Le joueur commence avec 1 fourneau. Chaque palier XP en débloque un nouveau.

```json
{
  "furnaceLevels": [
    {
      "furnaceCount": 1,
      "requiredXp": 0,
      "unlockMessage": "Ton premier fourneau est prêt. Lance ta première ligne de production !"
    },
    {
      "furnaceCount": 2,
      "requiredXp": 200,
      "unlockMessage": "Deuxième fourneau débloqué ! Tu peux maintenant cuisiner deux recettes en parallèle."
    },
    {
      "furnaceCount": 3,
      "requiredXp": 600,
      "unlockMessage": "Troisième fourneau ! Ton atelier prend forme."
    },
    {
      "furnaceCount": 4,
      "requiredXp": 1500,
      "unlockMessage": "Quatrième fourneau. Un vrai chef s'installe."
    },
    {
      "furnaceCount": 5,
      "requiredXp": 3000,
      "unlockMessage": "Cinquième fourneau ! La cuisine tourne à plein régime."
    }
  ]
}
```

---

### `src/types/cook.ts`

Types TypeScript complets pour le système Cook.

```typescript
// ─── DONNÉES JSON (lecture seule) ───────────────────────────────────────────

export interface Machine {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  tier: number                        // 1 = basique, 2 = avancé, 3 = magique
  speedMultiplier: number             // multiplicateur de vitesse (1.0 = normal)
  efficiencyBonus: number             // réduction de consommation (0 = aucune)
  compatibleRecipes: string[] | null  // null = toutes les recettes
  unlockLevel: number                 // niveau joueur requis
  unlockXp: number                    // XP total requis
}

export interface FurnaceLevel {
  furnaceCount: number
  requiredXp: number
  unlockMessage: string
}

// ─── ÉTAT JOUEUR (store Zustand) ─────────────────────────────────────────────

export type PausedReason =
  | null              // en production normale
  | 'no_recipe'       // aucune recette assignée
  | 'no_machine'      // aucune machine (production à 100% quand même — machine optionnelle)
  | 'no_stock'        // stock d'un ingrédient épuisé
  | 'paused_by_player' // joueur a mis en pause manuellement

export interface Furnace {
  id: string                  // uuid
  slotIndex: number           // position visuelle dans la liste (0, 1, 2...)
  recipeId: string | null     // recette cook assignée
  machineId: string | null    // machine assignée (optionnelle)
  active: boolean             // true = en production, false = pause joueur
  lastTickAt: number          // timestamp ms du dernier calcul
  pausedReason: PausedReason  // raison de la pause (null si en production)
  totalProduced: number       // total de plats produits sur ce fourneau (stats)
}

// ─── RÉSULTATS DE TICK ────────────────────────────────────────────────────────

export interface ResourceConsumed {
  resourceId: string
  amount: number
}

export interface ProductionResult {
  furnaceId: string
  recipeId: string
  outputResourceId: string
  outputName: string
  outputEmoji: string
  amount: number                      // plats produits durant ce tick
  resourcesConsumed: ResourceConsumed[]
  pausedReason: PausedReason          // null si production normale
  xpGained: number
}

// ─── ÉTAT GLOBAL DU STORE ────────────────────────────────────────────────────

export interface CookState {
  furnaces: Furnace[]
  totalCookXp: number                 // XP total accumulé via le cook
  unlockedFurnaceCount: number        // nombre de fourneaux actuellement débloqués
}
```

---

### Mise à jour `src/types/game.ts`

Ajouter les champs manquants sur `CookRecipe` pour supporter les machines :

```typescript
// Ajouter ce champ optionnel à l'interface CookRecipe existante :
export interface CookRecipe {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  inspired: string
  productionLine: ProductionStep[]
  optimalRatio: {
    description: string
    ratios: number[]
  }
  cookTimeSeconds: number
  outputPerBatch: number
  xpReward: number
  unlocked: boolean
  // Nouveau champ pour les machines compatibles (cohérence avec machines.json)
  // Pas besoin de l'ajouter dans cook-recipes.json — il est géré côté machines.json
}
```

---

### Mise à jour `src/data/index.ts`

Ajouter les exports des nouvelles données :

```typescript
import resourcesData from './resources.json'
import regionsData from './regions.json'
import craftRecipesData from './craft-recipes.json'
import cookRecipesData from './cook-recipes.json'
import machinesData from './machines.json'
import furnaceLevelsData from './furnace-levels.json'

export const RESOURCES = resourcesData.resources
export const REGIONS = regionsData.regions
export const CRAFT_RECIPES = craftRecipesData.craftRecipes
export const COOK_RECIPES = cookRecipesData.cookRecipes
export const MACHINES = machinesData.machines
export const FURNACE_LEVELS = furnaceLevelsData.furnaceLevels
```

---

### `src/lib/cookHelpers.ts`

Fonctions utilitaires pures pour le Cook. Aucun side-effect, pas d'accès aux stores.
Ces fonctions sont utilisées par `useCookStore` et les composants UI.

```typescript
import { COOK_RECIPES, MACHINES, FURNACE_LEVELS } from '../data'
import type { Furnace, Machine, PausedReason } from '../types/cook'

/**
 * Retourne la machine assignée à un fourneau (ou null).
 */
export function getMachineForFurnace(furnace: Furnace): Machine | null {
  if (!furnace.machineId) return null
  return MACHINES.find((m) => m.id === furnace.machineId) ?? null
}

/**
 * Calcule le multiplicateur de vitesse effectif d'un fourneau.
 * Sans machine : 1.0 (vitesse normale)
 * Avec machine incompatible : 1.0 (machine ignorée)
 */
export function getSpeedMultiplier(furnace: Furnace): number {
  const machine = getMachineForFurnace(furnace)
  if (!machine) return 1.0
  if (!furnace.recipeId) return 1.0

  // Vérifier compatibilité
  if (machine.compatibleRecipes && !machine.compatibleRecipes.includes(furnace.recipeId)) {
    return 1.0  // machine incompatible → pas de bonus
  }

  return machine.speedMultiplier
}

/**
 * Calcule le bonus d'efficacité effectif d'un fourneau.
 * L'efficacité réduit la consommation d'ingrédients.
 * efficiencyBonus: 0.1 = 10% de réduction de consommation
 */
export function getEfficiencyRate(furnace: Furnace): number {
  const machine = getMachineForFurnace(furnace)
  if (!machine) return 0

  if (machine.compatibleRecipes && furnace.recipeId &&
      !machine.compatibleRecipes.includes(furnace.recipeId)) {
    return 0  // machine incompatible
  }

  return machine.efficiencyBonus
}

/**
 * Calcule la consommation d'un ingrédient pour un elapsed donné.
 * Tient compte du speedMultiplier et de l'efficiencyBonus.
 */
export function calcIngredientConsumption(
  perMin: number,
  elapsedMs: number,
  speedMultiplier: number,
  efficiencyRate: number
): number {
  const elapsedMin = elapsedMs / 60000
  const base = perMin * elapsedMin * speedMultiplier
  const reduced = base * (1 - efficiencyRate)
  return reduced
}

/**
 * Calcule la production (outputPerBatch / cookTimeSeconds) pour un elapsed donné.
 * Tient compte du speedMultiplier.
 */
export function calcProduction(
  outputPerBatch: number,
  cookTimeSeconds: number,
  elapsedMs: number,
  speedMultiplier: number
): number {
  const elapsedSec = elapsedMs / 1000
  const batchesPerSec = (1 / cookTimeSeconds) * speedMultiplier
  return outputPerBatch * batchesPerSec * elapsedSec
}

/**
 * Vérifie si un fourneau peut produire ce tick.
 * Retourne la raison de pause ou null si tout est ok.
 */
export function checkCanProduce(
  furnace: Furnace,
  inventory: Record<string, number>,
  elapsedMs: number
): PausedReason {
  if (!furnace.active) return 'paused_by_player'
  if (!furnace.recipeId) return 'no_recipe'

  const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)
  if (!recipe) return 'no_recipe'

  const speedMultiplier = getSpeedMultiplier(furnace)
  const efficiencyRate = getEfficiencyRate(furnace)

  // Vérifier que chaque ingrédient est disponible en quantité suffisante
  for (const step of recipe.productionLine) {
    const needed = calcIngredientConsumption(
      step.perMin, elapsedMs, speedMultiplier, efficiencyRate
    )
    if ((inventory[step.resourceId] ?? 0) < needed) {
      return 'no_stock'
    }
  }

  return null  // tout est ok
}

/**
 * Retourne le nombre de fourneaux débloqués selon le XP total.
 */
export function getUnlockedFurnaceCount(totalXp: number): number {
  let count = 1
  for (const level of FURNACE_LEVELS) {
    if (totalXp >= level.requiredXp) {
      count = level.furnaceCount
    }
  }
  return count
}

/**
 * Retourne le prochain palier de déblocage de fourneau (ou null si max atteint).
 */
export function getNextFurnaceUnlock(totalXp: number): typeof FURNACE_LEVELS[0] | null {
  return FURNACE_LEVELS.find((l) => l.requiredXp > totalXp) ?? null
}

/**
 * Vérifie si une machine est compatible avec une recette.
 */
export function isMachineCompatible(machineId: string, recipeId: string): boolean {
  const machine = MACHINES.find((m) => m.id === machineId)
  if (!machine) return false
  if (!machine.compatibleRecipes) return true  // null = toutes compatibles
  return machine.compatibleRecipes.includes(recipeId)
}

/**
 * Retourne toutes les machines débloquées selon le XP total.
 */
export function getUnlockedMachines(totalXp: number): typeof MACHINES {
  return MACHINES.filter((m) => m.unlockXp <= totalXp)
}

/**
 * Formate un label de production/min pour l'UI.
 * Ex: "2.4 plats/min" ou "0.8 plats/min"
 */
export function formatProductionRate(
  outputPerBatch: number,
  cookTimeSeconds: number,
  speedMultiplier: number
): string {
  const perMin = (outputPerBatch / cookTimeSeconds) * 60 * speedMultiplier
  return `${perMin.toFixed(1)}/min`
}
```

---

## Critères de succès
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] `MACHINES` et `FURNACE_LEVELS` sont importables depuis `src/data`
- [ ] Les types `Machine`, `Furnace`, `ProductionResult`, `CookState` sont disponibles depuis `src/types/cook`
- [ ] `cookHelpers.ts` compile sans erreur
- [ ] `getUnlockedFurnaceCount(0)` retourne `1`
- [ ] `getUnlockedFurnaceCount(200)` retourne `2`
- [ ] `getSpeedMultiplier` retourne `1.2` pour un fourneau avec `four_basique`
- [ ] `isMachineCompatible('petrin_bois', 'pizza_fantastique')` retourne `true`
- [ ] `isMachineCompatible('petrin_bois', 'gelee_slime')` retourne `false`

## Notes pour la suite
- `useCookStore` (prompt 010) utilisera `checkCanProduce()` et `calcProduction()`
  à chaque tick — toute la logique métier est déjà ici dans les helpers
- `totalCookXp` dans `CookState` est distinct de `totalXp` dans `useCraftStore` —
  en Phase 3 ils fusionneront dans un `usePlayerStore` global
- Les champs `speedMultiplier` et `efficiencyBonus` valent respectivement `1.0` et `0`
  pour les machines de base — prêts à être modifiés par un futur système d'upgrade
  sans changer une ligne de code
- `compatibleRecipes: null` signifie "compatible avec tout" — convention à respecter
  pour toutes les nouvelles machines génériques
