import { useState } from 'react'
import { usePlayerStore } from '../../stores/usePlayerStore'
import type { ClassId } from '../../types/player'

const CLASS_IDS: ClassId[] = [
  'recolteur', 'artisan', 'cuisinier', 'explorateur', 'chasseur', 'erudit',
]

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const debugSetClassLevel = usePlayerStore((s) => s.debugSetClassLevel)
  const classLevels = usePlayerStore((s) => s.classLevels)

  if (!import.meta.env.DEV) return null

  return (
    <div style={{
      background: 'rgba(255,213,0,0.06)',
      border: '1px solid rgba(255,213,0,0.2)',
      borderRadius: '10px',
      padding: '12px',
      marginTop: '20px',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none', border: 'none',
          color: '#ffd500', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', width: '100%', textAlign: 'left',
        }}
      >
        🛠️ Debug — Niveaux de classe {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CLASS_IDS.map((classId) => (
            <div key={classId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#636e8a', width: '100px' }}>{classId}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffd500', width: '24px' }}>
                {classLevels[classId] ?? 0}
              </span>
              <input
                type="range"
                min={0}
                max={10}
                value={classLevels[classId] ?? 0}
                onChange={(e) => debugSetClassLevel(classId, parseInt(e.target.value))}
                style={{ flex: 1, accentColor: '#ffd500' }}
              />
            </div>
          ))}
          <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '4px' }}>
            ⚠️ Debug uniquement — invisible en production
          </div>
        </div>
      )}
    </div>
  )
}
