import { useState, useEffect } from 'react'
import type { TileStatic } from '../../types/tile'
import type { Creature } from '../../types/creature'
import type { Resource } from '../../types/game'
import { TILE_RARITY_LABELS, TILE_BIOME_LABELS, TILE_CULTURE_LABELS } from '../../types/tile'
import type { TileRarity, TileBiome, TileCulture, TileDifficulty } from '../../types/map'
import { SpriteDropdown } from '../../components/admin/SpriteDropdown'

interface TileFormProps {
  tile: TileStatic
  creatures: Creature[]
  resources: Resource[]
  saving: boolean
  onSave: (tile: TileStatic, spriteId: string | null) => void
  onClear: (tile: TileStatic) => void
  onClose: () => void
}

export function TileForm({
  tile, creatures, resources, saving, onSave, onClear, onClose
}: TileFormProps) {
  const [form, setForm] = useState<TileStatic>(tile)
  const [spriteId, setSpriteId] = useState<string | null>(null)

  useEffect(() => { setForm(tile); setSpriteId(null) }, [tile.id])

  function update<K extends keyof TileStatic>(key: K, value: TileStatic[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const compatibleCreatures = creatures.filter((c) =>
    c.compatibleBiomes.includes(form.biome) &&
    c.compatibleCultures.includes(form.culture)
  )

  const compatibleResources = resources.filter((r) => {
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

  function handleCreatureSelect(creatureId: string) {
    const creature = creatures.find((c) => c.id === creatureId)
    update('creatureId', creatureId || null)
    if (creature) {
      update('difficulty', creature.difficulty)
    }
  }

  function addResource(resourceId: string) {
    if (form.resources.find((r) => r.resourceId === resourceId)) return
    update('resources', [...form.resources, { resourceId, dailyQuota: 100 }])
  }

  function updateQuota(resourceId: string, quota: number) {
    update('resources', form.resources.map((r) =>
      r.resourceId === resourceId ? { ...r, dailyQuota: quota } : r
    ))
  }

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
            {form.x === 15 && form.y === 15
              ? '⭐ Case de départ'
              : `Distance centre : ${Math.abs(form.x - 15) + Math.abs(form.y - 15)}`
            }
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
              {c.emoji} {c.name} ({c.rarityLabel}{c.isBoss ? ' — BOSS' : ''})
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
            La difficulté a été mise à jour selon la créature.
          </div>
        )}
      </div>

      {/* Ressources */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Ressources ({form.resources.length} assignées)
        </label>

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
                onChange={(e) => updateQuota(tr.resourceId, parseInt(e.target.value) || 0)}
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
            Aucune ressource compatible pour ce biome.
          </div>
        )}
      </div>

      {/* Type spécial */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Type spécial</label>
        <select
          value={form.specialType ?? ''}
          onChange={(e) => update('specialType', (e.target.value || null) as TileStatic['specialType'])}
          style={inputStyle}
        >
          <option value="">— Aucun —</option>
          <option value="ruins">🏚️ Ruines</option>
          <option value="boss_zone">💀 Zone de boss</option>
          <option value="village">🏘️ Village</option>
        </select>
      </div>

      {/* Sprite tileset */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Sprite (optionnel)</label>
        <SpriteDropdown
          category="tileset"
          value={spriteId}
          onChange={setSpriteId}
        />
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
          onClick={() => onSave(form, spriteId)}
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
