import { useState, useEffect, useMemo } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { useToast } from '../../components/shared/ToastManager'
import type { Region } from '../../types/game'

const REGION_FIELDS: FormField[] = [
  { key: 'id',               label: 'ID (snake_case)',          type: 'text',    required: true, placeholder: 'ex: foret' },
  { key: 'name',             label: 'Nom affiché',              type: 'text',    required: true },
  { key: 'emoji',            label: 'Emoji',                    type: 'text',    required: true },
  { key: 'unlocked',         label: 'Débloquée au départ',      type: 'boolean', required: true },
  { key: 'description',      label: 'Description',              type: 'textarea', required: true },
  { key: 'tooltip',          label: 'Tooltip',                  type: 'textarea', required: true },
  { key: 'unlockCondition',  label: 'Condition de déblocage',   type: 'text',    placeholder: 'ex: Crafter 10 Bouillons de Base' },
]

export function RegionsAdmin() {
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<Region | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterUnlocked, setFilterUnlocked] = useState<string>('all')
  const [search, setSearch] = useState('')
  const addToast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAll<Region>('game_regions')
      setRegions(data)
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return regions.filter((r) => {
      if (filterUnlocked === 'unlocked' && !r.unlocked) return false
      if (filterUnlocked === 'locked' && r.unlocked) return false
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [regions, filterUnlocked, search])

  async function handleSave(values: Record<string, any>) {
    await upsertEntry('game_regions', values.id, values)
    addToast(`✅ Région "${values.name}" sauvegardée !`, 'success')
    await load()
  }

  async function handleDelete(item: Region) {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return
    try {
      await deleteEntry('game_regions', item.id)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>🗺️ Régions</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
            {filtered.length} / {regions.length} région{regions.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true) }}
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
        <select value={filterUnlocked} onChange={(e) => setFilterUnlocked(e.target.value)} style={inputStyle}>
          <option value="all">🔓 Toutes</option>
          <option value="unlocked">✅ Débloquées</option>
          <option value="locked">🔒 Verrouillées</option>
        </select>
        {(filterUnlocked !== 'all' || search) && (
          <button onClick={() => { setFilterUnlocked('all'); setSearch('') }}
            style={{ ...inputStyle, cursor: 'pointer', color: '#636e8a', padding: '7px 12px' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>⏳ Chargement...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>
            {regions.length === 0 ? 'Aucune région. Lance seedGameData() dans la console.' : 'Aucun résultat.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['', 'Région', 'Statut', 'Condition de déblocage', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontSize: '22px', width: '40px' }}>{r.emoji}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: '#636e8a' }}>{r.id}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                        color: r.unlocked ? '#30d158' : '#636e8a',
                        background: r.unlocked ? 'rgba(48,209,88,0.12)' : 'rgba(99,110,138,0.12)',
                        border: `1px solid ${r.unlocked ? 'rgba(48,209,88,0.3)' : 'rgba(99,110,138,0.3)'}`,
                      }}>
                        {r.unlocked ? '✅ Débloquée' : '🔒 Verrouillée'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#8b949e', maxWidth: '240px' }}>
                      {r.unlockCondition ?? <span style={{ color: '#636e8a', fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditItem(r); setShowForm(true) }}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <AdminFormModal
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle région'}
          fields={REGION_FIELDS}
          initialValues={editItem ?? undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}
