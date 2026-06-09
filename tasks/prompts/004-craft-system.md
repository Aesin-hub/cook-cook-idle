# Prompt 004 — Système de craft (timer + file d'attente)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001, 002 et 003 ont été exécutés.

Structure existante pertinente :
- `src/data/craft-recipes.json` — recettes avec `inputs`, `output`, `craftTimeSeconds`, `xpReward`, `firstTimeFast`, `emoji`, `tooltip`
- `src/types/game.ts` — type `CraftRecipe` avec `firstTimeFast: boolean`
- `src/stores/useInventoryStore.ts` — `addResources()`, `removeResources()`, `getAmount()`
- `src/hooks/useGameLoop.ts` — tick 1s (à étendre)

## Décisions de design (issues de l'analyse marché)
- **Premier craft ultra-rapide** : si `firstTimeFast: true` sur la recette ET que
  c'est la première fois que le joueur la craft, le timer est réduit à 3s.
  Leçon "générosité perçue" : donner une récompense rapide ancre le joueur.
- **Annulation toujours possible et remboursée** : un craft en attente ou en cours
  peut toujours être annulé. Les ingrédients sont remboursés intégralement.
  Les joueurs détestent les décisions irréversibles.
- **Toasts de complétion lisibles** : quand un craft se termine, un toast affiche
  `emoji + name` de la ressource produite, pas l'ID technique. "+1 🍵 Bouillon de Base !"
- **Zéro slot craft premium** : le nombre de slots de file d'attente ne sera jamais
  augmenté via achat. La file est illimitée — c'est la durée qui est le coût, pas les slots.
- **Feedback immédiat sur stock insuffisant** : le message d'erreur indique exactement
  quelle ressource manque et de combien. "Il te manque 2 🌿 Herbe."

## Objectif
Implémenter le **système de craft complet** :
- File d'attente illimitée (les crafts s'exécutent un par un)
- Timer basé sur `craftTimeSeconds` (3s la première fois si `firstTimeFast`)
- Ingrédients débités au lancement, ressource produite créditée à la fin
- Toasts de complétion avec noms lisibles
- Gain XP + tracking "première fois" par recette

---

## Fichiers à créer / modifier

### `src/types/craft.ts`

```typescript
export interface CraftJob {
  id: string
  recipeId: string
  startedAt: number     // 0 = pas encore démarré (en attente dans la file)
  endsAt: number        // 0 = pas encore calculé
  quantity: number
  isFirstTime: boolean  // true = timer réduit à 3s (firstTimeFast)
}

export interface CraftState {
  queue: CraftJob[]
  totalXp: number
  craftedOnce: Record<string, boolean>  // recipeId → true si déjà crafté au moins 1 fois
}

export interface CraftResult {
  recipeId: string
  recipeName: string
  recipeEmoji: string
  output: { resourceId: string; amount: number }
  xpGained: number
}
```

---

### `src/stores/useCraftStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { CRAFT_RECIPES } from '../data'
import { useInventoryStore } from './useInventoryStore'
import type { CraftJob, CraftState, CraftResult } from '../types/craft'

const FIRST_TIME_DURATION_MS = 3000  // 3s pour le premier craft (générosité perçue)

interface CraftActions {
  enqueueCraft: (recipeId: string, quantity?: number) => { success: boolean; reason?: string }
  cancelCraft: (jobId: string) => void   // toujours possible, toujours remboursé
  processTick: () => CraftResult[]
  getCurrentJob: () => CraftJob | null
  getQueueLength: () => number
  getProgress: () => number              // 0 à 1
}

