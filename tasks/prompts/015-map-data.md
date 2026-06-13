# Prompt 015 — Données carte + Créatures + Interface admin carte

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 014 ont été exécutés.

Structure existante pertinente :
- `src/types/map.ts` — `TileCoord`, `TileRarity`, `TileDifficulty`, `TileBiome`,
  `TileCulture`, `MAP_SIZE`, `MAP_CENTER`, fonctions utilitaires
- `src/lib/supabase.ts` — client Supabase
- `src/lib/adminService.ts` — `fetchAll`, `upsertEntry`, `deleteEntry`
- `src/stores/useGameDataStore.ts` — chargement données depuis Supabase
- `src/pages/AdminPage.tsx` + `src/components/admin/` — admin panel existant
- `src/data/index.ts` — exports centralisés

## Objectif
1. Créer la table Supabase `game_creatures` + enrichir `game_resources`
2. Créer la table `game_map` (tuiles statiques) + `save_map` (état joueur)
3. Ajouter la section **Créatures** dans l'admin panel (CRUD complet)
4. Ajouter l'interface **admin carte** (grille 31×31 cliquable + formulaire filtré)
5. Créer les types TypeScript correspondants

---

## Prérequis — Script SQL à exécuter dans Supabase

```sql
-- Table des créatures
CREATE TABLE game_creatures (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table de la carte (tuiles statiques — une ligne par tuile)
CREATE TABLE game_map (
  id TEXT PRIMARY KEY,        -- format: "x_y" ex: "15_15"
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sauvegarde de l'état de la carte par joueur
CREATE TABLE save_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  discovered_tiles JSONB NOT NULL DEFAULT '[]',  -- liste de "x_y" découvertes
  explored_tiles JSONB NOT NULL DEFAULT '[]',    -- liste de "x_y" explorées
  tile_quotas JSONB NOT NULL DEFAULT '{}',       -- { "x_y": { remaining, resetAt } }
  captured_familiars JSONB NOT NULL DEFAULT '[]',-- liste d'ids de créatures capturées
  active_familiar TEXT,                          -- id créature familier actif
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX game_map_coords ON game_map(x, y);
CREATE INDEX save_map_user ON save_map(user_id);

-- RLS
ALTER TABLE game_creatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read creatures" ON game_creatures FOR SELECT USING (true);
CREATE POLICY "Public read map" ON game_map FOR SELECT USING (true);
CREATE POLICY "Admin write creatures" ON game_creatures FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
CREATE POLICY "Admin write map" ON game_map FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
CREATE POLICY "Users manage own map save" ON save_map FOR ALL
  USING (auth.uid() = user_id);
```

---

## Fichiers à créer / modifier

---

### `src/types/creature.ts`

```typescript
import type { TileBiome, TileCulture, TileDifficulty } from './map'

// Drop d'une créature
export interface CreatureDrop {
  resourceId: string
  chance: number        // 0 à 1 (ex: 0.8 = 80%)
  minAmount: number
  maxAmount: number
}

// Taux de succès de chasse selon le niveau Chasseur
export interface HuntSuccessEntry {
  chasseurLevel: number  // niveau Chasseur requis
  successRate: number    // 0 à 1
}

// Bonus de familier
export interface FamiliarBonus {
  resourceId: string     // ressource produite passivement
  amountPerMin: number   // quantité produite par minute
}

// Définition complète d'une créature
export interface Creature {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  rarityLabel: string

  // Compatibilité tuile
  compatibleBiomes: TileBiome[]
  compatibleCultures: TileCulture[]

  // Combat
  difficulty: TileDifficulty          // impacte la difficulté de la tuile
  isBoss: boolean
  bossRespawnHoursMin: number         // durée min sur la tuile (si boss)
  bossRespawnHoursMax: number         // durée max sur la tuile (si boss)
  huntSuccessRate: HuntSuccessEntry[] // table de succès par niveau Chasseur
  captureChance: number               // 0 à 1 (10% = 0.1)

  // XP
  xpOnSuccess: number                 // XP Chasseur si succès
  xpOnFailure: number                 // XP Chasseur si échec (20% du succès)

  // Drops
  dropResources: CreatureDrop[]

  // Familier
  isFamiliar: boolean                 // peut-elle être capturée comme familier ?
  familiarBonus: FamiliarBonus | null // bonus si familier actif

  // Messages
  successMessages: string[]           // messages aléatoires en cas de succès
  failMessages: string[]              // messages aléatoires en cas d'échec
}
```

