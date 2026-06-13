import { useState, useMemo } from 'react'
import { useCraftStore } from '../stores/useCraftStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { CRAFT_RECIPES } from '../data'
import { RecipeCard } from '../components/craft/RecipeCard'
import { CraftQueueBar } from '../components/craft/CraftQueueBar'
import { XpBadge } from '../components/craft/XpBadge'
import { AutoCraftPanel } from '../components/craft/AutoCraftPanel'
import { canAffordRecipe } from '../lib/craftHelpers'

type CraftTab = 'manual' | 'auto'

export function CraftPage() {
  const [activeTab, setActiveTab] = useState<CraftTab>('manual')
  const resources = useInventoryStore((state) => state.resources)
  const queue = useCraftStore((state) => state.queue)

  const sortedRecipes = useMemo(() => {
    return [...CRAFT_RECIPES].sort((a, b) => {
      const aAfford = canAffordRecipe(a.id, resources)
      const bAfford = canAffordRecipe(b.id, resources)
      if (aAfford && !bAfford) return -1
      if (!aAfford && bAfford) return 1
      return a.name.localeCompare(b.name)
    })
  }, [resources])

  const hasActiveQueue = queue.length > 0

  return (
    <div
      style={{
        padding: '16px',
        maxWidth: '480px',
        margin: '0 auto',
        paddingBottom: hasActiveQueue ? '148px' : '80px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>⚗️ Craft</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
            Transforme tes ressources en matériaux.
          </p>
        </div>
        <XpBadge />
      </div>

      {/* Tabs Manuel / Auto */}
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

      {activeTab === 'manual' ? (
        <>
          {hasActiveQueue && (
            <div style={{
              background: 'rgba(191,90,242,0.08)',
              border: '1px solid rgba(191,90,242,0.2)',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '13px', color: '#bf5af2', fontWeight: 500 }}>
                ⚗️ {queue.length} craft{queue.length > 1 ? 's' : ''} en cours / en attente
              </span>
              <span style={{ fontSize: '11px', color: '#636e8a' }}>Voir en bas ↓</span>
            </div>
          )}

          {sortedRecipes.some((r) => canAffordRecipe(r.id, resources)) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#30d158', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                ✅ Disponibles
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sortedRecipes
                  .filter((r) => canAffordRecipe(r.id, resources))
                  .map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
              </div>
            </div>
          )}

          {sortedRecipes.some((r) => !canAffordRecipe(r.id, resources)) && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                🔒 Stock insuffisant
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sortedRecipes
                  .filter((r) => !canAffordRecipe(r.id, resources))
                  .map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        <AutoCraftPanel />
      )}

      <CraftQueueBar />
    </div>
  )
}
