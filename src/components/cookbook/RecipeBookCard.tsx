import type { RealRecipe, RecipeCategory } from '../../types/recipe'
import { CATEGORY_LABELS, CUISINE_LABELS, DIFFICULTY_LABELS } from '../../types/recipe'

export interface CookRecipeWithReal {
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
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
            {recipe.name}
          </div>
          {real && (
            <div style={{ fontSize: '12px', color: '#636e8a', marginTop: '1px' }}>
              → {real.name}
            </div>
          )}
          {real && (
            <div style={{ display: 'flex', gap: '5px', marginTop: '7px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '10px', borderRadius: '20px', padding: '1px 8px',
                background: 'rgba(255,213,0,0.1)', border: '1px solid rgba(255,213,0,0.2)',
                color: '#ffd500',
              }}>
                {CATEGORY_LABELS[real.category as RecipeCategory]}
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
