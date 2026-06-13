# Prompt 022 — Cahier de Recettes

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 021 ont été exécutés.

Structure existante pertinente :
- `src/data/cook-recipes.json` — recettes cook (id, name, emoji, unlocked...)
- `src/stores/useGameDataStore.ts` — `cookRecipes` chargées depuis Supabase
- `src/pages/ProfilePage.tsx` — page Profil existante
- `src/components/profile/` — composants profil existants

## Objectif
Créer le **Cahier de Recettes** — accessible depuis la page Profil.
Chaque recette cook débloquée en jeu révèle sa vraie recette réelle cuisinables chez soi.

## Décisions de game design validées
- Recettes verrouillées → **cadenas sans info** (Option A)
- Navigation → **accessible depuis la page Profil** (Option C)
- 3 recettes MVP avec leur vraie recette ajoutées dans `cook-recipes.json`

---

## Données à ajouter dans `cook-recipes.json`

Ajouter le champ `realRecipe` sur les 3 recettes existantes.

### gelee_slime → Panna Cotta aux Fruits Rouges
```json
"realRecipe": {
  "name": "Panna Cotta aux Fruits Rouges",
  "category": "dessert",
  "cuisine": "west",
  "prepTimeMin": 15,
  "cookTimeMin": 5,
  "difficulty": 1,
  "servings": 4,
  "ingredients": [
    "50cl de crème liquide entière",
    "3 feuilles de gélatine",
    "50g de sucre",
    "1 gousse de vanille",
    "200g de fruits rouges (framboises, myrtilles)",
    "2 cuillères à soupe de sucre glace"
  ],
  "steps": [
    "Faire tremper la gélatine dans de l'eau froide 5 minutes.",
    "Chauffer la crème avec le sucre et la vanille sans faire bouillir.",
    "Hors du feu, incorporer la gélatine essorée et bien mélanger.",
    "Verser dans des ramequins, réfrigérer minimum 4 heures.",
    "Mixer les fruits rouges avec le sucre glace pour le coulis.",
    "Démouler et napper de coulis avant de servir."
  ],
  "tip": "Pour la version Gelée de Slime, ajoute une pointe de colorant vert alimentaire !"
}
```

### soupe_champignons → Velouté de Champignons
```json
"realRecipe": {
  "name": "Velouté de Champignons",
  "category": "plat",
  "cuisine": "west",
  "prepTimeMin": 15,
  "cookTimeMin": 25,
  "difficulty": 1,
  "servings": 4,
  "ingredients": [
    "500g de champignons de Paris",
    "1 oignon",
    "2 gousses d'ail",
    "30cl de crème fraîche",
    "1L de bouillon de légumes",
    "Beurre, sel, poivre, persil frais"
  ],
  "steps": [
    "Émincer l'oignon et l'ail, faire revenir dans du beurre 3 minutes.",
    "Ajouter les champignons émincés, cuire 10 minutes à feu moyen.",
    "Verser le bouillon, laisser mijoter 15 minutes.",
    "Mixer finement, ajouter la crème et rectifier l'assaisonnement.",
    "Servir chaud avec du persil frais émincé."
  ],
  "tip": "Pour une saveur plus intense, utilise un mélange de champignons sauvages."
}
```

### pizza_fantastique → Pizza Margherita
```json
"realRecipe": {
  "name": "Pizza Margherita",
  "category": "plat",
  "cuisine": "west",
  "prepTimeMin": 30,
  "cookTimeMin": 15,
  "difficulty": 2,
  "servings": 2,
  "ingredients": [
    "250g de farine T00 (ou T45)",
    "1 sachet de levure boulangère sèche",
    "15cl d'eau tiède",
    "1 cuillère à soupe d'huile d'olive",
    "200g de sauce tomate",
    "150g de mozzarella di bufala",
    "Basilic frais, sel, origan"
  ],
  "steps": [
    "Mélanger la farine, la levure et le sel. Creuser un puits.",
    "Ajouter l'eau tiède et l'huile, pétrir 10 minutes jusqu'à pâte lisse.",
    "Laisser lever 1h sous un torchon humide dans un endroit chaud.",
    "Préchauffer le four à 250°C (maximum). Étaler la pâte finement.",
    "Napper de sauce tomate, enfourner 5 minutes.",
    "Sortir, ajouter la mozzarella déchirée, remettre 8-10 minutes.",
    "Garnir de basilic frais et d'un filet d'huile d'olive à la sortie du four."
  ],
  "tip": "La clé d'une bonne pizza : four très chaud et pâte étalée très finement."
}
```

---

## Fichiers à créer

---

### `src/types/recipe.ts`