export const useCraftStore = create<CraftState & CraftActions>()(
  persist(
    (set, get) => ({
      queue: [],
      totalXp: 0,
      craftedOnce: {},

      enqueueCraft: (recipeId, quantity = 1) => {
        const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId)
        if (!recipe) return { success: false, reason: 'Recette introuvable.' }

        const { removeResources, getAmount } = useInventoryStore.getState()
        const totalInputs = recipe.inputs.map((input) => ({
          resourceId: input.resourceId,
          amount: input.quantity * quantity,
        }))

        // Message d'erreur précis : indiquer quelle ressource manque et de combien
        for (const { resourceId, amount } of totalInputs) {
          const have = getAmount(resourceId)
          if (have < amount) {
            const res = CRAFT_RECIPES.flatMap((r) => r.inputs).find((i) => i.resourceId === resourceId)
            return {
              success: false,
              reason: `Il te manque ${amount - have} × ${resourceId}.`,
            }
          }
        }

        removeResources(totalInputs)

        const { queue, craftedOnce } = get()
        const isFirstTime = recipe.firstTimeFast && !craftedOnce[recipeId]
        const isFirst = queue.length === 0
        const now = Date.now()
        const durationMs = isFirstTime ? FIRST_TIME_DURATION_MS : recipe.craftTimeSeconds * 1000

        const newJob: CraftJob = {
          id: uuidv4(),
          recipeId,
          quantity,
          isFirstTime,
          startedAt: isFirst ? now : 0,
          endsAt: isFirst ? now + durationMs : 0,
        }

        set({ queue: [...queue, newJob] })
        return { success: true }
      },

      // Annulation toujours possible, remboursement intégral
      cancelCraft: (jobId) => {
        const { queue } = get()
        const job = queue.find((j) => j.id === jobId)
        if (!job) return
        const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
        if (!recipe) return
        const refund = recipe.inputs.map((input) => ({
          resourceId: input.resourceId,
          amount: input.quantity * job.quantity,
        }))
        useInventoryStore.getState().addResources(refund)
        set({ queue: queue.filter((j) => j.id !== jobId) })
      },

      processTick: () => {
        const { queue, totalXp, craftedOnce } = get()
        if (queue.length === 0) return []

        const now = Date.now()
        const completedResults: CraftResult[] = []
        let currentQueue = [...queue]
        let newTotalXp = totalXp
        const newCraftedOnce = { ...craftedOnce }

        while (currentQueue.length > 0) {
          const job = currentQueue[0]

          // Démarrer un job en attente
          if (job.startedAt === 0) {
            const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
            if (!recipe) { currentQueue.shift(); continue }
            const durationMs = job.isFirstTime ? FIRST_TIME_DURATION_MS : recipe.craftTimeSeconds * 1000
            currentQueue[0] = { ...job, startedAt: now, endsAt: now + durationMs }
            break
          }

          // Pas encore terminé
          if (now < job.endsAt) break

          // ✅ Craft terminé
          const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
          if (recipe) {
            const outputAmount = recipe.output.quantity * job.quantity
            const xpGained = recipe.xpReward * job.quantity
            useInventoryStore.getState().addResources([{ resourceId: recipe.output.resourceId, amount: outputAmount }])
            newTotalXp += xpGained
            newCraftedOnce[recipe.id] = true  // marquer comme crafté au moins une fois

            // Toast lisible : emoji + nom, jamais l'ID technique
            completedResults.push({
              recipeId: recipe.id,
              recipeName: recipe.name,
              recipeEmoji: recipe.emoji,
              output: { resourceId: recipe.output.resourceId, amount: outputAmount },
              xpGained,
            })
          }

          currentQueue.shift()

          // Démarrer le suivant immédiatement
          if (currentQueue.length > 0 && currentQueue[0].startedAt === 0) {
            const nextRecipe = CRAFT_RECIPES.find((r) => r.id === currentQueue[0].recipeId)
            if (nextRecipe) {
              const durationMs = currentQueue[0].isFirstTime ? FIRST_TIME_DURATION_MS : nextRecipe.craftTimeSeconds * 1000
              currentQueue[0] = { ...currentQueue[0], startedAt: now, endsAt: now + durationMs }
            }
          }
        }

        set({ queue: currentQueue, totalXp: newTotalXp, craftedOnce: newCraftedOnce })
        return completedResults
      },

      getCurrentJob: () => get().queue[0] ?? null,
      getQueueLength: () => get().queue.length,
      getProgress: () => {
        const job = get().queue[0]
        if (!job || job.startedAt === 0) return 0
        const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId)
        if (!recipe) return 0
        const total = job.isFirstTime ? FIRST_TIME_DURATION_MS : recipe.craftTimeSeconds * 1000
        return Math.min((Date.now() - job.startedAt) / total, 1)
      },
    }),
    {
      name: 'cooking-fantasy-craft',
      partialize: (state) => ({ queue: state.queue, totalXp: state.totalXp, craftedOnce: state.craftedOnce }),
    }
  )
)
```

---

### Mise à jour `src/hooks/useGameLoop.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCraftStore } from '../stores/useCraftStore'

