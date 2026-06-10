import { getUnlockedMachines, isMachineCompatible } from '../../lib/cookHelpers'
import { useCookStore } from '../../stores/useCookStore'

interface MachinePickerModalProps {
  currentMachineId: string | null
  recipeId: string | null
  onSelect: (machineId: string | null) => void
  onClose: () => void
}

export function MachinePickerModal({ currentMachineId, recipeId, onSelect, onClose }: MachinePickerModalProps) {
  const totalXp = useCookStore((state) => state.getTotalXp())
  const unlockedMachines = getUnlockedMachines(totalXp)

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
          padding: '20px', width: '100%', maxWidth: '480px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '70vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 16px' }} />

        <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>
          🔧 Choisir une machine
        </h3>

        <button
          onClick={() => { onSelect(null); onClose() }}
          style={{
            width: '100%', background: !currentMachineId ? 'rgba(255,255,255,0.06)' : '#0d1117',
            border: `1px solid ${!currentMachineId ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '10px', padding: '12px 14px',
            cursor: 'pointer', textAlign: 'left', marginBottom: '8px',
          }}
        >
          <div style={{ fontSize: '14px', color: '#636e8a' }}>— Aucune machine</div>
          <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px' }}>Production à vitesse normale</div>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {unlockedMachines.map((machine) => {
            const isSelected = machine.id === currentMachineId
            const compatible = recipeId ? isMachineCompatible(machine.id, recipeId) : true
            const isIncompatible = recipeId && !compatible

            return (
              <button
                key={machine.id}
                onClick={() => { onSelect(machine.id); onClose() }}
                style={{
                  background: isSelected ? 'rgba(191,90,242,0.1)' : '#0d1117',
                  border: `1px solid ${isSelected ? 'rgba(191,90,242,0.4)' : isIncompatible ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px', padding: '12px 14px',
                  cursor: 'pointer', textAlign: 'left',
                  opacity: isIncompatible ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{machine.emoji}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#bf5af2' : '#e2e8f0' }}>
                        {machine.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#636e8a' }}>Tier {machine.tier}</div>
                    </div>
                  </div>
                  {isIncompatible && (
                    <span style={{ fontSize: '10px', color: '#ff453a' }}>Incompatible</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {machine.speedMultiplier > 1 && (
                    <span style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', color: '#ff9500' }}>
                      ⚡ ×{machine.speedMultiplier} vitesse
                    </span>
                  )}
                  {machine.efficiencyBonus > 0 && (
                    <span style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', color: '#30d158' }}>
                      💚 -{Math.round(machine.efficiencyBonus * 100)}% consommation
                    </span>
                  )}
                </div>

                <div style={{ marginTop: '4px', fontSize: '11px', color: '#636e8a' }}>
                  {machine.tooltip}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
