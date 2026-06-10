# Prompt 011 — UI Cook (Page Cook)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 010 ont été exécutés.

Structure existante pertinente :
- `src/types/cook.ts` — `Furnace`, `Machine`, `PausedReason`, `ProductionResult`
- `src/stores/useCookStore.ts` — `furnaces`, `totalCookXp`, `unlockedFurnaceCount`,
  `assignRecipe()`, `assignMachine()`, `togglePause()`, `getTotalXp()`
- `src/lib/cookHelpers.ts` — `getSpeedMultiplier()`, `getEfficiencyRate()`,
  `getUnlockedMachines()`, `getNextFurnaceUnlock()`, `formatProductionRate()`,
  `isMachineCompatible()`
- `src/stores/useInventoryStore.ts` — `resources`, `getAmount()`
- `src/data/index.ts` — `COOK_RECIPES`, `MACHINES`, `FURNACE_LEVELS`
- `src/components/shared/ProgressBar.tsx` — réutilisable
- `src/components/shared/Tooltip.tsx` — réutilisable
- `src/components/shared/ToastManager.tsx` — `useToast()`
- `src/components/craft/XpBadge.tsx` — référence pour le badge XP Cook
- `src/App.tsx` — `case 'cook': return <ComingSoon ...>` à remplacer

## Décisions de design
- **Couleur Cook** : orange `#ff9500` — progress bars, bordures actives, badges, boutons
- **Un fourneau = une card** — layout vertical, une card par fourneau
- **3 états visuels d'un fourneau** :
  - 🟠 En production : bordure orange + progress bar orange animée
  - ⏸️ En pause joueur : bordure grise + badge "En pause"
  - 🔴 Stock épuisé : bordure rouge + badge "Stock insuffisant" + ressource manquante indiquée
  - ⬜ Vide (pas de recette) : bordure pointillée + CTA "Choisir une recette"
- **Assignation en 2 taps** : tap "Choisir recette" → bottom sheet recettes → tap recette → assignée
- **Machine optionnelle** : tap "Ajouter machine" → bottom sheet machines débloquées
- **Stats de production** : production/min affichée sous chaque fourneau actif
- **Barre de progression XP** vers le prochain fourneau — sticky en haut de page
- **Fourneau verrouillé** : card grisée avec XP requis visible

---

## Architecture des fichiers

```
src/
├── pages/
│   └── CookPage.tsx                  ← page principale Cook
├── components/
│   └── cook/
│       ├── FurnaceCard.tsx           ← card d'un fourneau (tous états)
│       ├── RecipePickerModal.tsx     ← bottom sheet choix de recette cook
│       ├── MachinePickerModal.tsx    ← bottom sheet choix de machine
│       ├── ProductionStats.tsx       ← stats détaillées d'une ligne active
│       └── XpFurnaceBar.tsx          ← barre XP progression vers prochain fourneau
```

---

## Fichiers à créer

---

### `src/components/cook/XpFurnaceBar.tsx`

Barre sticky en haut de la page Cook.
Affiche le XP total, la progression vers le prochain fourneau débloqué,
et le nombre de fourneaux actifs.

