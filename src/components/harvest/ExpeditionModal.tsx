import { useState } from 'react'
import { RESOURCES } from '../../data'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useToast } from '../shared/ToastManager'
import type { RegionId } from '../../types/game'
import type { ExpeditionDuration } from '../../types/harvest'

const DURATIONS: { value: ExpeditionDuration; label: string }[] = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 heure' },
  { value: 120, label: '2 heures' },
]

const EXPEDITION_MULTIPLIER = 0.6

interface ExpeditionModalProps {
  regionId: RegionId
  onClose: () => void
}

export function ExpeditionModal({ regionId, onClose }: ExpeditionModalProps) {
  const regionResources = RESOURCES.filter((r) => r.region === regionId)
  const [selectedResource, setSelectedResource] = useState(regionResources[0]?.id ?? '')
  const [selectedDuration, setSelectedDuration] = useState<ExpeditionDuration>(30)
  const startExpedition = useHarvestStore((state) => state.startExpedition)
  const addToast = useToast()

  const selectedRes = RESOURCES.find((r) => r.id === selectedResource)
  const estimatedYield = selectedRes
    ? Math.floor(selectedRes.baseYieldPerMin * selectedDuration * EXPEDITION_MULTIPLIER)
    : 0

  function handleLaunch() {
    const result = startExpedition(selectedResource, regionId, selectedDuration)
    if (result.success) {
      addToast(`🧭 Expédition lancée ! Retour dans ${DURATIONS.find(d => d.value === selectedDuration)?.label}`, 'success')
      onClose()
    } else {
      addToast(result.reason ?? "Impossible de lancer l'expédition.", 'error')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          width: '100%',
          maxWidth: '480px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>
          🧭 Nouvelle expédition
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Ressource ciblée
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {regionResources.map((res) => (
              <button
                key={res.id}
                onClick={() => setSelectedResource(res.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: selectedResource === res.id ? 'rgba(0,210,255,0.1)' : '#0d1117',
                  border: `1px solid ${selectedResource === res.id ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{res.emoji} {res.name}</span>
                <span style={{ fontSize: '11px', color: '#636e8a' }}>{res.baseYieldPerMin}/min</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Durée de l'expédition
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {DURATIONS.map((d) => {
              const estimate = selectedRes ? Math.floor(selectedRes.baseYieldPerMin * d.value * EXPEDITION_MULTIPLIER) : 0
              const isSelected = selectedDuration === d.value
              return (
                <button
                  key={d.value}
                  onClick={() => setSelectedDuration(d.value)}
                  style={{
                    background: isSelected ? 'rgba(0,210,255,0.1)' : '#0d1117',
                    border: `1px solid ${isSelected ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '8px',
                    padding: '10px',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#00d2ff' : '#e2e8f0' }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
                    ≈ {estimate} {selectedRes?.emoji}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            background: '#0d1117',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: '#636e8a' }}>Butin estimé</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#00d2ff' }}>
            +{estimatedYield} {selectedRes?.emoji} {selectedRes?.name}
          </span>
        </div>

        <button
          onClick={handleLaunch}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '10px',
            color: '#00d2ff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🧭 Lancer l'expédition
        </button>
      </div>
    </div>
  )
}
