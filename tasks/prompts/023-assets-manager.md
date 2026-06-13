# Prompt 023 — Assets Manager (Supabase Storage + Admin Upload + Dropdowns)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 022 ont été exécutés.

Structure existante pertinente :
- `src/lib/supabase.ts` — client Supabase
- `src/lib/adminService.ts` — CRUD admin existant
- `src/pages/AdminPage.tsx` — admin panel avec sidebar
- `src/components/admin/AdminLayout.tsx` — layout admin avec sections
- Tables Supabase existantes : `game_resources`, `game_creatures`, `game_machines`,
  `game_cook_recipes`, `game_craft_recipes`, `game_map`

## Objectif
Créer le système de gestion des assets visuels du jeu :
1. Bucket Supabase Storage `game-assets` pour stocker les fichiers
2. Table `game_assets` pour référencer les assets
3. Section "Assets" dans l'admin panel (upload + prévisualisation)
4. Dropdown "Sprite" dans tous les formulaires admin existants
5. Fallback automatique sur l'emoji si aucun sprite assigné

## Décisions de game design validées
- Sprites **32×32** pixels
- Assets classés par **catégorie** : tileset / resource / creature / dish / machine / effect
- Formats supportés : **PNG, JPG, WebP, GIF**
- Sprites animés = spritesheets horizontaux (frames côte à côte)
- Détection auto de la largeur des frames : `frameWidth = imageWidth / frameCount`
- L'admin saisit uniquement : `frameCount` + `frameRate` (fps)
- **Prévisualisation animée** dans le formulaire de tuile si spritesheet
- **Fallback emoji** si aucun sprite assigné

---

## Prérequis — Supabase Storage + Script SQL

### 1. Créer le bucket dans Supabase Dashboard
Aller dans **Storage** → **New bucket**
- Nom : `game-assets`
- Public : ✅ oui (les assets doivent être accessibles publiquement)

### 2. Script SQL à exécuter
```sql
-- Table des assets visuels
CREATE TABLE game_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'tileset' | 'resource' | 'creature' | 'dish' | 'machine' | 'effect'
  format TEXT NOT NULL,    -- 'png' | 'jpg' | 'webp' | 'gif'
  width INTEGER,           -- largeur totale en pixels
  height INTEGER,          -- hauteur en pixels
  is_animated BOOLEAN DEFAULT FALSE,
  frame_count INTEGER DEFAULT 1,
  frame_rate INTEGER DEFAULT 8,  -- fps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE game_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read assets" ON game_assets FOR SELECT USING (true);
CREATE POLICY "Admin write assets" ON game_assets FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

-- Ajouter le champ sprite_id sur les tables existantes
ALTER TABLE game_resources ADD COLUMN IF NOT EXISTS sprite_id UUID REFERENCES game_assets(id);
ALTER TABLE game_creatures ADD COLUMN IF NOT EXISTS sprite_id UUID REFERENCES game_assets(id);
ALTER TABLE game_machines ADD COLUMN IF NOT EXISTS sprite_id UUID REFERENCES game_assets(id);
ALTER TABLE game_cook_recipes ADD COLUMN IF NOT EXISTS sprite_id UUID REFERENCES game_assets(id);
ALTER TABLE game_craft_recipes ADD COLUMN IF NOT EXISTS sprite_id UUID REFERENCES game_assets(id);
ALTER TABLE game_map ADD COLUMN IF NOT EXISTS sprite_id UUID REFERENCES game_assets(id);
```

### 3. Policy Storage dans Supabase
Aller dans **Storage** → **game-assets** → **Policies** → ajouter :
```sql
-- Lecture publique
CREATE POLICY "Public read game assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-assets');

-- Upload admin uniquement
CREATE POLICY "Admin upload game assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'game-assets' AND
  auth.jwt() ->> 'email' = current_setting('app.admin_email', true)
);

-- Suppression admin uniquement
CREATE POLICY "Admin delete game assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'game-assets' AND
  auth.jwt() ->> 'email' = current_setting('app.admin_email', true)
);
```

---

## Fichiers à créer / modifier

---

### `src/types/asset.ts`

```typescript
export type AssetCategory =
  | 'tileset'    // tuiles de la carte
  | 'resource'   // ressources / ingrédients
  | 'creature'   // créatures et monstres
  | 'dish'       // plats cuisinés
  | 'machine'    // machines de craft/cook
  | 'effect'     // effets de particules

export type AssetFormat = 'png' | 'jpg' | 'webp' | 'gif'

export interface GameAsset {
  id: string
  name: string
  url: string
  category: AssetCategory
  format: AssetFormat
  width: number | null
  height: number | null
  isAnimated: boolean
  frameCount: number      // nb de frames (1 si statique)
  frameRate: number       // fps (8 par défaut)
  createdAt: string
}

// Largeur d'une frame calculée automatiquement
export function getFrameWidth(asset: GameAsset): number {
  if (!asset.width || !asset.isAnimated) return asset.width ?? 32
  return Math.floor(asset.width / asset.frameCount)
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  tileset:  '🗺️ Tilesets',
  resource: '🌿 Ressources',
  creature: '🐉 Créatures',
  dish:     '🍽️ Plats',
  machine:  '⚙️ Machines',
  effect:   '✨ Effets',
}

export const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const MAX_FILE_SIZE_MB = 2
```

