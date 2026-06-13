# Prompt 014 — usePlayerStore (XP global + niveaux + classes)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 013-bis ont été exécutés.

Structure existante pertinente :
- `src/stores/useCraftStore.ts` — `totalXp`, `craftedOnce`
- `src/stores/useCookStore.ts` — `totalCookXp`, `getTotalXp()`
- `src/hooks/useGameLoop.ts` — accepte `HarvestMultipliers` (4ème param)
- `src/types/map.ts` — `HarvestMultipliers`, `DEFAULT_HARVEST_MULTIPLIERS`

## Objectif
Créer `usePlayerStore` — le store central de progression du joueur.
Il unifie toutes les sources d'XP et calcule les bonus de classes actifs.

## Ce que ce prompt fait
1. Crée `src/types/player.ts` — types des classes et niveaux
2. Crée `src/data/classes.json` — config des 6 classes (niveaux, bonus, XP requis)
3. Crée `src/stores/usePlayerStore.ts` — store central
4. Migre `useCraftStore` et `useCookStore` pour déléguer l'XP à `usePlayerStore`
5. Met à jour `App.tsx` pour passer les vrais multiplicateurs à `useGameLoop`

---

## Fichiers à créer

---

### `src/types/player.ts`

```typescript
// Les 6 classes du jeu
export type ClassId =
  | 'recolteur'
  | 'artisan'
  | 'cuisinier'
  | 'explorateur'
  | 'chasseur'
  | 'erudit'

// Source d'XP pour chaque classe
export type XpSource =
  | 'harvest'      // récolte → Récolteur
  | 'craft'        // craft → Artisan
  | 'cook'         // cuisine → Cuisinier
  | 'explore'      // exploration carte → Explorateur
  | 'hunt'         // chasse/capture → Chasseur
  | 'discover'     // découverte recette → Érudit

// Mapping source → classe
export const XP_SOURCE_TO_CLASS: Record<XpSource, ClassId> = {
  harvest:  'recolteur',
  craft:    'artisan',
  cook:     'cuisinier',
  explore:  'explorateur',
  hunt:     'chasseur',
  discover: 'erudit',
}

// Un bonus de classe à un niveau donné
export type BonusType =
  | 'yield_multiplier'          // multiplicateur yield récolte
  | 'expedition_multiplier'     // multiplicateur rendement expéditions
  | 'expedition_slots'          // slots d'expédition supplémentaires
  | 'travel_time_multiplier'    // multiplicateur temps de déplacement
  | 'offline_cap_multiplier'    // multiplicateur plafond offline
  | 'craft_time_multiplier'     // multiplicateur temps de craft
  | 'craft_double_chance'       // % chance de craft double
  | 'cook_speed_multiplier'     // multiplicateur vitesse cook
  | 'cook_efficiency'           // réduction consommation ingrédients cook
  | 'furnace_bonus'             // fourneaux supplémentaires
  | 'xp_multiplier'             // multiplicateur XP global
  | 'drop_rate_multiplier'      // multiplicateur drop rate créatures
  | 'unlock_feature'            // déblocage d'une feature (string)

export interface ClassBonus {
  type: BonusType
  value: number       // valeur du bonus (multiplicateur, %, ou nombre de slots)
  feature?: string    // nom de la feature débloquée si type = 'unlock_feature'
}

// Un niveau d'une classe
export interface ClassLevel {
  level: number
  xpRequired: number  // XP de classe requis pour atteindre ce niveau
  bonus: ClassBonus   // bonus débloqué à ce niveau
  description: string // texte affiché au joueur
}

// Définition complète d'une classe
export interface ClassDefinition {
  id: ClassId
  name: string
  emoji: string
  description: string
  levels: ClassLevel[]  // 10 niveaux
}

// État du joueur dans le store
export interface PlayerState {
  // XP global (toutes sources)
  totalXp: number

  // XP par classe
  classXp: Record<ClassId, number>

  // Niveau par classe (calculé depuis classXp)
  classLevels: Record<ClassId, number>

  // Timestamp de création du compte
  createdAt: number
}
```

