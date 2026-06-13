import { useGameDataStore } from '../../stores/useGameDataStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { useToast } from '../shared/ToastManager'
import { Tooltip } from '../shared/Tooltip'

const RARITY_COLORS: Record<string, string> = {
  common: '#636e8a', uncommon: '#30d158',
  rare: '#00d2ff', epic: '#bf5af2', legendary: '#ff9500',
}

export function FamiliarCollection() {
  const creatures = useGameDataStore((s) => s.creatures)
  const capturedCreatureIds = useBestiaryStore((s) => s.capturedCreatureIds)
  const activeFamiliarId = useBestiaryStore((s) => s.activeFamiliarId)
  const setActiveFamiliar = useBestiaryStore((s) => s.setActiveFamiliar)
  const addToast = useToast()

  const familiars = creatures.filter((c) => c.isFamiliar)
  const capturedCount = familiars.filter((c) => capturedCreatureIds.includes(c.id)).length

  function handleSelectFamiliar(creatureId: string) {
    if (!capturedCreatureIds.includes(creatureId)) return
    if (activeFamiliarId === creatureId) {
      setActiveFamiliar(null)
      addToast('Familier désactivé.', 'info')
    } else {
      setActiveFamiliar(creatureId)
      const creature = creatures.find((c) => c.id === creatureId)
      addToast(`${creature?.emoji} ${creature?.name} est maintenant ton familier actif !`, 'success')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#636e8a',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Familiers
        </div>
        <div style={{ fontSize: '12px', color: '#636e8a' }}>
          {capturedCount}/{familiars.length} capturés
        </div>
      </div>

      {familiars.length === 0 ? (
        <div style={{
          background: '#161b22', borderRadius: '10px', padding: '20px',
          textAlign: 'center', color: '#636e8a', fontSize: '13px',
        }}>
          Aucun familier disponible pour l'instant. Explore la carte !
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {familiars.map((creature) => {
            const isCaptured = capturedCreatureIds.includes(creature.id)
            const isActive = activeFamiliarId === creature.id

            return (
              <Tooltip
                key={creature.id}
                content={
                  isCaptured
                    ? `${creature.name}${creature.familiarBonus ? `\n+${creature.familiarBonus.amountPerMin}/min ${creature.familiarBonus.resourceId}` : ''}`
                    : `??? — Non capturé (${(creature.captureChance * 100).toFixed(0)}% chance)`
                }
              >
                <button
                  onClick={() => handleSelectFamiliar(creature.id)}
                  disabled={!isCaptured}
                  style={{
                    background: isActive ? 'rgba(48,209,88,0.12)' : isCaptured ? '#161b22' : '#0d1117',
                    border: `1px solid ${isActive ? 'rgba(48,209,88,0.4)' : isCaptured ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: '10px',
                    padding: '10px 6px',
                    cursor: isCaptured ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    position: 'relative', width: '100%',
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: '4px', right: '4px',
                      width: '8px', height: '8px', borderRadius: '50%', background: '#30d158',
                    }} />
                  )}

                  <span style={{
                    fontSize: '26px',
                    filter: isCaptured ? 'none' : 'grayscale(1) brightness(0.3)',
                  }}>
                    {creature.emoji}
                  </span>

                  <span style={{
                    fontSize: '9px', color: isCaptured ? '#8b949e' : '#4a5568',
                    textAlign: 'center', lineHeight: 1.2,
                    width: '100%', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {isCaptured ? creature.name : '???'}
                  </span>

                  {isCaptured && (
                    <span style={{ fontSize: '8px', color: RARITY_COLORS[creature.rarity] ?? '#636e8a' }}>
                      {creature.rarityLabel}
                    </span>
                  )}
                </button>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
}
