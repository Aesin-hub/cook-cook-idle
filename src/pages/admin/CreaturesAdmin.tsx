import { useState, useEffect, useMemo } from 'react'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { SpriteDropdown } from '../../components/admin/SpriteDropdown'
import { assignSprite } from '../../lib/assetService'
import { useToast } from '../../components/shared/ToastManager'
import { loadCreatures, saveCreature, deleteCreature } from '../../lib/mapAdminService'
import type { Creature } from '../../types/creature'

const JSON_FIELDS = [
  'compatibleBiomes', 'compatibleCultures', 'dropResources',
  'huntSuccessRate', 'familiarBonus', 'successMessages', 'failMessages',
]

const RARITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  common:    { color: '#8b949e', bg: 'rgba(139,148,158,0.12)', border: 'rgba(139,148,158,0.3)' },
  uncommon:  { color: '#30d158', bg: 'rgba(48,209,88,0.12)',   border: 'rgba(48,209,88,0.3)'   },
  rare:      { color: '#00d2ff', bg: 'rgba(0,210,255,0.12)',   border: 'rgba(0,210,255,0.3)'   },
  epic:      { color: '#bf5af2', bg: 'rgba(191,90,242,0.12)',  border: 'rgba(191,90,242,0.3)'  },
  legendary: { color: '#ff9500', bg: 'rgba(255,149,0,0.12)',   border: 'rgba(255,149,0,0.3)'   },
}

const CREATURE_FIELDS: FormField[] = [
  { key: 'id',                label: 'ID (snake_case)',              type: 'text',     required: true,  placeholder: 'ex: slime_vert' },
  { key: 'name',              label: 'Nom affiché',                  type: 'text',     required: true },
  { key: 'emoji',             label: 'Emoji',                        type: 'text',     required: true },
  { key: 'description',       label: 'Description',                  type: 'textarea', required: true },
  { key: 'tooltip',           label: 'Tooltip',                      type: 'textarea', required: true },
  { key: 'rarity',            label: 'Rareté',                       type: 'select',   required: true,
    options: [
      { value: 'common',    label: 'Commun' },
      { value: 'uncommon',  label: 'Peu commun' },
      { value: 'rare',      label: 'Rare' },
      { value: 'epic',      label: 'Épique' },
      { value: 'legendary', label: 'Légendaire' },
    ]
  },
  { key: 'rarityLabel',       label: 'Rareté (affiché)',             type: 'text',     required: true,  placeholder: 'ex: Commun' },
  { key: 'difficulty',        label: 'Difficulté (1-3)',             type: 'number',   required: true },
  { key: 'isBoss',            label: 'Est un boss ?',                type: 'boolean',  required: true },
  { key: 'isFamiliar',        label: 'Peut être familier ?',         type: 'boolean',  required: true },
  { key: 'captureChance',     label: 'Chance capture (0 à 1)',       type: 'number',   required: true },
  { key: 'xpOnSuccess',       label: 'XP si succès',                 type: 'number',   required: true },
  { key: 'xpOnFailure',       label: 'XP si échec',                  type: 'number',   required: false },
  { key: 'bossRespawnHoursMin', label: 'Respawn min en h (boss)',    type: 'number',   required: false },
  { key: 'bossRespawnHoursMax', label: 'Respawn max en h (boss)',    type: 'number',   required: false },
  { key: 'compatibleBiomes',  label: 'Biomes compatibles (JSON)',    type: 'textarea', required: true,
    placeholder: '["forest","swamp"]' },
  { key: 'compatibleCultures', label: 'Cultures compatibles (JSON)', type: 'textarea', required: true,
    placeholder: '["east","center"]' },
  { key: 'dropResources',     label: 'Drops (JSON)',                 type: 'textarea', required: true,
    placeholder: '[{"resourceId":"slime","chance":0.8,"minAmount":1,"maxAmount":3}]' },
  { key: 'huntSuccessRate',   label: 'Taux succès chasse (JSON)',    type: 'textarea', required: true,
    placeholder: '[{"chasseurLevel":1,"successRate":0.20}]' },
  { key: 'familiarBonus',     label: 'Bonus familier (JSON ou null)',type: 'textarea', required: false,
    placeholder: '{"resourceId":"gel_slime","amountPerMin":2}' },
  { key: 'successMessages',   label: 'Messages succès (JSON)',       type: 'textarea', required: true,
    placeholder: '["Bien joué !"]' },
  { key: 'failMessages',      label: "Messages échec (JSON)",        type: 'textarea', required: true,
    placeholder: '["La créature s\'est échappée..."]' },
]