---

### `src/data/classes.json`

Configuration complète des 6 classes avec leurs 10 niveaux.
Toutes les valeurs sont configurables via admin panel.

```json
{
  "classes": [
    {
      "id": "recolteur",
      "name": "Récolteur",
      "emoji": "🌿",
      "description": "Maîtrise de la récolte idle et des régions",
      "levels": [
        { "level": 1,  "xpRequired": 50,   "bonus": { "type": "yield_multiplier", "value": 1.1 },          "description": "+10% yield toutes ressources" },
        { "level": 2,  "xpRequired": 150,  "bonus": { "type": "expedition_slots", "value": 1 },             "description": "+1 slot d'expédition (max 4)" },
        { "level": 3,  "xpRequired": 350,  "bonus": { "type": "yield_multiplier", "value": 1.2 },           "description": "+20% yield toutes ressources" },
        { "level": 4,  "xpRequired": 700,  "bonus": { "type": "travel_time_multiplier", "value": 0.75 },    "description": "Temps de déplacement carte -25%" },
        { "level": 5,  "xpRequired": 1200, "bonus": { "type": "expedition_slots", "value": 1 },             "description": "+1 slot d'expédition (max 5)" },
        { "level": 6,  "xpRequired": 2000, "bonus": { "type": "offline_cap_multiplier", "value": 1.5 },     "description": "Offline progress plafonné à 12h" },
        { "level": 7,  "xpRequired": 3000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "dual_region_camp" }, "description": "Camp génère 2 régions simultanément" },
        { "level": 8,  "xpRequired": 4500, "bonus": { "type": "expedition_multiplier", "value": 0.8 },      "description": "Expéditions rapportent 80% au lieu de 60%" },
        { "level": 9,  "xpRequired": 6500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "auto_reveal_adjacent" }, "description": "Découverte automatique des tuiles adjacentes" },
        { "level": 10, "xpRequired": 9000, "bonus": { "type": "yield_multiplier", "value": 2.0 },           "description": "×2 sur toutes les ressources rares+" }
      ]
    },
    {
      "id": "artisan",
      "name": "Artisan",
      "emoji": "⚗️",
      "description": "Maîtrise du craft et de la transformation",
      "levels": [
        { "level": 1,  "xpRequired": 50,   "bonus": { "type": "craft_time_multiplier", "value": 0.9 },  "description": "-10% temps de craft" },
        { "level": 2,  "xpRequired": 150,  "bonus": { "type": "unlock_feature", "value": 1, "feature": "craft_queue_display" }, "description": "Affichage étendu de la file de craft" },
        { "level": 3,  "xpRequired": 350,  "bonus": { "type": "craft_time_multiplier", "value": 0.8 },  "description": "-20% temps de craft" },
        { "level": 4,  "xpRequired": 700,  "bonus": { "type": "craft_double_chance", "value": 0.1 },    "description": "10% de chance de craft double" },
        { "level": 5,  "xpRequired": 1200, "bonus": { "type": "unlock_feature", "value": 1, "feature": "craft_tier2" }, "description": "Déblocage recettes craft tier 2" },
        { "level": 6,  "xpRequired": 2000, "bonus": { "type": "craft_time_multiplier", "value": 0.7 },  "description": "-30% temps de craft" },
        { "level": 7,  "xpRequired": 3000, "bonus": { "type": "craft_double_chance", "value": 0.2 },    "description": "20% de chance de craft double" },
        { "level": 8,  "xpRequired": 4500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "bulk_craft" }, "description": "Craft en lot ×10 sans multiplicateur de temps" },
        { "level": 9,  "xpRequired": 6500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "craft_legendary" }, "description": "Déblocage recettes craft légendaires" },
        { "level": 10, "xpRequired": 9000, "bonus": { "type": "craft_time_multiplier", "value": 0.0 },  "description": "Craft instantané pour toutes les recettes communes" }
      ]
    },
    {
      "id": "cuisinier",
      "name": "Cuisinier",
      "emoji": "🍳",
      "description": "Maîtrise des lignes de production Cook",
      "levels": [
        { "level": 1,  "xpRequired": 50,   "bonus": { "type": "cook_speed_multiplier", "value": 1.1 },  "description": "+10% vitesse production" },
        { "level": 2,  "xpRequired": 150,  "bonus": { "type": "cook_efficiency", "value": 0.1 },         "description": "-10% consommation d'ingrédients" },
        { "level": 3,  "xpRequired": 350,  "bonus": { "type": "furnace_bonus", "value": 1 },             "description": "+1 fourneau supplémentaire" },
        { "level": 4,  "xpRequired": 700,  "bonus": { "type": "xp_multiplier", "value": 1.2 },           "description": "Plats produits donnent +20% XP" },
        { "level": 5,  "xpRequired": 1200, "bonus": { "type": "unlock_feature", "value": 1, "feature": "cook_tier2" }, "description": "Déblocage recettes cook régionales" },
        { "level": 6,  "xpRequired": 2000, "bonus": { "type": "cook_speed_multiplier", "value": 1.2 },  "description": "+20% vitesse production" },
        { "level": 7,  "xpRequired": 3000, "bonus": { "type": "cook_efficiency", "value": 0.2 },         "description": "-20% consommation d'ingrédients" },
        { "level": 8,  "xpRequired": 4500, "bonus": { "type": "furnace_bonus", "value": 1 },             "description": "+1 fourneau supplémentaire" },
        { "level": 9,  "xpRequired": 6500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "cook_legendary" }, "description": "Déblocage recettes cook légendaires" },
        { "level": 10, "xpRequired": 9000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "cook_partial_stock" }, "description": "Production continue même si stock partiellement vide" }
      ]
    },
    {
      "id": "explorateur",
      "name": "Explorateur",
      "emoji": "🗺️",
      "description": "Maîtrise de la carte et du brouillard de guerre",
      "levels": [
        { "level": 1,  "xpRequired": 50,   "bonus": { "type": "unlock_feature", "value": 1, "feature": "reveal_diagonals" }, "description": "Dévoilement en 8 directions" },
        { "level": 2,  "xpRequired": 150,  "bonus": { "type": "unlock_feature", "value": 1, "feature": "show_rarity_before_explore" }, "description": "Rareté des tuiles visible avant exploration" },
        { "level": 3,  "xpRequired": 350,  "bonus": { "type": "travel_time_multiplier", "value": 0.75 }, "description": "Coût déplacement -25%" },
        { "level": 4,  "xpRequired": 700,  "bonus": { "type": "unlock_feature", "value": 1, "feature": "detect_special_tiles" }, "description": "Détecte tuiles spéciales dans un rayon de 2" },
        { "level": 5,  "xpRequired": 1200, "bonus": { "type": "unlock_feature", "value": 1, "feature": "spyglass" }, "description": "Longue vue : révèle 1 tuile au choix" },
        { "level": 6,  "xpRequired": 2000, "bonus": { "type": "travel_time_multiplier", "value": 0.5 },  "description": "Coût déplacement -50%" },
        { "level": 7,  "xpRequired": 3000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "expedition_non_adjacent" }, "description": "Expéditions vers tuiles non adjacentes" },
        { "level": 8,  "xpRequired": 4500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "daily_auto_reveal" }, "description": "Dévoilement automatique d'une tuile par jour" },
        { "level": 9,  "xpRequired": 6500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "hidden_tiles_access" }, "description": "Accès aux zones cachées" },
        { "level": 10, "xpRequired": 9000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "full_rarity_reveal" }, "description": "Brouillard ne cache plus la rareté" }
      ]
    },
    {
      "id": "chasseur",
      "name": "Chasseur",
      "emoji": "🗡️",
      "description": "Maîtrise du bestiaire et des drops de créatures",
      "levels": [
        { "level": 1,  "xpRequired": 50,   "bonus": { "type": "drop_rate_multiplier", "value": 1.1 },  "description": "+10% drop rate créatures" },
        { "level": 2,  "xpRequired": 150,  "bonus": { "type": "unlock_feature", "value": 1, "feature": "basic_traps" }, "description": "Déblocage des pièges basiques" },
        { "level": 3,  "xpRequired": 350,  "bonus": { "type": "drop_rate_multiplier", "value": 1.2 },  "description": "+20% drop rate" },
        { "level": 4,  "xpRequired": 700,  "bonus": { "type": "unlock_feature", "value": 1, "feature": "boss_retry" }, "description": "Boss de zone affrontables 2×" },
        { "level": 5,  "xpRequired": 1200, "bonus": { "type": "unlock_feature", "value": 1, "feature": "familiars" }, "description": "Déblocage des familiers" },
        { "level": 6,  "xpRequired": 2000, "bonus": { "type": "drop_rate_multiplier", "value": 1.3 },  "description": "+30% drop rate" },
        { "level": 7,  "xpRequired": 3000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "advanced_traps" }, "description": "Pièges avancés — créatures épiques" },
        { "level": 8,  "xpRequired": 4500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "creature_producers" }, "description": "Créatures comme producteurs passifs" },
        { "level": 9,  "xpRequired": 6500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "boss_respawn" }, "description": "Boss de zone respecables à volonté" },
        { "level": 10, "xpRequired": 9000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "legendary_familiar" }, "description": "Familier légendaire débloqué" }
      ]
    },
    {
      "id": "erudit",
      "name": "Érudit",
      "emoji": "📚",
      "description": "Maîtrise des recettes, du lore et des bonus de connaissance",
      "levels": [
        { "level": 1,  "xpRequired": 50,   "bonus": { "type": "unlock_feature", "value": 1, "feature": "rich_tooltips" }, "description": "Tooltips enrichis (lore + stats)" },
        { "level": 2,  "xpRequired": 150,  "bonus": { "type": "xp_multiplier", "value": 1.15 },  "description": "+15% XP sur toutes les actions" },
        { "level": 3,  "xpRequired": 350,  "bonus": { "type": "unlock_feature", "value": 1, "feature": "recipe_preview" }, "description": "Aperçu des recettes verrouillées" },
        { "level": 4,  "xpRequired": 700,  "bonus": { "type": "xp_multiplier", "value": 1.25 },  "description": "+25% XP sur toutes les actions" },
        { "level": 5,  "xpRequired": 1200, "bonus": { "type": "unlock_feature", "value": 1, "feature": "recipe_journal" }, "description": "Déblocage du Journal de recettes" },
        { "level": 6,  "xpRequired": 2000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "tile_analysis" }, "description": "Analyse de tuile : ressources exactes sans explorer" },
        { "level": 7,  "xpRequired": 3000, "bonus": { "type": "xp_multiplier", "value": 1.4 },   "description": "+40% XP sur toutes les actions" },
        { "level": 8,  "xpRequired": 4500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "recipe_sharing" }, "description": "Partage de recettes (Phase 4)" },
        { "level": 9,  "xpRequired": 6500, "bonus": { "type": "unlock_feature", "value": 1, "feature": "ratio_suggestion" }, "description": "Suggestion automatique du ratio optimal" },
        { "level": 10, "xpRequired": 9000, "bonus": { "type": "unlock_feature", "value": 1, "feature": "all_recipes_preview" }, "description": "Toutes les recettes en aperçu débloqué" }
      ]
    }
  ]
}
```

