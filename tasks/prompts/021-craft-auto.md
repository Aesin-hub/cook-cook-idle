# Prompt 021 — Craft Automatique (Auto-craft + Chaînes de production)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 020 + AUDIT Phase 3 ont été exécutés.

Structure existante pertinente :
- `src/stores/useCraftStore.ts` — `enqueueCraft()`, `queue`, `processTick()`
- `src/stores/useInventoryStore.ts` — `resources`, `getAmount()`
- `src/stores/useCookStore.ts` — `furnaces`, `unlockedFurnaceCount`
- `src/data/craft-recipes.json` — recettes avec `inputs`, `output`
- `src/hooks/useGameLoop.ts` — tick 1s
- `src/pages/CraftPage.tsx` — page Craft existante avec onglets
- `src/types/craftAuto.ts` — à créer

## Objectif
Implémenter le **système de craft automatique** — mix B + C :

**Niveau B — Auto-craft avec seuil de stock**
Le joueur configure un stock cible par ressource craftée.
Quand le stock descend en dessous → craft automatique dans la file existante.

**Niveau C — Chaînes d'alimentation vers les fourneaux Cook**
Les ressources craftées alimentent automatiquement les lignes Cook configurées.

**Interface** : onglet "Auto" sur la page Craft existante — pas de page dédiée.

## Décisions de game design validées
- Le craft auto utilise **la même file** que le craft manuel (visible par le joueur)
- Si les ingrédients manquent → **attente silencieuse** (aucun message)
- La priorité entre les recettes est **réglable manuellement par drag to reorder**
- Toggle global ON/OFF pour tout le système
- Max **1 craft auto par tick** pour ne pas saturer la file manuelle

---

## Fichiers à créer / modifier

---

### `src/types/craftAuto.ts`

```typescript
// Configuration d'un seuil de stock pour l'auto-craft
export interface StockThreshold {
  recipeId: string      // recette à crafter automatiquement
  targetStock: number   // quantité cible à maintenir en stock
  enabled: boolean      // actif ou non
  priority: number      // ordre de priorité (1 = plus haute) — drag to reorder
}

// Chaîne d'alimentation : ressource craftée → fourneau Cook
export interface FeedChain {
  id: string
  resourceId: string    // ressource craftée à envoyer
  furnaceId: string     // id du fourneau cible
  enabled: boolean
}

// État global du store
export interface CraftAutoState {
  stockThresholds: StockThreshold[]
  feedChains: FeedChain[]
  autoEnabled: boolean
}
```

---

### `src/stores/useCraftAutoStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { CRAFT_RECIPES } from '../data'
import { useInventoryStore } from './useInventoryStore'
import { useCraftStore } from './useCraftStore'
import type { CraftAutoState, StockThreshold, FeedChain } from '../types/craftAuto'

interface CraftAutoActions {
  // Seuils de stock
  setStockThreshold: (recipeId: string, targetStock: number) => void
  toggleThreshold: (recipeId: string) => void
  removeThreshold: (recipeId: string) => void
  reorderThresholds: (fromIndex: number, toIndex: number) => void

  // Chaînes d'alimentation
  addFeedChain: (resourceId: string, furnaceId: string) => void
  toggleFeedChain: (chainId: string) => void
  removeFeedChain: (chainId: string) => void

  // Toggle global
  toggleAutoEnabled: () => void

  // Tick — appelé par useGameLoop toutes les secondes
  processTick: () => void
}

