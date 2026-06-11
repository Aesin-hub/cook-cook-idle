import { useMapStore } from '../../stores/useMapStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { useGameDataStore } from '../../stores/useGameDataStore'
import { useToast } from '../shared/ToastManager'
import { RESOURCES } from '../../data'
import {
  TILE_RARITY_LABELS, TILE_BIOME_LABELS, TILE_CULTURE_LABELS, TILE_RARITY_COLORS,
} from '../../types/tile'
import type { TileCoord } from '../../types/map'

const BIOME_EMOJI: Record<string, string> = {
  forest: '🌲', cave: '⛰️', swamp: '🌿', plain: '🌾',
  mountain: '🏔️', desert: '🏜️', volcano: '🌋',
  ruins: '🏚️', village: '🏘️', empty: '',
}

interface TileInfoSheetProps {
  coord: TileCoord
  onClose: () => void
}

export function TileInfoSheet({ coord, onClose }: TileInfoSheetProps) {
  const staticTile = useMapStore((s) => s.getStaticTile(coord))
  const playerState = useMapStore((s) => s.getTilePlayerState(coord))
  const visibility = useMapStore((s) => s.getTileVisibility(coord))
  const moveCamp = useMapStore((s) => s.moveCamp)
  const campCoord = useMapStore((s) => s.campCoord)
  const campTravel = useMapStore((s) => s.campTravel)
  const isTileQuotaEmpty = useMapStore((s) => s.isTileQuotaEmpty(coord))
  const getQuotaResetLabel = useMapStore((s) => s.getQuotaResetLabel)
  const boss = useBestiaryStore((s) => s.getBossOnTile(coord.x, coord.y))
  const creatures = useGameDataStore((s) => s.creatures)
  const capturedCreatureIds = useBestiaryStore((s) => s.capturedCreatureIds)
  const addToast = useToast()

  if (!staticTile) return null

  const isCamp = campCoord?.x === coord.x && campCoord?.y === coord.y
  const isInTransit = campTravel?.isInTransit ?? false
  const creature = staticTile.creatureId
    ? creatures.find((c) => c.id === staticTile.creatureId) ?? null
    : null
  const isCaptured = creature ? capturedCreatureIds.includes(creature.id) : false
  const rarityColor = TILE_RARITY_COLORS[staticTile.rarity]

  function handleMoveCamp() {
    const result = moveCamp(coord)
    if (result.success) {
      const min = Math.ceil((result.travelMs ?? 0) / 60000)
      addToast(`🏕️ Camp en route ! Arrivée dans ${min}min.`, 'success')
      onClose()
    } else {
      addToast(result.reason ?? 'Impossible de déplacer le camp.', 'error')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px', width: '100%',
          maxHeight: '70vh', overflowY: 'auto',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{
          width: '40px', height: '4px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '2px', margin: '0 auto 16px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: `${rarityColor}22`, border: `2px solid ${rarityColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
            }}>
              {visibility !== 'hidden' ? (BIOME_EMOJI[staticTile.biome] ?? '?') : '?'}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
                {TILE_BIOME_LABELS[staticTile.biome]} ({coord.x}, {coord.y})
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                {(visibility === 'biome_rarity' || visibility === 'resources_type' || visibility === 'resources_full') && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: rarityColor,
                    background: `${rarityColor}15`, borderRadius: '20px', padding: '1px 8px',
                  }}>
                    {TILE_RARITY_LABELS[staticTile.rarity]}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: '#636e8a' }}>{'⭐'.repeat(staticTile.difficulty)}</span>
                <span style={{ fontSize: '11px', color: '#636e8a' }}>{TILE_CULTURE_LABELS[staticTile.culture]}</span>
              </div>
            </div>
          </div>
          {isCamp && (
            <div style={{
              background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.3)',
              borderRadius: '20px', padding: '3px 10px',
              fontSize: '11px', fontWeight: 600, color: '#ff9500',
            }}>
              🏕️ Camp actif
            </div>
          )}
        </div>

        {/* Boss présent */}
        {boss && creature && (
          <div style={{
            background: 'rgba(255,68,58,0.08)', border: '1px solid rgba(255,68,58,0.25)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ff453a', marginBottom: '4px' }}>
              💀 Boss présent — {creature.emoji} {creature.name}
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a' }}>
              Disparaît dans {Math.ceil((boss.expiresAt - Date.now()) / 3600000)}h
            </div>
          </div>
        )}

        {/* Ressources */}
        {(visibility === 'resources_type' || visibility === 'resources_full') && staticTile.resources.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Ressources
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {staticTile.resources.map((tr) => {
                const res = RESOURCES.find((r) => r.id === tr.resourceId)
                const remaining = playerState?.quotaRemaining[tr.resourceId] ?? tr.dailyQuota
                const isEmpty = remaining === 0
                return (
                  <div key={tr.resourceId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#0d1117', borderRadius: '8px', padding: '7px 12px',
                    opacity: isEmpty ? 0.5 : 1,
                  }}>
                    <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                      {res?.emoji} {visibility === 'resources_full' ? (res?.name ?? tr.resourceId) : (res?.rarityLabel ?? 'Ressource')}
                    </span>
                    {visibility === 'resources_full' && (
                      <span style={{ fontSize: '12px', color: isEmpty ? '#ff453a' : '#30d158' }}>
                        {isEmpty ? `⚠️ ${getQuotaResetLabel()}` : `${remaining} restants`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Créature (si non-boss) */}
        {creature && !boss && (
          <div style={{
            background: '#0d1117', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px', filter: isCaptured ? 'none' : 'grayscale(1)' }}>
                {creature.emoji}
              </span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: isCaptured ? '#e2e8f0' : '#636e8a' }}>
                  {isCaptured ? creature.name : '??? (non capturé)'}
                </div>
                <div style={{ fontSize: '11px', color: '#636e8a' }}>
                  {isCaptured ? 'Familier acquis ✅' : `${(creature.captureChance * 100).toFixed(0)}% de capture`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quota vide */}
        {isTileQuotaEmpty && !isCamp && (
          <div style={{
            background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)',
            borderRadius: '8px', padding: '8px 12px', marginBottom: '12px',
            fontSize: '12px', color: '#ff9500',
          }}>
            ⚠️ Région vide — {getQuotaResetLabel()}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!isCamp && !isInTransit && (
            <button onClick={handleMoveCamp} style={{
              padding: '12px', background: 'rgba(255,149,0,0.15)',
              border: '1px solid rgba(255,149,0,0.4)',
              borderRadius: '10px', color: '#ff9500',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>
              🏕️ Déplacer le camp ici
            </button>
          )}
          <button onClick={onClose} style={{
            padding: '12px', background: 'rgba(0,210,255,0.1)',
            border: '1px solid rgba(0,210,255,0.3)',
            borderRadius: '10px', color: '#00d2ff',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>
            🧭 Envoyer une expédition
          </button>
          {boss && (
            <button style={{
              padding: '12px', background: 'rgba(255,68,58,0.15)',
              border: '1px solid rgba(255,68,58,0.4)',
              borderRadius: '10px', color: '#ff453a',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>
              ⚔️ Affronter le boss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
