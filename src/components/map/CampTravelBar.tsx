import { useEffect, useState } from 'react'
import { useMapStore } from '../../stores/useMapStore'
import { ProgressBar } from '../shared/ProgressBar'

export function CampTravelBar() {
  const campTravel = useMapStore((s) => s.campTravel)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!campTravel?.isInTransit) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [campTravel?.isInTransit])

  if (!campTravel?.isInTransit) return null

  const now = Date.now()
  const total = campTravel.arrivesAt - campTravel.startedAt
  const elapsed = now - campTravel.startedAt
  const progress = Math.min(elapsed / total, 1)
  const remainingMs = Math.max(0, campTravel.arrivesAt - now)
  const label = remainingMs > 60000
    ? `${Math.ceil(remainingMs / 60000)}min`
    : `${Math.ceil(remainingMs / 1000)}s`

  return (
    <div style={{
      position: 'fixed', bottom: '64px', left: 0, right: 0, zIndex: 90,
      background: '#161b22',
      borderTop: '1px solid rgba(0,210,255,0.2)',
      padding: '10px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
          🏕️ Camp en route → ({campTravel.toCoord.x}, {campTravel.toCoord.y})
        </span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#00d2ff' }}>
          {label}
        </span>
      </div>
      <ProgressBar value={progress} color="#00d2ff" height={4} showGlow />
      <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '4px' }}>
        ⚠️ Le camp ne produit pas pendant le trajet
      </div>
    </div>
  )
}
