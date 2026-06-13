import { useEffect, useRef, useState } from 'react'
import type { GameAsset } from '../../types/asset'
import { getFrameWidth } from '../../types/asset'

interface SpritePreviewProps {
  asset: GameAsset
  size?: number
  showName?: boolean
}

export function SpritePreview({ asset, size = 64, showName = false }: SpritePreviewProps) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!asset.isAnimated || asset.frameCount <= 1) return
    intervalRef.current = setInterval(() => {
      setCurrentFrame((f) => (f + 1) % asset.frameCount)
    }, 1000 / asset.frameRate)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [asset.isAnimated, asset.frameCount, asset.frameRate])

  const frameWidth = getFrameWidth(asset)

  const animStyle: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(${asset.url})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${currentFrame * frameWidth * (size / frameWidth)}px 0px`,
    backgroundSize: `${asset.frameCount * size}px ${size}px`,
    imageRendering: 'pixelated',
    flexShrink: 0,
  }

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: 'contain',
    imageRendering: 'pixelated',
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      {asset.isAnimated ? (
        <div style={animStyle} />
      ) : (
        <img src={asset.url} alt={asset.name} style={imgStyle} />
      )}
      {showName && (
        <span style={{ fontSize: '10px', color: '#636e8a', textAlign: 'center', maxWidth: size }}>
          {asset.name}
        </span>
      )}
      {asset.isAnimated && (
        <span style={{
          fontSize: '9px', color: '#bf5af2',
          background: 'rgba(191,90,242,0.1)',
          borderRadius: '20px', padding: '1px 6px',
        }}>
          ▶ {asset.frameCount}f
        </span>
      )}
    </div>
  )
}
