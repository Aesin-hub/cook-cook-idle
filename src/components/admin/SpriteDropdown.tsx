import { useState, useEffect } from 'react'
import { fetchAssets } from '../../lib/assetService'
import { SpritePreview } from './SpritePreview'
import { CATEGORY_LABELS } from '../../types/asset'
import type { GameAsset, AssetCategory } from '../../types/asset'

interface SpriteDropdownProps {
  category: AssetCategory
  value: string | null
  onChange: (assetId: string | null) => void
  fallbackEmoji?: string
}

export function SpriteDropdown({ category, value, onChange, fallbackEmoji }: SpriteDropdownProps) {
  const [assets, setAssets] = useState<GameAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const selectedAsset = assets.find((a) => a.id === value) ?? null

  useEffect(() => {
    fetchAssets(category)
      .then(setAssets)
      .catch(() => setAssets([]))
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '8px 12px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
          textAlign: 'left',
        }}
      >
        {selectedAsset ? (
          <SpritePreview asset={selectedAsset} size={32} />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
          }}>
            {fallbackEmoji ?? '❓'}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
            {selectedAsset?.name ?? 'Aucun sprite (emoji par défaut)'}
          </div>
          <div style={{ fontSize: '10px', color: '#636e8a' }}>
            {CATEGORY_LABELS[category]}
          </div>
        </div>
        <span style={{ color: '#636e8a', fontSize: '12px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', marginTop: '4px',
          maxHeight: '280px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false) }}
            style={{
              width: '100%', padding: '10px 12px',
              background: !value ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', flexShrink: 0,
            }}>
              {fallbackEmoji ?? '❓'}
            </div>
            <span style={{ fontSize: '12px', color: '#636e8a' }}>
              Emoji par défaut ({fallbackEmoji ?? 'aucun'})
            </span>
          </button>

          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#636e8a', fontSize: '12px' }}>
              ⏳ Chargement...
            </div>
          ) : assets.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#636e8a', fontSize: '12px' }}>
              Aucun asset dans cette catégorie.<br />
              Uploade-en dans la section Assets.
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: '8px', padding: '10px',
            }}>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => { onChange(asset.id); setOpen(false) }}
                  style={{
                    background: value === asset.id ? 'rgba(0,210,255,0.12)' : '#0d1117',
                    border: `1px solid ${value === asset.id ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '8px', padding: '8px',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  }}
                >
                  <SpritePreview asset={asset} size={40} />
                  <span style={{
                    fontSize: '9px', color: '#8b949e',
                    textAlign: 'center', lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', maxWidth: '64px',
                    display: 'block',
                  }}>
                    {asset.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
