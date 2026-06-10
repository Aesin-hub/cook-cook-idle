# Prompt 010 — Store Cook (useCookStore + tick + offline)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 009 ont été exécutés.

Structure existante pertinente :
- `src/types/cook.ts` — `Machine`, `Furnace`, `ProductionResult`, `CookState`, `PausedReason`
- `src/lib/cookHelpers.ts` — `checkCanProduce()`, `calcProduction()`, `calcIngredientConsumption()`,
  `getSpeedMultiplier()`, `getEfficiencyRate()`, `getUnlockedFurnaceCount()`,
  `getNextFurnaceUnlock()`, `isMachineCompatible()`, `getUnlockedMachines()`
- `src/data/index.ts` — exports `COOK_RECIPES`, `MACHINES`, `FURNACE_LEVELS`
- `src/stores/useInventoryStore.ts` — `addResources()`, `removeResources()`, `resources`
- `src/stores/useCraftStore.ts` — `totalXp` (XP craft — à combiner avec XP cook pour les fourneaux)
- `src/hooks/useGameLoop.ts` — tick 1s, appelle `harvestTick` + `craftTick` (à étendre)
- `src/hooks/useOfflineProgress.ts` — pattern offline progress (référence)

## Décisions d'architecture
- **`useCookStore`** est le seul responsable de la logique Cook — les composants UI ne calculent rien
- **Offline progress** : même pattern que Harvest — plafond 8h, calculé au chargement
- **XP total** pour les fourneaux = `useCraftStore.totalXp + useCookStore.totalCookXp`
  — les deux stores restent séparés jusqu'à `usePlayerStore` en Phase 3
- **Machines optionnelles** : une ligne sans machine tourne à 100% — machine = bonus uniquement
- **Pause auto** : si un ingrédient manque, `pausedReason = 'no_stock'`, production = 0
  Le fourneau reprend automatiquement dès que le stock est reconstitué
- **`processTick()`** retourne des `ProductionResult[]` — utilisés par `useGameLoop`
  pour créditer l'inventaire et afficher les toasts
- **Nouveau fourneau débloqué** : détecté dans `processTick()` en comparant
  `getUnlockedFurnaceCount(newTotalXp)` avec l'état précédent

---

## Fichiers à créer / modifier

---

### `src/stores/useCookStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { COOK_RECIPES, MACHINES, FURNACE_LEVELS } from '../data'
import { useInventoryStore } from './useInventoryStore'
import { useCraftStore } from './useCraftStore'
import {
  checkCanProduce,
  calcProduction,
  calcIngredientConsumption,
  getSpeedMultiplier,
  getEfficiencyRate,
  getUnlockedFurnaceCount,
  getNextFurnaceUnlock,
} from '../lib/cookHelpers'
import type { Furnace, CookState, ProductionResult, ResourceConsumed } from '../types/cook'

const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000  // 8h

interface CookActions {
  // Gestion des fourneaux
  assignRecipe: (furnaceId: string, recipeId: string | null) => void
  assignMachine: (furnaceId: string, machineId: string | null) => void
  togglePause: (furnaceId: string) => void

  // Tick temps réel — appelé par useGameLoop toutes les secondes
  // Retourne les ProductionResult pour les toasts et le crédit inventaire
  processTick: () => ProductionResult[]

  // Offline progress — appelé UNE FOIS au chargement
  calculateOfflineProgress: () => {
    results: ProductionResult[]
    elapsedMs: number
    cappedAt8h: boolean
  }

  // Synchronise le nombre de fourneaux débloqués avec le XP total actuel
  // Appelé après chaque gain d'XP (craft ou cook)
  syncFurnaceCount: () => { newFurnaceUnlocked: boolean; unlockMessage?: string }

  // Getters
  getTotalXp: () => number  // craft XP + cook XP combinés
}

