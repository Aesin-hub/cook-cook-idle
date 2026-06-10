import { useState, useEffect } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { DataTable } from '../../components/admin/DataTable'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { useToast } from '../../components/shared/ToastManager'
import type { Region } from '../../types/game'

const REGION_FIELDS: FormField[] = [
  { key: 'id',               label: 'ID (snake_case)',     type: 'text',    required: true, placeholder: 'ex: foret' },
  { key: 'name',             label: 'Nom affiché',         type: 'text',    required: true, placeholder: 'ex: Forêt' },
  { key: 'emoji',            label: 'Emoji',               type: 'text',    required: true, placeholder: 'ex: 🌲' },
  { key: 'unlocked',         label: 'Débloquée',           type: 'boolean', required: true },
  { key: 'description',      label: 'Description',         type: 'textarea', required: true },
  { key: 'tooltip',          label: 'Tooltip',             type: 'textarea', required: true },
  { key: 'unlockCondition',  label: 'Condition de déblocage', type: 'text', placeholder: 'ex: Atteindre le niveau 5' },
]

export function RegionsAdmin() {
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<Region | null>(null)
  const [showForm, setShowForm] = useState(false)
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>🗺️ Régions</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>{regions.length} région{regions.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true) }}
          style={{ padding: '9px 16px', background: 'rgba(0,210,255,0.15)', border: '1px solid rgba(0,210,255,0.4)', borderRadius: '8px', color: '#00d2ff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >+ Ajouter</button>
      </div>
      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <DataTable
          data={regions}
          loading={loading}
          columns={[
            { key: 'emoji', label: '', width: '40px' },
            { key: 'name', label: 'Nom' },
            { key: 'unlocked', label: 'Débloquée', width: '100px', render: (r) => r.unlocked ? '✅' : '🔒' },
          ]}
          onEdit={(item) => { setEditItem(item); setShowForm(true) }}
          onDelete={handleDelete}
        />
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
