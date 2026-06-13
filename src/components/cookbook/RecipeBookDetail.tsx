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
