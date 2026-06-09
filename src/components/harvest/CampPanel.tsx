import { useMemo } from 'react'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { RESOURCES, REGIONS } from '../../data'
import { ProgressBar } from '../shared/ProgressBar'
import { Tooltip } from '../shared/Tooltip'

export function CampPanel() {
  const camp = useHarvestStore((state) => state.camp)
  const removeCamp = useHarvestStore((state) => state.removeCamp)
  const resources = useInventoryStore((state) => state.resources)

  const region = useMemo(() => camp ? REGIONS.find((r) => r.id === camp.regionId) : null, [camp])
  const regionResources = useMemo(() => camp ? RESOURCES.filter((r) => r.region === camp.regionId) : [], [camp])

  if (!camp || !region) {
    return (
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⛺</div>
        <p style={{ fontSize: '14px', color: '#636e8a', margin: 0 }}>
          Aucun camp actif. Sélectionne une région pour commencer la récolte.
        </p>
      </div>
    )
  }

  const campDuration = Date.now() - camp.startedAt
  const campHours = Math.floor(campDuration / 3600000)
  const campMinutes = Math.floor((campDuration % 3600000) / 60000)

  // Calcul de la production totale par minute pour la progress bar (cosmétique)
  const totalYieldPerMin = regionResources.reduce((sum, r) => sum + r.baseYieldPerMin, 0)

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid rgba(0,210,255,0.2)',
        borderRadius: '12px',
        padding: '16px',
        animation: 'pulse-ring 2s infinite',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>{region.emoji}</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>{region.name}</div>
            <div style={{ fontSize: '11px', color: '#636e8a' }}>
              Camp depuis {campHours > 0 ? `${campHours}h ` : ''}{campMinutes}min
            </div>
          </div>
        </div>
        <button
          onClick={removeCamp}
          style={{
            background: 'rgba(255,68,58,0.1)',
            border: '1px solid rgba(255,68,58,0.3)',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '11px',
            color: '#ff453a',
            cursor: 'pointer',
          }}
        >
          Lever le camp
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <ProgressBar value={1} color="#00d2ff" height={3} showGlow={false} animated />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {regionResources.map((res) => {
          const amount = resources[res.id] ?? 0
          return (
            <Tooltip key={res.id} content={res.tooltip}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#0d1117',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{res.emoji}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>{res.name}</div>
                    <div style={{ fontSize: '11px', color: '#636e8a' }}>{res.rarityLabel}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#00d2ff' }}>
                    {Math.floor(amount).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#636e8a' }}>+{res.baseYieldPerMin}/min</div>
                </div>
              </div>
            </Tooltip>
          )
        })}
      </div>

      <div style={{ marginTop: '10px', fontSize: '11px', color: '#636e8a', textAlign: 'right' }}>
        Production totale : {totalYieldPerMin}/min
      </div>
    </div>
  )
}