```typescript
export type RecipeCategory = 'entree' | 'plat' | 'dessert' | 'aperitif' | 'cocktail'
export type RecipeCuisine = 'center' | 'north' | 'east' | 'west' | 'south'

export interface RealRecipe {
  name: string
  category: RecipeCategory
  cuisine: RecipeCuisine
  prepTimeMin: number
  cookTimeMin: number
  difficulty: 1 | 2 | 3
  servings: number
  ingredients: string[]
  steps: string[]
  tip?: string
}

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  entree:   '🥗 Entrée',
  plat:     '🍽️ Plat',
  dessert:  '🍮 Dessert',
  aperitif: '🥂 Apéritif',
  cocktail: '🍹 Cocktail',
}

export const CUISINE_LABELS: Record<RecipeCuisine, string> = {
  center: '🌍 Classique',
  north:  '❄️ Nordique',
  east:   '🌸 Asiatique',
  west:   '🏰 Médiéval',
  south:  '🌶️ Épicé',
}

export const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: '⭐ Facile',
  2: '⭐⭐ Moyen',
  3: '⭐⭐⭐ Difficile',
}
```

---

### `src/components/cookbook/RecipeBookCard.tsx`

Card d'une recette dans la liste.

```tsx
import type { RealRecipe, RecipeCategory, RecipeCuisine } from '../../types/recipe'
import { CATEGORY_LABELS, CUISINE_LABELS, DIFFICULTY_LABELS } from '../../types/recipe'

interface CookRecipeWithReal {
  id: string
  name: string
  emoji: string
  unlocked: boolean
  realRecipe?: RealRecipe
}

interface RecipeBookCardProps {
  recipe: CookRecipeWithReal
  onClick: () => void
}

export function RecipeBookCard({ recipe, onClick }: RecipeBookCardProps) {
  const real = recipe.realRecipe

  // Recette verrouillée — cadenas sans info
  if (!recipe.unlocked) {
    return (
      <div style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '14px',
        display: 'flex', alignItems: 'center', gap: '12px',
        opacity: 0.45,
      }}>
        <span style={{ fontSize: '26px', filter: 'grayscale(1)' }}>🔒</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#636e8a' }}>
            Recette verrouillée
          </div>
          <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px' }}>
            Cuisine ce plat pour la débloquer
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: '#161b22',
        border: '1px solid rgba(255,213,0,0.12)',
        borderRadius: '12px', padding: '14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '28px', flexShrink: 0 }}>{recipe.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Nom fantastique */}
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
            {recipe.name}
          </div>
          {/* Nom réel */}
          {real && (
            <div style={{ fontSize: '12px', color: '#636e8a', marginTop: '1px' }}>
              → {real.name}
            </div>
          )}
          {/* Tags */}
          {real && (
            <div style={{ display: 'flex', gap: '5px', marginTop: '7px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '10px', borderRadius: '20px', padding: '1px 8px',
                background: 'rgba(255,213,0,0.1)', border: '1px solid rgba(255,213,0,0.2)',
                color: '#ffd500',
              }}>
                {CATEGORY_LABELS[real.category]}
              </span>
              <span style={{
                fontSize: '10px', borderRadius: '20px', padding: '1px 8px',
                background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.15)',
                color: '#00d2ff',
              }}>
                {CUISINE_LABELS[real.cuisine]}
              </span>
              <span style={{ fontSize: '10px', color: '#636e8a' }}>
                ⏱ {real.prepTimeMin + real.cookTimeMin}min
              </span>
              <span style={{ fontSize: '10px', color: '#636e8a' }}>
                {DIFFICULTY_LABELS[real.difficulty]}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
```

---

### `src/components/cookbook/RecipeBookDetail.tsx`

Bottom sheet avec la vraie recette complète.

