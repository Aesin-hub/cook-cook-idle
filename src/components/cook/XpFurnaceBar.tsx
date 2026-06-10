import { useMemo } from 'react'
import { useCookStore } from '../../stores/useCookStore'
import { getNextFurnaceUnlock } from '../../lib/cookHelpers'
import { ProgressBar } from '../shared/ProgressBar'
import { FURNACE_LEVELS } from '../../data'

export function XpFurnaceBar() {
  const getTotalXp = useCookStore((state) => state.getTotalXp)
  const unlockedFurnaceCount = useCookStore((state) => state.unlockedFurnaceCount)
  const furnaces = useCookStore((state) => state.furnaces)

  const totalXp = getTotalXp()
  const nextUnlock = getNextFurnaceUnlock(totalXp)
  const maxFurnaces = FURNACE_LEVELS[FURNACE_LEVELS.length - 1].furnaceCount
  const isMaxed = unlockedFurnaceCount >= maxFurnaces

  const activeCount = furnaces.filter(
    (f) => f.slotIndex < unlockedFurnaceCount && f.active && f.recipeId && f.pausedReason === null
  ).length

  const prevRequired = useMemo(() => {
    const prev = [...FURNACE_LEVELS]
      .reverse()
      .find((l) => l.furnaceCount < unlockedFurnaceCount + 1 && l.requiredXp <= totalXp)
    return prev?.requiredXp ?? 0
  }, [totalXp, unlockedFurnaceCount])

  const progress = nextUnlock
    ? (totalXp - prevRequired) / (nextUnlock.requiredXp - prevRequired)
    : 1

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: '#0d1117',
      paddingBottom: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(255,213,0,0.1)',
            border: '1px solid rgba(255,213,0,0.25)',
            borderRadius: '20px', padding: '3px 10px',
            fontSize: '12px', fontWeight: 600, color: '#ffd500',
          }}>
            ⭐ {totalXp.toLocaleString()} XP
          </div>
          <div style={{
            background: 'rgba(255,149,0,0.1)',
            border: '1px solid rgba(255,149,0,0.25)',
            borderRadius: '20px', padding: '3px 10px',
            fontSize: '12px', color: '#ff9500',
          }}>
            🍳 {activeCount}/{unlockedFurnaceCount} actif{activeCount > 1 ? 's' : ''}
          </div>
        </div>

        {!isMaxed && nextUnlock && (
          <div style={{ fontSize: '11px', color: '#636e8a', textAlign: 'right' }}>
            Fourneau {unlockedFurnaceCount + 1} à {nextUnlock.requiredXp.toLocaleString()} XP
          </div>
        )}
        {isMaxed && (
          <div style={{ fontSize: '11px', color: '#30d158' }}>
            ✅ Maximum atteint
          </div>
        )}
      </div>

      {!isMaxed && (
        <ProgressBar
          value={Math.min(progress, 1)}
          color="#ff9500"
          height={5}
          showGlow
        />
      )}
    </div>
  )
}
