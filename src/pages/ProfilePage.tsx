import { PlayerHeader } from '../components/profile/PlayerHeader'
import { ClassCard } from '../components/profile/ClassCard'
import { FamiliarCollection } from '../components/profile/FamiliarCollection'
import { DebugPanel } from '../components/profile/DebugPanel'
import type { ClassId } from '../types/player'

const CLASS_IDS: ClassId[] = [
  'recolteur', 'artisan', 'cuisinier', 'explorateur', 'chasseur', 'erudit',
]

export function ProfilePage() {
  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '80px' }}>
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          ⭐ Profil
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 12px' }}>
          Ta progression et tes classes d'aventurier.
        </p>
      </div>

      <PlayerHeader />

      <div style={{
        fontSize: '11px', fontWeight: 500, color: '#636e8a',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
      }}>
        Classes
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {CLASS_IDS.map((classId) => (
          <ClassCard key={classId} classId={classId} />
        ))}
      </div>

      <FamiliarCollection />

      <DebugPanel />
    </div>
  )
}