export const useCookStore = create<CookState & CookActions>()(
  persist(
    (set, get) => ({
      // ─── État initial ─────────────────────────────────────────────────────
      furnaces: [
        // Le joueur commence avec 1 fourneau vide
        {
          id: uuidv4(),
          slotIndex: 0,
          recipeId: null,
          machineId: null,
          active: true,
          lastTickAt: Date.now(),
          pausedReason: 'no_recipe',
          totalProduced: 0,
        },
      ],
      totalCookXp: 0,
      unlockedFurnaceCount: 1,

      // ─── Gestion des fourneaux ────────────────────────────────────────────

      assignRecipe: (furnaceId, recipeId) => {
        set((state) => ({
          furnaces: state.furnaces.map((f) =>
            f.id === furnaceId
              ? {
                  ...f,
                  recipeId,
                  lastTickAt: Date.now(),  // reset le timer au changement de recette
                  pausedReason: recipeId ? null : 'no_recipe',
                }
              : f
          ),
        }))
      },

      assignMachine: (furnaceId, machineId) => {
        set((state) => ({
          furnaces: state.furnaces.map((f) =>
            f.id === furnaceId ? { ...f, machineId } : f
          ),
        }))
      },

      togglePause: (furnaceId) => {
        set((state) => ({
          furnaces: state.furnaces.map((f) => {
            if (f.id !== furnaceId) return f
            const nowActive = !f.active
            return {
              ...f,
              active: nowActive,
              pausedReason: nowActive ? null : 'paused_by_player',
              lastTickAt: nowActive ? Date.now() : f.lastTickAt,
            }
          }),
        }))
      },

      // ─── Tick temps réel ──────────────────────────────────────────────────
      processTick: () => {
        const { furnaces, totalCookXp, unlockedFurnaceCount } = get()
        const inventory = useInventoryStore.getState()
        const now = Date.now()
        const results: ProductionResult[] = []
        let newTotalCookXp = totalCookXp

        const updatedFurnaces = furnaces.map((furnace) => {
          // Ignorer les fourneaux au-delà du nombre débloqué
          if (furnace.slotIndex >= unlockedFurnaceCount) return furnace

          const elapsedMs = now - furnace.lastTickAt
          if (elapsedMs <= 0) return furnace

          // Vérifier si la production est possible
          const pausedReason = checkCanProduce(furnace, inventory.resources, elapsedMs)

          if (pausedReason !== null) {
            // Pas de production ce tick
            return { ...furnace, pausedReason, lastTickAt: now }
          }

          const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)!
          const speedMultiplier = getSpeedMultiplier(furnace)
          const efficiencyRate = getEfficiencyRate(furnace)

          // Calculer la production
          const outputAmount = calcProduction(
            recipe.outputPerBatch,
            recipe.cookTimeSeconds,
            elapsedMs,
            speedMultiplier
          )

          if (outputAmount <= 0) {
            return { ...furnace, pausedReason: null, lastTickAt: now }
          }

          // Calculer et débiter la consommation de chaque ingrédient
          const resourcesConsumed: ResourceConsumed[] = recipe.productionLine.map((step) => ({
            resourceId: step.resourceId,
            amount: calcIngredientConsumption(
              step.perMin, elapsedMs, speedMultiplier, efficiencyRate
            ),
          }))

          // Débiter l'inventaire
          inventory.removeResources(
            resourcesConsumed.map((r) => ({ resourceId: r.resourceId, amount: r.amount }))
          )

          // Créditer le plat produit
          const outputResource = { resourceId: recipe.id, amount: outputAmount }
          inventory.addResources([outputResource])

          // XP cook
          const xpGained = Math.floor(outputAmount * recipe.xpReward)
          newTotalCookXp += xpGained

          // Trouver le nom et emoji de la ressource produite pour le toast
          // Le plat a le même ID que la recette cook
          results.push({
            furnaceId: furnace.id,
            recipeId: recipe.id,
            outputResourceId: recipe.id,
            outputName: recipe.name,
            outputEmoji: recipe.emoji,
            amount: outputAmount,
            resourcesConsumed,
            pausedReason: null,
            xpGained,
          })

          return {
            ...furnace,
            pausedReason: null,
            lastTickAt: now,
            totalProduced: furnace.totalProduced + outputAmount,
          }
        })

        set({ furnaces: updatedFurnaces, totalCookXp: newTotalCookXp })
        return results
      },

      // ─── Offline progress ─────────────────────────────────────────────────
      calculateOfflineProgress: () => {
        const { furnaces, totalCookXp, unlockedFurnaceCount } = get()
        const inventory = useInventoryStore.getState()
        const now = Date.now()

        // Calculer l'elapsed depuis le lastTickAt du premier fourneau actif
        // On prend le min de tous les lastTickAt pour être conservateur
        const oldestTickAt = furnaces.reduce(
          (min, f) => Math.min(min, f.lastTickAt),
          now
        )
        const rawElapsedMs = now - oldestTickAt
        const cappedAt8h = rawElapsedMs > OFFLINE_CAP_MS
        const elapsedMs = Math.min(rawElapsedMs, OFFLINE_CAP_MS)

        const results: ProductionResult[] = []
        let newTotalCookXp = totalCookXp

        const updatedFurnaces = furnaces.map((furnace) => {
          if (furnace.slotIndex >= unlockedFurnaceCount) return furnace
          if (!furnace.active || !furnace.recipeId) return { ...furnace, lastTickAt: now }

          const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)
          if (!recipe) return { ...furnace, lastTickAt: now }

          const speedMultiplier = getSpeedMultiplier(furnace)
          const efficiencyRate = getEfficiencyRate(furnace)

          // Pour l'offline, on vérifie le stock AVANT de consommer
          // Si stock insuffisant → production partielle jusqu'à épuisement
          // Calcul simplifié : on produit autant que les stocks le permettent

          // Consommation théorique complète
          const theoreticalConsumption = recipe.productionLine.map((step) => ({
            resourceId: step.resourceId,
            amount: calcIngredientConsumption(
              step.perMin, elapsedMs, speedMultiplier, efficiencyRate
            ),
          }))

          // Ratio limité par le stock le plus contraignant
          let productionRatio = 1
          for (const { resourceId, amount } of theoreticalConsumption) {
            if (amount > 0) {
              const available = inventory.resources[resourceId] ?? 0
              productionRatio = Math.min(productionRatio, available / amount)
            }
          }
          productionRatio = Math.max(0, productionRatio)

          if (productionRatio <= 0) {
            return { ...furnace, pausedReason: 'no_stock' as const, lastTickAt: now }
          }

          // Production réelle (limitée par le stock)
          const outputAmount = calcProduction(
            recipe.outputPerBatch,
            recipe.cookTimeSeconds,
            elapsedMs,
            speedMultiplier
          ) * productionRatio

          const resourcesConsumed: ResourceConsumed[] = theoreticalConsumption.map((c) => ({
            ...c,
            amount: c.amount * productionRatio,
          }))

          // Appliquer à l'inventaire
          inventory.removeResources(
            resourcesConsumed.map((r) => ({ resourceId: r.resourceId, amount: r.amount }))
          )
          inventory.addResources([{ resourceId: recipe.id, amount: outputAmount }])

          const xpGained = Math.floor(outputAmount * recipe.xpReward)
          newTotalCookXp += xpGained

          results.push({
            furnaceId: furnace.id,
            recipeId: recipe.id,
            outputResourceId: recipe.id,
            outputName: recipe.name,
            outputEmoji: recipe.emoji,
            amount: outputAmount,
            resourcesConsumed,
            pausedReason: null,
            xpGained,
          })

          return {
            ...furnace,
            pausedReason: null,
            lastTickAt: now,
            totalProduced: furnace.totalProduced + outputAmount,
          }
        })

        set({ furnaces: updatedFurnaces, totalCookXp: newTotalCookXp })
        return { results, elapsedMs, cappedAt8h }
      },

      // ─── Sync fourneaux débloqués ─────────────────────────────────────────
      // À appeler après chaque gain d'XP (craft ou cook)
      syncFurnaceCount: () => {
        const { furnaces, totalCookXp, unlockedFurnaceCount } = get()
        const craftXp = useCraftStore.getState().totalXp
        const totalXp = craftXp + totalCookXp

        const newCount = getUnlockedFurnaceCount(totalXp)

        if (newCount <= unlockedFurnaceCount) {
          return { newFurnaceUnlocked: false }
        }

        // Débloquer de nouveaux fourneaux
        const newFurnaces = [...furnaces]
        for (let i = unlockedFurnaceCount; i < newCount; i++) {
          newFurnaces.push({
            id: uuidv4(),
            slotIndex: i,
            recipeId: null,
            machineId: null,
            active: true,
            lastTickAt: Date.now(),
            pausedReason: 'no_recipe',
            totalProduced: 0,
          })
        }

        // Message de déblocage depuis les données JSON
        const level = FURNACE_LEVELS.find((l) => l.furnaceCount === newCount)
        const unlockMessage = level?.unlockMessage

        set({ furnaces: newFurnaces, unlockedFurnaceCount: newCount })
        return { newFurnaceUnlocked: true, unlockMessage }
      },

      // ─── Getter XP total ──────────────────────────────────────────────────
      getTotalXp: () => {
        const craftXp = useCraftStore.getState().totalXp
        return craftXp + get().totalCookXp
      },
    }),
    {
      name: 'cooking-fantasy-cook',
      partialize: (state) => ({
        furnaces: state.furnaces,
        totalCookXp: state.totalCookXp,
        unlockedFurnaceCount: state.unlockedFurnaceCount,
      }),
    }
  )
)
```

---

### Mise à jour `src/hooks/useGameLoop.ts`

Ajouter le tick Cook et la sync des fourneaux après chaque tick.

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCraftStore } from '../stores/useCraftStore'
import { useCookStore } from '../stores/useCookStore'
import type { ProductionResult } from '../types/cook'
import type { CraftResult } from '../types/craft'

const TICK_INTERVAL_MS = 1000

export function useGameLoop(
  onCraftComplete?: (results: CraftResult[]) => void,
  onCookComplete?: (results: ProductionResult[]) => void,
  onFurnaceUnlocked?: (message: string) => void,
) {
  const harvestTick = useHarvestStore((state) => state.tick)
  const addResources = useInventoryStore((state) => state.addResources)
  const craftTick = useCraftStore((state) => state.processTick)
  const cookTick = useCookStore((state) => state.processTick)
  const syncFurnaceCount = useCookStore((state) => state.syncFurnaceCount)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // 1. Harvest
      const harvestYields = harvestTick()
      if (harvestYields.length > 0) addResources(harvestYields)

      // 2. Craft
      const craftResults = craftTick()
      if (craftResults.length > 0) {
        onCraftComplete?.(craftResults)
        // Sync fourneaux après gain XP craft
        const { newFurnaceUnlocked, unlockMessage } = syncFurnaceCount()
        if (newFurnaceUnlocked && unlockMessage) {
          onFurnaceUnlocked?.(unlockMessage)
        }
      }

      // 3. Cook
      const cookResults = cookTick()
      if (cookResults.length > 0) {
        onCookComplete?.(cookResults)
        // Sync fourneaux après gain XP cook
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

### Mise à jour `src/hooks/useOfflineProgress.ts`

Intégrer le calcul offline du Cook dans le hook existant.

```typescript
import { useEffect, useState } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useCookStore } from '../stores/useCookStore'
import { RESOURCES } from '../data'
import type { OfflineProgressResult } from '../types/harvest'
import type { ProductionResult } from '../types/cook'

