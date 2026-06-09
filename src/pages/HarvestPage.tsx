import { useState, useMemo } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useToast } from '../components/shared/ToastManager'
import { RegionCard } from '../components/harvest/RegionCard'
import { CampPanel } from '../components/harvest/CampPanel'
import { ExpeditionSlot } from '../components/harvest/ExpeditionSlot'
import { ExpeditionModal } from '../components/harvest/ExpeditionModal'
import { REGIONS } from '../data'
import type { RegionId } from '../types/game'
import type { Expedition } from '../types/harvest'

export function HarvestPage() {
  const camp = useHarvestStore((state) => state.camp)
  const setCamp = useHarvestStore((state) => state.setCamp)
  const expeditions = useHarvestStore((state) => state.expeditions)
  const addToast = useToast()

  const [expeditionModalRegion, setExpeditionModalRegion] = useState<RegionId | null>(null)
  const activeRegionId: RegionId = camp?.regionId ?? 'foret'

  const activeExpeditions = useMemo(() => expeditions.filter((e) => !e.collected), [expeditions])

  const expeditionSlots = useMemo<(Expedition | null)[]>(() => {
    const slots: (Expedition | null)[] = [null, null, null]
    activeExpeditions.forEach((e, i) => { if (i < 3) slots[i] = e })
    return slots
  }, [activeExpeditions])

  function handleRegionSelect(regionId: RegionId) {
    if (camp?.regionId === regionId) return
    setCamp(regionId)
    const region = REGIONS.find((r) => r.id === regionId)
    addToast(`⛺ Camp installé en ${region?.name ?? regionId}`, 'success')
  }

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>⛺ Récolte</h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Pose ton camp pour récolter en continu. Lance des expéditions pour cibler une ressource.
        </p>
      </div>

      <section style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
          Régions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {REGIONS.map((region) => (
            <RegionCard key={region.id} region={region} camp={camp} onSelect={handleRegionSelect} />
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
          Camp actif
        </div>
        <CampPanel />
      </section>

      <section style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Expéditions ({activeExpeditions.length}/3)
          </div>
          <div style={{ fontSize: '11px', color: '#636e8a' }}>Rendement : 60% du camp</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {expeditionSlots.map((expedition, i) => (
            <ExpeditionSlot
              key={expedition?.id ?? `empty-${i}`}
              expedition={expedition}
              slotIndex={i}
              onStartNew={() => setExpeditionModalRegion(activeRegionId)}
            />
          ))}
        </div>
      </section>

      {expeditionModalRegion && (
        <ExpeditionModal regionId={expeditionModalRegion} onClose={() => setExpeditionModalRegion(null)} />
      )}
    </div>
  )
}
