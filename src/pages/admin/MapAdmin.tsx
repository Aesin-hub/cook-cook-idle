import { useState, useEffect } from 'react'
import { loadMapTiles, saveTile, clearTile, loadCreatures } from '../../lib/mapAdminService'
import { fetchAll } from '../../lib/adminService'
import { useToast } from '../../components/shared/ToastManager'
import { MAP_SIZE, MAP_CENTER } from '../../types/map'
import type { TileRarity } from '../../types/map'
import { TILE_RARITY_COLORS, TILE_RARITY_LABELS, TILE_BIOME_LABELS } from '../../types/tile'
import type { TileStatic } from '../../types/tile'
import type { Creature } from '../../types/creature'
import type { Resource } from '../../types/game'
import { TileForm } from './TileForm'

const TILE_SIZE = 20

export function MapAdmin() {
  const [tiles, setTiles] = useState<Record<string, TileStatic>>({})
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedTile, setSelectedTile] = useState<TileStatic | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const addToast = useToast()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [tilesData, creaturesData, resourcesData] = await Promise.all([
          loadMapTiles(),
          loadCreatures(),
          fetchAll<Resource>('game_resources'),
        ])
        setTiles(tilesData)
        setCreatures(creaturesData)
        setResources(resourcesData)
      } catch (err: any) {
        addToast(err.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleTileClick(x: number, y: number) {
    const tileId = `${x}_${y}`
    const existing = tiles[tileId]
    if (existing) {
      setSelectedTile(existing)
    } else {
      setSelectedTile({
        id: tileId, x, y,
        rarity: 'common', difficulty: 1,
        biome: 'empty', culture: 'center',
        specialType: null, resources: [],
        creatureId: null, isEnabled: false,
      })
    }
  }

  async function handleSaveTile(tile: TileStatic) {
    setSaving(true)
    try {
      await saveTile(tile)
      setTiles((prev) => ({ ...prev, [tile.id]: tile }))
      setSelectedTile(tile)
      addToast(`✅ Tuile (${tile.x}, ${tile.y}) sauvegardée !`, 'success')
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClearTile(tile: TileStatic) {
    if (!confirm(`Vider la tuile (${tile.x}, ${tile.y}) ?`)) return
    setSaving(true)
    try {
      await clearTile(tile.id, tile.x, tile.y)
      setTiles((prev) => ({
        ...prev,
        [tile.id]: { ...tile, isEnabled: false, resources: [], creatureId: null },
      }))
      setSelectedTile(null)
      addToast('Tuile vidée.', 'info')
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>
        ⏳ Chargement de la carte...
      </div>
    )
  }

  const enabledCount = Object.values(tiles).filter((t) => t.isEnabled).length

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 80px)' }}>

      {/* Grille de la carte */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            🗺️ Carte 31×31
          </h1>
          <div style={{ fontSize: '12px', color: '#636e8a' }}>
            {enabledCount} / 961 tuiles configurées
          </div>
        </div>

        {/* Légende des raretés */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {(Object.entries(TILE_RARITY_COLORS) as [TileRarity, string][]).map(([rarity, color]) => (
            <div key={rarity} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: color }} />
              <span style={{ fontSize: '11px', color: '#636e8a' }}>{TILE_RARITY_LABELS[rarity]}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '11px', color: '#636e8a' }}>Vide</span>
          </div>
        </div>

        {/* Grille */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${MAP_SIZE}, ${TILE_SIZE}px)`,
            gap: '1px',
            background: 'rgba(255,255,255,0.04)',
            padding: '1px',
            borderRadius: '8px',
            width: 'fit-content',
          }}
        >
          {Array.from({ length: MAP_SIZE }, (_, y) =>
            Array.from({ length: MAP_SIZE }, (_, x) => {
              const tileId = `${x}_${y}`
              const tile = tiles[tileId]
              const isSelected = selectedTile?.id === tileId
              const isCenter = x === MAP_CENTER.x && y === MAP_CENTER.y
              const bgColor = tile?.isEnabled
                ? TILE_RARITY_COLORS[tile.rarity]
                : '#0d1117'

              return (
                <div
                  key={tileId}
                  onClick={() => handleTileClick(x, y)}
                  title={
                    tile?.isEnabled
                      ? `(${x},${y}) ${TILE_RARITY_LABELS[tile.rarity]} — ${TILE_BIOME_LABELS[tile.biome]}`
                      : `(${x},${y}) Vide`
                  }
                  style={{
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    background: isSelected ? '#ffffff' : isCenter ? '#ffd500' : bgColor,
                    cursor: 'pointer',
                    opacity: tile?.isEnabled || isCenter ? 0.85 : 0.3,
                    transition: 'all 0.1s ease',
                    outline: isSelected ? '2px solid #ffffff' : 'none',
                  }}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Panneau formulaire */}
      <div
        style={{
          width: '340px',
          flexShrink: 0,
          background: '#161b22',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto',
          padding: selectedTile ? '16px' : '0',
        }}
      >
        {!selectedTile ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#636e8a', fontSize: '13px',
            textAlign: 'center', padding: '20px',
          }}>
            Clique sur une tuile pour la configurer
          </div>
        ) : (
          <TileForm
            tile={selectedTile}
            creatures={creatures}
            resources={resources}
            saving={saving}
            onSave={handleSaveTile}
            onClear={handleClearTile}
            onClose={() => setSelectedTile(null)}
          />
        )}
      </div>
    </div>
  )
}
