import { useEffect, useState } from 'react'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { useGameDataStore } from '../../stores/useGameDataStore'

interface BossIndicatorProps {
  onBossClick: (x: number, y: number) => void
}

export function BossIndicator({ onBossClick }: BossIndicatorProps) {
  const getActiveBosses = useBestiaryStore((s) => s.getActiveBosses)
  const creatures = useGameDataStore((s) => s.creatures)
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const bosses = getActiveBosses()
  if (bosses.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: '6px', padding: '8px 16px',
      background: 'rgba(255,68,58,0.06)',
      borderBottom: '1px solid rgba(255,68,58,0.15)',
      overflowX: 'auto',
    }}>
      {bosses.map((boss) => {
        const creature = creatures.find((c) => c.id === boss.creatureId)
        const remainingMs = boss.expiresAt - Date.now()
        const remainingH = Math.floor(remainingMs / 3600000)
        const remainingM = Math.floor((remainingMs % 3600000) / 60000)
        const timeLabel = remainingH > 0 ? `${remainingH}h${remainingM}m` : `${remainingM}m`

        return (
          <button
            key={boss.id}
            onClick={() => onBossClick(boss.tileX, boss.tileY)}
            style={{
              flexShrink: 0,
              background: 'rgba(255,68,58,0.1)',
              border: '1px solid rgba(255,68,58,0.3)',
              borderRadius: '20px', padding: '4px 12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <span style={{ fontSize: '14px' }}>{creature?.emoji ?? '💀'}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#ff453a' }}>
              {creature?.name ?? boss.creatureId}
            </span>
            <span style={{ fontSize: '10px', color: '#636e8a' }}>
              ({boss.tileX},{boss.tileY}) · {timeLabel}
            </span>
          </button>
        )
      })}
    </div>
  )
}
