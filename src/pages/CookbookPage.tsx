import { useState, useMemo } from 'react'
import { useGameDataStore } from '../stores/useGameDataStore'
import { RecipeBookCard } from '../components/cookbook/RecipeBookCard'
import { RecipeBookDetail } from '../components/cookbook/RecipeBookDetail'
import type { RecipeCategory, RecipeCuisine } from '../types/recipe'
import { CATEGORY_LABELS, CUISINE_LABELS } from '../types/recipe'
import type { CookRecipeWithReal } from '../components/cookbook/RecipeBookCard'

type FilterCategory = RecipeCategory | 'all'
type FilterCuisine = RecipeCuisine | 'all'

export function CookbookPage() {
  const cookRecipes = useGameDataStore((s) => s.cookRecipes) as unknown as CookRecipeWithReal[]
  const [selectedRecipe, setSelectedRecipe] = useState<CookRecipeWithReal | null>(null)
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

  const filterBtn = (active: boolean, colorRgb: string): React.CSSProperties => ({
    flexShrink: 0, padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
    background: active ? `rgba(${colorRgb}, 0.12)` : '#161b22',
    border: `1px solid ${active ? `rgba(${colorRgb}, 0.4)` : 'rgba(255,255,255,0.08)'}`,
    fontSize: '11px', fontWeight: active ? 600 : 400,
    color: active ? `rgb(${colorRgb})` : '#636e8a',
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

      {/* Recherche */}
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
          <button key={cat} onClick={() => setFilterCategory(cat)} style={filterBtn(filterCategory === cat, '255, 213, 0')}>
            {cat === 'all' ? '📋 Tout' : CATEGORY_LABELS[cat as RecipeCategory]}
          </button>
        ))}
      </div>

      {/* Filtres cuisine */}
      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '2px', scrollbarWidth: 'none' }}>
        {(['all', 'center', 'north', 'east', 'west', 'south'] as FilterCuisine[]).map((cui) => (
          <button key={cui} onClick={() => setFilterCuisine(cui)} style={filterBtn(filterCuisine === cui, '0, 210, 255')}>
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