---

### `src/lib/assetService.ts`

```typescript
import { supabase } from './supabase'
import type { GameAsset, AssetCategory, AssetFormat } from '../types/asset'

// ─── UPLOAD ──────────────────────────────────────────────────────────────────

/**
 * Upload un fichier dans Supabase Storage + crée l'entrée dans game_assets.
 * Retourne l'asset créé.
 */
export async function uploadAsset(
  file: File,
  name: string,
  category: AssetCategory,
  options: {
    isAnimated?: boolean
    frameCount?: number
    frameRate?: number
  } = {}
): Promise<GameAsset> {
  // 1. Upload dans Storage
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${category}/${Date.now()}_${name.replace(/\s+/g, '_')}.${ext}`

  const { data: storageData, error: storageError } = await supabase.storage
    .from('game-assets')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (storageError) throw new Error(`Upload Storage : ${storageError.message}`)

  // 2. Récupérer l'URL publique
  const { data: urlData } = supabase.storage
    .from('game-assets')
    .getPublicUrl(storageData.path)

  // 3. Lire les dimensions de l'image
  const dimensions = await getImageDimensions(file)

  // 4. Créer l'entrée en base
  const format = ext as AssetFormat
  const isAnimated = options.isAnimated ?? false
  const frameCount = isAnimated ? (options.frameCount ?? 1) : 1
  const frameRate = options.frameRate ?? 8

  const { data, error } = await supabase
    .from('game_assets')
    .insert({
      name,
      url: urlData.publicUrl,
      category,
      format,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      is_animated: isAnimated,
      frame_count: frameCount,
      frame_rate: frameRate,
    })
    .select()
    .single()

  if (error) throw new Error(`Création asset : ${error.message}`)

  return mapAsset(data)
}

// ─── LECTURE ──────────────────────────────────────────────────────────────────

export async function fetchAssets(category?: AssetCategory): Promise<GameAsset[]> {
  let query = supabase.from('game_assets').select('*').order('created_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw new Error(`fetchAssets : ${error.message}`)
  return (data ?? []).map(mapAsset)
}

export async function fetchAssetById(id: string): Promise<GameAsset | null> {
  const { data } = await supabase.from('game_assets').select('*').eq('id', id).single()
  return data ? mapAsset(data) : null
}

// ─── SUPPRESSION ─────────────────────────────────────────────────────────────

export async function deleteAsset(asset: GameAsset): Promise<void> {
  // Extraire le path depuis l'URL publique
  const url = new URL(asset.url)
  const path = url.pathname.split('/game-assets/')[1]

  await supabase.storage.from('game-assets').remove([path])
  await supabase.from('game_assets').delete().eq('id', asset.id)
}

// ─── ASSIGNER UN SPRITE ───────────────────────────────────────────────────────

export async function assignSprite(
  table: string,
  elementId: string,
  assetId: string | null
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ sprite_id: assetId })
    .eq('id', elementId)
  if (error) throw new Error(`assignSprite : ${error.message}`)
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function mapAsset(row: any): GameAsset {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    category: row.category,
    format: row.format,
    width: row.width,
    height: row.height,
    isAnimated: row.is_animated,
    frameCount: row.frame_count,
    frameRate: row.frame_rate,
    createdAt: row.created_at,
  }
}

function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}
```

---

### `src/components/admin/SpritePreview.tsx`

Composant de prévisualisation d'un sprite — statique ou animé.
Utilisé dans le dropdown et dans les formulaires.

```tsx
import { useEffect, useRef, useState } from 'react'
import type { GameAsset } from '../../types/asset'
import { getFrameWidth } from '../../types/asset'

interface SpritePreviewProps {
  asset: GameAsset
  size?: number       // taille d'affichage en px (défaut: 64)
  showName?: boolean
}