```tsx
import type { RealRecipe } from '../../types/recipe'
import { CATEGORY_LABELS, CUISINE_LABELS, DIFFICULTY_LABELS } from '../../types/recipe'

interface CookRecipeWithReal {
  id: string
  name: string
  emoji: string
  realRecipe?: RealRecipe
}

interface RecipeBookDetailProps {
  recipe: CookRecipeWithReal
  onClose: () => void
}

export function RecipeBookDetail({ recipe, onClose }: RecipeBookDetailProps) {
  const real = recipe.realRecipe

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px', width: '100%',
          maxHeight: '88vh', overflowY: 'auto',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{
          width: '40px', height: '4px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '2px', margin: '0 auto 16px',
        }} />

        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '36px' }}>{recipe.emoji}</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>
                {real?.name ?? recipe.name}
              </div>
              <div style={{ fontSize: '12px', color: '#636e8a' }}>
                Version fantastique : {recipe.name}
              </div>
            </div>
          </div>

          {real && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px', borderRadius: '20px', padding: '2px 10px',
                background: 'rgba(255,213,0,0.1)', border: '1px solid rgba(255,213,0,0.2)',
                color: '#ffd500',
              }}>
                {CATEGORY_LABELS[real.category]}
              </span>
              <span style={{
                fontSize: '11px', borderRadius: '20px', padding: '2px 10px',
                background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.15)',
                color: '#00d2ff',
              }}>
                {CUISINE_LABELS[real.cuisine]}
              </span>
              <span style={{ fontSize: '11px', color: '#636e8a' }}>
                {DIFFICULTY_LABELS[real.difficulty]}
              </span>
              <span style={{ fontSize: '11px', color: '#636e8a' }}>
                👥 {real.servings} pers.
              </span>
              <span style={{ fontSize: '11px', color: '#636e8a' }}>
                ⏱ Prép. {real.prepTimeMin}min · Cuisson {real.cookTimeMin}min
              </span>
            </div>
          )}
        </div>

        {real ? (
          <>
            {/* Ingrédients */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffd500', marginBottom: '8px' }}>
                🛒 Ingrédients
              </div>
              <div style={{ background: '#0d1117', borderRadius: '10px', padding: '12px' }}>
                {real.ingredients.map((ing, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '13px', color: '#e2e8f0',
                      padding: '5px 0', display: 'flex', gap: '8px',
                      borderBottom: i < real.ingredients.length - 1
                        ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <span style={{ color: '#636e8a', fontSize: '11px', minWidth: '18px', paddingTop: '2px' }}>
                      {i + 1}.
                    </span>
                    <span>{ing}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Étapes */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffd500', marginBottom: '8px' }}>
                👨‍🍳 Préparation
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {real.steps.map((step, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#0d1117', borderRadius: '8px',
                      padding: '10px 12px', display: 'flex', gap: '10px',
                    }}
                  >
                    <div style={{
                      minWidth: '22px', height: '22px', borderRadius: '50%',
                      background: 'rgba(255,213,0,0.15)',
                      border: '1px solid rgba(255,213,0,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: '#ffd500',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5 }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conseil du chef */}
            {real.tip && (
              <div style={{
                background: 'rgba(255,213,0,0.06)',
                border: '1px solid rgba(255,213,0,0.2)',
                borderRadius: '10px', padding: '12px 14px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffd500', marginBottom: '4px' }}>
                  💡 Conseil du chef
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e', lineHeight: 1.5 }}>
                  {real.tip}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#636e8a', fontSize: '13px' }}>
            La vraie recette sera ajoutée prochainement.
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### `src/pages/CookbookPage.tsx`

Page principale du cahier.

```tsx
import { useState, useMemo } from 'react'
import { useGameDataStore } from '../stores/useGameDataStore'
import { RecipeBookCard } from '../components/cookbook/RecipeBookCard'
import { RecipeBookDetail } from '../components/cookbook/RecipeBookDetail'
import type { RecipeCategory, RecipeCuisine } from '../types/recipe'
import { CATEGORY_LABELS, CUISINE_LABELS } from '../types/recipe'

type FilterCategory = RecipeCategory | 'all'
type FilterCuisine = RecipeCuisine | 'all'

