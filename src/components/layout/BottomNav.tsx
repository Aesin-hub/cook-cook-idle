interface Tab {
  id: 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'
  label: string
  emoji: string
}

const TABS: Tab[] = [
  { id: 'harvest',   label: 'Récolte',  emoji: '⛺' },
  { id: 'craft',     label: 'Craft',    emoji: '⚗️' },
  { id: 'cook',      label: 'Cook',     emoji: '🍳' },
  { id: 'inventory', label: 'Sac',      emoji: '🎒' },
  { id: 'map',       label: 'Carte',    emoji: '🗺️' },
]

interface BottomNavProps {
  activeTab: Tab['id']
  onTabChange: (tab: Tab['id']) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#0d1117',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        const activeColor =
          tab.id === 'harvest'   ? '#00d2ff' :
          tab.id === 'craft'     ? '#bf5af2' :
          tab.id === 'cook'      ? '#ff9500' :
          tab.id === 'inventory' ? '#ffd500' : '#636e8a'

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              background: isActive ? `${activeColor}1a` : 'transparent',
              border: 'none',
              borderTop: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
              cursor: 'pointer',
              padding: '6px 0 4px',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.emoji}</span>
            <span style={{ fontSize: '10px', fontWeight: 500, color: isActive ? activeColor : '#636e8a', letterSpacing: '0.02em' }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