---

### `src/types/tile.ts`

```typescript
import type {
  TileCoord, TileRarity, TileDifficulty, TileBiome, TileCulture
} from './map'

// Type spécial d'une tuile
export type TileSpecialType = 'ruins' | 'boss_zone' | 'village' | null

// Ressource disponible sur une tuile
export interface TileResource {
  resourceId: string
  dailyQuota: number      // quantité max récoltable par expédition/jour
}

// Données STATIQUES d'une tuile (définies par l'admin, ne changent jamais)
export interface TileStatic {
  id: string              // format "x_y"
  x: number
  y: number
  rarity: TileRarity
  difficulty: TileDifficulty
  biome: TileBiome
  culture: TileCulture
  specialType: TileSpecialType
  resources: TileResource[]   // ressources disponibles sur cette tuile
  creatureId: string | null   // créature présente (ou null)
  isEnabled: boolean          // false = tuile désactivée (pas encore créée)
}

// Données DYNAMIQUES d'une tuile (état joueur, changent en cours de jeu)
export interface TileDynamic {
  tileId: string          // référence à TileStatic.id
  discoveryState: 'hidden' | 'revealed' | 'explored'
  quotaRemaining: number  // quota journalier restant
  quotaResetAt: number    // timestamp de la prochaine réinitialisation
  familiarCaptured: boolean // le familier de cette tuile a-t-il été capturé ?
}

// Tuile complète (statique + dynamique combinés pour l'UI)
export interface TileFull extends TileStatic {
  dynamic: TileDynamic
}

// Couleurs d'affichage par rareté (cohérent avec le design system)
export const TILE_RARITY_COLORS: Record<TileRarity, string> = {
  common:    '#636e8a',
  uncommon:  '#30d158',
  rare:      '#00d2ff',
  epic:      '#bf5af2',
  legendary: '#ff9500',
}

// Labels français
export const TILE_RARITY_LABELS: Record<TileRarity, string> = {
  common:    'Commun',
  uncommon:  'Peu commun',
  rare:      'Rare',
  epic:      'Épique',
  legendary: 'Légendaire',
}

export const TILE_BIOME_LABELS: Record<TileBiome, string> = {
  forest:  'Forêt',
  cave:    'Caverne',
  swamp:   'Marais',
  plain:   'Plaine',
  mountain:'Montagne',
  desert:  'Désert',
  volcano: 'Volcan',
  ruins:   'Ruines',
  village: 'Village',
  empty:   'Terrain vide',
}

export const TILE_CULTURE_LABELS: Record<TileCulture, string> = {
  center: 'Neutre',
  north:  'Nordique',
  east:   'Asiatique',
  south:  'Arabe / Africain',
  west:   'Celtique / Médiéval',
}
```

---

### `src/lib/mapAdminService.ts`

Service dédié aux opérations admin sur la carte et les créatures.

