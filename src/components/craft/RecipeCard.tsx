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

  const queuePosition = queue.findIndex((j) => j.recipeId === recipe.id)
  const isCurrentJob = queuePosition === 0
  const isQueued = queuePosition > 0

  const outputResource = RESOURCES.find((r) => r.id === recipe.output.resourceId)

  function handleCraft() {
    const result = enqueueCraft(recipe.id, qty)
    if (result.success) {
      const label = qty > 1 ? ` ×${qty}` : ''
      addToast(`⚗️ ${recipe.emoji} ${recipe.name}${label} ajouté à la file !`, 'info')
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          {isFirstTime && (
            <div style={{ background: 'rgba(255,213,0,0.12)', border: '1px solid rgba(255,213,0,0.3)', borderRadius: '20px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, color: '#ffd500' }}>
              ✨ 3s première fois
            </div>
          )}
          {isCurrentJob && (
            <div style={{ background: 'rgba(191,90,242,0.12)', border: '1px solid rgba(191,90,242,0.3)', borderRadius: '20px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, color: '#bf5af2', animation: 'pulse-ring 2s infinite' }}>
              ⚗️ En cours...
            </div>
          )}
          {isQueued && (
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '2px 8px', fontSize: '10px', color: '#636e8a' }}>
              #{queuePosition} en attente
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#0d1117', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Ingrédients
        </div>
        {recipe.inputs.map((input) => (
          <IngredientRow key={input.resourceId} resourceId={input.resourceId} required={input.quantity} quantity={qty} />
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '6px', paddingTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#4a5568' }}>Produit</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#bf5af2' }}>
            {outputResource?.emoji ?? '📦'} {recipe.output.quantity * qty}× {outputResource?.name ?? recipe.output.resourceId}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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

      {missingReason && (
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#ff453a', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ⚠️ {missingReason}
        </div>
      )}
    </div>
  )
}