export const useCraftAutoStore = create<CraftAutoState & CraftAutoActions>()(
  persist(
    (set, get) => ({
      stockThresholds: [],
      feedChains: [],
      autoEnabled: false,

      // ─── Seuils de stock ──────────────────────────────────────────────

      setStockThreshold: (recipeId, targetStock) => {
        const { stockThresholds } = get()
        const existing = stockThresholds.find((t) => t.recipeId === recipeId)
        if (existing) {
          set({
            stockThresholds: stockThresholds.map((t) =>
              t.recipeId === recipeId ? { ...t, targetStock } : t
            ),
          })
        } else {
          // Nouvelle entrée — priorité la plus basse
          const maxPriority = stockThresholds.reduce((m, t) => Math.max(m, t.priority), 0)
          set({
            stockThresholds: [
              ...stockThresholds,
              { recipeId, targetStock, enabled: true, priority: maxPriority + 1 },
            ],
          })
        }
      },

      toggleThreshold: (recipeId) => {
        set((s) => ({
          stockThresholds: s.stockThresholds.map((t) =>
            t.recipeId === recipeId ? { ...t, enabled: !t.enabled } : t
          ),
        }))
      },

      removeThreshold: (recipeId) => {
        set((s) => ({
          stockThresholds: s.stockThresholds.filter((t) => t.recipeId !== recipeId),
        }))
      },

      // Drag to reorder — échange les priorités
      reorderThresholds: (fromIndex, toIndex) => {
        set((s) => {
          const sorted = [...s.stockThresholds].sort((a, b) => a.priority - b.priority)
          const [moved] = sorted.splice(fromIndex, 1)
          sorted.splice(toIndex, 0, moved)
          // Réassigner les priorités selon le nouvel ordre
          return {
            stockThresholds: sorted.map((t, i) => ({ ...t, priority: i + 1 })),
          }
        })
      },

      // ─── Chaînes d'alimentation ───────────────────────────────────────

      addFeedChain: (resourceId, furnaceId) => {
        set((s) => ({
          feedChains: [
            ...s.feedChains,
            { id: uuidv4(), resourceId, furnaceId, enabled: true },
          ],
        }))
      },

      toggleFeedChain: (chainId) => {
        set((s) => ({
          feedChains: s.feedChains.map((c) =>
            c.id === chainId ? { ...c, enabled: !c.enabled } : c
          ),
        }))
      },

      removeFeedChain: (chainId) => {
        set((s) => ({
          feedChains: s.feedChains.filter((c) => c.id !== chainId),
        }))
      },

      // ─── Toggle global ────────────────────────────────────────────────

      toggleAutoEnabled: () => set((s) => ({ autoEnabled: !s.autoEnabled })),

      // ─── Tick auto-craft ──────────────────────────────────────────────

      processTick: () => {
        const { stockThresholds, autoEnabled } = get()
        if (!autoEnabled) return

        const inventory = useInventoryStore.getState()
        const craftStore = useCraftStore.getState()

        // Trier par priorité (1 = plus haute)
        const sorted = [...stockThresholds]
          .filter((t) => t.enabled)
          .sort((a, b) => a.priority - b.priority)

        for (const threshold of sorted) {
          const recipe = CRAFT_RECIPES.find((r) => r.id === threshold.recipeId)
          if (!recipe) continue

          const currentStock = inventory.getAmount(recipe.output.resourceId)
          if (currentStock >= threshold.targetStock) continue

          // Vérifier silencieusement que les ingrédients sont disponibles
          const canAfford = recipe.inputs.every(
            (input) => inventory.getAmount(input.resourceId) >= input.quantity
          )
          if (!canAfford) continue  // Attente silencieuse — pas de message

          // Ajouter à la file de craft (max 1 par tick)
          const needed = Math.ceil(
            (threshold.targetStock - currentStock) / recipe.output.quantity
          )
          craftStore.enqueueCraft(recipe.id, Math.min(needed, 5))
          return  // Un seul craft auto par tick — stop après le premier traité
        }
      },
    }),
    {
      name: 'cooking-fantasy-craft-auto',
      partialize: (state) => ({
        stockThresholds: state.stockThresholds,
        feedChains: state.feedChains,
        autoEnabled: state.autoEnabled,
      }),
    }
  )
)
```

---

### Mise à jour `src/hooks/useGameLoop.ts`

Ajouter le tick auto-craft après le tick craft.

```typescript
import { useCraftAutoStore } from '../stores/useCraftAutoStore'

// Dans l'interval, juste après craftTick() :
// 2bis. Auto-craft
useCraftAutoStore.getState().processTick()
```

---

### `src/components/craft/AutoCraftPanel.tsx`

Interface de configuration complète de l'auto-craft.

```tsx
import { useState, useRef } from 'react'
import { useCraftAutoStore } from '../../stores/useCraftAutoStore'
import { useCookStore } from '../../stores/useCookStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { CRAFT_RECIPES, COOK_RECIPES } from '../../data'

