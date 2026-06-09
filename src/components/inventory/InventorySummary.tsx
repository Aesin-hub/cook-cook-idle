import { useMemo } from 'react'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { RESOURCES, REGIONS } from '../../data'

export function InventorySummary() {
  const resources = useInventoryStore((state) => state.resources)
  const camp = useHarvestStore((state) => state.camp)

  const totalTypes = useMemo(
    () => Object.values(resources).filter((v) => v >= 1).length,
    [resources]
  )

  const totalItems = useMemo(
    () => Math.floor(Object.values(resources).reduce((sum, v) => sum + v, 0)),
    [resources]
  )

  const campRegion = useMemo(
    () => camp ? REGIONS.find((r) => r.id === camp.regionId) : null,
    [camp]
  )

  const campYieldTotal = useMemo(() => {
    if (!camp) return 0
    return RESOURCES
      .filter((r) => r.region === camp.regionId)
      .reduce((sum, r) => sum + r.baseYieldPerMin, 0)
  }, [camp])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          background: '#161b22',
          borderRadius: '10px',
          padding: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ fontSize: '11px', color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Total ressources
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffd500' }}>
          {totalItems.toLocaleString()}
        </div>
        <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
          {totalTypes} type{totalTypes > 1 ? 's' : ''} différent{totalTypes > 1 ? 's' : ''}
        </div>
      </div>

      <div
        style={{
          background: '#161b22',
          borderRadius: '10px',
          padding: '12px',
          border: `1px solid ${camp ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
        }}
      >
        <div style={{ fontSize: '11px', color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Production
        </div>
        {camp && campRegion ? (
          <>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#00d2ff' }}>
              +{campYieldTotal}/min
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
              {campRegion.emoji} {campRegion.name}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#4a5568' }}>
              0/min
            </div>
            <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px' }}>
              Aucun camp actif
            </div>
          </>
        )}
      </div>
    </div>
  )
}
