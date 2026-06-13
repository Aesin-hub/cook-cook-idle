import { useState } from 'react'
import { PlayerHeader } from '../components/profile/PlayerHeader'
import { ClassCard } from '../components/profile/ClassCard'
import { FamiliarCollection } from '../components/profile/FamiliarCollection'
import { DebugPanel } from '../components/profile/DebugPanel'
import { CookbookPage } from './CookbookPage'
import type { ClassId } from '../types/player'

const CLASS_IDS: ClassId[] = [
  'recolteur', 'artisan', 'cuisinier', 'explorateur', 'chasseur', 'erudit',
]

export function ProfilePage() {
  const [showCookbook, setShowCookbook] = useState(false)

  if (showCookbook) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowCookbook(false)}
          style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: '#0d1117', border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            width: '100%', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', color: '#00d2ff', fontSize: '14px',
          }}
        >
          ← Retour au Profil
        </button>
        <CookbookPage />
      </div>
    )
  }

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

      {/* Bouton Cahier de Recettes */}
      <button
        onClick={() => setShowCookbook(true)}
        style={{
          width: '100%', marginBottom: '20px',
          padding: '13px', background: 'rgba(255,213,0,0.08)',
          border: '1px solid rgba(255,213,0,0.2)',
          borderRadius: '12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>📖</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffd500' }}>
              Cahier de Recettes
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '1px' }}>
              Tes vraies recettes à cuisiner chez toi
            </div>
          </div>
        </div>
        <span style={{ fontSize: '16px', color: '#636e8a' }}>→</span>
      </button>

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
