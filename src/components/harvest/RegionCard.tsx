import type { Region } from '../../types/game'
import type { Camp } from '../../types/harvest'

interface RegionCardProps {
  region: Region
  camp: Camp | null
  onSelect: (regionId: Region['id']) => void
}

export function RegionCard({ region, camp, onSelect }: RegionCardProps) {
  const isActive = camp?.regionId === region.id
  const isLocked = !region.unlocked

  const borderColor = isActive ? '#00d2ff' : isLocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'
  const bgColor = isActive ? 'rgba(0,210,255,0.06)' : '#161b22'

  return (
    <button
      onClick={() => !isLocked && onSelect(region.id)}
      disabled={isLocked}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '14px',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s ease',
        animation: isActive ? 'pulse-ring 2s infinite' : 'none',
        opacity: isLocked ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '20px',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 600,
            color: '#00d2ff',
          }}
        >
          ⛺ Camp actif
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '24px' }}>{region.emoji}</span>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: isLocked ? '#636e8a' : '#e2e8f0' }}>
            {region.name}
          </div>
          <div style={{ fontSize: '12px', color: '#636e8a', marginTop: '2px' }}>
            {region.description}
          </div>
        </div>
      </div>

      {isLocked && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#636e8a',
          }}
        >
          🔒 {region.unlockCondition}
        </div>
      )}
    </button>
  )
}
