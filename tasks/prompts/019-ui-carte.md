# Prompt 019 — UI Carte (page joueur)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 018 ont été exécutés.

Structure existante pertinente :
- `src/stores/useMapStore.ts` — `staticTiles`, `playerTiles`, `campCoord`,
  `campTravel`, `moveCamp()`, `getTileVisibility()`, `searchResource()`,
  `searchResult`, `searchMessage`, `isTileQuotaEmpty()`, `getQuotaResetLabel()`
- `src/stores/useBestiaryStore.ts` — `getBossOnTile()`, `getActiveBosses()`,
  `hunt()`, `capturedCreatureIds`
- `src/stores/usePlayerStore.ts` — `isFeatureUnlocked()`
- `src/types/tile.ts` — `TILE_RARITY_COLORS`, `TILE_RARITY_LABELS`,
  `TILE_BIOME_LABELS`, `TileStatic`, `TileVisibility`
- `src/types/map.ts` — `MAP_SIZE`, `MAP_CENTER`, `tileDistance`, `travelTimeMs`
- `src/components/shared/ProgressBar.tsx` — réutilisable
- `src/components/shared/ToastManager.tsx` — `useToast()`
- `src/App.tsx` — `case 'map': return <ComingSoon ...>` à remplacer

## Décisions de design
- **Couleur carte** : l'onglet Carte est gris `#636e8a` (neutre, pas de couleur de boucle)
- **Tuile size** : 24px par tuile → carte totale 744×744px
- **Pan/zoom** : CSS transforms pures, pas de librairie externe
- **Zoom** : 0.5× min, 2× max, 1× par défaut
- **Camp** : marqueur 🏕️ orange pulsant
- **Boss** : marqueur 💀 rouge clignotant
- **Tuile sélectionnée** : bordure blanche 2px
- **Bottom sheet** : slide-up depuis le bas, ferme en swipant vers le bas

---

## Architecture des fichiers

```
src/
├── pages/
│   └── MapPage.tsx                ← page principale carte
├── components/
│   └── map/
│       ├── MapGrid.tsx            ← grille 31×31 avec pan/zoom
│       ├── MapTile.tsx            ← rendu d'une tuile individuelle
│       ├── TileInfoSheet.tsx      ← bottom sheet infos d'une tuile
│       ├── MapSearchBar.tsx       ← barre de recherche ressource
│       ├── CampTravelBar.tsx      ← barre de progression déplacement camp
│       └── BossIndicator.tsx      ← liste des boss actifs
```

---

## Fichiers à créer

---

### `src/components/map/MapTile.tsx`

Rendu d'une tuile individuelle. Pur visuel — pas de logique métier.

```tsx
import { memo } from 'react'
import { TILE_RARITY_COLORS } from '../../types/tile'
import type { TileStatic } from '../../types/tile'
import type { TileVisibility } from '../../types/mapState'
import type { TilePlayerState } from '../../types/mapState'

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
  isInTransit: boolean  // camp en déplacement vers cette tuile
  onClick: () => void
}

// Emoji biome pour les tuiles révélées
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
  const isRevealed = visibility !== 'hidden'

  // Couleur de fond
  let bgColor = '#0a0e14'  // hidden = quasi-noir

  if (isRevealed && staticTile?.isEnabled) {
    const rarityColor = TILE_RARITY_COLORS[staticTile.rarity]
    bgColor = isHidden ? '#0a0e14'
      : visibility === 'biome_only' ? `${rarityColor}33`  // très atténué
      : `${rarityColor}88`  // semi-transparent
  } else if (isRevealed && !staticTile?.isEnabled) {
    bgColor = '#0d1117'  // tuile vide révélée
  }

  // Bordure
  let borderColor = 'transparent'
  if (isSelected) borderColor = '#ffffff'
  else if (isCamp) borderColor = '#ff9500'
  else if (hasBoss) borderColor = '#ff453a'
  else if (isInTransit) borderColor = '#00d2ff'

  // Contenu affiché dans la tuile
  let content = ''
  if (isCamp) content = '🏕️'
  else if (hasBoss) content = '💀'
  else if (isInTransit) content = '→'
  else if (visibility === 'biome_only' || visibility === 'biome_rarity') {
    content = staticTile ? BIOME_EMOJI[staticTile.biome] ?? '' : ''
  }

  // Quota vide = opacité réduite sur la tuile
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
        position: 'relative',
        animation: isCamp ? 'pulse-ring 2s infinite'
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
```

