import { useState, useEffect, useRef } from 'react'
import { uploadAsset, fetchAssets, deleteAsset } from '../../lib/assetService'
import { SpritePreview } from '../../components/admin/SpritePreview'
import { useToast } from '../../components/shared/ToastManager'
import { CATEGORY_LABELS, SUPPORTED_FORMATS, MAX_FILE_SIZE_MB } from '../../types/asset'
import type { GameAsset, AssetCategory } from '../../types/asset'

const CATEGORIES: AssetCategory[] = ['tileset', 'resource', 'creature', 'dish', 'machine', 'effect']

export function AssetsAdmin() {
  const [assets, setAssets] = useState<GameAsset[]>([])
  const [activeCategory, setActiveCategory] = useState<AssetCategory>('tileset')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addToast = useToast()

  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [isAnimated, setIsAnimated] = useState(false)
  const [frameCount, setFrameCount] = useState(4)
  const [frameRate, setFrameRate] = useState(8)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAssets(activeCategory)
      setAssets(data)
    } catch (err: unknown) {
      addToast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeCategory])

  function handleFileSelect(file: File) {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      addToast('Format non supporté. Utilise PNG, JPG, WebP ou GIF.', 'error')
      return
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      addToast(`Fichier trop lourd (max ${MAX_FILE_SIZE_MB}MB).`, 'error')
      return
    }
    setUploadFile(file)
    setUploadPreview(URL.createObjectURL(file))
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))
    }
    if (file.type === 'image/gif') setIsAnimated(true)
  }

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) {
      addToast('Remplis le nom et sélectionne un fichier.', 'error')
      return
    }
    setUploading(true)
    try {
      await uploadAsset(uploadFile, uploadName.trim(), activeCategory, {
        isAnimated, frameCount: isAnimated ? frameCount : 1, frameRate,
      })
      addToast(`✅ "${uploadName}" uploadé !`, 'success')
      setUploadFile(null)
      setUploadPreview(null)
      setUploadName('')
      setIsAnimated(false)
      setFrameCount(4)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (err: unknown) {
      addToast((err as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(asset: GameAsset) {
    if (!confirm(`Supprimer "${asset.name}" ? Les éléments qui utilisent ce sprite reviendront à l'emoji.`)) return
    try {
      await deleteAsset(asset)
      addToast(`🗑️ "${asset.name}" supprimé.`, 'info')
      await load()
    } catch (err: unknown) {
      addToast((err as Error).message, 'error')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d1117',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '8px 10px',
    fontSize: '12px', color: '#e2e8f0', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          🖼️ Assets Visuels
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Sprites 32×32 • PNG, JPG, WebP, GIF supportés • Max {MAX_FILE_SIZE_MB}MB
        </p>
      </div>

      {/* Tabs catégories */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
              background: activeCategory === cat ? 'rgba(0,210,255,0.15)' : '#161b22',
              border: `1px solid ${activeCategory === cat ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
              fontSize: '12px', fontWeight: activeCategory === cat ? 600 : 400,
              color: activeCategory === cat ? '#00d2ff' : '#636e8a',
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Zone d'upload */}
        <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '14px' }}>
            ⬆️ Uploader un asset
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFileSelect(file)
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'rgba(0,210,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '10px', padding: '20px',
              textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(0,210,255,0.05)' : 'transparent',
              marginBottom: '12px', transition: 'all 0.2s',
            }}
          >
            {uploadPreview ? (
              <img
                src={uploadPreview}
                alt="preview"
                style={{ maxWidth: '80px', maxHeight: '80px', imageRendering: 'pixelated' }}
              />
            ) : (
              <>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🖼️</div>
                <div style={{ fontSize: '12px', color: '#636e8a' }}>Glisse un fichier ici ou clique</div>
                <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '4px' }}>
                  PNG, JPG, WebP, GIF • Max {MAX_FILE_SIZE_MB}MB
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />

          <input
            type="text"
            placeholder="Nom de l'asset..."
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            style={{ ...inputStyle, marginBottom: '10px' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#e2e8f0' }}>Sprite animé (spritesheet)</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([true, false] as const).map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setIsAnimated(val)}
                  style={{
                    padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                    background: isAnimated === val ? 'rgba(191,90,242,0.15)' : '#0d1117',
                    border: `1px solid ${isAnimated === val ? 'rgba(191,90,242,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: isAnimated === val ? '#bf5af2' : '#636e8a',
                  }}
                >
                  {val ? 'Oui' : 'Non'}
                </button>
              ))}
            </div>
          </div>

          {isAnimated && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#636e8a', display: 'block', marginBottom: '4px' }}>Nb de frames</label>
                <input type="number" min={2} max={32} value={frameCount}
                  onChange={(e) => setFrameCount(parseInt(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#636e8a', display: 'block', marginBottom: '4px' }}>FPS</label>
                <input type="number" min={1} max={30} value={frameRate}
                  onChange={(e) => setFrameRate(parseInt(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!uploadFile || !uploadName.trim() || uploading}
            style={{
              width: '100%', padding: '10px',
              background: (!uploadFile || !uploadName.trim() || uploading)
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,210,255,0.15)',
              border: `1px solid ${(!uploadFile || !uploadName.trim() || uploading)
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,210,255,0.4)'}`,
              borderRadius: '8px', cursor: 'pointer',
              color: (!uploadFile || !uploadName.trim() || uploading) ? '#4a5568' : '#00d2ff',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            {uploading ? '⏳ Upload en cours...' : '⬆️ Uploader'}
          </button>
        </div>

        {/* Liste des assets */}
        <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '14px' }}>
            {CATEGORY_LABELS[activeCategory]} — {assets.length} asset{assets.length !== 1 ? 's' : ''}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#636e8a' }}>⏳</div>
          ) : assets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#636e8a', fontSize: '12px' }}>
              Aucun asset. Upload le premier !
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: '8px', maxHeight: '400px', overflowY: 'auto',
            }}>
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    background: '#0d1117', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '8px', position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  }}
                >
                  <SpritePreview asset={asset} size={40} />
                  <span style={{
                    fontSize: '9px', color: '#8b949e', textAlign: 'center',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', width: '100%', display: 'block',
                  }}>
                    {asset.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(asset)}
                    style={{
                      position: 'absolute', top: '2px', right: '2px',
                      background: 'rgba(255,68,58,0.15)', border: 'none',
                      borderRadius: '4px', width: '16px', height: '16px',
                      cursor: 'pointer', fontSize: '9px', color: '#ff453a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
