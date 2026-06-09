import { useEffect, useState } from 'react'
import { useCraftStore } from '../../stores/useCraftStore'
import { useToast } from '../shared/ToastManager'
import { ProgressBar } from '../shared/ProgressBar'
import { CRAFT_RECIPES } from '../../data'
import { getRemainingSeconds, formatCraftTime } from '../../lib/craftHelpers'

export function CraftQueueBar() {
  const queue = useCraftStore((state) => state.queue)
  const getProgress = useCraftStore((state) => state.getProgress)
  const cancelCraft = useCraftStore((state) => state.cancelCraft)
  const addToast = useToast()

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
  const queueSize = queue.length - 1

  function handleCancel() {
    cancelCraft(currentJob.id)
    addToast('Craft annulé. Ingrédients remboursés.', 'info')
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '64px',
        left: 0,
        right: 0,
        background: '#161b22',
        borderTop: '1px solid rgba(191,90,242,0.2)',
        padding: '10px 16px',
        zIndex: 90,
      }}
    >
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
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#bf5af2' }}>
              {formatCraftTime(remaining)}
            </div>
            <div style={{ fontSize: '10px', color: '#636e8a' }}>restant</div>
          </div>
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

      <ProgressBar value={progress} color="#bf5af2" height={5} showGlow />
    </div>
  )
}
