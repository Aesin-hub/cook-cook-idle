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

  const dragIndex = useRef<number | null>(null)

  const unconfiguredRecipes = CRAFT_RECIPES.filter(
    (r) => !stockThresholds.find((t) => t.recipeId === r.id)
  )

  const activeFurnaces = furnaces.filter(
    (f) => f.slotIndex < unlockedFurnaceCount && f.recipeId
  )

  const sortedThresholds = [...stockThresholds].sort((a, b) => a.priority - b.priority)

  const inputStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '7px 10px',
    fontSize: '12px',
    color: '#e2e8f0',
    outline: 'none',
  }

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
            {autoEnabled ? 'Actif — craft selon tes seuils' : 'Inactif — tout est manuel'}
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

      {/* Seuils de stock */}
      <div>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#636e8a',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Seuils de stock</span>
          {sortedThresholds.length > 1 && (
            <span style={{ fontSize: '10px', color: '#4a5568' }}>↕ Glisse pour réordonner</span>
          )}
        </div>

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
                  <span style={{ fontSize: '14px', color: '#636e8a' }}>⠿</span>
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

                {/* Barre de progression stock */}
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
              style={{ ...inputStyle, flex: 1 }}
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
              style={{ ...inputStyle, width: '70px', textAlign: 'center' }}
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
          <div style={{ textAlign: 'center', padding: '20px', color: '#636e8a', fontSize: '12px' }}>
            Aucun seuil configuré. Ajoute une recette pour commencer.
          </div>
        )}
      </div>

      {/* Chaînes d'alimentation Cook */}
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
                  style={{ ...inputStyle, flex: 1 }}
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
                  style={{ ...inputStyle, flex: 1 }}
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