---

### `src/components/map/MapGrid.tsx`

Grille 31×31 avec pan/zoom via CSS transforms.

```tsx
import { useRef, useState, useCallback, useEffect } from 'react'
import { useMapStore } from '../../stores/useMapStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { MAP_SIZE, MAP_CENTER } from '../../types/map'
import { MapTile } from './MapTile'
import type { TileCoord } from '../../types/map'

const TILE_SIZE = 24
const MAP_PX = MAP_SIZE * TILE_SIZE  // 744px

interface MapGridProps {
  selectedCoord: TileCoord | null
  onTileSelect: (coord: TileCoord) => void
}

export function MapGrid({ selectedCoord, onTileSelect }: MapGridProps) {
  const staticTiles = useMapStore((s) => s.staticTiles)
  const playerTiles = useMapStore((s) => s.playerTiles)
  const campCoord = useMapStore((s) => s.campCoord)
  const campTravel = useMapStore((s) => s.campTravel)
  const getTileVisibility = useMapStore((s) => s.getTileVisibility)
  const getBossOnTile = useBestiaryStore((s) => s.getBossOnTile)

  const containerRef = useRef<HTMLDivElement>(null)

  // État pan/zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startTX: 0, startTY: 0 })
  const pinchRef = useRef({ pinching: false, startDist: 0, startScale: 1 })

  // Centrer sur le camp au premier rendu
  useEffect(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const coord = campCoord ?? MAP_CENTER
    const campPx = {
      x: coord.x * TILE_SIZE + TILE_SIZE / 2,
      y: coord.y * TILE_SIZE + TILE_SIZE / 2,
    }
    setTransform({
      x: rect.width / 2 - campPx.x,
      y: rect.height / 2 - campPx.y,
      scale: 1,
    })
  }, [])

  // Centrer sur une coordonnée
  const centerOn = useCallback((coord: TileCoord) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const px = {
      x: coord.x * TILE_SIZE + TILE_SIZE / 2,
      y: coord.y * TILE_SIZE + TILE_SIZE / 2,
    }
    setTransform((t) => ({
      ...t,
      x: rect.width / 2 - px.x * t.scale,
      y: rect.height / 2 - px.y * t.scale,
    }))
  }, [])

  // Mouse drag
  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startTX: transform.x,
      startTY: transform.y,
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current.dragging) return
    setTransform((t) => ({
      ...t,
      x: dragRef.current.startTX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startTY + (e.clientY - dragRef.current.startY),
    }))
  }

  function onMouseUp() { dragRef.current.dragging = false }

  // Touch drag
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      dragRef.current = {
        dragging: true,
        startX: t.clientX, startY: t.clientY,
        startTX: transform.x, startTY: transform.y,
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = {
        pinching: true,
        startDist: Math.sqrt(dx * dx + dy * dy),
        startScale: transform.scale,
      }
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 1 && dragRef.current.dragging) {
      const t = e.touches[0]
      setTransform((prev) => ({
        ...prev,
        x: dragRef.current.startTX + (t.clientX - dragRef.current.startX),
        y: dragRef.current.startTY + (t.clientY - dragRef.current.startY),
      }))
    } else if (e.touches.length === 2 && pinchRef.current.pinching) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const newScale = Math.min(2, Math.max(0.5,
        pinchRef.current.startScale * (dist / pinchRef.current.startDist)
      ))
      setTransform((prev) => ({ ...prev, scale: newScale }))
    }
  }

  function onTouchEnd() {
    dragRef.current.dragging = false
    pinchRef.current.pinching = false
  }

  // Zoom molette desktop
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((t) => ({
      ...t,
      scale: Math.min(2, Math.max(0.5, t.scale * delta)),
    }))
  }

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      {/* Bouton centrer sur le camp */}
      <button
        onClick={() => campCoord && centerOn(campCoord)}
        style={{
          position: 'absolute', top: '10px', right: '10px', zIndex: 10,
          background: 'rgba(255,149,0,0.15)',
          border: '1px solid rgba(255,149,0,0.4)',
          borderRadius: '8px', padding: '6px 12px',
          fontSize: '12px', color: '#ff9500', cursor: 'pointer',
        }}
      >
        🏕️ Centrer
      </button>

      {/* Conteneur de la grille */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        {/* Grille transformée */}
        <div
          style={{
            width: MAP_PX,
            height: MAP_PX,
            display: 'grid',
            gridTemplateColumns: `repeat(${MAP_SIZE}, ${TILE_SIZE}px)`,
            gap: '1px',
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {Array.from({ length: MAP_SIZE }, (_, y) =>
            Array.from({ length: MAP_SIZE }, (_, x) => {
              const key = `${x}_${y}`
              const staticTile = staticTiles[key] ?? null
              const playerState = playerTiles[key] ?? null
              const visibility = getTileVisibility({ x, y })
              const isCamp = campCoord?.x === x && campCoord?.y === y
              const isSelected = selectedCoord?.x === x && selectedCoord?.y === y
              const hasBoss = !!getBossOnTile(x, y)
              const isInTransit = campTravel?.toCoord.x === x && campTravel?.toCoord.y === y

              return (
                <MapTile
                  key={key}
                  x={x} y={y}
                  staticTile={staticTile}
                  playerState={playerState}
                  visibility={visibility}
                  isCamp={isCamp}
                  isSelected={isSelected}
                  hasBoss={hasBoss}
                  isInTransit={isInTransit}
                  onClick={() => visibility !== 'hidden' && onTileSelect({ x, y })}
                />
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
```

