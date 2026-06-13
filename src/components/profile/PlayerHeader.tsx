import { useAuthStore } from '../../stores/useAuthStore'
import { usePlayerStore } from '../../stores/usePlayerStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { FURNACE_LEVELS } from '../../data'

export function PlayerHeader() {
  const user = useAuthStore((s) => s.user)
  const totalXp = usePlayerStore((s) => s.totalXp)
  const createdAt = usePlayerStore((s) => s.createdAt)
  const getActiveFamiliar = useBestiaryStore((s) => s.getActiveFamiliar)

  const familiar = getActiveFamiliar()
  const globalLevel = FURNACE_LEVELS.filter((l) => totalXp >= l.requiredXp).length
  const daysPlayed = Math.floor((Date.now() - createdAt) / 86400000)

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid rgba(255,213,0,0.15)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
    }}>
      {/* Identité */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>
            🍖 {user?.email?.split('@')[0] ?? 'Aventurier'}
          </div>
          <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
            {daysPlayed > 0
              ? `Aventurier depuis ${daysPlayed} jour${daysPlayed > 1 ? 's' : ''}`
              : "Aventurier depuis aujourd'hui"
            }
          </div>
        </div>

        <div style={{
          background: 'rgba(255,213,0,0.1)',
          border: '1px solid rgba(255,213,0,0.3)',
          borderRadius: '12px', padding: '8px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffd500' }}>
            {totalXp.toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: '#636e8a' }}>
            XP total · Niv. {globalLevel}
          </div>
        </div>
      </div>

      {/* Familier actif */}
      {familiar ? (
        <div style={{
          background: '#0d1117', borderRadius: '8px', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '24px' }}>{familiar.emoji}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              {familiar.name}{' '}
              <span style={{ fontSize: '10px', color: '#30d158', fontWeight: 400 }}>● Actif</span>
            </div>
            {familiar.familiarBonus && (
              <div style={{ fontSize: '11px', color: '#636e8a' }}>
                +{familiar.familiarBonus.amountPerMin}/min {familiar.familiarBonus.resourceId}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#0d1117', borderRadius: '8px', padding: '10px 12px',
          fontSize: '12px', color: '#636e8a',
        }}>
          🐾 Aucun familier actif — capture des créatures pour en débloquer un
        </div>
      )}
    </div>
  )
}