function creatureToFormValues(c: Creature): Record<string, any> {
  const result: Record<string, any> = { ...c }
  for (const key of JSON_FIELDS) {
    result[key] = JSON.stringify((c as any)[key] ?? null, null, 2)
  }
  return result
}

export function CreaturesAdmin() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<Creature | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [spriteId, setSpriteId] = useState<string | null>(null)
  const [spriteChanged, setSpriteChanged] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRarity, setFilterRarity] = useState('all')
  const addToast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await loadCreatures()
      setCreatures(data)
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return creatures.filter((c) => {
      if (filterRarity !== 'all' && c.rarity !== filterRarity) return false
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [creatures, filterRarity, search])

  async function handleSave(values: Record<string, any>) {
    const parsed: Record<string, any> = { ...values }
    for (const key of JSON_FIELDS) {
      if (typeof parsed[key] === 'string' && parsed[key].trim() !== '') {
        try {
          parsed[key] = JSON.parse(parsed[key])
        } catch {
          throw new Error(`Le champ "${key}" n'est pas un JSON valide.`)
        }
      } else if (typeof parsed[key] === 'string') {
        parsed[key] = key === 'familiarBonus' ? null : []
      }
    }
    await saveCreature(parsed as Creature)
    if (spriteChanged) {
      await assignSprite('game_creatures', parsed.id, spriteId)
      setSpriteChanged(false)
    }
    addToast(`✅ Créature "${parsed.name}" sauvegardée !`, 'success')
    await load()
  }

  async function handleDelete(item: Creature) {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return
    try {
      await deleteCreature(item.id)
      addToast(`🗑️ "${item.name}" supprimée.`, 'info')
      await load()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const inputStyle = {
    background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '7px 10px',
    fontSize: '12px', color: '#e2e8f0', outline: 'none',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>🐉 Créatures</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
            {filtered.length} / {creatures.length} créature{creatures.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setSpriteId(null); setSpriteChanged(false); setShowForm(true) }}
          style={{ padding: '9px 16px', background: 'rgba(0,210,255,0.15)', border: '1px solid rgba(0,210,255,0.4)', borderRadius: '8px', color: '#00d2ff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >+ Ajouter</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          placeholder="🔍 Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: '160px' }}
        />
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)} style={inputStyle}>
          <option value="all">✨ Toutes raretés</option>
          <option value="common">⬜ Commun</option>
          <option value="uncommon">🟢 Peu commun</option>
          <option value="rare">🔵 Rare</option>
          <option value="epic">🟣 Épique</option>
          <option value="legendary">🟠 Légendaire</option>
        </select>
        {(filterRarity !== 'all' || search) && (
          <button
            onClick={() => { setFilterRarity('all'); setSearch('') }}
            style={{ ...inputStyle, cursor: 'pointer', color: '#636e8a', padding: '7px 12px' }}
          >✕ Reset</button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>⏳ Chargement...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>
            {creatures.length === 0 ? 'Aucune créature. Clique sur "+ Ajouter" pour commencer.' : 'Aucun résultat pour ces filtres.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['', 'Nom', 'Rareté', 'Diff.', 'Boss', 'Familier', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const rc = RARITY_COLORS[c.rarity] ?? RARITY_COLORS.common
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', fontSize: '20px', width: '40px' }}>{c.emoji}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: '#636e8a' }}>{c.id}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: 600,
                          color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`,
                        }}>
                          {c.rarityLabel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#ffd500' }}>
                        {'⭐'.repeat(c.difficulty)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: c.isBoss ? '#ff453a' : '#636e8a' }}>
                        {c.isBoss ? '💀' : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: c.isFamiliar ? '#30d158' : '#636e8a' }}>
                        {c.isFamiliar ? '🐾' : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { setEditItem(c); setSpriteId(null); setSpriteChanged(false); setShowForm(true) }}
                            style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.2)', borderRadius: '6px', color: '#00d2ff', cursor: 'pointer' }}>
                            Modifier
                          </button>
                          <button onClick={() => handleDelete(c)}
                            style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(255,68,58,0.08)', border: '1px solid rgba(255,68,58,0.2)', borderRadius: '6px', color: '#ff453a', cursor: 'pointer' }}>
                            Suppr.
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <AdminFormModal
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle créature'}
          fields={CREATURE_FIELDS}
          initialValues={editItem ? creatureToFormValues(editItem) : undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        >
          <div>
            <label style={{ fontSize: '12px', color: '#636e8a', display: 'block', marginBottom: '5px' }}>
              Sprite (optionnel)
            </label>
            <SpriteDropdown
              category="creature"
              value={spriteId}
              onChange={(id) => { setSpriteId(id); setSpriteChanged(true) }}
              fallbackEmoji={editItem?.emoji}
            />
          </div>
        </AdminFormModal>
      )}
    </div>
  )
}
