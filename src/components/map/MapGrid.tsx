import { useRef, useState, useCallback, useEffect } from 'react'
import { useMapStore } from '../../stores/useMapStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { MAP_SIZE, MAP_CENTER } from '../../types/map'
import { MapTile } from './MapTile'
import type { TileCoord } from '../../types/map'

const TILE_SIZE = 24
const MAP_PX = MAP_SIZE * TILE_SIZE

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
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startTX: 0, startTY: 0 })
  const pinchRef = useRef({ pinching: false, startDist: 0, startScale: 1 })

  useEffect(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const coord = campCoord ?? MAP_CENTER
    setTransform({
      x: rect.width / 2 - (coord.x * TILE_SIZE + TILE_SIZE / 2),
      y: rect.height / 2 - (coord.y * TILE_SIZE + TILE_SIZE / 2),
      scale: 1,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const centerOn = useCallback((coord: TileCoord) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setTransform((t) => ({
      ...t,
      x: rect.width / 2 - (coord.x * TILE_SIZE + TILE_SIZE / 2) * t.scale,
      y: rect.height / 2 - (coord.y * TILE_SIZE + TILE_SIZE / 2) * t.scale,
    }))
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = {
      dragging: true,
      startX: e.clientX, startY: e.clientY,
      startTX: transform.x, startTY: transform.y,
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
                  isInTransit={isInTransit ?? false}
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