---

### `src/stores/usePlayerStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import classesData from '../data/classes.json'
import type {
  ClassId, XpSource, PlayerState, ClassDefinition, ClassBonus
} from '../types/player'
import type { HarvestMultipliers } from '../types/map'
import { DEFAULT_HARVEST_MULTIPLIERS } from '../types/map'

// Toutes les classes chargées depuis le JSON
const CLASSES: ClassDefinition[] = classesData.classes as ClassDefinition[]

// Classes par ID pour accès rapide
const CLASS_MAP: Record<ClassId, ClassDefinition> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c])
) as Record<ClassId, ClassDefinition>

const ALL_CLASS_IDS: ClassId[] = [
  'recolteur', 'artisan', 'cuisinier', 'explorateur', 'chasseur', 'erudit'
]

// XP initial par classe
const INITIAL_CLASS_XP: Record<ClassId, number> = Object.fromEntries(
  ALL_CLASS_IDS.map((id) => [id, 0])
) as Record<ClassId, number>

const INITIAL_CLASS_LEVELS: Record<ClassId, number> = Object.fromEntries(
  ALL_CLASS_IDS.map((id) => [id, 0])
) as Record<ClassId, number>

interface PlayerActions {
  // Ajouter de l'XP depuis une source
  addXp: (source: XpSource, amount: number) => {
    xpGained: number
    classLeveledUp: ClassId | null
    newLevel: number | null
  }

