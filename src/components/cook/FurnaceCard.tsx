import { useState } from 'react'
import { useCookStore } from '../../stores/useCookStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { useToast } from '../shared/ToastManager'
import { Tooltip } from '../shared/Tooltip'
import { ProgressBar } from '../shared/ProgressBar'
import { ProductionStats } from './ProductionStats'
import { RecipePickerModal } from './RecipePickerModal'
import { MachinePickerModal } from './MachinePickerModal'
import { COOK_RECIPES, MACHINES, RESOURCES } from '../../data'
import type { Furnace } from '../../types/cook'

interface FurnaceCardProps {
  furnace: Furnace
  isLocked: boolean
  nextUnlockXp?: number
}

export function FurnaceCard({ furnace, isLocked, nextUnlockXp }: FurnaceCardProps) {
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [showMachinePicker, setShowMachinePicker] = useState(false)
  const [showStats, setShowStats] = useState(false)

  const assignRecipe = useCookStore((state) => state.assignRecipe)
  const assignMachine = useCookStore((state) => state.assignMachine)
  const togglePause = useCookStore((state) => state.togglePause)
  const resources = useInventoryStore((state) => state.resources)
  const addToast = useToast()

  const recipe = furnace.recipeId ? COOK_RECIPES.find((r) => r.id === furnace.recipeId) : null
  const machine = furnace.machineId ? MACHINES.find((m) => m.id === furnace.machineId) : null

  const isProducing = furnace.active && furnace.pausedReason === null && !!recipe
  const isPausedByPlayer = furnace.pausedReason === 'paused_by_player'
  const isNoStock = furnace.pausedReason === 'no_stock'
  const isNoRecipe = !recipe

  const borderColor = isLocked ? 'rgba(255,255,255,0.04)'
    : isProducing ? 'rgba(255,149,0,0.3)'
    : isNoStock   ? 'rgba(255,68,58,0.3)'
    : isPausedByPlayer ? 'rgba(99,110,138,0.3)'
    : 'rgba(255,255,255,0.06)'

  const bgColor = isProducing ? 'rgba(255,149,0,0.04)' : '#161b22'

  const missingResource = isNoStock && recipe
    ? (() => {
        for (const step of recipe.productionLine) {
          if ((resources[step.resourceId] ?? 0) < 0.1) {
            const res = RESOURCES.find((r) => r.id === step.resourceId)
            return res ? `${res.emoji} ${res.name}` : step.resourceId
          }
        }
        return null
      })()
    : null

  if (isLocked) {
    return (
      <div style={{
        background: '#161b22', border: '1px dashed rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '16px', opacity: 0.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px', filter: 'grayscale(1)' }}>🍳</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#636e8a' }}>
              Fourneau {furnace.slotIndex + 1}
            </div>
            <div style={{ fontSize: '11px', color: '#4a5568' }}>
              🔒 Débloqué à {nextUnlockXp?.toLocaleString()} XP
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px', padding: '14px',
        transition: 'border-color 0.3s ease, background 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🍳</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#636e8a' }}>
              Fourneau {furnace.slotIndex + 1}
            </span>

            {isProducing && (
              <div style={{
                background: 'rgba(255,149,0,0.12)',
                border: '1px solid rgba(255,149,0,0.3)',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '10px', fontWeight: 600, color: '#ff9500',
                animation: 'pulse-ring 2s infinite',
              }}>
                🔥 En production
              </div>
            )}
            {isPausedByPlayer && (
              <div style={{
                background: 'rgba(99,110,138,0.12)',
                border: '1px solid rgba(99,110,138,0.3)',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '10px', color: '#636e8a',
              }}>
                ⏸ En pause
              </div>
            )}
            {isNoStock && (
              <div style={{
                background: 'rgba(255,68,58,0.12)',
                border: '1px solid rgba(255,68,58,0.3)',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '10px', fontWeight: 600, color: '#ff453a',
              }}>
                ⚠️ Stock vide
              </div>
            )}
          </div>

          {recipe && (
            <button
              onClick={() => togglePause(furnace.id)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px', padding: '4px 8px',
                fontSize: '11px', color: '#636e8a', cursor: 'pointer',
              }}
            >
              {furnace.active ? '⏸ Pause' : '▶ Reprendre'}
            </button>
          )}
        </div>

        {isNoRecipe ? (
          <button
            onClick={() => setShowRecipePicker(true)}
            style={{
              width: '100%', background: 'rgba(255,149,0,0.06)',
              border: '1px dashed rgba(255,149,0,0.3)',
              borderRadius: '10px', padding: '14px',
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>🍽️</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ff9500' }}>Choisir une recette</div>
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
              Tap pour sélectionner une recette de cuisine
            </div>
          </button>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: '8px',
            }}>
              <Tooltip content={recipe.tooltip}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                  <span style={{ fontSize: '22px' }}>{recipe.emoji}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
                      {recipe.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#636e8a' }}>
                      +{recipe.xpReward} XP/batch
                    </div>
                  </div>
                </div>
              </Tooltip>
              <button
                onClick={() => setShowRecipePicker(true)}
                style={{
                  background: 'transparent', border: 'none',
                  fontSize: '11px', color: '#636e8a',
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Changer
              </button>
            </div>

            <ProgressBar
              value={isProducing ? 1 : 0}
              color={isNoStock ? '#ff453a' : '#ff9500'}
              height={5}
              animated={isProducing}
              showGlow={isProducing}
            />

            {isNoStock && missingResource && (
              <div style={{
                marginTop: '6px', fontSize: '11px', color: '#ff453a',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                ⚠️ Stock épuisé : {missingResource}
              </div>
            )}

            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {machine ? (
                <Tooltip content={machine.tooltip}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    <span style={{ fontSize: '16px' }}>{machine.emoji}</span>
                    <span style={{ fontSize: '12px', color: '#bf5af2' }}>{machine.name}</span>
                  </div>
                </Tooltip>
              ) : (
                <span style={{ fontSize: '12px', color: '#4a5568' }}>— Sans machine</span>
              )}
              <button
                onClick={() => setShowMachinePicker(true)}
                style={{
                  background: 'rgba(191,90,242,0.08)',
                  border: '1px solid rgba(191,90,242,0.2)',
                  borderRadius: '6px', padding: '4px 10px',
                  fontSize: '11px', color: '#bf5af2', cursor: 'pointer',
                }}
              >
                {machine ? '🔧 Changer' : '+ Machine'}
              </button>
            </div>

            <button
              onClick={() => setShowStats((v) => !v)}
              style={{
                marginTop: '8px', background: 'transparent', border: 'none',
                fontSize: '11px', color: '#636e8a', cursor: 'pointer',
                textDecoration: 'underline', padding: 0,
              }}
            >
              {showStats ? '▲ Masquer les stats' : '▼ Voir les stats de production'}
            </button>

            {showStats && <ProductionStats furnace={furnace} />}
          </>
        )}
      </div>

      {showRecipePicker && (
        <RecipePickerModal
          currentRecipeId={furnace.recipeId}
          onSelect={(id) => {
            assignRecipe(furnace.id, id)
            addToast(`🍳 Recette assignée au fourneau ${furnace.slotIndex + 1} !`, 'success')
          }}
          onClose={() => setShowRecipePicker(false)}
        />
      )}
      {showMachinePicker && (
        <MachinePickerModal
          currentMachineId={furnace.machineId}
          recipeId={furnace.recipeId}
          onSelect={(id) => {
            assignMachine(furnace.id, id)
            addToast(id ? '🔧 Machine assignée !' : 'Machine retirée.', 'info')
          }}
          onClose={() => setShowMachinePicker(false)}
        />
      )}
    </>
  )
}
