import { useState } from 'react'
import { useMapStore } from '../../stores/useMapStore'

interface MapSearchBarProps {
  onResultFound: (coord: { x: number; y: number }) => void
}

export function MapSearchBar({ onResultFound }: MapSearchBarProps) {
  const [query, setQuery] = useState('')
  const searchResource = useMapStore((s) => s.searchResource)
  const searchMessage = useMapStore((s) => s.searchMessage)

  function handleSearch() {
    if (!query.trim()) return
    searchResource(query)
    // Lire depuis le store directement après la mise à jour synchrone
    const result = useMapStore.getState().searchResult
    if (result) onResultFound(result)
  }

  return (
    <div style={{ padding: '10px 16px', background: '#0d1117' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="🔍 Chercher une ressource sur la carte..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, background: '#161b22',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '8px 12px',
            fontSize: '13px', color: '#e2e8f0',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '8px 14px', background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '10px', color: '#00d2ff',
            fontSize: '13px', cursor: 'pointer',
          }}
        >
          Chercher
        </button>
      </div>
      {searchMessage && (
        <div style={{ fontSize: '12px', color: '#636e8a', marginTop: '6px', paddingLeft: '4px' }}>
          {searchMessage}
        </div>
      )}
    </div>
  )
}