const TICK_INTERVAL_MS = 1000

/**
 * Boucle principale du jeu — 1 tick / seconde.
 * Retourne les CraftResult pour que l'UI puisse afficher des toasts.
 */
export function useGameLoop(onCraftComplete?: (results: ReturnType<typeof useCraftStore.getState>['queue']) => void) {
  const harvestTick = useHarvestStore((state) => state.tick)
  const addResources = useInventoryStore((state) => state.addResources)
  const craftTick = useCraftStore((state) => state.processTick)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // 1. Harvest
      const harvestYields = harvestTick()
      if (harvestYields.length > 0) addResources(harvestYields)

      // 2. Craft — les résultats sont passés au callback pour afficher les toasts
      const craftResults = craftTick()
      if (craftResults.length > 0 && onCraftComplete) {
        onCraftComplete(craftResults as any)
      }
    }, TICK_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [harvestTick, addResources, craftTick, onCraftComplete])
}
```

---

### `src/lib/craftHelpers.ts`

```typescript
import { CRAFT_RECIPES } from '../data'
import { RESOURCES } from '../data'
import type { CraftRecipe } from '../types/game'

export function getAllCraftRecipes(): CraftRecipe[] {
  return CRAFT_RECIPES
}

/**
 * Vérifie si le joueur peut se permettre une recette.
 * Pure fonction — ne modifie pas l'inventaire.
 */
export function canAffordRecipe(recipeId: string, inventory: Record<string, number>, quantity = 1): boolean {
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId)
  if (!recipe) return false
  return recipe.inputs.every((input) => (inventory[input.resourceId] ?? 0) >= input.quantity * quantity)
}

/**
 * Retourne le message d'erreur précis si le joueur n'a pas assez de ressources.
 * Format : "Il te manque 2 🌿 Herbe."
 */
export function getMissingReason(recipeId: string, inventory: Record<string, number>, quantity = 1): string | null {
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId)
  if (!recipe) return null
  for (const input of recipe.inputs) {
    const have = inventory[input.resourceId] ?? 0
    const need = input.quantity * quantity
    if (have < need) {
      const res = RESOURCES.find((r) => r.id === input.resourceId)
      return `Il te manque ${need - have} ${res?.emoji ?? ''} ${res?.name ?? input.resourceId}.`
    }
  }
  return null
}

export function getRemainingSeconds(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

export function formatCraftTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}
```

---

## Critères de succès
- [ ] `npm run build` sans erreur TypeScript
- [ ] Premier craft d'un Bouillon se termine en 3s (firstTimeFast)
- [ ] Deuxième craft du même Bouillon se termine en 10s (durée normale)
- [ ] `cancelCraft()` rembourse toujours les ingrédients intégralement
- [ ] `processTick()` retourne des `CraftResult` avec `recipeName` et `recipeEmoji`
- [ ] `getMissingReason()` retourne un message précis avec emoji et nom de la ressource manquante
- [ ] `craftedOnce` persiste au rechargement (le firstTimeFast ne se redéclenche pas)
- [ ] `totalXp` augmente à chaque craft complété

## Notes pour la suite
- Les `CraftResult` retournés par `processTick()` seront utilisés dans le prompt 006
  (UI Craft) pour afficher des toasts "+1 🍵 Bouillon de Base !"
- `totalXp` et `craftedOnce` migreront vers `usePlayerStore` en Phase 3
- La file est intentionnellement illimitée — c'est la durée qui est le coût, pas le nombre de slots
  (décision anti p2w : on ne vendra jamais de slots supplémentaires)
