import { useState, type ReactNode } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'

type AdminSection =
  | 'regions'
  | 'resources'
  | 'craft-recipes'
  | 'cook-recipes'
  | 'machines'

const SECTIONS: { id: AdminSection; label: string; emoji: string }[] = [
  { id: 'regions',       label: 'Régions',         emoji: '🗺️' },
  { id: 'resources',     label: 'Ressources',       emoji: '🌿' },
  { id: 'craft-recipes', label: 'Recettes Craft',   emoji: '⚗️' },
  { id: 'cook-recipes',  label: 'Recettes Cook',    emoji: '🍳' },
  { id: 'machines',      label: 'Machines',         emoji: '🔧' },
]

interface AdminLayoutProps {
  children: (section: AdminSection) => ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('resources')
  const { signOut, user } = useAuthStore()

  return (
    <div style={{ minHeight: '100dvh', background: '#0d1117', display: 'flex' }}>
      <div style={{
        width: '220px', background: '#161b22',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 0',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>🍖</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>Admin Panel</div>
          <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>Cooking Fantasy</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '8px',
                  background: isActive ? 'rgba(0,210,255,0.1)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(0,210,255,0.2)' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left', marginBottom: '2px',
                }}
              >
                <span style={{ fontSize: '16px' }}>{s.emoji}</span>
                <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: isActive ? '#00d2ff' : '#8b949e' }}>
                  {s.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: '#636e8a', marginBottom: '8px', wordBreak: 'break-all' }}>
            {user?.email}
          </div>
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '7px',
              background: 'rgba(255,68,58,0.08)',
              border: '1px solid rgba(255,68,58,0.2)',
              borderRadius: '6px', color: '#ff453a',
              fontSize: '12px', cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {children(activeSection)}
      </main>
    </div>
  )
}