export function SpritePreview({ asset, size = 64, showName = false }: SpritePreviewProps) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Animation automatique si spritesheet
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
  const frameHeight = asset.height ?? 32

  // Pour les sprites animés : on affiche via clip CSS
  const style = asset.isAnimated ? {
    width: size,
    height: size,
    backgroundImage: `url(${asset.url})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${currentFrame * frameWidth * (size / frameWidth)}px 0px`,
    backgroundSize: `${asset.frameCount * size}px ${size}px`,
    imageRendering: 'pixelated' as const,
  } : {
    width: size,
    height: size,
    objectFit: 'contain' as const,
    imageRendering: 'pixelated' as const,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      {asset.isAnimated ? (
        <div style={style} />
      ) : (
        <img src={asset.url} alt={asset.name} style={style} />
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
```

---

### `src/components/admin/SpriteDropdown.tsx`

Dropdown de sélection de sprite filtré par catégorie.
Affiche une miniature de chaque asset. Pour les tilesets animés,
la miniature joue l'animation en direct.

```tsx
import { useState, useEffect } from 'react'
import { fetchAssets } from '../../lib/assetService'
import { SpritePreview } from './SpritePreview'
import { CATEGORY_LABELS } from '../../types/asset'
import type { GameAsset, AssetCategory } from '../../types/asset'

interface SpriteDropdownProps {
  category: AssetCategory
  value: string | null          // id de l'asset sélectionné
  onChange: (assetId: string | null) => void
  fallbackEmoji?: string        // emoji affiché si aucun sprite
}

export function SpriteDropdown({
  category, value, onChange, fallbackEmoji
}: SpriteDropdownProps) {
  const [assets, setAssets] = useState<GameAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const selectedAsset = assets.find((a) => a.id === value) ?? null

  useEffect(() => {
    fetchAssets(category)
      .then(setAssets)
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div style={{ position: 'relative' }}>
      {/* Bouton principal */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '8px 12px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
          textAlign: 'left',
        }}
      >
        {/* Prévisualisation du sprite sélectionné */}
        {selectedAsset ? (
          <SpritePreview asset={selectedAsset} size={32} />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px',
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

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', marginTop: '4px',
          maxHeight: '280px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {/* Option "aucun sprite" */}
          <button
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
              fontSize: '18px',
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
              Uploads-en dans la section Assets.
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: '8px', padding: '10px',
            }}>
              {assets.map((asset) => (
                <button
                  key={asset.id}
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
```

---

### `src/pages/admin/AssetsAdmin.tsx`

Section admin principale pour gérer les assets.

```tsx
import { useState, useEffect, useRef } from 'react'
import { uploadAsset, fetchAssets, deleteAsset } from '../../lib/assetService'
import { SpritePreview } from '../../components/admin/SpritePreview'
import { useToast } from '../../components/shared/ToastManager'
import {
  CATEGORY_LABELS, SUPPORTED_FORMATS, MAX_FILE_SIZE_MB
} from '../../types/asset'
import type { GameAsset, AssetCategory } from '../../types/asset'

const CATEGORIES: AssetCategory[] = [
  'tileset', 'resource', 'creature', 'dish', 'machine', 'effect'
]

export function AssetsAdmin() {
  const [assets, setAssets] = useState<GameAsset[]>([])
  const [activeCategory, setActiveCategory] = useState<AssetCategory>('tileset')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addToast = useToast()

  // Formulaire d'upload
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
    } catch (err: any) {
      addToast(err.message, 'error')
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
    // Auto-remplir le nom depuis le filename
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))
    }
    // Détecter si GIF → probablement animé
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
      await load()
    } catch (err: any) {
      addToast(err.message, 'error')
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
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          🖼️ Assets Visuels
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Sprites 32×32 • PNG, JPG, WebP, GIF supportés
        </p>
      </div>

      {/* Tabs catégories */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
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
            <span style={{ marginLeft: '6px', opacity: 0.6 }}>
              ({assets.filter ? '' : '…'})
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Zone d'upload */}
        <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '14px' }}>
            ⬆️ Uploader un asset
          </div>

          {/* Drag & drop */}
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
                <div style={{ fontSize: '12px', color: '#636e8a' }}>
                  Glisse un fichier ici ou clique
                </div>
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

          {/* Nom */}
          <input
            type="text"
            placeholder="Nom de l'asset..."
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            style={{
              width: '100%', background: '#0d1117',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', padding: '8px 10px',
              fontSize: '12px', color: '#e2e8f0', outline: 'none',
              boxSizing: 'border-box', marginBottom: '10px',
            }}
          />

          {/* Sprite animé */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#e2e8f0' }}>Sprite animé (spritesheet)</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[true, false].map((val) => (
                <button
                  key={String(val)}
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
                <label style={{ fontSize: '10px', color: '#636e8a', display: 'block', marginBottom: '4px' }}>
                  Nb de frames
                </label>
                <input
                  type="number" min={2} max={32} value={frameCount}
                  onChange={(e) => setFrameCount(parseInt(e.target.value))}
                  style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#636e8a', display: 'block', marginBottom: '4px' }}>
                  FPS
                </label>
                <input
                  type="number" min={1} max={30} value={frameRate}
                  onChange={(e) => setFrameRate(parseInt(e.target.value))}
                  style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          <button
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
            {CATEGORY_LABELS[activeCategory]} — {assets.length} asset{assets.length > 1 ? 's' : ''}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#636e8a' }}>⏳</div>
          ) : assets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#636e8a', fontSize: '12px' }}>
              Aucun asset. Upload le premier !
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: '8px',
              maxHeight: '400px', overflowY: 'auto',
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
                    whiteSpace: 'nowrap', width: '100%',
                  }}>
                    {asset.name}
                  </span>
                  <button
                    onClick={() => handleDelete(asset)}
                    style={{
                      position: 'absolute', top: '2px', right: '2px',
                      background: 'rgba(255,68,58,0.15)',
                      border: 'none', borderRadius: '4px',
                      width: '16px', height: '16px',
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
```

---

### Mise à jour `src/pages/AdminPage.tsx`

Ajouter la section Assets dans la sidebar.

```tsx
// Ajouter dans SECTIONS (en premier) :
{ id: 'assets', label: 'Assets', emoji: '🖼️' },

// Ajouter l'import :
import { AssetsAdmin } from './admin/AssetsAdmin'

// Ajouter dans le switch :
case 'assets': return <AssetsAdmin />
```

---

### Mise à jour des formulaires existants

Ajouter `SpriteDropdown` dans chaque formulaire admin.

**Dans `ResourcesAdmin.tsx`** — ajouter après le champ tooltip :
```tsx
import { SpriteDropdown } from '../../components/admin/SpriteDropdown'

// Dans le state du formulaire :
const [spriteId, setSpriteId] = useState<string | null>(item?.sprite_id ?? null)

// Dans le JSX, avant les boutons :
<div style={sectionStyle}>
  <label style={labelStyle}>Sprite (optionnel)</label>
  <SpriteDropdown
    category="resource"
    value={spriteId}
    onChange={setSpriteId}
    fallbackEmoji={form.emoji}
  />
</div>

// Dans handleSave, inclure sprite_id :
await upsertEntry('game_resources', values.id, { ...values, sprite_id: spriteId })
```

**Même pattern pour :**
- `CreaturesAdmin.tsx` → category="creature"
- `CookRecipesAdmin.tsx` → category="dish"
- `CraftRecipesAdmin.tsx` → category="resource"
- `MachinesAdmin.tsx` → category="machine"
- `TileForm.tsx` → category="tileset" + prévisualisation animée en direct

---

### Mise à jour `src/stores/useGameDataStore.ts`

Charger les sprites assignés avec les données de jeu.

```typescript
// Enrichir loadFromSupabase() pour joindre les sprites :
// Pour chaque ressource, créature, etc., récupérer aussi le sprite_id
// et l'URL correspondante depuis game_assets

// Ajouter une query jointe pour les ressources :
const { data: resourcesWithSprites } = await supabase
  .from('game_resources')
  .select('data, sprite_id, game_assets(url, is_animated, frame_count, frame_rate, width)')

// Enrichir les données avec les infos sprite :
const resources = resourcesWithSprites?.map((r) => ({
  ...r.data,
  sprite: r.game_assets ?? null,
})) ?? []
```

---

## Critères de succès

### Supabase Storage
- [ ] Bucket `game-assets` créé et public
- [ ] Les policies Storage permettent la lecture publique
- [ ] L'upload admin fonctionne (token JWT vérifié)

### Section Assets admin
- [ ] La section "🖼️ Assets" apparaît en premier dans la sidebar
- [ ] Drag & drop d'un PNG → prévisualisation immédiate
- [ ] Clic sur la zone → sélecteur de fichier
- [ ] Upload PNG statique → apparaît dans la grille
- [ ] Upload spritesheet animé (4 frames) → badge "▶ 4f" visible
- [ ] La prévisualisation animée joue correctement dans la grille
- [ ] Supprimer un asset → disparaît de la liste

### SpriteDropdown dans les formulaires
- [ ] Formulaire Ressource → dropdown "Sprite" avec catégorie "resource"
- [ ] Dropdown vide → message "Aucun asset, uploadez-en"
- [ ] Sélectionner un sprite → miniature visible dans le bouton
- [ ] Sélectionner "Emoji par défaut" → sprite_id = null
- [ ] Pour les tilesets → animation joue dans le dropdown

### Données enrichies
- [ ] `useGameDataStore` charge les sprites avec les ressources
- [ ] `resource.sprite.url` accessible dans les composants React
- [ ] Si `sprite === null` → fallback sur l'emoji existant

## Notes pour la suite
- Le prompt 024 (Phaser de base) utilisera `asset.url` pour charger les textures
- `getFrameWidth(asset)` est la fonction clé pour Phaser : elle calcule automatiquement
  la taille d'une frame depuis la largeur totale et le nombre de frames
- Les emojis restent dans toutes les données — ils servent de fallback permanent
  même quand Phaser est intégré
