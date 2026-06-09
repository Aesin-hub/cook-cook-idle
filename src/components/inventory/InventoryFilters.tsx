import type { RegionId } from '../../types/game'

export type SortMode = 'quantity' | 'name' | 'rarity'
export type FilterRegion = RegionId | 'crafted' | 'all'

interface InventoryFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  filterRegion: FilterRegion
  onFilterRegion: (r: FilterRegion) => void
  sortMode: SortMode
  onSortMode: (s: SortMode) => void
}

const REGION_FILTERS: { id: FilterRegion; label: string; emoji: string }[] = [
  { id: 'all',     label: 'Tout',    emoji: '📦' },
  { id: 'foret',   label: 'Forêt',   emoji: '🌲' },
  { id: 'caverne', label: 'Caverne', emoji: '⛰️' },
  { id: 'marais',  label: 'Marais',  emoji: '🌿' },
  { id: 'plaine',  label: 'Plaine',  emoji: '🌾' },
  { id: 'crafted', label: 'Craftés', emoji: '⚗️' },
]

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'quantity', label: 'Quantité ↓' },
  { id: 'name',     label: 'Nom A→Z' },
  { id: 'rarity',   label: 'Rareté' },
]

export function InventoryFilters({
  search, onSearchChange,
  filterRegion, onFilterRegion,
  sortMode, onSortMode,
}: InventoryFiltersProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#0d1117',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '12px',
      }}
    >
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <span
          style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="text"
          placeholder="Rechercher une ressource..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            background: '#161b22',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '9px 12px 9px 36px',
            fontSize: '13px',
            color: '#e2e8f0',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute', right: '10px', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: '#636e8a', cursor: 'pointer', fontSize: '14px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex', gap: '6px',
          overflowX: 'auto', paddingBottom: '2px',
          scrollbarWidth: 'none',
        }}
      >
        {REGION_FILTERS.map((f) => {
          const isActive = filterRegion === f.id
          return (
            <button
              key={f.id}
              onClick={() => onFilterRegion(f.id)}
              style={{
                flexShrink: 0,
                background: isActive ? 'rgba(255,213,0,0.12)' : '#161b22',
                border: `1px solid ${isActive ? 'rgba(255,213,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#ffd500' : '#636e8a',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {f.emoji} {f.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
        {SORT_OPTIONS.map((s) => {
          const isActive = sortMode === s.id
          return (
            <button
              key={s.id}
              onClick={() => onSortMode(s.id)}
              style={{
                background: isActive ? 'rgba(255,213,0,0.08)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(255,213,0,0.2)' : 'transparent'}`,
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                color: isActive ? '#ffd500' : '#636e8a',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