export interface OfflineProgressDisplay extends OfflineProgressResult {
  yieldsDisplay: { name: string; emoji: string; amount: number }[]
  cookResultsDisplay: { name: string; emoji: string; amount: number }[]
  elapsedLabel: string
  dismiss: () => void
}

function formatElapsed(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin}min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function useOfflineProgress(): OfflineProgressDisplay | null {
  const calculateHarvestOffline = useHarvestStore((state) => state.calculateOfflineProgress)
  const calculateCookOffline = useCookStore((state) => state.calculateOfflineProgress)
  const addResources = useInventoryStore((state) => state.addResources)
  const [result, setResult] = useState<OfflineProgressDisplay | null>(null)

  useEffect(() => {
    // 1. Offline harvest
    const { yields, elapsedMs, cappedAt8h } = calculateHarvestOffline()

    // 2. Offline cook (calcule et applique en interne)
    const { results: cookResults } = calculateCookOffline()

    if (elapsedMs < 60000 && cookResults.length === 0) return

    // Créditer les ressources harvest
    if (yields.length > 0) addResources(yields)

    // Construire l'affichage harvest
    const yieldsDisplay = yields
      .map((y) => {
        const resource = RESOURCES.find((r) => r.id === y.resourceId)
        return {
          name: resource?.name ?? y.resourceId,
          emoji: resource?.emoji ?? '📦',
          amount: Math.floor(y.amount),
        }
      })
      .filter((y) => y.amount > 0)

    // Construire l'affichage cook
    const cookResultsDisplay = cookResults
      .filter((r) => r.amount >= 0.1)
      .map((r) => ({
        name: r.outputName,
        emoji: r.outputEmoji,
        amount: Math.floor(r.amount),
      }))

    // Ne pas afficher si rien de notable
    if (yieldsDisplay.length === 0 && cookResultsDisplay.length === 0) return

    setResult({
      yields,
      yieldsDisplay,
      cookResultsDisplay,
      elapsedMs,
      cappedAt8h,
      elapsedLabel: formatElapsed(elapsedMs),
      dismiss: () => setResult(null),
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
```

---

### Mise à jour `src/components/shared/OfflineModal.tsx`

Afficher aussi les plats cuisinés pendant l'absence.

```tsx
import { OfflineProgressDisplay } from '../../hooks/useOfflineProgress'

interface OfflineModalProps {
  progress: OfflineProgressDisplay
}

export function OfflineModal({ progress }: OfflineModalProps) {
  const hasHarvest = progress.yieldsDisplay.length > 0
  const hasCook = progress.cookResultsDisplay.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#161b22',
        border: '1px solid rgba(0,210,255,0.2)',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 0 40px rgba(0,210,255,0.1)',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⛺</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            Tes équipes ont bien travaillé !
          </h2>
          <p style={{ fontSize: '13px', color: '#636e8a', margin: '4px 0 0' }}>
            Absent pendant {progress.elapsedLabel}
            {progress.cappedAt8h && <span style={{ color: '#ffd500' }}> · plafonné à 8h</span>}
          </p>
        </div>

        {/* Récolte */}
        {hasHarvest && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: '#00d2ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              ⛺ Récolte
            </div>
            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {progress.yieldsDisplay.map((y) => (
                <div key={y.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#8b949e' }}>{y.emoji} {y.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#00d2ff' }}>+{y.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cook */}
        {hasCook && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', color: '#ff9500', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              🍳 Cuisine
            </div>
            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {progress.cookResultsDisplay.map((r) => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#8b949e' }}>{r.emoji} {r.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#ff9500' }}>+{r.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={progress.dismiss}
          style={{
            width: '100%', padding: '12px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '10px', color: '#00d2ff',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Super, merci ! 🎉
        </button>
      </div>
    </div>
  )
}
```

---

### Mise à jour `src/App.tsx`

Câbler les callbacks Cook dans `useGameLoop`.

```tsx
// Modifier l'appel useGameLoop dans GameApp() :

useGameLoop(
  // Craft complete
  (craftResults) => {
    craftResults.forEach((result) => {
      addToast(
        `${result.recipeEmoji} +${result.output.amount} ${result.recipeName} ! (+${result.xpGained} XP)`,
        'success'
      )
    })
  },
  // Cook complete
  (cookResults) => {
    cookResults.forEach((result) => {
      if (result.amount >= 0.5) {
        addToast(
          `${result.outputEmoji} +${Math.floor(result.amount)} ${result.outputName} cuisiné ! (+${result.xpGained} XP)`,
          'success'
        )
      }
    })
  },
  // Nouveau fourneau débloqué
  (message) => {
    addToast(`🍳 ${message}`, 'success')
  }
)
```

---

## Architecture complète après ce prompt

```
useGameLoop (tick 1s)
├── harvestTick()     → yields → addResources()
├── craftTick()       → CraftResult[] → toasts + syncFurnaceCount()
└── cookTick()        → ProductionResult[] → toasts + syncFurnaceCount()
      ↓
  Pour chaque fourneau actif :
    checkCanProduce() → pausedReason ou null
    calcProduction()  → outputAmount
    calcIngredientConsumption() × N ingrédients
    removeResources() + addResources()
    totalCookXp += xpGained

syncFurnaceCount()
  getTotalXp() = craftXp + cookXp
  getUnlockedFurnaceCount(totalXp)
  Si nouveau palier → créer fourneau vide + toast

Offline (au chargement) :
  calculateHarvestOffline() → yields harvest
  calculateCookOffline()    → production limitée par stock disponible
  OfflineModal → section Récolte + section Cuisine
```

---

## Critères de succès

### Store
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] `useCookStore` accessible dans les DevTools Zustand
- [ ] État initial : 1 fourneau avec `recipeId: null`, `pausedReason: 'no_recipe'`
- [ ] `assignRecipe('id', 'gelee_slime')` → `pausedReason` passe à `null`
- [ ] `assignMachine('id', 'four_basique')` → `machineId` mis à jour
- [ ] `togglePause('id')` → `active` bascule + `pausedReason` mis à jour

### Tick
- [ ] Fourneau sans recette → `processTick()` retourne `[]`, aucune consommation
- [ ] Fourneau avec recette + stock suffisant → plat crédité dans l'inventaire chaque seconde
- [ ] Fourneau avec recette + stock insuffisant → `pausedReason = 'no_stock'`, zéro consommation
- [ ] Fourneau reprend automatiquement quand le stock est reconstitué (tick suivant)
- [ ] `totalCookXp` augmente à chaque production

### Fourneaux
- [ ] `syncFurnaceCount()` avec 0 XP → `unlockedFurnaceCount = 1`
- [ ] `syncFurnaceCount()` avec 200 XP (craft + cook combinés) → `unlockedFurnaceCount = 2` + toast
- [ ] Le nouveau fourneau a `slotIndex: 1`, `recipeId: null`, `pausedReason: 'no_recipe'`

### Offline
- [ ] Fermer le jeu avec un fourneau actif, rouvrir → plats produits + section "Cuisine" dans la modal
- [ ] Si stock insuffisant pendant l'absence → production partielle (pas de valeur négative en inventaire)

### Intégration
- [ ] Toast orange "🟢 +2 Gelée de Slime cuisinée ! (+30 XP)" s'affiche depuis n'importe quel onglet
- [ ] Toast "🍳 Deuxième fourneau débloqué !" quand le palier 200 XP est atteint

## Notes pour la suite
- `useSaveManager` (prompt 008) devra être mis à jour pour sauvegarder `useCookStore`
  → ajouter `saveCook()` dans `saveService.ts` et une table `save_cook` dans Supabase
- `getTotalXp()` combine craft + cook XP — en Phase 3 ce sera `usePlayerStore.totalXp`
- La production offline est **conservative** : limitée par le stock disponible au retour,
  pas par le stock au moment du départ (impossible à savoir sans serveur)
- Les toasts Cook sont filtrés à `amount >= 0.5` pour éviter le spam sur les petites fractions
