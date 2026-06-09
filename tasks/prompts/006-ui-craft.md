# Prompt 006 — UI Craft

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 005 ont été exécutés.

Structure existante complète pertinente :
- `src/types/craft.ts` — `CraftJob`, `CraftState`, `CraftResult`
- `src/stores/useCraftStore.ts` — `enqueueCraft()`, `cancelCraft()`, `getProgress()`, `getCurrentJob()`, `queue`, `totalXp`, `craftedOnce`
- `src/lib/craftHelpers.ts` — `canAffordRecipe()`, `getMissingReason()`, `getRemainingSeconds()`, `formatCraftTime()`
- `src/stores/useInventoryStore.ts` — `resources`, `getAmount()`
- `src/data/craft-recipes.json` — recettes avec `emoji`, `tooltip`, `firstTimeFast`, `xpReward`
- `src/data/resources.json` — ressources avec `emoji`, `name`
- `src/components/shared/ProgressBar.tsx` — `value`, `color`, `height`, `showGlow`
- `src/components/shared/Tooltip.tsx` — tooltip hover/tap
- `src/components/shared/ToastManager.tsx` — `useToast()`
- `src/pages/HarvestPage.tsx` — référence de structure pour la cohérence visuelle
- `src/App.tsx` — `case 'craft': return <ComingSoon ... />` à remplacer

## Décisions de design
- **Couleur craft** : violet `#bf5af2` — progress bar, bordures actives, badges, boutons
- **Recette craftable** : card avec bouton violet actif, ingrédients en vert si dispo / rouge si manquant
- **Recette non craftable** : bouton grisé + `getMissingReason()` affiché directement sous le bouton
- **Premier craft** : badge "✨ Première fois — 3s !" visible si `firstTimeFast && !craftedOnce[id]`
- **File d'attente** : panneau sticky en bas de page (au dessus de la BottomNav) quand un craft est en cours
- **XP** : affiché en haut de page, couleur or `#ffd500`, augmente visuellement à chaque craft
- **Quantité** : sélecteur ×1 / ×5 / ×10 sur chaque recette pour crafter en lot
- **Annulation** : toujours possible depuis la file, avec remboursement confirmé en toast

---

## Architecture des fichiers

```
src/
├── pages/
│   └── CraftPage.tsx               ← page principale craft
├── components/
│   └── craft/
│       ├── RecipeCard.tsx           ← carte d'une recette (craftable/non craftable)
│       ├── IngredientRow.tsx        ← ligne ingrédient (emoji + nom + stock / requis)
│       ├── CraftQueueBar.tsx        ← barre fixe au dessus de la nav — craft en cours
│       └── XpBadge.tsx              ← badge XP total animé
```

---

## Fichiers à créer

---

### `src/components/craft/IngredientRow.tsx`

Affiche un ingrédient d'une recette : emoji + nom + quantité disponible vs requise.
Couleur verte si le stock est suffisant, rouge si insuffisant.

```tsx
import { RESOURCES } from '../../data'
import { useInventoryStore } from '../../stores/useInventoryStore'

interface IngredientRowProps {
  resourceId: string
  required: number       // quantité requise pour 1 craft
  quantity: number       // multiplicateur (×1, ×5, ×10)
}

export function IngredientRow({ resourceId, required, quantity }: IngredientRowProps) {
  const amount = useInventoryStore((state) => state.getAmount(resourceId))
  const resource = RESOURCES.find((r) => r.id === resourceId)
  const totalRequired = required * quantity
  const hasEnough = amount >= totalRequired

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0',
      }}
    >
      {/* Emoji + nom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '15px' }}>{resource?.emoji ?? '📦'}</span>
        <span style={{ fontSize: '12px', color: '#8b949e' }}>
          {resource?.name ?? resourceId}
        </span>
      </div>

      {/* Stock / requis */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: hasEnough ? '#30d158' : '#ff453a',
          }}
        >
          {Math.floor(amount).toLocaleString()}
        </span>
        <span style={{ fontSize: '12px', color: '#4a5568' }}>/</span>
        <span style={{ fontSize: '12px', color: '#636e8a' }}>
          {totalRequired}
        </span>
      </div>
    </div>
  )
}
```

---

