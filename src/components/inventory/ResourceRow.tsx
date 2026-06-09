import { useHarvestStore } from '../../stores/useHarvestStore'
import { Tooltip } from '../shared/Tooltip'
import type { Resource } from '../../types/game'

interface ResourceRowProps {
  resourceId: string
  amount: number
  resource: Resource | null
}

export const RARITY_ORDER: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3,
}

const RARITY_COLOR: Record<string, string> = {
  common:   '#636e8a',
  uncommon: '#30d158',
  rare:     '#00d2ff',
  epic:     '#bf5af2',
}

function formatId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ResourceRow({ resourceId, amount, resource }: ResourceRowProps) {
  const camp = useHarvestStore((state) => state.camp)

  const isProducing = camp && resource && camp.regionId === resource.region
  const yieldPerMin = isProducing ? resource.baseYieldPerMin : null

  const isEmpty = amount < 1

  const displayName   = resource?.name       ?? formatId(resourceId)
  const displayEmoji  = resource?.emoji      ?? '📦'
  const displayRarity = resource?.rarityLabel ?? 'Crafté'
  const rarityKey     = resource?.rarity     ?? 'crafted'
  const tooltip       = resource?.tooltip    ?? `Ressource craftée : ${displayName}`
  const rarityColor   = RARITY_COLOR[rarityKey] ?? '#bf5af2'

  return (
    <Tooltip content={tooltip}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: '#161b22',
          borderRadius: '10px',
          opacity: isEmpty ? 0.45 : 1,
          transition: 'opacity 0.2s',
          cursor: 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px', minWidth: '28px', textAlign: 'center' }}>
            {displayEmoji}
          </span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: isEmpty ? '#4a5568' : '#e2e8f0' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '11px', color: rarityColor, marginTop: '1px' }}>
              {displayRarity}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: isEmpty ? '#4a5568' : '#ffd500',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.floor(amount).toLocaleString()}
          </div>
          {yieldPerMin && (
            <div style={{ fontSize: '11px', color: '#30d158', marginTop: '1px' }}>
              +{yieldPerMin}/min
            </div>
          )}
          {!yieldPerMin && resource && (
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '1px' }}>
              {resource.baseYieldPerMin}/min max
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  )
}
