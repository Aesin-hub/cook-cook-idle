import { useEffect, useState } from 'react'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { RESOURCES } from '../../data'
import { useToast } from '../shared/ToastManager'
import { ProgressBar } from '../shared/ProgressBar'
import type { Expedition } from '../../types/harvest'

interface ExpeditionSlotProps {
  expedition: Expedition | null
  slotIndex: number
  onStartNew: () => void
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Terminée !'
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function ExpeditionSlot({ expedition, slotIndex, onStartNew }: ExpeditionSlotProps) {
  const [now, setNow] = useState(Date.now())
  const collectExpedition = useHarvestStore((state) => state.collectExpedition)
  const cancelExpedition = useHarvestStore((state) => state.cancelExpedition)
  const addResources = useInventoryStore((state) => state.addResources)
  const addToast = useToast()

  useEffect(() => {
    if (!expedition || expedition.collected) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [expedition])

  if (!expedition || expedition.collected) {
    return (
      <button
        onClick={onStartNew}
        style={{
          background: '#161b22',
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '36px', height: '36px',
            background: 'rgba(0,210,255,0.08)',
            border: '1px solid rgba(0,210,255,0.2)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', color: '#00d2ff',
          }}
        >
          +
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#636e8a' }}>
            Slot {slotIndex + 1} — Disponible
          </div>
          <div style={{ fontSize: '11px', color: '#4a5568' }}>Tap pour lancer une expédition</div>
        </div>
      </button>
    )
  }

  const resource = RESOURCES.find((r) => r.id === expedition.resourceId)
  const remaining = expedition.endsAt - now
  const isFinished = remaining <= 0
  const progress = 1 - Math.max(0, remaining) / (expedition.durationMinutes * 60 * 1000)

  function handleCollect() {
    const result = collectExpedition(expedition!.id)
    if (result) {
      addResources([result])
      const res = RESOURCES.find((r) => r.id === result.resourceId)
      addToast(`${res?.emoji ?? '📦'} +${result.amount} ${res?.name ?? result.resourceId} récupéré !`, 'success')
    }
  }

  function handleCancel() {
    cancelExpedition(expedition!.id)
    addToast('Expédition annulée. Tes ressources ont été remboursées.', 'info')
  }

  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid ${isFinished ? 'rgba(48,209,88,0.3)' : 'rgba(255,213,0,0.2)'}`,
        borderRadius: '12px',
        padding: '14px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{resource?.emoji ?? '📦'}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              {resource?.name ?? expedition.resourceId}
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a' }}>Expédition {slotIndex + 1}</div>
          </div>
        </div>

        {isFinished ? (
          <button
            onClick={handleCollect}
            style={{
              background: 'rgba(48,209,88,0.15)',
              border: '1px solid rgba(48,209,88,0.4)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#30d158',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              animation: 'pulse-ring 1.5s infinite',
            }}
          >
            ✅ Récupérer
          </button>
        ) : (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffd500' }}>
              {formatCountdown(remaining)}
            </div>
            <div style={{ fontSize: '10px', color: '#636e8a' }}>restant</div>
          </div>
        )}
      </div>

      <ProgressBar value={progress} color={isFinished ? '#30d158' : '#ffd500'} height={5} showGlow={isFinished} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
        <span style={{ fontSize: '11px', color: '#636e8a' }}>
          Butin : ≈ {resource ? Math.floor(resource.baseYieldPerMin * expedition.durationMinutes * 0.6) : '?'} {resource?.emoji}
        </span>
        {!isFinished && (
          <button
            onClick={handleCancel}
            style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#636e8a', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Annuler (remboursé)
          </button>
        )}
      </div>
    </div>
  )
}