```tsx
import { useMemo } from 'react'
import { useCookStore } from '../../stores/useCookStore'
import { getNextFurnaceUnlock, getUnlockedFurnaceCount } from '../../lib/cookHelpers'
import { ProgressBar } from '../shared/ProgressBar'
import { FURNACE_LEVELS } from '../../data'

export function XpFurnaceBar() {
  const getTotalXp = useCookStore((state) => state.getTotalXp)
  const unlockedFurnaceCount = useCookStore((state) => state.unlockedFurnaceCount)
  const furnaces = useCookStore((state) => state.furnaces)

  const totalXp = getTotalXp()
  const nextUnlock = getNextFurnaceUnlock(totalXp)
  const maxFurnaces = FURNACE_LEVELS[FURNACE_LEVELS.length - 1].furnaceCount
  const isMaxed = unlockedFurnaceCount >= maxFurnaces

  const activeCount = furnaces.filter(
    (f) => f.slotIndex < unlockedFurnaceCount && f.active && f.recipeId && f.pausedReason === null
  ).length

  // Progression vers le prochain palier
  const prevRequired = useMemo(() => {
    const prev = [...FURNACE_LEVELS]
      .reverse()
      .find((l) => l.furnaceCount < unlockedFurnaceCount + 1 && l.requiredXp <= totalXp)
    return prev?.requiredXp ?? 0
  }, [totalXp, unlockedFurnaceCount])

  const progress = nextUnlock
    ? (totalXp - prevRequired) / (nextUnlock.requiredXp - prevRequired)
    : 1

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: '#0d1117',
      paddingBottom: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '16px',
    }}>
      {/* Header : XP + fourneaux actifs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Badge XP */}
          <div style={{
            background: 'rgba(255,213,0,0.1)',
            border: '1px solid rgba(255,213,0,0.25)',
            borderRadius: '20px', padding: '3px 10px',
            fontSize: '12px', fontWeight: 600, color: '#ffd500',
          }}>
            ⭐ {totalXp.toLocaleString()} XP
          </div>
          {/* Fourneaux actifs */}
          <div style={{
            background: 'rgba(255,149,0,0.1)',
            border: '1px solid rgba(255,149,0,0.25)',
            borderRadius: '20px', padding: '3px 10px',
            fontSize: '12px', color: '#ff9500',
          }}>
            🍳 {activeCount}/{unlockedFurnaceCount} actif{activeCount > 1 ? 's' : ''}
          </div>
        </div>

        {/* Prochain déblocage */}
        {!isMaxed && nextUnlock && (
          <div style={{ fontSize: '11px', color: '#636e8a', textAlign: 'right' }}>
            Fourneau {unlockedFurnaceCount + 1} à {nextUnlock.requiredXp.toLocaleString()} XP
          </div>
        )}
        {isMaxed && (
          <div style={{ fontSize: '11px', color: '#30d158' }}>
            ✅ Maximum atteint
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {!isMaxed && (
        <ProgressBar
          value={Math.min(progress, 1)}
          color="#ff9500"
          height={5}
          showGlow
        />
      )}
    </div>
  )
}
```

---

### `src/components/cook/ProductionStats.tsx`

Panneau de stats détaillées d'un fourneau actif.
Affiche : production/min, consommation de chaque ingrédient/min, bonus machine.

```tsx
import { useMemo } from 'react'
import { COOK_RECIPES, RESOURCES, MACHINES } from '../../data'
import {
  getSpeedMultiplier,
  getEfficiencyRate,
  formatProductionRate,
} from '../../lib/cookHelpers'
import type { Furnace } from '../../types/cook'

interface ProductionStatsProps {
  furnace: Furnace
}

export function ProductionStats({ furnace }: ProductionStatsProps) {
  const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)
  const machine = furnace.machineId ? MACHINES.find((m) => m.id === furnace.machineId) : null

  if (!recipe) return null

  const speedMultiplier = getSpeedMultiplier(furnace)
  const efficiencyRate = getEfficiencyRate(furnace)
  const productionRate = formatProductionRate(recipe.outputPerBatch, recipe.cookTimeSeconds, speedMultiplier)

  // Consommation réelle/min par ingrédient (avec bonus machine)
  const consumptionDisplay = useMemo(() => {
    return recipe.productionLine.map((step) => {
      const resource = RESOURCES.find((r) => r.id === step.resourceId)
      const basePerMin = step.perMin * speedMultiplier * (1 - efficiencyRate)
      return {
        resourceId: step.resourceId,
        name: resource?.name ?? step.resourceId,
        emoji: resource?.emoji ?? '📦',
        perMin: basePerMin,
      }
    })
  }, [recipe, speedMultiplier, efficiencyRate])

  return (
    <div style={{
      background: '#0d1117',
      borderRadius: '8px',
      padding: '10px 12px',
      marginTop: '8px',
    }}>
      {/* Production */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: '#636e8a' }}>Production</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ff9500' }}>
          {recipe.emoji} {productionRate}
        </span>
      </div>

      {/* Consommation */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {consumptionDisplay.map((c) => (
          <div key={c.resourceId} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#636e8a' }}>{c.emoji} {c.name}</span>
            <span style={{ fontSize: '11px', color: '#8b949e' }}>-{c.perMin.toFixed(1)}/min</span>
          </div>
        ))}
      </div>

      {/* Bonus machine si présente */}
      {machine && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: '6px', paddingTop: '6px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '13px' }}>{machine.emoji}</span>
          <span style={{ fontSize: '11px', color: '#bf5af2' }}>
            {machine.name}
            {speedMultiplier > 1 && ` · ×${speedMultiplier} vitesse`}
            {efficiencyRate > 0 && ` · -${Math.round(efficiencyRate * 100)}% consommation`}
          </span>
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/cook/RecipePickerModal.tsx`