export function AutoCraftPanel() {
  const {
    stockThresholds, feedChains, autoEnabled,
    setStockThreshold, toggleThreshold, removeThreshold, reorderThresholds,
    addFeedChain, toggleFeedChain, removeFeedChain,
    toggleAutoEnabled,
  } = useCraftAutoStore()

  const furnaces = useCookStore((s) => s.furnaces)
  const unlockedFurnaceCount = useCookStore((s) => s.unlockedFurnaceCount)
  const resources = useInventoryStore((s) => s.resources)

  const [newRecipeId, setNewRecipeId] = useState('')
  const [newTarget, setNewTarget] = useState(100)
  const [newFeedResource, setNewFeedResource] = useState('')
  const [newFeedFurnace, setNewFeedFurnace] = useState('')

  // Drag to reorder
  const dragIndex = useRef<number | null>(null)

  // Recettes pas encore configurées
  const unconfiguredRecipes = CRAFT_RECIPES.filter(
    (r) => !stockThresholds.find((t) => t.recipeId === r.id)
  )

  // Fourneaux actifs avec une recette
  const activeFurnaces = furnaces.filter(
    (f) => f.slotIndex < unlockedFurnaceCount && f.recipeId
  )

  // Seuils triés par priorité
  const sortedThresholds = [...stockThresholds].sort((a, b) => a.priority - b.priority)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Toggle global */}
      <div style={{
        background: '#161b22',
        border: `1px solid ${autoEnabled ? 'rgba(191,90,242,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px', padding: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>
            ⚙️ Craft Automatique
          </div>
          <div style={{ fontSize: '12px', color: '#636e8a', marginTop: '2px' }}>
            {autoEnabled
              ? 'Actif — le système craft selon tes seuils'
              : 'Inactif — tout est manuel'}
          </div>
        </div>
        <button
          onClick={toggleAutoEnabled}
          style={{
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            background: autoEnabled ? 'rgba(191,90,242,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${autoEnabled ? 'rgba(191,90,242,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: autoEnabled ? '#bf5af2' : '#636e8a',
            fontSize: '13px', fontWeight: 600,
          }}
        >
          {autoEnabled ? '✅ Activé' : '⏸ Désactivé'}
        </button>
      </div>

      {/* Section seuils de stock */}
      <div>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#636e8a',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Seuils de stock</span>
          {sortedThresholds.length > 1 && (
            <span style={{ fontSize: '10px', color: '#4a5568' }}>
              ↕ Glisse pour réordonner
            </span>
          )}
        </div>

        {/* Seuils configurés — draggables */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedThresholds.map((threshold, index) => {
            const recipe = CRAFT_RECIPES.find((r) => r.id === threshold.recipeId)
            if (!recipe) return null
            const currentStock = Math.floor(resources[recipe.output.resourceId] ?? 0)
            const progress = Math.min(currentStock / threshold.targetStock, 1)

            return (
              <div
                key={threshold.recipeId}
                draggable
                onDragStart={() => { dragIndex.current = index }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current !== null && dragIndex.current !== index) {
                    reorderThresholds(dragIndex.current, index)
                    dragIndex.current = null
                  }
                }}
                style={{
                  background: '#161b22',
                  border: `1px solid ${threshold.enabled ? 'rgba(191,90,242,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px', padding: '12px',
                  opacity: threshold.enabled ? 1 : 0.5,
                  cursor: 'grab',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {/* Handle drag */}
                  <span style={{ fontSize: '14px', color: '#636e8a', cursor: 'grab' }}>⠿</span>
                  <span style={{ fontSize: '11px', color: '#4a5568', minWidth: '16px' }}>
                    #{threshold.priority}
                  </span>
                  <span style={{ fontSize: '18px' }}>{recipe.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                      {recipe.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#636e8a' }}>
                      {currentStock.toLocaleString()} / {threshold.targetStock.toLocaleString()} en stock
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => toggleThreshold(threshold.recipeId)}
                      style={{
                        padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '11px', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)', color: '#636e8a',
                      }}
                    >
                      {threshold.enabled ? 'Pause' : 'Activer'}
                    </button>
                    <button
                      onClick={() => removeThreshold(threshold.recipeId)}
                      style={{
                        padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '11px', background: 'rgba(255,68,58,0.08)',
                        border: '1px solid rgba(255,68,58,0.2)', color: '#ff453a',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barre de progression */}
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '4px' }}>
                  <div style={{
                    width: `${progress * 100}%`, height: '100%',
                    background: progress >= 1 ? '#30d158' : '#bf5af2',
                    borderRadius: '4px',
                    boxShadow: `0 0 6px ${progress >= 1 ? '#30d158' : '#bf5af2'}80`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Ajouter un seuil */}
        {unconfiguredRecipes.length > 0 && (
          <div style={{
            background: '#161b22', border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '12px', marginTop: '8px',
            display: 'flex', gap: '8px', alignItems: 'center',
          }}>
            <select
              value={newRecipeId}
              onChange={(e) => setNewRecipeId(e.target.value)}
              style={{
                flex: 1, background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '7px 10px',
                fontSize: '12px', color: '#e2e8f0', outline: 'none',
              }}
            >
              <option value="">+ Choisir une recette...</option>
              {unconfiguredRecipes.map((r) => (
                <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={newTarget}
              min={1}
              onChange={(e) => setNewTarget(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: '70px', background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '7px 8px',
                fontSize: '12px', color: '#e2e8f0', outline: 'none',
                textAlign: 'center',
              }}
            />
            <button
              onClick={() => {
                if (newRecipeId && newTarget > 0) {
                  setStockThreshold(newRecipeId, newTarget)
                  setNewRecipeId('')
                  setNewTarget(100)
                }
              }}
              disabled={!newRecipeId}
              style={{
                padding: '7px 12px', borderRadius: '8px', cursor: 'pointer',
                background: newRecipeId ? 'rgba(191,90,242,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${newRecipeId ? 'rgba(191,90,242,0.4)' : 'rgba(255,255,255,0.06)'}`,
                color: newRecipeId ? '#bf5af2' : '#4a5568',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              Ajouter
            </button>
          </div>
        )}

        {stockThresholds.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '20px', color: '#636e8a', fontSize: '12px',
          }}>
            Aucun seuil configuré. Ajoute une recette pour commencer.
          </div>
        )}
      </div>

      {/* Section chaînes d'alimentation */}
      <div>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#636e8a',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
        }}>
          Chaînes d'alimentation Cook
        </div>

        {activeFurnaces.length === 0 ? (
          <div style={{
            background: '#161b22', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px', padding: '12px',
            fontSize: '12px', color: '#636e8a', textAlign: 'center',
          }}>
            Assigne d'abord une recette à un fourneau dans l'onglet Cook.
          </div>
        ) : (
          <>
            {/* Chaînes configurées */}
            {feedChains.map((chain) => {
              const furnace = furnaces.find((f) => f.id === chain.furnaceId)
              const cookRecipe = furnace?.recipeId
                ? COOK_RECIPES.find((r) => r.id === furnace.recipeId)
                : null
              if (!furnace) return null

              return (
                <div key={chain.id} style={{
                  background: '#161b22',
                  border: `1px solid ${chain.enabled ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px', padding: '10px 12px', marginBottom: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  opacity: chain.enabled ? 1 : 0.5,
                }}>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚗️</span>
                    <span style={{ color: '#bf5af2' }}>{chain.resourceId}</span>
                    <span style={{ color: '#636e8a' }}>→</span>
                    <span>🍳</span>
                    <span>Fourneau {furnace.slotIndex + 1}</span>
                    {cookRecipe && (
                      <span style={{ color: '#636e8a' }}>({cookRecipe.emoji} {cookRecipe.name})</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => toggleFeedChain(chain.id)}
                      style={{ padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#636e8a' }}
                    >
                      {chain.enabled ? 'Pause' : 'Activer'}
                    </button>
                    <button
                      onClick={() => removeFeedChain(chain.id)}
                      style={{ padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', background: 'rgba(255,68,58,0.08)', border: '1px solid rgba(255,68,58,0.2)', color: '#ff453a' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Ajouter une chaîne */}
            <div style={{
              background: '#161b22', border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '12px',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={newFeedResource}
                  onChange={(e) => setNewFeedResource(e.target.value)}
                  style={{
                    flex: 1, background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', padding: '7px 10px',
                    fontSize: '12px', color: '#e2e8f0', outline: 'none',
                  }}
                >
                  <option value="">Ressource craftée...</option>
                  {CRAFT_RECIPES.map((r) => (
                    <option key={r.id} value={r.output.resourceId}>
                      {r.emoji} {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newFeedFurnace}
                  onChange={(e) => setNewFeedFurnace(e.target.value)}
                  style={{
                    flex: 1, background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', padding: '7px 10px',
                    fontSize: '12px', color: '#e2e8f0', outline: 'none',
                  }}
                >
                  <option value="">Fourneau...</option>
                  {activeFurnaces.map((f) => {
                    const cookRecipe = COOK_RECIPES.find((r) => r.id === f.recipeId)
                    return (
                      <option key={f.id} value={f.id}>
                        Fourneau {f.slotIndex + 1} — {cookRecipe?.name ?? ''}
                      </option>
                    )
                  })}
                </select>
              </div>
              <button
                onClick={() => {
                  if (newFeedResource && newFeedFurnace) {
                    addFeedChain(newFeedResource, newFeedFurnace)
                    setNewFeedResource('')
                    setNewFeedFurnace('')
                  }
                }}
                disabled={!newFeedResource || !newFeedFurnace}
                style={{
                  padding: '8px', borderRadius: '8px', cursor: 'pointer',
                  background: (newFeedResource && newFeedFurnace) ? 'rgba(255,149,0,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${(newFeedResource && newFeedFurnace) ? 'rgba(255,149,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  color: (newFeedResource && newFeedFurnace) ? '#ff9500' : '#4a5568',
                  fontSize: '13px', fontWeight: 600,
                }}
              >
                🔗 Créer la chaîne
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

---

### Mise à jour `src/pages/CraftPage.tsx`

Ajouter l'onglet "Auto".

```tsx
import { useState } from 'react'
import { AutoCraftPanel } from '../components/craft/AutoCraftPanel'

// Ajouter un state tabs :
const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual')

// Ajouter le switch tabs sous le header :
<div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
  {([
    { id: 'manual', label: '🔨 Manuel' },
    { id: 'auto',   label: '⚙️ Auto'   },
  ] as const).map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      style={{
        flex: 1, padding: '9px',
        background: activeTab === tab.id ? 'rgba(191,90,242,0.15)' : '#161b22',
        border: `1px solid ${activeTab === tab.id ? 'rgba(191,90,242,0.4)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '8px', cursor: 'pointer',
        fontSize: '13px', fontWeight: activeTab === tab.id ? 600 : 400,
        color: activeTab === tab.id ? '#bf5af2' : '#636e8a',
      }}
    >
      {tab.label}
    </button>
  ))}
</div>

// Conditionner l'affichage :
{activeTab === 'manual' ? (
  // ... contenu existant (liste des recettes + CraftQueueBar) ...
) : (
  <AutoCraftPanel />
)}
```

---

## Critères de succès

- [ ] `npm run build` passe sans erreur TypeScript
- [ ] L'onglet "Auto" apparaît sur la page Craft
- [ ] Toggle global ON/OFF fonctionne
- [ ] Configurer un seuil Bouillon 500 → le craft se lance automatiquement quand stock < 500
- [ ] Drag to reorder : glisser une recette change son ordre et son numéro de priorité
- [ ] Barre de progression du stock s'affiche et se met à jour en temps réel
- [ ] Supprimer un seuil → disparaît de la liste
- [ ] Pause d'un seuil → craft auto s'arrête pour cette recette
- [ ] Ajouter une chaîne d'alimentation → chaîne visible dans la liste
- [ ] `useCraftAutoStore` visible dans les DevTools Zustand avec bon état
- [ ] `processTick()` ne fait rien si `autoEnabled = false`
- [ ] Ingrédients insuffisants → attente silencieuse (aucun message affiché)
- [ ] Max 1 craft auto par tick — la file manuelle n'est pas surchargée

## Notes pour la suite
- Les chaînes d'alimentation (Niveau C) transfèrent les ressources vers les fourneaux
  Cook mais la logique de consommation automatique côté Cook est gérée par `useCookStore`
  qui lit déjà l'inventaire en continu — les chaînes servent surtout à prioriser
  quelles ressources doivent être maintenues en stock pour quels fourneaux
- En Phase 4, on pourra ajouter un indicateur visuel "⚙️ Auto" sur les RecipeCards
  dont le craft automatique est actif