### `src/components/craft/XpBadge.tsx`

Badge XP total. S'anime brièvement quand le XP augmente (scale + couleur or).

```tsx
import { useEffect, useRef, useState } from 'react'
import { useCraftStore } from '../../stores/useCraftStore'

export function XpBadge() {
  const totalXp = useCraftStore((state) => state.totalXp)
  const prevXp = useRef(totalXp)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (totalXp > prevXp.current) {
      setAnimating(true)
      const t = setTimeout(() => setAnimating(false), 600)
      prevXp.current = totalXp
      return () => clearTimeout(t)
    }
  }, [totalXp])

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: animating ? 'rgba(255,213,0,0.2)' : 'rgba(255,213,0,0.1)',
        border: `1px solid ${animating ? 'rgba(255,213,0,0.6)' : 'rgba(255,213,0,0.25)'}`,
        borderRadius: '20px',
        padding: '4px 12px',
        transition: 'all 0.3s ease',
        transform: animating ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <span style={{ fontSize: '13px' }}>⭐</span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#ffd500',
        }}
      >
        {totalXp.toLocaleString()} XP
      </span>
    </div>
  )
}
```

---

### `src/components/craft/RecipeCard.tsx`

Carte d'une recette de craft. Le composant le plus riche de la page.

États :
- **Craftable** : card avec bordure violette subtile, bouton violet actif
- **Non craftable** : card normale, bouton grisé, message d'erreur précis affiché
- **En cours** (job[0] dans la file) : badge "En cours..." violet animé
- **En attente** (dans la file mais pas en cours) : badge "En attente" gris
- **Première fois** : badge "✨ 3s !" si `firstTimeFast && !craftedOnce[id]`

