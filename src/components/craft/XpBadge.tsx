import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../../stores/usePlayerStore'

export function XpBadge() {
  const totalXp = usePlayerStore((state) => state.classXp.artisan)
  const prevXp = useRef(totalXp)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (totalXp > prevXp.current) {
      setAnimating(true)
      const t = setTimeout(() => setAnimating(false), 600)
      prevXp.current = totalXp
      return () => clearTimeout(t)
    }
  }, [totalXp])

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: animating ? 'rgba(255,213,0,0.2)' : 'rgba(255,213,0,0.1)',
        border: `1px solid ${animating ? 'rgba(255,213,0,0.6)' : 'rgba(255,213,0,0.25)'}`,
        borderRadius: '20px',
        padding: '4px 12px',
        transition: 'all 0.3s ease',
        transform: animating ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <span style={{ fontSize: '13px' }}>⭐</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffd500' }}>
        {totalXp.toLocaleString()} XP
      </span>
    </div>
  )
}
