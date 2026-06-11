import { memo } from 'react'
import { TILE_RARITY_COLORS } from '../../types/tile'
import type { TileStatic } from '../../types/tile'
import type { TileVisibility, TilePlayerState } from '../../types/mapState'

const TILE_SIZE = 24

interface MapTileProps {
  x: number
  y: number
  staticTile: TileStatic | null
  playerState: TilePlayerState | null
  visibility: TileVisibility
  isCamp: boolean
  isSelected: boolean
  hasBoss: boolean
  isInTransit: boolean
  onClick: () => void
}

const BIOME_EMOJI: Record<string, string> = {
  forest: '🌲', cave: '⛰️', swamp: '🌿', plain: '🌾',
  mountain: '🏔️', desert: '🏜️', volcano: '🌋',
  ruins: '🏚️', village: '🏘️', empty: '',
}

export const MapTile = memo(function MapTile({
  x, y, staticTile, playerState, visibility,
  isCamp, isSelected, hasBoss, isInTransit, onClick,
}: MapTileProps) {
  const isHidden = visibility === 'hidden'

  let bgColor = '#0a0e14'

  if (!isHidden && staticTile?.isEnabled) {
    const rarityColor = TILE_RARITY_COLORS[staticTile.rarity]
    bgColor = visibility === 'biome_only' ? `${rarityColor}33` : `${rarityColor}88`
  } else if (!isHidden && !staticTile?.isEnabled) {
    bgColor = '#0d1117'
  }

  let borderColor = 'transparent'
  if (isSelected) borderColor = '#ffffff'
  else if (isCamp) borderColor = '#ff9500'
  else if (hasBoss) borderColor = '#ff453a'
  else if (isInTransit) borderColor = '#00d2ff'

  let content = ''
  if (isCamp) content = '🏕️'
  else if (hasBoss) content = '💀'
  else if (isInTransit) content = '→'
  else if (visibility === 'biome_only' || visibility === 'biome_rarity') {
    content = staticTile ? (BIOME_EMOJI[staticTile.biome] ?? '') : ''
  }

  const isQuotaEmpty = playerState
    ? Object.values(playerState.quotaRemaining).every((q) => q === 0)
    : false

  return (
    <div
      onClick={onClick}
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: '2px',
        cursor: isHidden ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        lineHeight: 1,
        opacity: isQuotaEmpty && !isCamp ? 0.5 : 1,
        animation: isCamp ? 'camp-pulse 2s infinite'
          : hasBoss ? 'boss-pulse 1s infinite'
          : 'none',
        transition: 'background 0.2s ease',
        boxSizing: 'border-box',
      }}
      title={isHidden ? '' : `(${x},${y})`}
    >
      {content}
    </div>
  )
})
