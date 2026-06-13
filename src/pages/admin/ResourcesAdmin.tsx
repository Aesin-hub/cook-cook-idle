import { useState, useEffect, useMemo } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { SpriteDropdown } from '../../components/admin/SpriteDropdown'
import { assignSprite } from '../../lib/assetService'
import { useToast } from '../../components/shared/ToastManager'
import type { Resource } from '../../types/game'

const RARITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  common:   { color: '#8b949e', bg: 'rgba(139,148,158,0.12)', border: 'rgba(139,148,158,0.3)' },
  uncommon: { color: '#30d158', bg: 'rgba(48,209,88,0.12)',   border: 'rgba(48,209,88,0.3)'   },
  rare:     { color: '#00d2ff', bg: 'rgba(0,210,255,0.12)',   border: 'rgba(0,210,255,0.3)'   },
  epic:     { color: '#bf5af2', bg: 'rgba(191,90,242,0.12)',  border: 'rgba(191,90,242,0.3)'  },
}

const REGION_LABELS: Record<string, string> = {
  foret:   '🌲 Forêt',
  caverne: '⛰️ Caverne',
  marais:  '🌿 Marais',
  plaine:  '🌾 Plaine',
}

const RESOURCE_FIELDS: FormField[] = [
  { key: 'id',               label: 'ID (snake_case)',     type: 'text',    required: true, placeholder: 'ex: herbe_magique' },
  { key: 'name',             label: 'Nom affiché',         type: 'text',    required: true },
  { key: 'emoji',            label: 'Emoji',               type: 'text',    required: true },
  { key: 'region',           label: 'Région',              type: 'select',  required: true,
    options: [
      { value: 'foret',   label: '🌲 Forêt' },
      { value: 'caverne', label: '⛰️ Caverne' },
      { value: 'marais',  label: '🌿 Marais' },
      { value: 'plaine',  label: '🌾 Plaine' },
    ]
  },
  { key: 'rarity',           label: 'Rareté (code)',       type: 'select',  required: true,
    options: [
      { value: 'common',   label: '⬜ Commun' },
      { value: 'uncommon', label: '🟢 Peu commun' },
      { value: 'rare',     label: '🔵 Rare' },
      { value: 'epic',     label: '🟣 Épique' },
    ]
  },
  { key: 'rarityLabel',      label: 'Rareté (affiché)',    type: 'text',    required: true, placeholder: 'ex: Commun' },
  { key: 'baseYieldPerMin',  label: 'Production/min',      type: 'number',  required: true },
  { key: 'tooltip',          label: 'Tooltip',             type: 'textarea', required: true },
]

export function ResourcesAdmin() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<Resource | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [spriteId, setSpriteId] = useState<string | null>(null)
  const [spriteChanged, setSpriteChanged] = useState(false)
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterRarity, setFilterRarity] = useState<string>('all')
  const [search, setSearch] = useState('')
  const addToast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAll<Resource>('game_resources')
      setResources(data)
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (filterRegion !== 'all' && r.region !== filterRegion) return false
      if (filterRarity !== 'all' && r.rarity !== filterRarity) return false
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [resources, filterRegion, filterRarity, search])

  async function handleSave(values: Record<string, any>) {
    await upsertEntry('game_resources', values.id, values)
    if (spriteChanged) {
      await assignSprite('game_resources', values.id, spriteId)
      setSpriteChanged(false)
    }
    addToast(`✅ Ressource "${values.name}" sauvegardée !`, 'success')
    await load()
  }

  async function handleDelete(item: Resource) {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return
    try {
      await deleteEntry('game_resources', item.id)
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
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>🌿 Ressources</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
            {filtered.length} / {resources.length} ressource{resources.length > 1 ? 's' : ''}
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
        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} style={inputStyle}>
          <option value="all">🗺️ Toutes les régions</option>
          <option value="foret">🌲 Forêt</option>
          <option value="caverne">⛰️ Caverne</option>
          <option value="marais">🌿 Marais</option>
          <option value="plaine">🌾 Plaine</option>
        </select>
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)} style={inputStyle}>
          <option value="all">✨ Toutes raretés</option>
          <option value="common">⬜ Commun</option>
          <option value="uncommon">🟢 Peu commun</option>
          <option value="rare">🔵 Rare</option>
          <option value="epic">🟣 Épique</option>
        </select>
        {(filterRegion !== 'all' || filterRarity !== 'all' || search) && (
          <button
            onClick={() => { setFilterRegion('all'); setFilterRarity('all'); setSearch('') }}
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
            {resources.length === 0 ? 'Aucune ressource. Lance seedGameData() dans la console.' : 'Aucun résultat pour ces filtres.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['', 'Nom', 'Région', 'Rareté', '/min', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const rc = RARITY_COLORS[r.rarity] ?? RARITY_COLORS.common
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', fontSize: '20px', width: '40px' }}>{r.emoji}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: '#636e8a' }}>{r.id}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#8b949e' }}>
                        {REGION_LABELS[r.region] ?? r.region}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: 600,
                          color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`,
                        }}>
                          {r.rarityLabel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#30d158', fontWeight: 600 }}>{r.baseYieldPerMin}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { setEditItem(r); setSpriteId(null); setSpriteChanged(false); setShowForm(true) }}
                            style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.2)', borderRadius: '6px', color: '#00d2ff', cursor: 'pointer' }}>
                            Modifier
                          </button>
                          <button onClick={() => handleDelete(r)}
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
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle ressource'}
          fields={RESOURCE_FIELDS}
          initialValues={editItem ?? undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        >
          <div>
            <label style={{ fontSize: '12px', color: '#636e8a', display: 'block', marginBottom: '5px' }}>
              Sprite (optionnel)
            </label>
            <SpriteDropdown
              category="resource"
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