  // Getters
  getClassLevel: (classId: ClassId) => number
  getClassXp: (classId: ClassId) => number
  getClassProgress: (classId: ClassId) => number  // 0 à 1 vers le niveau suivant

  // Calcule les multiplicateurs actifs selon les niveaux de classes
  getHarvestMultipliers: () => HarvestMultipliers

  // Vérifie si une feature est débloquée
  isFeatureUnlocked: (feature: string) => boolean

  // Retourne tous les bonus actifs d'une classe
  getActiveBonuses: (classId: ClassId) => ClassBonus[]

  // Mode debug — forcer le niveau d'une classe (dev uniquement)
  debugSetClassLevel: (classId: ClassId, level: number) => void
}

type PlayerStore = PlayerState & PlayerActions

/**
 * Calcule le niveau d'une classe depuis son XP total.
 */
function computeClassLevel(classId: ClassId, xp: number): number {
  const classDef = CLASS_MAP[classId]
  if (!classDef) return 0
  let level = 0
  for (const lvl of classDef.levels) {
    if (xp >= lvl.xpRequired) level = lvl.level
    else break
  }
  return level
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      totalXp: 0,
      classXp: { ...INITIAL_CLASS_XP },
      classLevels: { ...INITIAL_CLASS_LEVELS },
      createdAt: Date.now(),

      // ─── Ajouter XP ───────────────────────────────────────────────────────
      addXp: (source, amount) => {
        const { classXp, classLevels, totalXp } = get()
        const classId = {
          harvest: 'recolteur',
          craft: 'artisan',
          cook: 'cuisinier',
          explore: 'explorateur',
          hunt: 'chasseur',
          discover: 'erudit',
        }[source] as ClassId

        // Appliquer le multiplicateur XP de l'Érudit
        const xpMultiplier = get().getHarvestMultipliers().yieldMultiplier  // réutilisé pour XP
        const xpGained = Math.floor(amount * xpMultiplier)

        const newClassXp = { ...classXp, [classId]: classXp[classId] + xpGained }
        const newLevel = computeClassLevel(classId, newClassXp[classId])
        const oldLevel = classLevels[classId]
        const leveledUp = newLevel > oldLevel

        set({
          totalXp: totalXp + xpGained,
          classXp: newClassXp,
          classLevels: leveledUp
            ? { ...classLevels, [classId]: newLevel }
            : classLevels,
        })

        return {
          xpGained,
          classLeveledUp: leveledUp ? classId : null,
          newLevel: leveledUp ? newLevel : null,
        }
      },

      // ─── Getters ──────────────────────────────────────────────────────────
      getClassLevel: (classId) => get().classLevels[classId] ?? 0,
      getClassXp: (classId) => get().classXp[classId] ?? 0,

      getClassProgress: (classId) => {
        const { classXp, classLevels } = get()
        const currentLevel = classLevels[classId] ?? 0
        const classDef = CLASS_MAP[classId]
        if (!classDef) return 0

        const nextLevelDef = classDef.levels.find((l) => l.level === currentLevel + 1)
        if (!nextLevelDef) return 1  // niveau max atteint

        const currentLevelDef = classDef.levels.find((l) => l.level === currentLevel)
        const fromXp = currentLevelDef?.xpRequired ?? 0
        const toXp = nextLevelDef.xpRequired
        const current = classXp[classId] ?? 0

        return Math.min((current - fromXp) / (toXp - fromXp), 1)
      },

      // ─── Calculer les multiplicateurs actifs ─────────────────────────────
      getHarvestMultipliers: (): HarvestMultipliers => {
        const { classLevels } = get()

        // Accumuler les bonus de toutes les classes débloquées
        let yieldMultiplier = DEFAULT_HARVEST_MULTIPLIERS.yieldMultiplier
        let expeditionMultiplier = DEFAULT_HARVEST_MULTIPLIERS.expeditionMultiplier
        let travelTimeMultiplier = DEFAULT_HARVEST_MULTIPLIERS.travelTimeMultiplier
        let offlineCapMultiplier = DEFAULT_HARVEST_MULTIPLIERS.offlineCapMultiplier

        for (const classId of ALL_CLASS_IDS) {
          const level = classLevels[classId] ?? 0
          if (level === 0) continue

          const classDef = CLASS_MAP[classId]
          const unlockedLevels = classDef.levels.filter((l) => l.level <= level)

          for (const lvl of unlockedLevels) {
            const bonus = lvl.bonus
            switch (bonus.type) {
              case 'yield_multiplier':
                // On prend la valeur la plus haute (pas d'empilement multiplicatif)
                yieldMultiplier = Math.max(yieldMultiplier, bonus.value)
                break
              case 'expedition_multiplier':
                expeditionMultiplier = Math.max(expeditionMultiplier, bonus.value)
                break
              case 'travel_time_multiplier':
                // On prend la valeur la plus basse (plus rapide = meilleur)
                travelTimeMultiplier = Math.min(travelTimeMultiplier, bonus.value)
                break
              case 'offline_cap_multiplier':
                offlineCapMultiplier = Math.max(offlineCapMultiplier, bonus.value)
                break
            }
          }
        }

        return {
          yieldMultiplier,
          expeditionMultiplier,
          travelTimeMultiplier,
          offlineCapMultiplier,
        }
      },

      // ─── Features débloquées ──────────────────────────────────────────────
      isFeatureUnlocked: (feature) => {
        const { classLevels } = get()
        for (const classId of ALL_CLASS_IDS) {
          const level = classLevels[classId] ?? 0
          const classDef = CLASS_MAP[classId]
          const unlockedLevels = classDef.levels.filter((l) => l.level <= level)
          for (const lvl of unlockedLevels) {
            if (lvl.bonus.type === 'unlock_feature' && lvl.bonus.feature === feature) {
              return true
            }
          }
        }
        return false
      },

      getActiveBonuses: (classId) => {
        const { classLevels } = get()
        const level = classLevels[classId] ?? 0
        const classDef = CLASS_MAP[classId]
        if (!classDef || level === 0) return []
        return classDef.levels
          .filter((l) => l.level <= level)
          .map((l) => l.bonus)
      },

      // ─── Debug ────────────────────────────────────────────────────────────
      debugSetClassLevel: (classId, level) => {
        if (!import.meta.env.DEV) return
        const classDef = CLASS_MAP[classId]
        if (!classDef) return
        const levelDef = classDef.levels.find((l) => l.level === level)
        const xpRequired = levelDef?.xpRequired ?? 0

        set((state) => ({
          classXp: { ...state.classXp, [classId]: xpRequired },
          classLevels: { ...state.classLevels, [classId]: level },
        }))
        console.log(`[Debug] ${classId} → niveau ${level}`)
      },
    }),
    {
      name: 'cooking-fantasy-player',
      partialize: (state) => ({
        totalXp: state.totalXp,
        classXp: state.classXp,
        classLevels: state.classLevels,
        createdAt: state.createdAt,
      }),
    }
  )
)
```

---

### Mise à jour `src/stores/useCraftStore.ts`

Remplacer la gestion locale de `totalXp` par un appel à `usePlayerStore.addXp`.

```typescript
// Dans processTick(), remplacer :
// set({ totalXp: totalXp + xpGained })
// Par :
import { usePlayerStore } from './usePlayerStore'
// ...
usePlayerStore.getState().addXp('craft', xpGained)