```typescript
import { supabase } from './supabase'
import type { TileStatic } from '../types/tile'
import type { Creature } from '../types/creature'

// ─── CARTE ────────────────────────────────────────────────────────────────────

/**
 * Charge toutes les tuiles de la carte depuis Supabase.
 * Retourne un Record<tileId, TileStatic> pour accès O(1).
 */
export async function loadMapTiles(): Promise<Record<string, TileStatic>> {
  const { data, error } = await supabase
    .from('game_map')
    .select('id, x, y, data')
    .order('id')

  if (error) throw new Error(`[MapAdmin] loadMapTiles: ${error.message}`)

  const result: Record<string, TileStatic> = {}
  for (const row of data ?? []) {
    result[row.id] = { ...row.data, id: row.id, x: row.x, y: row.y }
  }
  return result
}

/**
 * Sauvegarde une tuile (création ou mise à jour).
 */
export async function saveTile(tile: TileStatic): Promise<void> {
  const { error } = await supabase
    .from('game_map')
    .upsert(
      { id: tile.id, x: tile.x, y: tile.y, data: tile, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  if (error) throw new Error(`[MapAdmin] saveTile: ${error.message}`)
}

/**
 * Vide une tuile (la remet à l'état "terrain vide").
 */
export async function clearTile(tileId: string, x: number, y: number): Promise<void> {
  const emptyTile: TileStatic = {
    id: tileId, x, y,
    rarity: 'common', difficulty: 1,
    biome: 'empty', culture: 'center',
    specialType: null, resources: [],
    creatureId: null, isEnabled: false,
  }
  await saveTile(emptyTile)
}

// ─── CRÉATURES ────────────────────────────────────────────────────────────────

export async function loadCreatures(): Promise<Creature[]> {
  const { data, error } = await supabase
    .from('game_creatures')
    .select('data')
    .order('id')
  if (error) throw new Error(`[MapAdmin] loadCreatures: ${error.message}`)
  return (data ?? []).map((r) => r.data as Creature)
}

export async function saveCreature(creature: Creature): Promise<void> {
  const { error } = await supabase
    .from('game_creatures')
    .upsert(
      { id: creature.id, data: creature, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  if (error) throw new Error(`[MapAdmin] saveCreature: ${error.message}`)
}

export async function deleteCreature(id: string): Promise<void> {
  const { error } = await supabase.from('game_creatures').delete().eq('id', id)
  if (error) throw new Error(`[MapAdmin] deleteCreature: ${error.message}`)
}
```

---

### `src/pages/admin/MapAdmin.tsx`

Interface admin de la carte — grille 31×31 cliquable + formulaire filtré.

