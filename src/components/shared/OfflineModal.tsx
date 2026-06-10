import type { OfflineProgressDisplay } from '../../hooks/useOfflineProgress'

interface OfflineModalProps {
  progress: OfflineProgressDisplay
}

export function OfflineModal({ progress }: OfflineModalProps) {
  const hasHarvest = progress.yieldsDisplay.length > 0
  const hasCook = progress.cookResultsDisplay.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#161b22',
        border: '1px solid rgba(0,210,255,0.2)',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 0 40px rgba(0,210,255,0.1)',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⛺</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            Tes équipes ont bien travaillé !
          </h2>
          <p style={{ fontSize: '13px', color: '#636e8a', margin: '4px 0 0' }}>
            Absent pendant {progress.elapsedLabel}
            {progress.cappedAt8h && <span style={{ color: '#ffd500' }}> · plafonné à 8h</span>}
          </p>
        </div>

        {/* Récolte */}
        {hasHarvest && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: '#00d2ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              ⛺ Récolte
            </div>
            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {progress.yieldsDisplay.map((y) => (
                <div key={y.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#8b949e' }}>{y.emoji} {y.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#00d2ff' }}>+{y.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cook */}
        {hasCook && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', color: '#ff9500', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              🍳 Cuisine
            </div>
            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {progress.cookResultsDisplay.map((r) => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#8b949e' }}>{r.emoji} {r.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#ff9500' }}>+{r.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={progress.dismiss}
          style={{
            width: '100%', padding: '12px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '10px', color: '#00d2ff',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Super, merci ! 🎉
        </button>
      </div>
    </div>
  )
}