```tsx
import { useState } from 'react'
import { useCraftStore } from '../../stores/useCraftStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { useToast } from '../shared/ToastManager'
import { Tooltip } from '../shared/Tooltip'
import { IngredientRow } from './IngredientRow'
import { canAffordRecipe, getMissingReason } from '../../lib/craftHelpers'
import { RESOURCES } from '../../data'
import type { CraftRecipe } from '../../types/game'

const QUANTITIES = [1, 5, 10] as const
type Qty = typeof QUANTITIES[number]

interface RecipeCardProps {
  recipe: CraftRecipe
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const [qty, setQty] = useState<Qty>(1)
  const resources = useInventoryStore((state) => state.resources)
  const queue = useCraftStore((state) => state.queue)
  const craftedOnce = useCraftStore((state) => state.craftedOnce)
  const enqueueCraft = useCraftStore((state) => state.enqueueCraft)
  const addToast = useToast()

  const canAfford = canAffordRecipe(recipe.id, resources, qty)
  const missingReason = !canAfford ? getMissingReason(recipe.id, resources, qty) : null
  const isFirstTime = recipe.firstTimeFast && !craftedOnce[recipe.id]

  // Position dans la file (0 = en cours, >0 = en attente, -1 = pas dans la file)
  const queuePosition = queue.findIndex((j) => j.recipeId === recipe.id)
  const isCurrentJob = queuePosition === 0
  const isQueued = queuePosition > 0

  // Ressource produite
  const outputResource = RESOURCES.find((r) => r.id === recipe.output.resourceId)

  function handleCraft() {
    const result = enqueueCraft(recipe.id, qty)
    if (result.success) {
      const label = qty > 1 ? `×${qty}` : ''
      addToast(`⚗️ ${recipe.emoji} ${recipe.name} ${label} ajouté à la file !`, 'info')
    } else {
      addToast(result.reason ?? 'Impossible de crafter.', 'error')
    }
  }

  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid ${isCurrentJob ? 'rgba(191,90,242,0.35)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        padding: '14px',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Header recette */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '26px' }}>{recipe.emoji}</span>
          <div>
            <Tooltip content={recipe.tooltip}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0', cursor: 'default' }}>
                {recipe.name}
              </div>
            </Tooltip>
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
              {recipe.craftTimeSeconds}s · +{recipe.xpReward} XP
            </div>
          </div>
        </div>

        {/* Badges état */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          {isFirstTime && (
            <div style={{
              background: 'rgba(255,213,0,0.12)',
              border: '1px solid rgba(255,213,0,0.3)',
              borderRadius: '20px', padding: '2px 8px',
              fontSize: '10px', fontWeight: 600, color: '#ffd500',
            }}>
              ✨ 3s première fois
            </div>
          )}
          {isCurrentJob && (
            <div style={{
              background: 'rgba(191,90,242,0.12)',
              border: '1px solid rgba(191,90,242,0.3)',
              borderRadius: '20px', padding: '2px 8px',
              fontSize: '10px', fontWeight: 600, color: '#bf5af2',
              animation: 'pulse-ring 2s infinite',
            }}>
              ⚗️ En cours...
            </div>
          )}
          {isQueued && (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px', padding: '2px 8px',
              fontSize: '10px', color: '#636e8a',
            }}>
              #{queuePosition} en attente
            </div>
          )}
        </div>
      </div>

      {/* Ingrédients */}
      <div
        style={{
          background: '#0d1117',
          borderRadius: '8px',
          padding: '8px 12px',
          marginBottom: '10px',
        }}
      >
        <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Ingrédients
        </div>
        {recipe.inputs.map((input) => (
          <IngredientRow
            key={input.resourceId}
            resourceId={input.resourceId}
            required={input.quantity}
            quantity={qty}
          />
        ))}

        {/* Flèche → produit */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            marginTop: '6px',
            paddingTop: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11px', color: '#4a5568' }}>Produit</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#bf5af2' }}>
            {outputResource?.emoji ?? '📦'} {recipe.output.quantity * qty}× {outputResource?.name ?? recipe.output.resourceId}
          </span>
        </div>
      </div>

      {/* Sélecteur quantité + bouton craft */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Sélecteur ×1 / ×5 / ×10 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {QUANTITIES.map((q) => (
            <button
              key={q}
              onClick={() => setQty(q)}
              style={{
                background: qty === q ? 'rgba(191,90,242,0.15)' : '#0d1117',
                border: `1px solid ${qty === q ? 'rgba(191,90,242,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: qty === q ? 600 : 400,
                color: qty === q ? '#bf5af2' : '#636e8a',
                cursor: 'pointer',
              }}
            >
              ×{q}
            </button>
          ))}
        </div>

        {/* Bouton craft */}
        <button
          onClick={handleCraft}
          disabled={!canAfford}
          style={{
            flex: 1,
            padding: '9px',
            background: canAfford ? 'rgba(191,90,242,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canAfford ? 'rgba(191,90,242,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '8px',
            color: canAfford ? '#bf5af2' : '#4a5568',
            fontSize: '13px',
            fontWeight: 600,
            cursor: canAfford ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
          }}
        >
          {canAfford ? `⚗️ Crafter ×${qty}` : '🔒 Stock insuffisant'}
        </button>
      </div>

      {/* Message d'erreur précis si stock insuffisant */}
      {missingReason && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: '#ff453a',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ⚠️ {missingReason}
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/craft/CraftQueueBar.tsx`

Barre sticky affichée AU DESSUS de la BottomNav quand un craft est en cours.
Montre : emoji + nom du craft en cours, progress bar violette, countdown, taille de la file,
et un bouton pour annuler le job en cours.

```tsx
import { useEffect, useState } from 'react'
import { useCraftStore } from '../../stores/useCraftStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { useToast } from '../shared/ToastManager'
import { ProgressBar } from '../shared/ProgressBar'
import { CRAFT_RECIPES } from '../../data'
import { getRemainingSeconds, formatCraftTime } from '../../lib/craftHelpers'

export function CraftQueueBar() {
  const queue = useCraftStore((state) => state.queue)
  const getProgress = useCraftStore((state) => state.getProgress)
  const cancelCraft = useCraftStore((state) => state.cancelCraft)
  const addToast = useToast()

  // Forcer le re-render toutes les secondes pour le countdown
  const [, setTick] = useState(0)
  useEffect(() => {
    if (queue.length === 0) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [queue.length])

  if (queue.length === 0) return null

  const currentJob = queue[0]
  const recipe = CRAFT_RECIPES.find((r) => r.id === currentJob.recipeId)
  if (!recipe) return null

  const progress = getProgress()
  const remaining = currentJob.endsAt > 0
    ? getRemainingSeconds(currentJob.endsAt)
    : recipe.craftTimeSeconds
  const queueSize = queue.length - 1  // jobs en attente après celui en cours

  function handleCancel() {
    cancelCraft(currentJob.id)
    addToast('Craft annulé. Ingrédients remboursés.', 'info')
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '64px',  // hauteur de la BottomNav
        left: 0,
        right: 0,
        background: '#161b22',
        borderTop: '1px solid rgba(191,90,242,0.2)',
        padding: '10px 16px',
        zIndex: 90,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header : recette en cours + countdown + annuler */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{recipe.emoji}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              {recipe.name}
              {currentJob.quantity > 1 && (
                <span style={{ color: '#636e8a', fontWeight: 400 }}> ×{currentJob.quantity}</span>
              )}
            </div>
            {queueSize > 0 && (
              <div style={{ fontSize: '10px', color: '#636e8a' }}>
                +{queueSize} en attente dans la file
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Countdown */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#bf5af2' }}>
              {formatCraftTime(remaining)}
            </div>
            <div style={{ fontSize: '10px', color: '#636e8a' }}>restant</div>
          </div>

          {/* Bouton annuler */}
          <button
            onClick={handleCancel}
            style={{
              background: 'rgba(255,68,58,0.08)',
              border: '1px solid rgba(255,68,58,0.2)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              color: '#ff453a',
              cursor: 'pointer',
            }}
          >
            ✕ Annuler
          </button>
        </div>
      </div>

      {/* Progress bar violette */}
      <ProgressBar value={progress} color="#bf5af2" height={5} showGlow />
    </div>
  )
}
```

---

### `src/pages/CraftPage.tsx`

Page principale Craft. Header XP → liste des recettes → barre de file sticky.

```tsx
import { useMemo } from 'react'
import { useCraftStore } from '../stores/useCraftStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { CRAFT_RECIPES } from '../data'
import { RecipeCard } from '../components/craft/RecipeCard'
import { CraftQueueBar } from '../components/craft/CraftQueueBar'
import { XpBadge } from '../components/craft/XpBadge'
import { canAffordRecipe } from '../lib/craftHelpers'

export function CraftPage() {
  const resources = useInventoryStore((state) => state.resources)
  const queue = useCraftStore((state) => state.queue)

  // Trier les recettes : craftables en premier, puis non craftables
  // À l'intérieur de chaque groupe : ordre alphabétique
  const sortedRecipes = useMemo(() => {
    return [...CRAFT_RECIPES].sort((a, b) => {
      const aAfford = canAffordRecipe(a.id, resources)
      const bAfford = canAffordRecipe(b.id, resources)
      if (aAfford && !bAfford) return -1
      if (!aAfford && bAfford) return 1
      return a.name.localeCompare(b.name)
    })
  }, [resources])

  // Padding bottom : laisser de la place pour CraftQueueBar si active
  const hasActiveQueue = queue.length > 0

  return (
    <div
      style={{
        padding: '16px',
        maxWidth: '480px',
        margin: '0 auto',
        // Si file active, ajouter de l'espace en bas pour ne pas masquer la dernière recette
        paddingBottom: hasActiveQueue ? '80px' : '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            ⚗️ Craft
          </h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
            Transforme tes ressources en matériaux.
          </p>
        </div>
        <XpBadge />
      </div>

      {/* Compteur de file */}
      {queue.length > 0 && (
        <div
          style={{
            background: 'rgba(191,90,242,0.08)',
            border: '1px solid rgba(191,90,242,0.2)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '13px', color: '#bf5af2', fontWeight: 500 }}>
            ⚗️ {queue.length} craft{queue.length > 1 ? 's' : ''} en cours / en attente
          </span>
          <span style={{ fontSize: '11px', color: '#636e8a' }}>
            Voir en bas ↓
          </span>
        </div>
      )}

      {/* Section : recettes craftables */}
      {sortedRecipes.some((r) => canAffordRecipe(r.id, resources)) && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 500, color: '#30d158',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
          }}>
            ✅ Disponibles
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sortedRecipes
              .filter((r) => canAffordRecipe(r.id, resources))
              .map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
          </div>
        </div>
      )}

      {/* Section : recettes non craftables (stock insuffisant) */}
      {sortedRecipes.some((r) => !canAffordRecipe(r.id, resources)) && (
        <div>
          <div style={{
            fontSize: '11px', fontWeight: 500, color: '#636e8a',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
          }}>
            🔒 Stock insuffisant
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sortedRecipes
              .filter((r) => !canAffordRecipe(r.id, resources))
              .map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
          </div>
        </div>
      )}

      {/* Barre de file sticky — au dessus de la BottomNav */}
      <CraftQueueBar />
    </div>
  )
}
```

---

### Mise à jour `src/App.tsx`

Remplacer le `ComingSoon` de l'onglet craft par `CraftPage` :

```tsx
// Ajouter l'import en haut du fichier :
import { CraftPage } from './pages/CraftPage'

// Dans renderPage(), remplacer :
// case 'craft': return <ComingSoon label="⚗️ Craft" color="#bf5af2" />
// Par :
case 'craft': return <CraftPage />
```

---

## Critères de succès

### Visuel
- [ ] L'onglet "Craft" de la BottomNav est violet quand actif (`#bf5af2`)
- [ ] Les recettes craftables apparaissent en premier (section "✅ Disponibles")
- [ ] Les recettes non craftables apparaissent en second (section "🔒 Stock insuffisant")
- [ ] Le badge XP est visible en haut à droite, couleur or `#ffd500`

### RecipeCard
- [ ] Chaque recette affiche `emoji + nom + craftTimeSeconds + xpReward`
- [ ] Les ingrédients sont verts si stock suffisant, rouges si insuffisant
- [ ] Le message d'erreur précis apparaît sous le bouton ("⚠️ Il te manque 3 🌿 Herbe.")
- [ ] Le badge "✨ 3s première fois" est visible si `firstTimeFast && !craftedOnce[id]`
- [ ] Le sélecteur ×1 / ×5 / ×10 met à jour les quantités d'ingrédients et le message d'erreur
- [ ] Le bouton craft se grise et affiche "🔒 Stock insuffisant" si pas assez de ressources
- [ ] Cliquer "Crafter" → toast "⚗️ [Recette] ajouté à la file !"
- [ ] Badge "⚗️ En cours..." sur la recette qui est en train de se crafter
- [ ] Badge "#2 en attente" sur une recette en position 2+ dans la file

### CraftQueueBar
- [ ] La barre n'apparaît que si `queue.length > 0`
- [ ] La progress bar violette progresse correctement (via `getProgress()`)
- [ ] Le countdown se met à jour chaque seconde
- [ ] "✕ Annuler" annule le job en cours et affiche un toast "Craft annulé. Ingrédients remboursés."
- [ ] La barre se positionne juste au dessus de la BottomNav (bottom: 64px)
- [ ] Elle n'est pas visible si aucun craft n'est en cours

### XpBadge
- [ ] Le badge s'anime brièvement (scale + glow) quand le XP augmente
- [ ] La valeur est formatée avec `.toLocaleString()` (ex: 1 234 XP)

### Intégration
- [ ] Le premier craft d'un Bouillon se termine en 3s (firstTimeFast)
- [ ] Après le craft, le Bouillon apparaît dans l'inventaire (`useInventoryStore`)
- [ ] `craftedOnce['bouillon_base']` passe à `true` → le badge "3s" disparaît
- [ ] Naviguer sur l'onglet Récolte pendant un craft → la `CraftQueueBar` reste visible
- [ ] Le toast de complétion ("🍵 +1 Bouillon de Base crafté ! (+5 XP)") s'affiche depuis `App.tsx`

## Notes pour la suite
- `CraftQueueBar` est en `position: fixed` → elle reste visible sur tous les onglets,
  pas seulement sur Craft. C'est intentionnel : le joueur sait toujours ce qui craft.
- La page Craft ne gère que le craft de ressources intermédiaires (prompt 002/004).
  Le Cook (lignes de production) est une page séparée — prompt 007.
- Le tri "craftables en premier" est recalculé à chaque changement d'inventaire via `useMemo`.
  C'est léger — 3 recettes pour le MVP. Si le nombre de recettes explose plus tard,
  on pourra optimiser avec une sélection Zustand plus fine.