```tsx
import { useState, useEffect, useCallback } from 'react'
import { loadMapTiles, saveTile, clearTile, loadCreatures } from '../../lib/mapAdminService'
import { fetchAll } from '../../lib/adminService'
import { useToast } from '../../components/shared/ToastManager'
import {
  MAP_SIZE, MAP_CENTER,
  type TileBiome, type TileCulture, type TileRarity, type TileDifficulty
} from '../../types/map'
import {
  TILE_RARITY_COLORS, TILE_RARITY_LABELS,
  TILE_BIOME_LABELS, TILE_CULTURE_LABELS,
  type TileStatic, type TileResource
} from '../../types/tile'
import type { Creature } from '../../types/creature'
import type { Resource } from '../../types/game'

const TILE_SIZE = 20  // px par tuile dans la grille

export function MapAdmin() {
  const [tiles, setTiles] = useState<Record<string, TileStatic>>({})
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedTile, setSelectedTile] = useState<TileStatic | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const addToast = useToast()

  // Charger les données
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [tilesData, creaturesData, resourcesData] = await Promise.all([
          loadMapTiles(),
          loadCreatures(),
          fetchAll<Resource>('game_resources'),
        ])
        setTiles(tilesData)
        setCreatures(creaturesData)
        setResources(resourcesData)
      } catch (err: any) {
        addToast(err.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Sélectionner une tuile ou créer une tuile vide
  function handleTileClick(x: number, y: number) {
    const tileId = `${x}_${y}`
    const existing = tiles[tileId]
    if (existing) {
      setSelectedTile(existing)
    } else {
      // Tuile non encore créée → formulaire vide
      setSelectedTile({
        id: tileId, x, y,
        rarity: 'common', difficulty: 1,
        biome: 'empty', culture: 'center',
        specialType: null, resources: [],
        creatureId: null, isEnabled: false,
      })
    }
  }

  // Sauvegarder la tuile éditée
  async function handleSaveTile(tile: TileStatic) {
    setSaving(true)
    try {
      await saveTile(tile)
      setTiles((prev) => ({ ...prev, [tile.id]: tile }))
      setSelectedTile(tile)
      addToast(`✅ Tuile (${tile.x}, ${tile.y}) sauvegardée !`, 'success')
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Vider une tuile
  async function handleClearTile(tile: TileStatic) {
    if (!confirm(`Vider la tuile (${tile.x}, ${tile.y}) ?`)) return
    setSaving(true)
    try {
      await clearTile(tile.id, tile.x, tile.y)
      setTiles((prev) => ({
        ...prev,
        [tile.id]: { ...tile, isEnabled: false, resources: [], creatureId: null },
      }))
      setSelectedTile(null)
      addToast('Tuile vidée.', 'info')
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>
        ⏳ Chargement de la carte...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 80px)' }}>

      {/* Grille de la carte */}
      <div style={{ flex: 1, overflowAuto: 'auto' }}>
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            🗺️ Carte 31×31
          </h1>
          <div style={{ fontSize: '12px', color: '#636e8a' }}>
            {Object.values(tiles).filter((t) => t.isEnabled).length} / 961 tuiles configurées
          </div>
        </div>

        {/* Légende des raretés */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {(Object.entries(TILE_RARITY_COLORS) as [TileRarity, string][]).map(([rarity, color]) => (
            <div key={rarity} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: color }} />
              <span style={{ fontSize: '11px', color: '#636e8a' }}>{TILE_RARITY_LABELS[rarity]}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#161b22', border: '1px solid rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '11px', color: '#636e8a' }}>Vide</span>
          </div>
        </div>

        {/* Grille */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${MAP_SIZE}, ${TILE_SIZE}px)`,
            gap: '1px',
            background: 'rgba(255,255,255,0.04)',
            padding: '1px',
            borderRadius: '8px',
            width: 'fit-content',
          }}
        >
          {Array.from({ length: MAP_SIZE }, (_, y) =>
            Array.from({ length: MAP_SIZE }, (_, x) => {
              const tileId = `${x}_${y}`
              const tile = tiles[tileId]
              const isSelected = selectedTile?.id === tileId
              const isCenter = x === MAP_CENTER.x && y === MAP_CENTER.y
              const bgColor = tile?.isEnabled
                ? TILE_RARITY_COLORS[tile.rarity]
                : '#0d1117'

              return (
                <div
                  key={tileId}
                  onClick={() => handleTileClick(x, y)}
                  title={tile?.isEnabled
                    ? `(${x},${y}) ${TILE_RARITY_LABELS[tile.rarity]} — ${TILE_BIOME_LABELS[tile.biome]}`
                    : `(${x},${y}) Vide`
                  }
                  style={{
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    background: isSelected
                      ? '#ffffff'
                      : isCenter
                      ? '#ffd500'
                      : bgColor,
                    cursor: 'pointer',
                    opacity: tile?.isEnabled ? 0.85 : 0.3,
                    transition: 'all 0.1s ease',
                    border: isSelected ? '1px solid #ffffff' : 'none',
                  }}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Panneau de formulaire */}
      <div
        style={{
          width: '340px',
          flexShrink: 0,
          background: '#161b22',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto',
          padding: selectedTile ? '16px' : '0',
        }}
      >
        {!selectedTile ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#636e8a', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            Clique sur une tuile pour la configurer
          </div>
        ) : (
          <TileForm
            tile={selectedTile}
            creatures={creatures}
            resources={resources}
            saving={saving}
            onSave={handleSaveTile}
            onClear={handleClearTile}
            onClose={() => setSelectedTile(null)}
          />
        )}
      </div>
    </div>
  )
}
```

---

### `src/pages/admin/TileForm.tsx`

Formulaire intelligent pour éditer une tuile.
Les dropdowns ressources et créatures sont filtrés selon le biome et la culture sélectionnés.

```tsx
import { useState, useEffect } from 'react'
import type { TileStatic, TileResource } from '../../types/tile'
import type { Creature } from '../../types/creature'
import type { Resource } from '../../types/game'
import {
  TILE_RARITY_LABELS, TILE_BIOME_LABELS, TILE_CULTURE_LABELS
} from '../../types/tile'
import type { TileRarity, TileBiome, TileCulture, TileDifficulty } from '../../types/map'

interface TileFormProps {
  tile: TileStatic
  creatures: Creature[]
  resources: Resource[]
  saving: boolean
  onSave: (tile: TileStatic) => void
  onClear: (tile: TileStatic) => void
  onClose: () => void
}

export function TileForm({
  tile, creatures, resources, saving, onSave, onClear, onClose
}: TileFormProps) {
  const [form, setForm] = useState<TileStatic>(tile)

  useEffect(() => { setForm(tile) }, [tile.id])

  function update<K extends keyof TileStatic>(key: K, value: TileStatic[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Filtrer les créatures compatibles avec le biome + culture sélectionnés
  const compatibleCreatures = creatures.filter((c) =>
    c.compatibleBiomes.includes(form.biome) &&
    c.compatibleCultures.includes(form.culture)
  )

  // Filtrer les ressources compatibles
  const compatibleResources = resources.filter((r) => {
    // Mapping biome → regionId pour filtrer les ressources existantes
    const biomeToRegion: Record<TileBiome, string[]> = {
      forest:   ['foret'],
      cave:     ['caverne'],
      swamp:    ['marais'],
      plain:    ['plaine'],
      mountain: ['caverne'],
      desert:   ['plaine'],
      volcano:  ['caverne'],
      ruins:    ['foret', 'caverne', 'marais', 'plaine'],
      village:  ['plaine'],
      empty:    [],
    }
    return biomeToRegion[form.biome]?.includes(r.region) ?? false
  })

  // Quand on sélectionne une créature, auto-remplir la difficulté
  function handleCreatureSelect(creatureId: string) {
    const creature = creatures.find((c) => c.id === creatureId)
    update('creatureId', creatureId)
    if (creature) {
      update('difficulty', creature.difficulty)
    }
  }

  // Ajouter une ressource à la liste
  function addResource(resourceId: string) {
    if (form.resources.find((r) => r.resourceId === resourceId)) return
    update('resources', [...form.resources, { resourceId, dailyQuota: 100 }])
  }

  // Modifier le quota d'une ressource
  function updateQuota(resourceId: string, quota: number) {
    update('resources', form.resources.map((r) =>
      r.resourceId === resourceId ? { ...r, dailyQuota: quota } : r
    ))
  }

  // Supprimer une ressource
  function removeResource(resourceId: string) {
    update('resources', form.resources.filter((r) => r.resourceId !== resourceId))
  }

  const inputStyle = {
    width: '100%', background: '#0d1117',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '7px 10px',
    fontSize: '12px', color: '#e2e8f0',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    fontSize: '11px', color: '#636e8a',
    display: 'block', marginBottom: '4px',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  }

  const sectionStyle = { marginBottom: '14px' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>
            Tuile ({form.x}, {form.y})
          </div>
          <div style={{ fontSize: '11px', color: '#636e8a' }}>
            {form.x === 15 && form.y === 15 ? '⭐ Case de départ' : `Distance centre : ${Math.abs(form.x - 15) + Math.abs(form.y - 15)}`}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#636e8a', cursor: 'pointer', fontSize: '16px' }}>✕</button>
      </div>

      {/* Activée */}
      <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: '#e2e8f0' }}>Tuile activée</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[true, false].map((val) => (
            <button key={String(val)} onClick={() => update('isEnabled', val)}
              style={{
                padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                background: form.isEnabled === val ? 'rgba(0,210,255,0.15)' : '#0d1117',
                border: `1px solid ${form.isEnabled === val ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: form.isEnabled === val ? '#00d2ff' : '#636e8a',
              }}
            >{val ? 'Oui' : 'Non'}</button>
          ))}
        </div>
      </div>

      {/* Rareté */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Rareté</label>
        <select value={form.rarity} onChange={(e) => update('rarity', e.target.value as TileRarity)} style={inputStyle}>
          {Object.entries(TILE_RARITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Difficulté */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Difficulté</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {([1, 2, 3] as TileDifficulty[]).map((d) => (
            <button key={d} onClick={() => update('difficulty', d)}
              style={{
                flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                background: form.difficulty === d ? 'rgba(255,213,0,0.15)' : '#0d1117',
                border: `1px solid ${form.difficulty === d ? 'rgba(255,213,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: form.difficulty === d ? '#ffd500' : '#636e8a',
              }}
            >{'⭐'.repeat(d)}</button>
          ))}
        </div>
      </div>

      {/* Biome */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Biome</label>
        <select value={form.biome} onChange={(e) => update('biome', e.target.value as TileBiome)} style={inputStyle}>
          {Object.entries(TILE_BIOME_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Culture */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Culture</label>
        <select value={form.culture} onChange={(e) => update('culture', e.target.value as TileCulture)} style={inputStyle}>
          {Object.entries(TILE_CULTURE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Créature */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Créature ({compatibleCreatures.length} compatibles)
        </label>
        <select
          value={form.creatureId ?? ''}
          onChange={(e) => handleCreatureSelect(e.target.value)}
          style={inputStyle}
        >
          <option value="">— Aucune créature —</option>
          {compatibleCreatures.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name} ({c.rarity}{c.isBoss ? ' — BOSS' : ''})
            </option>
          ))}
        </select>
        {form.biome !== 'empty' && compatibleCreatures.length === 0 && (
          <div style={{ fontSize: '11px', color: '#ff453a', marginTop: '4px' }}>
            Aucune créature compatible. Ajoute-en dans la section Créatures.
          </div>
        )}
        {form.creatureId && (
          <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '4px' }}>
            ⚠️ La difficulté a été mise à jour selon la créature.
          </div>
        )}
      </div>

      {/* Ressources */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Ressources ({form.resources.length} assignées)
        </label>

        {/* Ressources déjà assignées */}
        {form.resources.map((tr) => {
          const res = resources.find((r) => r.id === tr.resourceId)
          return (
            <div key={tr.resourceId} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#0d1117', borderRadius: '6px',
              padding: '6px 8px', marginBottom: '4px',
            }}>
              <span style={{ fontSize: '14px' }}>{res?.emoji ?? '📦'}</span>
              <span style={{ fontSize: '12px', color: '#e2e8f0', flex: 1 }}>{res?.name ?? tr.resourceId}</span>
              <input
                type="number"
                value={tr.dailyQuota}
                onChange={(e) => updateQuota(tr.resourceId, parseInt(e.target.value))}
                title="Quota journalier"
                style={{ ...inputStyle, width: '60px', padding: '4px 6px', textAlign: 'center' }}
              />
              <span style={{ fontSize: '10px', color: '#636e8a' }}>/jour</span>
              <button onClick={() => removeResource(tr.resourceId)}
                style={{ background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer', fontSize: '14px' }}>
                ✕
              </button>
            </div>
          )
        })}

        {/* Ajouter une ressource */}
        <select
          value=""
          onChange={(e) => e.target.value && addResource(e.target.value)}
          style={{ ...inputStyle, marginTop: '4px' }}
        >
          <option value="">+ Ajouter une ressource...</option>
          {compatibleResources
            .filter((r) => !form.resources.find((tr) => tr.resourceId === r.id))
            .map((r) => (
              <option key={r.id} value={r.id}>{r.emoji} {r.name} ({r.rarityLabel})</option>
            ))}
        </select>
        {form.biome !== 'empty' && compatibleResources.length === 0 && (
          <div style={{ fontSize: '11px', color: '#ff453a', marginTop: '4px' }}>
            Aucune ressource compatible. Ajoute-en dans la section Ressources.
          </div>
        )}
      </div>

      {/* Type spécial */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Type spécial</label>
        <select
          value={form.specialType ?? ''}
          onChange={(e) => update('specialType', (e.target.value || null) as any)}
          style={inputStyle}
        >
          <option value="">— Aucun —</option>
          <option value="ruins">🏚️ Ruines</option>
          <option value="boss_zone">💀 Zone de boss</option>
          <option value="village">🏘️ Village</option>
        </select>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button
          onClick={() => onClear(form)}
          style={{
            padding: '8px 12px', background: 'rgba(255,68,58,0.08)',
            border: '1px solid rgba(255,68,58,0.2)',
            borderRadius: '8px', color: '#ff453a',
            fontSize: '12px', cursor: 'pointer',
          }}
        >
          Vider
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          style={{
            flex: 1, padding: '8px',
            background: saving ? 'rgba(255,255,255,0.04)' : 'rgba(0,210,255,0.15)',
            border: `1px solid ${saving ? 'rgba(255,255,255,0.08)' : 'rgba(0,210,255,0.4)'}`,
            borderRadius: '8px',
            color: saving ? '#4a5568' : '#00d2ff',
            fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '⏳ Sauvegarde...' : '✅ Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
```

---

### `src/pages/admin/CreaturesAdmin.tsx`

Section admin CRUD pour les créatures.
Suit exactement le même pattern que `ResourcesAdmin.tsx`.

```tsx
// Créer ce fichier sur le modèle exact de ResourcesAdmin.tsx
// avec les champs suivants :

const CREATURE_FIELDS = [
  { key: 'id',            label: 'ID (snake_case)',     type: 'text',     required: true },
  { key: 'name',          label: 'Nom affiché',          type: 'text',     required: true },
  { key: 'emoji',         label: 'Emoji',               type: 'text',     required: true },
  { key: 'description',   label: 'Description',         type: 'textarea', required: true },
  { key: 'tooltip',       label: 'Tooltip',             type: 'textarea', required: true },
  { key: 'rarity',        label: 'Rareté',              type: 'select',   required: true,
    options: [
      { value: 'common',    label: 'Commun' },
      { value: 'uncommon',  label: 'Peu commun' },
      { value: 'rare',      label: 'Rare' },
      { value: 'epic',      label: 'Épique' },
      { value: 'legendary', label: 'Légendaire' },
    ]
  },
  { key: 'difficulty',    label: 'Difficulté (1-3)',    type: 'number',   required: true },
  { key: 'isBoss',        label: 'Est un boss ?',       type: 'boolean',  required: true },
  { key: 'isFamiliar',    label: 'Peut être familier ?',type: 'boolean',  required: true },
  { key: 'captureChance', label: 'Chance capture (0-1)',type: 'number',   required: true },
  { key: 'xpOnSuccess',   label: 'XP si succès',        type: 'number',   required: true },
  { key: 'xpOnFailure',   label: 'XP si échec (auto 20%)', type: 'number', required: false },
  // Champs complexes en textarea JSON
  { key: 'compatibleBiomes',   label: 'Biomes compatibles (JSON)',   type: 'textarea', required: true,
    placeholder: '["forest","swamp"]' },
  { key: 'compatibleCultures', label: 'Cultures compatibles (JSON)', type: 'textarea', required: true,
    placeholder: '["east","center"]' },
  { key: 'dropResources',      label: 'Drops (JSON)',                type: 'textarea', required: true,
    placeholder: '[{"resourceId":"slime","chance":0.8,"minAmount":1,"maxAmount":3}]' },
  { key: 'huntSuccessRate',    label: 'Taux succès chasse (JSON)',   type: 'textarea', required: true,
    placeholder: '[{"chasseurLevel":1,"successRate":0.20},{"chasseurLevel":5,"successRate":0.65}]' },
  { key: 'familiarBonus',      label: 'Bonus familier (JSON ou null)',type: 'textarea', required: false,
    placeholder: '{"resourceId":"gel_slime","amountPerMin":2}' },
  { key: 'successMessages',    label: 'Messages succès (JSON)',      type: 'textarea', required: true,
    placeholder: '["Bien joué ! Tu as vaincu la créature !"]' },
  { key: 'failMessages',       label: 'Messages échec (JSON)',       type: 'textarea', required: true,
    placeholder: '["La créature s\'est échappée... mais tu progresses !"]' },
  { key: 'bossRespawnHoursMin',label: 'Respawn min (h, boss only)',  type: 'number',   required: false },
  { key: 'bossRespawnHoursMax',label: 'Respawn max (h, boss only)',  type: 'number',   required: false },
]

// Table Supabase : 'game_creatures'
// Colonnes affichées dans DataTable :
// emoji | name | rarity | difficulty | isBoss | isFamiliar
```

---

### Mise à jour `src/pages/AdminPage.tsx`

Ajouter les deux nouvelles sections dans le layout admin :

```tsx
// Ajouter dans SECTIONS :
{ id: 'creatures', label: 'Créatures', emoji: '🐉' },
{ id: 'map',       label: 'Carte',     emoji: '🗺️' },

// Ajouter les imports :
import { CreaturesAdmin } from './admin/CreaturesAdmin'
import { MapAdmin } from './admin/MapAdmin'

// Ajouter dans le switch :
case 'creatures': return <CreaturesAdmin />
case 'map':       return <MapAdmin />
```

---

### Mise à jour `src/stores/useGameDataStore.ts`

Charger les créatures depuis Supabase au démarrage :

```typescript
// Ajouter dans l'interface GameDataState :
creatures: Creature[]

// Ajouter dans LOCAL_DEFAULTS :
creatures: []  // pas de créatures en local — toujours depuis Supabase

// Ajouter dans loadFromSupabase() :
const creaturesRes = await supabase.from('game_creatures').select('data').order('id')
const creatures = creaturesRes.data?.map((r) => r.data) as Creature[] ?? []
// Ajouter creatures dans le setState final

// Ajouter l'export :
export const CREATURES = []  // sera peuplé dynamiquement depuis useGameDataStore
```

---

## Critères de succès

### Tables Supabase
- [ ] `game_creatures` existe avec les bonnes RLS policies
- [ ] `game_map` existe avec index sur (x, y)
- [ ] `save_map` existe avec RLS par user_id

### Section Créatures admin
- [ ] La section "🐉 Créatures" apparaît dans la sidebar admin
- [ ] Liste vide au départ avec bouton "Ajouter"
- [ ] Ajouter un Slime → apparaît dans la liste
- [ ] Les champs JSON (dropResources, huntSuccessRate...) s'éditent en textarea
- [ ] Modifier / Supprimer fonctionnent

### Interface carte admin
- [ ] La grille 31×31 s'affiche avec les cases colorées selon leur rareté
- [ ] La case (15,15) est en or (case de départ)
- [ ] Cliquer sur une case vide → formulaire avec tous les champs
- [ ] Sélectionner Biome = Marais → dropdown Créatures filtre les créatures marais
- [ ] Sélectionner une créature → difficulté mise à jour automatiquement
- [ ] Dropdown Ressources filtre selon le biome sélectionné
- [ ] Quota journalier modifiable par ressource
- [ ] Sauvegarder → case colorée dans la grille selon sa rareté
- [ ] Vider → case redevient grise

### Données
- [ ] `useGameDataStore` charge les créatures depuis Supabase
- [ ] `npm run build` passe sans erreur TypeScript

## Notes pour la suite
- `useMapStore` (prompt 016) lira `game_map` pour construire la grille côté joueur
- `useBestiaryStore` (prompt 018) lira `game_creatures` pour les expéditions de chasse
- Le `save_map` par joueur sera géré par `useMapStore` + `useSaveManager`
- Les ressources dans `game_resources` n'ont pas encore de champ `compatibleBiomes` —
  le filtre dans `TileForm` utilise pour l'instant le champ `region` existant
  comme proxy. Un prompt futur pourra enrichir les ressources avec `compatibleBiomes`.
