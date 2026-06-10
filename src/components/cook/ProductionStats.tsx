import { useMemo } from 'react'
import { COOK_RECIPES, RESOURCES, MACHINES } from '../../data'
import {
  getSpeedMultiplier,
  getEfficiencyRate,
  formatProductionRate,
} from '../../lib/cookHelpers'
import type { Furnace } from '../../types/cook'

interface ProductionStatsProps {
  furnace: Furnace
}

export function ProductionStats({ furnace }: ProductionStatsProps) {
  const recipe = COOK_RECIPES.find((r) => r.id === furnace.recipeId)
  const machine = furnace.machineId ? MACHINES.find((m) => m.id === furnace.machineId) : null

  if (!recipe) return null

  const speedMultiplier = getSpeedMultiplier(furnace)
  const efficiencyRate = getEfficiencyRate(furnace)
  const productionRate = formatProductionRate(recipe.outputPerBatch, recipe.cookTimeSeconds, speedMultiplier)

  const consumptionDisplay = useMemo(() => {
    return recipe.productionLine.map((step) => {
      const resource = RESOURCES.find((r) => r.id === step.resourceId)
      const basePerMin = step.perMin * speedMultiplier * (1 - efficiencyRate)
      return {
        resourceId: step.resourceId,
        name: resource?.name ?? step.resourceId,
        emoji: resource?.emoji ?? '📦',
        perMin: basePerMin,
      }
    })
  }, [recipe, speedMultiplier, efficiencyRate])

  return (
    <div style={{
      background: '#0d1117',
      borderRadius: '8px',
      padding: '10px 12px',
      marginTop: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: '#636e8a' }}>Production</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ff9500' }}>
          {recipe.emoji} {productionRate}
        </span>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {consumptionDisplay.map((c) => (
          <div key={c.resourceId} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#636e8a' }}>{c.emoji} {c.name}</span>
            <span style={{ fontSize: '11px', color: '#8b949e' }}>-{c.perMin.toFixed(1)}/min</span>
          </div>
        ))}
      </div>

      {machine && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: '6px', paddingTop: '6px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '13px' }}>{machine.emoji}</span>
          <span style={{ fontSize: '11px', color: '#bf5af2' }}>
            {machine.name}
            {speedMultiplier > 1 && ` · ×${speedMultiplier} vitesse`}
            {efficiencyRate > 0 && ` · -${Math.round(efficiencyRate * 100)}% consommation`}
          </span>
        </div>
      )}
    </div>
  )
}
