import { useState, useEffect } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { DataTable } from '../../components/admin/DataTable'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { useToast } from '../../components/shared/ToastManager'
import type { Resource } from '../../types/game'

const RESOURCE_FIELDS: FormField[] = [
  { key: 'id',               label: 'ID (snake_case)',     type: 'text',    required: true, placeholder: 'ex: herbe_magique' },
  { key: 'name',             label: 'Nom affiché',         type: 'text',    required: true, placeholder: 'ex: Herbe Magique' },
  { key: 'emoji',            label: 'Emoji',               type: 'text',    required: true, placeholder: 'ex: 🌿' },
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
      { value: 'common',   label: 'Commun' },
      { value: 'uncommon', label: 'Peu commun' },
      { value: 'rare',     label: 'Rare' },
      { value: 'epic',     label: 'Épique' },
    ]
  },
  { key: 'rarityLabel',      label: 'Rareté (affiché)',    type: 'text',    required: true, placeholder: 'ex: Commun' },
  { key: 'baseYieldPerMin',  label: 'Production/min',      type: 'number',  required: true },
  { key: 'tooltip',          label: 'Tooltip (1 phrase)',  type: 'textarea', required: true },
]

export function ResourcesAdmin() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<Resource | null>(null)
  const [showForm, setShowForm] = useState(false)
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

  async function handleSave(values: Record<string, any>) {
    await upsertEntry('game_resources', values.id, values)
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            🌿 Ressources
          </h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
            {resources.length} ressource{resources.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true) }}
          style={{
            padding: '9px 16px', background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '8px', color: '#00d2ff',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          + Ajouter
        </button>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <DataTable
          data={resources}
          loading={loading}
          columns={[
            { key: 'emoji', label: '', width: '40px' },
            { key: 'name', label: 'Nom' },
            { key: 'region', label: 'Région', width: '100px' },
            { key: 'rarityLabel', label: 'Rareté', width: '120px' },
            { key: 'baseYieldPerMin', label: '/min', width: '60px' },
          ]}
          onEdit={(item) => { setEditItem(item); setShowForm(true) }}
          onDelete={handleDelete}
        />
      </div>

      {showForm && (
        <AdminFormModal
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle ressource'}
          fields={RESOURCE_FIELDS}
          initialValues={editItem ?? undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}