// Supprimer totalXp du state initial et de partialize
// Garder craftedOnce — il reste utile pour firstTimeFast
```

### Mise à jour `src/stores/useCookStore.ts`

Même migration — remplacer `totalCookXp` par `usePlayerStore.addXp('cook', xpGained)`.

```typescript
// Dans processTick(), remplacer :
// newTotalCookXp += xpGained
// set({ totalCookXp: newTotalCookXp })
// Par :
import { usePlayerStore } from './usePlayerStore'
// ...
usePlayerStore.getState().addXp('cook', xpGained)

// La fonction getTotalXp() dans useCookStore devient :
getTotalXp: () => usePlayerStore.getState().totalXp

// syncFurnaceCount() utilise maintenant usePlayerStore.totalXp :
syncFurnaceCount: () => {
  const totalXp = usePlayerStore.getState().totalXp
  // ... reste identique
}
```

---

### Mise à jour `src/App.tsx`

Brancher les vrais multiplicateurs de classes sur `useGameLoop`.

```tsx
import { usePlayerStore } from './stores/usePlayerStore'

// Dans GameApp() :
const getHarvestMultipliers = usePlayerStore((state) => state.getHarvestMultipliers)

useGameLoop(
  (craftResults) => { /* toasts craft */ },
  (cookResults) => { /* toasts cook */ },
  (message) => { addToast(`🍳 ${message}`, 'success') },
  getHarvestMultipliers()  // ← vrais multiplicateurs des classes
)
```

---

### Exposer debugSetClassLevel en dev

Dans `src/main.tsx`, exposer pour les tests :

```typescript
if (import.meta.env.DEV) {
  import('./stores/usePlayerStore').then(({ usePlayerStore }) => {
    (window as any).debugClass = (classId: string, level: number) =>
      usePlayerStore.getState().debugSetClassLevel(classId as any, level)
    console.log('[Dev] debugClass(classId, level) disponible dans la console')
  })
}
```

---

## Critères de succès
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] `usePlayerStore` visible dans les DevTools Zustand
- [ ] Crafter un Bouillon → `classXp.artisan` augmente dans le store
- [ ] Cuisiner une Gelée → `classXp.cuisinier` augmente dans le store
- [ ] `debugClass('recolteur', 3)` en console → `classLevels.recolteur = 3`
- [ ] Après debugClass niveau 3 Récolteur → `getHarvestMultipliers().yieldMultiplier = 1.2`
- [ ] `isFeatureUnlocked('familiars')` → `false` par défaut
- [ ] Après debugClass Chasseur niveau 5 → `isFeatureUnlocked('familiars')` → `true`
- [ ] `useCraftStore` ne contient plus de `totalXp` dans son state
- [ ] `useCookStore` ne contient plus de `totalCookXp` dans son state
- [ ] Le jeu fonctionne exactement comme avant (zéro régression)

## Notes pour la suite
- `useClassStore` (prompt 017) sera simplement une couche UI au-dessus de `usePlayerStore`
- Le multiplicateur XP de l'Érudit n'est pas encore appliqué parfaitement —
  il faudra qu'`addXp` lise le bonus Érudit sans boucle infinie (à affiner en 017)
- `getHarvestMultipliers()` sera appelé à chaque render dans App.tsx —
  si les performances posent problème, passer par un `useMemo`
- `debugSetClassLevel` est désactivé en production — sécurisé par `import.meta.env.DEV`