export function CookbookPage() {
  const cookRecipes = useGameDataStore((s) => s.cookRecipes) as any[]
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null)
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all')
  const [filterCuisine, setFilterCuisine] = useState<FilterCuisine>('all')
  const [search, setSearch] = useState('')

  const unlockedCount = cookRecipes.filter((r) => r.unlocked).length

  const filtered = useMemo(() => {
    return cookRecipes.filter((r) => {
      const real = r.realRecipe
      if (filterCategory !== 'all' && real?.category !== filterCategory) return false
      if (filterCuisine !== 'all' && real?.cuisine !== filterCuisine) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!r.name.toLowerCase().includes(q) && !real?.name?.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [cookRecipes, filterCategory, filterCuisine, search])

  const filterBtnStyle = (active: boolean, color: string) => ({
    flexShrink: 0 as const, padding: '4px 12px', borderRadius: '20px',
    cursor: 'pointer' as const,
    background: active ? `rgba(${color}, 0.12)` : '#161b22',
    border: `1px solid ${active ? `rgba(${color}, 0.4)` : 'rgba(255,255,255,0.08)'}`,
    fontSize: '11px', fontWeight: active ? 600 : 400,
    color: active ? `rgb(${color})` : '#636e8a',
  })

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          📖 Cahier de Recettes
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          {unlockedCount} recette{unlockedCount > 1 ? 's' : ''} débloquée{unlockedCount > 1 ? 's' : ''} sur {cookRecipes.length}
        </p>
      </div>

      {/* Barre de recherche */}
      <input
        type="text"
        placeholder="🔍 Rechercher (nom fantastique ou réel)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%', background: '#161b22',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '9px 12px',
          fontSize: '13px', color: '#e2e8f0',
          outline: 'none', boxSizing: 'border-box', marginBottom: '10px',
        }}
      />

      {/* Filtres catégorie */}
      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', marginBottom: '7px', paddingBottom: '2px', scrollbarWidth: 'none' }}>
        {(['all', 'entree', 'plat', 'dessert', 'aperitif', 'cocktail'] as FilterCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            style={filterBtnStyle(filterCategory === cat, '255, 213, 0')}
          >
            {cat === 'all' ? '📋 Tout' : CATEGORY_LABELS[cat as RecipeCategory]}
          </button>
        ))}
      </div>

      {/* Filtres cuisine */}
      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '2px', scrollbarWidth: 'none' }}>
        {(['all', 'center', 'north', 'east', 'west', 'south'] as FilterCuisine[]).map((cui) => (
          <button
            key={cui}
            onClick={() => setFilterCuisine(cui)}
            style={filterBtnStyle(filterCuisine === cui, '0, 210, 255')}
          >
            {cui === 'all' ? '🌍 Toutes' : CUISINE_LABELS[cui as RecipeCuisine]}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📖</div>
          <div>Aucune recette trouvée</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((recipe) => (
            <RecipeBookCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => recipe.unlocked && setSelectedRecipe(recipe)}
            />
          ))}
        </div>
      )}

      {/* Bottom sheet détail */}
      {selectedRecipe && (
        <RecipeBookDetail
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  )
}
```

---

### Mise à jour `src/pages/ProfilePage.tsx`

Ajouter un bouton "📖 Cahier de Recettes" et la navigation vers `CookbookPage`.

```tsx
import { useState } from 'react'
import { CookbookPage } from './CookbookPage'

// Ajouter un state dans ProfilePage :
const [showCookbook, setShowCookbook] = useState(false)

// Si showCookbook → afficher CookbookPage avec un bouton retour :
if (showCookbook) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowCookbook(false)}
        style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: '#0d1117', border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          width: '100%', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          cursor: 'pointer', color: '#00d2ff', fontSize: '14px',
        }}
      >
        ← Retour au Profil
      </button>
      <CookbookPage />
    </div>
  )
}

// Ajouter ce bouton dans le contenu de ProfilePage,
// juste avant la section Classes :
<button
  onClick={() => setShowCookbook(true)}
  style={{
    width: '100%', marginBottom: '20px',
    padding: '13px', background: 'rgba(255,213,0,0.08)',
    border: '1px solid rgba(255,213,0,0.2)',
    borderRadius: '12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }}
>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <span style={{ fontSize: '22px' }}>📖</span>
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffd500' }}>
        Cahier de Recettes
      </div>
      <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '1px' }}>
        Tes vraies recettes à cuisiner chez toi
      </div>
    </div>
  </div>
  <span style={{ fontSize: '16px', color: '#636e8a' }}>→</span>
</button>
```

---

## Critères de succès
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] Les 3 recettes MVP ont leur `realRecipe` dans `cook-recipes.json`
- [ ] Bouton "📖 Cahier de Recettes" visible dans la page Profil
- [ ] Clic sur le bouton → page Cahier, bouton "← Retour" fonctionne
- [ ] Les recettes débloquées affichent leur card avec nom fantastique + réel + tags
- [ ] Les recettes verrouillées affichent juste un cadenas sans info
- [ ] Tap sur une recette débloquée → bottom sheet avec ingrédients + étapes + conseil
- [ ] Filtre "Plat" → affiche uniquement les plats
- [ ] Filtre "Asiatique" → affiche uniquement les recettes de cuisine asiatique
- [ ] Recherche "champignon" → trouve la Soupe aux Champignons (nom fantastique)
- [ ] Recherche "panna" → trouve la Gelée de Slime (nom réel)
- [ ] Compteur "X recettes débloquées sur Y" correct

## Notes pour la suite
- Les nouvelles recettes cook ajoutées via l'admin panel devront inclure
  le champ `realRecipe` — à ajouter dans le formulaire admin (prompt 013 à enrichir)
- En Phase 4, le Cahier pourra avoir un bouton "Partager cette recette"
  qui génère un lien vers une version publique de la recette
- Les filtres cuisine correspondent aux zones culturelles de la carte —
  cohérence narrative entre l'exploration et les recettes débloquées
