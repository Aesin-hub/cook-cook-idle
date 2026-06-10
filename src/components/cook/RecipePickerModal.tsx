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
