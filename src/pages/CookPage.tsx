import { useMemo } from 'react'
import { useCookStore } from '../stores/useCookStore'
import { FURNACE_LEVELS } from '../data'
import { getNextFurnaceUnlock } from '../lib/cookHelpers'
import { FurnaceCard } from '../components/cook/FurnaceCard'
import { XpFurnaceBar } from '../components/cook/XpFurnaceBar'
import type { Furnace } from '../types/cook'

export function CookPage() {
  const furnaces = useCookStore((state) => state.furnaces)
  const unlockedFurnaceCount = useCookStore((state) => state.unlockedFurnaceCount)
  const getTotalXp = useCookStore((state) => state.getTotalXp)

  const totalXp = getTotalXp()
  const nextUnlock = getNextFurnaceUnlock(totalXp)
  const maxFurnaces = FURNACE_LEVELS[FURNACE_LEVELS.length - 1].furnaceCount

  const displayFurnaces = useMemo(() => {
    const slots = [...furnaces].sort((a, b) => a.slotIndex - b.slotIndex)
    if (unlockedFurnaceCount < maxFurnaces) {
      slots.push({
        id: 'locked-preview',
        slotIndex: unlockedFurnaceCount,
        recipeId: null,
        machineId: null,
        active: false,
        lastTickAt: 0,
        pausedReason: 'no_recipe' as const,
        totalProduced: 0,
      } as Furnace)
    }
    return slots
  }, [furnaces, unlockedFurnaceCount, maxFurnaces])

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '80px' }}>

      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          🍳 Cook
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Assigne des recettes à tes fourneaux. Ajoute des machines pour booster la production.
        </p>
      </div>

      <XpFurnaceBar />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayFurnaces.map((furnace) => (
          <FurnaceCard
            key={furnace.id}
            furnace={furnace}
            isLocked={furnace.slotIndex >= unlockedFurnaceCount}
            nextUnlockXp={nextUnlock?.requiredXp}
          />
        ))}
      </div>
    </div>
  )
}
