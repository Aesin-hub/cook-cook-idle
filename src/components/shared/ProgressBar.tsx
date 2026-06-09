interface ProgressBarProps {
  value: number
  color?: string
  height?: number
  animated?: boolean
  showGlow?: boolean
}

export function ProgressBar({ value, color = '#00d2ff', height = 6, animated = false, showGlow = true }: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 1) * 100

  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: height, height, overflow: 'hidden' }}>
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: height,
          boxShadow: showGlow ? `0 0 8px ${color}80` : 'none',
          transition: animated ? 'none' : 'width 0.3s ease',
        }}
      />
    </div>
  )
}