---

### `src/components/map/MapSearchBar.tsx`

Barre de recherche en haut de la carte.

```tsx
import { useState } from 'react'
import { useMapStore } from '../../stores/useMapStore'

interface MapSearchBarProps {
  onResultFound: (coord: { x: number; y: number }) => void
}

export function MapSearchBar({ onResultFound }: MapSearchBarProps) {
  const [query, setQuery] = useState('')
  const searchResource = useMapStore((s) => s.searchResource)
  const searchResult = useMapStore((s) => s.searchResult)
  const searchMessage = useMapStore((s) => s.searchMessage)

  function handleSearch() {
    if (!query.trim()) return
    searchResource(query)
    if (searchResult) onResultFound(searchResult)
  }

  return (
    <div style={{ padding: '10px 16px', background: '#0d1117' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Chercher une ressource sur la carte..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              width: '100%', background: '#161b22',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', padding: '8px 12px',
              fontSize: '13px', color: '#e2e8f0',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
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
```

---

### `src/components/map/CampTravelBar.tsx`

Barre sticky visible quand le camp est en déplacement.

```tsx
import { useEffect, useState } from 'react'
import { useMapStore } from '../../stores/useMapStore'
import { ProgressBar } from '../shared/ProgressBar'

export function CampTravelBar() {
  const campTravel = useMapStore((s) => s.campTravel)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!campTravel?.isInTransit) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [campTravel?.isInTransit])

  if (!campTravel?.isInTransit) return null

  const now = Date.now()
  const total = campTravel.arrivesAt - campTravel.startedAt
  const elapsed = now - campTravel.startedAt
  const progress = Math.min(elapsed / total, 1)
  const remainingMs = Math.max(0, campTravel.arrivesAt - now)
  const remainingMin = Math.ceil(remainingMs / 60000)
  const remainingSec = Math.ceil(remainingMs / 1000)

  const label = remainingMs > 60000
    ? `${remainingMin}min`
    : `${remainingSec}s`

  return (
    <div style={{
      position: 'fixed', bottom: '64px', left: 0, right: 0, zIndex: 90,
      background: '#161b22',
      borderTop: '1px solid rgba(0,210,255,0.2)',
      padding: '10px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
          🏕️ Camp en déplacement vers ({campTravel.toCoord.x}, {campTravel.toCoord.y})
        </span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#00d2ff' }}>
          {label}
        </span>
      </div>
      <ProgressBar value={progress} color="#00d2ff" height={4} showGlow />
      <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '4px' }}>
        ⚠️ Le camp ne produit pas pendant le trajet
      </div>
    </div>
  )
}
```

---

### `src/components/map/BossIndicator.tsx`

Liste compacte des boss actifs — affichée en haut de la carte.