Bottom sheet pour choisir une recette cook à assigner à un fourneau.
Affiche toutes les recettes débloquées avec leurs ingrédients et leur production/min estimée.

```tsx
import { COOK_RECIPES, RESOURCES } from '../../data'
import { formatProductionRate } from '../../lib/cookHelpers'

interface RecipePickerModalProps {
  currentRecipeId: string | null
  onSelect: (recipeId: string) => void
  onClose: () => void
}

export function RecipePickerModal({ currentRecipeId, onSelect, onClose }: RecipePickerModalProps) {
  const unlockedRecipes = COOK_RECIPES.filter((r) => r.unlocked)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          width: '100%', maxWidth: '480px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '75vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 16px' }} />

        <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>
          🍳 Choisir une recette
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {unlockedRecipes.map((recipe) => {
            const isSelected = recipe.id === currentRecipeId
            const productionRate = formatProductionRate(recipe.outputPerBatch, recipe.cookTimeSeconds, 1.0)

            return (
              <button
                key={recipe.id}
                onClick={() => { onSelect(recipe.id); onClose() }}
                style={{
                  background: isSelected ? 'rgba(255,149,0,0.1)' : '#0d1117',
                  border: `1px solid ${isSelected ? 'rgba(255,149,0,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px', padding: '12px 14px',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {/* Header recette */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>{recipe.emoji}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#ff9500' : '#e2e8f0' }}>
                        {recipe.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#636e8a' }}>
                        +{recipe.xpReward} XP/batch
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ff9500' }}>
                    {productionRate}
                  </div>
                </div>

                {/* Ingrédients */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {recipe.productionLine.map((step) => {
                    const res = RESOURCES.find((r) => r.id === step.resourceId)
                    return (
                      <span key={step.resourceId} style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '20px', padding: '2px 8px',
                        fontSize: '11px', color: '#8b949e',
                      }}>
                        {res?.emoji ?? '📦'} {res?.name ?? step.resourceId} {step.perMin}/min
                      </span>
                    )
                  })}
                </div>

                {/* Ratio optimal */}
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#636e8a' }}>
                  Ratio optimal : {recipe.optimalRatio.description}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

---

### `src/components/cook/MachinePickerModal.tsx`

Bottom sheet pour assigner une machine à un fourneau.
N'affiche que les machines débloquées (unlockXp ≤ totalXp).
Indique si la machine est compatible avec la recette assignée.

```tsx
import { getUnlockedMachines, isMachineCompatible } from '../../lib/cookHelpers'
import { useCookStore } from '../../stores/useCookStore'

interface MachinePickerModalProps {
  currentMachineId: string | null
  recipeId: string | null
  onSelect: (machineId: string | null) => void
  onClose: () => void
}

export function MachinePickerModal({ currentMachineId, recipeId, onSelect, onClose }: MachinePickerModalProps) {
  const totalXp = useCookStore((state) => state.getTotalXp())
  const unlockedMachines = getUnlockedMachines(totalXp)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px', width: '100%', maxWidth: '480px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '70vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 16px' }} />

        <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>
          🔧 Choisir une machine
        </h3>

        {/* Option "Aucune machine" */}
        <button
          onClick={() => { onSelect(null); onClose() }}
          style={{
            width: '100%', background: !currentMachineId ? 'rgba(255,255,255,0.06)' : '#0d1117',
            border: `1px solid ${!currentMachineId ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '10px', padding: '12px 14px',
            cursor: 'pointer', textAlign: 'left', marginBottom: '8px',
          }}
        >
          <div style={{ fontSize: '14px', color: '#636e8a' }}>— Aucune machine</div>
          <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px' }}>Production à vitesse normale</div>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {unlockedMachines.map((machine) => {
            const isSelected = machine.id === currentMachineId
            const compatible = recipeId ? isMachineCompatible(machine.id, recipeId) : true
            const isIncompatible = recipeId && !compatible

            return (
              <button
                key={machine.id}
                onClick={() => { onSelect(machine.id); onClose() }}
                style={{
                  background: isSelected ? 'rgba(191,90,242,0.1)' : '#0d1117',
                  border: `1px solid ${isSelected ? 'rgba(191,90,242,0.4)' : isIncompatible ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px', padding: '12px 14px',
                  cursor: 'pointer', textAlign: 'left',
                  opacity: isIncompatible ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{machine.emoji}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#bf5af2' : '#e2e8f0' }}>
                        {machine.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#636e8a' }}>Tier {machine.tier}</div>
                    </div>
                  </div>
                  {isIncompatible && (
                    <span style={{ fontSize: '10px', color: '#ff453a' }}>Incompatible</span>
                  )}
                </div>

                {/* Bonus */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {machine.speedMultiplier > 1 && (
                    <span style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', color: '#ff9500' }}>
                      ⚡ ×{machine.speedMultiplier} vitesse
                    </span>
                  )}
                  {machine.efficiencyBonus > 0 && (
                    <span style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', color: '#30d158' }}>
                      💚 -{Math.round(machine.efficiencyBonus * 100)}% consommation
                    </span>
                  )}
                </div>

                {/* Tooltip */}
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#636e8a' }}>
                  {machine.tooltip}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

---

### `src/components/cook/FurnaceCard.tsx`

La card principale d'un fourneau. Gère tous les états visuels.

```tsx
import { useState } from 'react'
import { useCookStore } from '../../stores/useCookStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { useToast } from '../shared/ToastManager'
import { Tooltip } from '../shared/Tooltip'
import { ProgressBar } from '../shared/ProgressBar'
import { ProductionStats } from './ProductionStats'
import { RecipePickerModal } from './RecipePickerModal'
import { MachinePickerModal } from './MachinePickerModal'
import { COOK_RECIPES, MACHINES, RESOURCES } from '../../data'
import { checkCanProduce } from '../../lib/cookHelpers'
import type { Furnace } from '../../types/cook'

// Couleurs selon l'état du fourneau
const STATE_COLORS = {
  producing:  '#ff9500',
  paused:     '#636e8a',
  no_stock:   '#ff453a',
  no_recipe:  'rgba(255,255,255,0.08)',
}

interface FurnaceCardProps {
  furnace: Furnace
  isLocked: boolean  // true si slotIndex >= unlockedFurnaceCount
  nextUnlockXp?: number
}

export function FurnaceCard({ furnace, isLocked, nextUnlockXp }: FurnaceCardProps) {
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [showMachinePicker, setShowMachinePicker] = useState(false)
  const [showStats, setShowStats] = useState(false)

  const assignRecipe = useCookStore((state) => state.assignRecipe)
  const assignMachine = useCookStore((state) => state.assignMachine)
  const togglePause = useCookStore((state) => state.togglePause)
  const resources = useInventoryStore((state) => state.resources)
  const addToast = useToast()

  const recipe = furnace.recipeId ? COOK_RECIPES.find((r) => r.id === furnace.recipeId) : null
  const machine = furnace.machineId ? MACHINES.find((m) => m.id === furnace.machineId) : null

  // Déterminer l'état visuel
  const isProducing = furnace.active && furnace.pausedReason === null && !!recipe
  const isPausedByPlayer = furnace.pausedReason === 'paused_by_player'
  const isNoStock = furnace.pausedReason === 'no_stock'
  const isNoRecipe = !recipe

  const borderColor = isLocked ? 'rgba(255,255,255,0.04)'
    : isProducing ? 'rgba(255,149,0,0.3)'
    : isNoStock   ? 'rgba(255,68,58,0.3)'
    : isPausedByPlayer ? 'rgba(99,110,138,0.3)'
    : 'rgba(255,255,255,0.06)'

  const bgColor = isProducing ? 'rgba(255,149,0,0.04)' : '#161b22'

  // Trouver la ressource manquante (pour no_stock)
  const missingResource = isNoStock && recipe
    ? (() => {
        for (const step of recipe.productionLine) {
          if ((resources[step.resourceId] ?? 0) < 0.1) {
            const res = RESOURCES.find((r) => r.id === step.resourceId)
            return res ? `${res.emoji} ${res.name}` : step.resourceId
          }
        }
        return null
      })()
    : null

  // ─── Fourneau verrouillé ──────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div style={{
        background: '#161b22', border: '1px dashed rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '16px', opacity: 0.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px', filter: 'grayscale(1)' }}>🍳</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#636e8a' }}>
              Fourneau {furnace.slotIndex + 1}
            </div>
            <div style={{ fontSize: '11px', color: '#4a5568' }}>
              🔒 Débloqué à {nextUnlockXp?.toLocaleString()} XP
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Fourneau actif ───────────────────────────────────────────────────────
  return (
    <>
      <div style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px', padding: '14px',
        transition: 'border-color 0.3s ease, background 0.3s ease',
      }}>
        {/* Header : numéro + état + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🍳</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#636e8a' }}>
              Fourneau {furnace.slotIndex + 1}
            </span>

            {/* Badge état */}
            {isProducing && (
              <div style={{
                background: 'rgba(255,149,0,0.12)',
                border: '1px solid rgba(255,149,0,0.3)',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '10px', fontWeight: 600, color: '#ff9500',
                animation: 'pulse-ring 2s infinite',
              }}>
                🔥 En production
              </div>
            )}
            {isPausedByPlayer && (
              <div style={{
                background: 'rgba(99,110,138,0.12)',
                border: '1px solid rgba(99,110,138,0.3)',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '10px', color: '#636e8a',
              }}>
                ⏸ En pause
              </div>
            )}
            {isNoStock && (
              <div style={{
                background: 'rgba(255,68,58,0.12)',
                border: '1px solid rgba(255,68,58,0.3)',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '10px', fontWeight: 600, color: '#ff453a',
              }}>
                ⚠️ Stock vide
              </div>
            )}
          </div>

          {/* Bouton pause */}
          {recipe && (
            <button
              onClick={() => togglePause(furnace.id)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px', padding: '4px 8px',
                fontSize: '11px', color: '#636e8a', cursor: 'pointer',
              }}
            >
              {furnace.active ? '⏸ Pause' : '▶ Reprendre'}
            </button>
          )}
        </div>

        {/* Contenu : pas de recette */}
        {isNoRecipe ? (
          <button
            onClick={() => setShowRecipePicker(true)}
            style={{
              width: '100%', background: 'rgba(255,149,0,0.06)',
              border: '1px dashed rgba(255,149,0,0.3)',
              borderRadius: '10px', padding: '14px',
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>🍽️</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ff9500' }}>Choisir une recette</div>
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
              Tap pour sélectionner une recette de cuisine
            </div>
          </button>
        ) : (
          <>
            {/* Recette assignée */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: '8px',
            }}>
              <Tooltip content={recipe.tooltip}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                  <span style={{ fontSize: '22px' }}>{recipe.emoji}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
                      {recipe.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#636e8a' }}>
                      +{recipe.xpReward} XP/batch
                    </div>
                  </div>
                </div>
              </Tooltip>
              <button
                onClick={() => setShowRecipePicker(true)}
                style={{
                  background: 'transparent', border: 'none',
                  fontSize: '11px', color: '#636e8a',
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Changer
              </button>
            </div>

            {/* Progress bar orange */}
            <ProgressBar
              value={isProducing ? 1 : 0}
              color={isNoStock ? '#ff453a' : '#ff9500'}
              height={5}
              animated={isProducing}
              showGlow={isProducing}
            />

            {/* Message stock vide */}
            {isNoStock && missingResource && (
              <div style={{
                marginTop: '6px', fontSize: '11px', color: '#ff453a',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                ⚠️ Stock épuisé : {missingResource}
              </div>
            )}

            {/* Machine */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {machine ? (
                <Tooltip content={machine.tooltip}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    <span style={{ fontSize: '16px' }}>{machine.emoji}</span>
                    <span style={{ fontSize: '12px', color: '#bf5af2' }}>{machine.name}</span>
                  </div>
                </Tooltip>
              ) : (
                <span style={{ fontSize: '12px', color: '#4a5568' }}>— Sans machine</span>
              )}
              <button
                onClick={() => setShowMachinePicker(true)}
                style={{
                  background: 'rgba(191,90,242,0.08)',
                  border: '1px solid rgba(191,90,242,0.2)',
                  borderRadius: '6px', padding: '4px 10px',
                  fontSize: '11px', color: '#bf5af2', cursor: 'pointer',
                }}
              >
                {machine ? '🔧 Changer' : '+ Machine'}
              </button>
            </div>

            {/* Toggle stats */}
            <button
              onClick={() => setShowStats((v) => !v)}
              style={{
                marginTop: '8px', background: 'transparent', border: 'none',
                fontSize: '11px', color: '#636e8a', cursor: 'pointer',
                textDecoration: 'underline', padding: 0,
              }}
            >
              {showStats ? '▲ Masquer les stats' : '▼ Voir les stats de production'}
            </button>

            {showStats && <ProductionStats furnace={furnace} />}
          </>
        )}
      </div>

      {/* Modals */}
      {showRecipePicker && (
        <RecipePickerModal
          currentRecipeId={furnace.recipeId}
          onSelect={(id) => {
            assignRecipe(furnace.id, id)
            addToast(`🍳 Recette assignée au fourneau ${furnace.slotIndex + 1} !`, 'success')
          }}
          onClose={() => setShowRecipePicker(false)}
        />
      )}
      {showMachinePicker && (
        <MachinePickerModal
          currentMachineId={furnace.machineId}
          recipeId={furnace.recipeId}
          onSelect={(id) => {
            assignMachine(furnace.id, id)
            addToast(id ? `🔧 Machine assignée !` : 'Machine retirée.', 'info')
          }}
          onClose={() => setShowMachinePicker(false)}
        />
      )}
    </>
  )
}
```

---

### `src/pages/CookPage.tsx`

Page principale Cook. Header XP → barre progression fourneau → liste des fourneaux.

```tsx
import { useMemo } from 'react'
import { useCookStore } from '../stores/useCookStore'
import { FURNACE_LEVELS } from '../data'
import { getNextFurnaceUnlock } from '../lib/cookHelpers'
import { FurnaceCard } from '../components/cook/FurnaceCard'
import { XpFurnaceBar } from '../components/cook/XpFurnaceBar'

export function CookPage() {
  const furnaces = useCookStore((state) => state.furnaces)
  const unlockedFurnaceCount = useCookStore((state) => state.unlockedFurnaceCount)
  const getTotalXp = useCookStore((state) => state.getTotalXp)

  const totalXp = getTotalXp()
  const nextUnlock = getNextFurnaceUnlock(totalXp)
  const maxFurnaces = FURNACE_LEVELS[FURNACE_LEVELS.length - 1].furnaceCount

  // Afficher tous les fourneaux débloqués + le prochain verrouillé (aperçu)
  const displayFurnaces = useMemo(() => {
    const slots = [...furnaces].sort((a, b) => a.slotIndex - b.slotIndex)
    // Ajouter un slot verrouillé si on n'est pas au max
    if (unlockedFurnaceCount < maxFurnaces) {
      slots.push({
        id: 'locked-preview',
        slotIndex: unlockedFurnaceCount,
        recipeId: null,
        machineId: null,
        active: false,
        lastTickAt: 0,
        pausedReason: 'no_recipe' as const,
        totalProduced: 0,
      })
    }
    return slots
  }, [furnaces, unlockedFurnaceCount, maxFurnaces])

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          🍳 Cook
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Assigne des recettes à tes fourneaux. Ajoute des machines pour booster la production.
        </p>
      </div>

      {/* Barre XP → prochain fourneau */}
      <XpFurnaceBar />

      {/* Liste des fourneaux */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayFurnaces.map((furnace) => (
          <FurnaceCard
            key={furnace.id}
            furnace={furnace}
            isLocked={furnace.slotIndex >= unlockedFurnaceCount}
            nextUnlockXp={nextUnlock?.requiredXp}
          />
        ))}
      </div>
    </div>
  )
}
```

---

### Mise à jour `src/App.tsx`

Remplacer le `ComingSoon` Cook par `CookPage` :

```tsx
// Ajouter l'import :
import { CookPage } from './pages/CookPage'

// Dans renderPage(), remplacer :
// case 'cook': return <ComingSoon label="🍳 Cook" color="#ff9500" />
// Par :
case 'cook': return <CookPage />
```

---

## Critères de succès

### Visuel
- [ ] L'onglet "Cook" est orange `#ff9500` quand actif
- [ ] Un fourneau en production a une bordure orange + badge "🔥 En production" animé
- [ ] Un fourneau sans recette affiche le CTA "Choisir une recette" en pointillés
- [ ] Un fourneau en "Stock vide" a une bordure rouge + badge rouge + ressource manquante
- [ ] Le fourneau verrouillé est grisé avec le XP requis affiché
- [ ] La barre XP sticky en haut progresse correctement vers le prochain palier

### Assignation recette
- [ ] Tap "Choisir une recette" → bottom sheet avec toutes les recettes débloquées
- [ ] Chaque recette affiche production/min, ingrédients, ratio optimal
- [ ] Tap sur une recette → assignée au fourneau → modal fermée → badge "En production"
- [ ] "Changer" sur une recette déjà assignée → rouvre le picker

### Assignation machine
- [ ] Tap "+ Machine" → bottom sheet avec machines débloquées selon l'XP
- [ ] Machine incompatible avec la recette → grisée avec label "Incompatible"
- [ ] Tap "Aucune machine" → machine retirée du fourneau
- [ ] Les bonus de la machine s'affichent dans `ProductionStats`

### Production
- [ ] Fourneau avec recette + stock → plats apparaissent dans l'inventaire (onglet Sac)
- [ ] Stock épuisé → fourneau passe en "Stock vide" automatiquement au tick suivant
- [ ] Stock reconstitué → fourneau reprend automatiquement
- [ ] Bouton "⏸ Pause" → fourneau s'arrête → "▶ Reprendre" → repart
- [ ] `totalCookXp` augmente dans les DevTools Zustand
- [ ] Toast "🟢 +2 Gelée de Slime cuisinée !" visible depuis tous les onglets

### XP & Fourneaux
- [ ] La barre XP reflète le XP total (craft + cook)
- [ ] Atteindre 200 XP → toast "🍳 Deuxième fourneau débloqué !" + nouveau fourneau visible
- [ ] Le fourneau préview (verrouillé) disparaît quand le palier est atteint

## Notes pour la suite
- La progress bar du fourneau actif est en mode "indéfini" (pleine et animée)
  car la production est continue, pas en batches discrets. En Phase 3 on pourra
  ajouter un vrai compteur de batches si souhaité.
- `useSaveManager` (prompt 008) devra inclure `useCookStore` dans la sauvegarde Supabase
  → ajouter une table `save_cook` et l'appel dans `saveService.ts`
- La page Cook est la dernière page jouable de la Phase 2. La boucle complète
  Récolte → Craft → Cook est maintenant jouable end-to-end.