```tsx
import { useEffect, useState } from 'react'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { useGameDataStore } from '../../stores/useGameDataStore'

interface BossIndicatorProps {
  onBossClick: (x: number, y: number) => void
}

export function BossIndicator({ onBossClick }: BossIndicatorProps) {
  const getActiveBosses = useBestiaryStore((s) => s.getActiveBosses)
  const creatures = useGameDataStore((s) => s.creatures)
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const bosses = getActiveBosses()
  if (bosses.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: '6px', padding: '8px 16px',
      background: 'rgba(255,68,58,0.06)',
      borderBottom: '1px solid rgba(255,68,58,0.15)',
      overflowX: 'auto',
    }}>
      {bosses.map((boss) => {
        const creature = creatures.find((c) => c.id === boss.creatureId)
        const remainingMs = boss.expiresAt - Date.now()
        const remainingH = Math.floor(remainingMs / 3600000)
        const remainingM = Math.floor((remainingMs % 3600000) / 60000)
        const timeLabel = remainingH > 0 ? `${remainingH}h${remainingM}m` : `${remainingM}m`

        return (
          <button
            key={boss.id}
            onClick={() => onBossClick(boss.tileX, boss.tileY)}
            style={{
              flexShrink: 0,
              background: 'rgba(255,68,58,0.1)',
              border: '1px solid rgba(255,68,58,0.3)',
              borderRadius: '20px', padding: '4px 12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <span style={{ fontSize: '14px' }}>{creature?.emoji ?? '💀'}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#ff453a' }}>
              {creature?.name ?? boss.creatureId}
            </span>
            <span style={{ fontSize: '10px', color: '#636e8a' }}>
              ({boss.tileX},{boss.tileY}) · {timeLabel}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

---

### `src/components/map/TileInfoSheet.tsx`

Bottom sheet affiché quand le joueur sélectionne une tuile.

```tsx
import { useState } from 'react'
import { useMapStore } from '../../stores/useMapStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { useGameDataStore } from '../../stores/useGameDataStore'
import { useToast } from '../shared/ToastManager'
import { RESOURCES } from '../../data'
import {
  TILE_RARITY_LABELS, TILE_BIOME_LABELS, TILE_CULTURE_LABELS,
  TILE_RARITY_COLORS,
} from '../../types/tile'
import type { TileCoord } from '../../types/map'

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

  const isCamp = campCoord?.x === coord.x && campCoord?.y === coord.y
  const isInTransit = campTravel?.isInTransit

  const creature = staticTile?.creatureId
    ? creatures.find((c) => c.id === staticTile.creatureId)
    : null
  const isCaptured = creature ? capturedCreatureIds.includes(creature.id) : false

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

  if (!staticTile) return null

  const rarityColor = TILE_RARITY_COLORS[staticTile.rarity]

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
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 16px' }} />

        {/* Header tuile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: `${rarityColor}22`,
              border: `2px solid ${rarityColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
            }}>
              {/* Emoji biome si visible */}
              {visibility !== 'hidden' ? { forest:'🌲',cave:'⛰️',swamp:'🌿',plain:'🌾',mountain:'🏔️',desert:'🏜️',volcano:'🌋',ruins:'🏚️',village:'🏘️',empty:'' }[staticTile.biome] : '?'}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
                {TILE_BIOME_LABELS[staticTile.biome]} ({coord.x}, {coord.y})
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                {(visibility === 'biome_rarity' || visibility === 'resources_type' || visibility === 'resources_full') && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: rarityColor,
                    background: `${rarityColor}15`, borderRadius: '20px', padding: '1px 8px',
                  }}>
                    {TILE_RARITY_LABELS[staticTile.rarity]}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: '#636e8a' }}>
                  {'⭐'.repeat(staticTile.difficulty)}
                </span>
                <span style={{ fontSize: '11px', color: '#636e8a' }}>
                  {TILE_CULTURE_LABELS[staticTile.culture]}
                </span>
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

        {/* Boss sur cette tuile */}
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
                      {res?.emoji} {visibility === 'resources_full' ? res?.name ?? tr.resourceId : res?.rarityLabel ?? 'Ressource'}
                    </span>
                    {visibility === 'resources_full' && (
                      <span style={{ fontSize: '12px', color: isEmpty ? '#ff453a' : '#30d158' }}>
                        {isEmpty ? `⚠️ Vide — ${getQuotaResetLabel()}` : `${remaining} restants`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Créature */}
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
                  {isCaptured ? `Familier acquis ✅` : `${(creature.captureChance * 100).toFixed(0)}% de capture`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quota vide warning */}
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
          {/* Déplacer le camp */}
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

          {/* Envoyer une expédition — géré par HarvestPage */}
          <button onClick={onClose} style={{
            padding: '12px', background: 'rgba(0,210,255,0.1)',
            border: '1px solid rgba(0,210,255,0.3)',
            borderRadius: '10px', color: '#00d2ff',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>
            🧭 Envoyer une expédition
          </button>

          {/* Chasser le boss */}
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
```

---

### `src/pages/MapPage.tsx`

Page principale — assemble tous les composants.

```tsx
import { useState } from 'react'
import { useMapStore } from '../stores/useMapStore'
import { MapGrid } from '../components/map/MapGrid'
import { MapSearchBar } from '../components/map/MapSearchBar'
import { TileInfoSheet } from '../components/map/TileInfoSheet'
import { CampTravelBar } from '../components/map/CampTravelBar'
import { BossIndicator } from '../components/map/BossIndicator'
import type { TileCoord } from '../types/map'

export function MapPage() {
  const [selectedCoord, setSelectedCoord] = useState<TileCoord | null>(null)
  const searchResult = useMapStore((s) => s.searchResult)
  const tilesLoaded = useMapStore((s) => s.tilesLoaded)

  if (!tilesLoaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: '12px',
      }}>
        <div style={{ fontSize: '32px' }}>🗺️</div>
        <p style={{ fontSize: '13px', color: '#636e8a' }}>Chargement de la carte...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Barre de recherche */}
      <MapSearchBar
        onResultFound={(coord) => setSelectedCoord(coord)}
      />

      {/* Indicateur boss actifs */}
      <BossIndicator
        onBossClick={(x, y) => setSelectedCoord({ x, y })}
      />

      {/* Grille principale */}
      <MapGrid
        selectedCoord={selectedCoord}
        onTileSelect={setSelectedCoord}
      />

      {/* Bottom sheet infos tuile */}
      {selectedCoord && (
        <TileInfoSheet
          coord={selectedCoord}
          onClose={() => setSelectedCoord(null)}
        />
      )}

      {/* Barre de déplacement du camp */}
      <CampTravelBar />
    </div>
  )
}
```

---

### Ajouter dans `src/index.css`

```css
@keyframes boss-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

---

### Mise à jour `src/App.tsx`

```tsx
import { MapPage } from './pages/MapPage'

// Dans renderPage() :
case 'map': return <MapPage />
```

---

## Critères de succès

### Grille
- [ ] La grille 31×31 s'affiche correctement
- [ ] Les tuiles `hidden` sont quasi-noires
- [ ] Les tuiles `revealed` affichent leur biome atténué
- [ ] Les tuiles `explored` affichent leur couleur de rareté pleine
- [ ] Le camp (15,15) a un marqueur 🏕️ orange pulsant
- [ ] Les boss actifs ont un marqueur 💀 rouge clignotant

### Navigation
- [ ] Pan fonctionne (souris + touch)
- [ ] Pinch-to-zoom fonctionne sur mobile (0.5× à 2×)
- [ ] Molette zoom fonctionne sur desktop
- [ ] Bouton "Centrer" recentre sur le camp
- [ ] La carte est centrée sur le camp au premier chargement

### Interactions
- [ ] Cliquer sur une tuile `revealed` ou `explored` → bottom sheet
- [ ] Bottom sheet affiche biome + rareté selon visibilité
- [ ] "Déplacer le camp ici" → toast + barre de progression
- [ ] `CampTravelBar` apparaît pendant le déplacement
- [ ] Boss indicator liste les boss actifs avec leur timer

### Recherche
- [ ] Taper "herbe" + chercher → carte centre sur la tuile
- [ ] Ressource non trouvée → message "Explore davantage"

### Quota
- [ ] Tuile quota vide → badge ⚠️ dans le bottom sheet
- [ ] Message "Reset à minuit (dans Xh Ymin)" affiché

## Notes pour la suite
- Le bouton "Envoyer une expédition" dans `TileInfoSheet` ferme la sheet
  et redirige vers HarvestPage — la liaison entre les deux pages sera
  améliorée dans un prompt de polish (paramètre de navigation)
- Le bouton "Affronter le boss" est présent mais non câblé —
  la logique `hunt()` sera branchée dans le prompt 020 (UI Bestiaire)
- La performance de la grille 31×31 (961 tuiles) est gérée par `memo()`
  sur `MapTile` — si des problèmes apparaissent, on pourra passer à
  une virtualisation canvas en Phase 4
